from collections.abc import Mapping, Sequence
from datetime import date, time
from uuid import UUID

from kakimetch_common.database import get_connection
from kakimetch_common.escort_rules import (
    _as_text,
    _as_text_set,
    get_hard_filter_issues,
    load_escorts_for_slot,
)
from app.schemas.match import EscortSuggestion, MatchResult

DIALECT_MATCH_SCORE = 2
GENDER_MATCH_SCORE = 1


class TripNotFoundError(Exception):
    pass


class MatchingNotAllowedError(Exception):
    pass


def rank_escorts(
    client: Mapping[str, object],
    appt_date: date,
    appt_time: time,
    escorts: Sequence[Mapping[str, object]],
    limit: int = 3,
) -> MatchResult:
    """Hard-filter escort candidates, then rank survivors with simple match scores."""
    suggestions: list[EscortSuggestion] = []

    for escort in escorts:
        if get_hard_filter_issues(client, appt_date, appt_time, escort):
            continue

        score = 0
        flairs: list[str] = []
        if client.get("wheelchair_required"):
            flairs.append("Wheelchair capable")

        client_dialect = _as_text(client.get("dialect"))
        escort_dialects = _as_text_set(escort.get("dialects"))
        if client_dialect and client_dialect.casefold() in escort_dialects:
            score += DIALECT_MATCH_SCORE
            flairs.append(f"Speaks {client_dialect}")

        gender_preference = _as_text(client.get("gender_preference"))
        escort_gender = _as_text(escort.get("gender"))
        if gender_preference and escort_gender == gender_preference:
            score += GENDER_MATCH_SCORE
            flairs.append("Gender preference met")

        suggestions.append(
            EscortSuggestion(
                escort_id=str(escort["id"]),
                name=_as_text(escort.get("name")),
                gender=escort_gender,
                score=score,
                flairs=flairs,
            )
        )

    suggestions.sort(
        key=lambda suggestion: (-suggestion.score, suggestion.name.casefold())
    )
    suggestions = suggestions[:limit]
    warning = None
    if not suggestions:
        warning = "No viable escort is available. An admin can assign an escort with an override reason."

    return MatchResult(suggestions=suggestions, warning=warning)


def get_escort_suggestions(trip_id: UUID, limit: int = 3) -> MatchResult:
    """Load an accepted trip and return its ranked escort suggestions."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                    trips.escort_id,
                    trips.appt_date,
                    trips.appt_time,
                    trips.status,
                    elderly_clients.dialect,
                    elderly_clients.gender_preference,
                    elderly_clients.wheelchair_required,
                    elderly_clients.escort_required
                from public.trips
                join public.elderly_clients on elderly_clients.id = trips.elderly_id
                where trips.id = %s
                  and elderly_clients.deleted_at is null
                """,
                (trip_id,),
            )
            trip = cursor.fetchone()
            if trip is None:
                raise TripNotFoundError
            if trip["status"] not in ("accepted", "scheduled"):
                raise MatchingNotAllowedError
            if not trip["escort_required"]:
                return MatchResult(
                    suggestions=[],
                    warning="This trip does not require an escort.",
                )

            escorts = [
                escort
                for escort in load_escorts_for_slot(
                    cursor, trip_id, trip["appt_date"], trip["appt_time"]
                )
                if escort["id"] != trip["escort_id"]
            ]

    return rank_escorts(trip, trip["appt_date"], trip["appt_time"], escorts, limit)
