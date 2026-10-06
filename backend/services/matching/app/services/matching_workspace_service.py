from collections.abc import Mapping
from uuid import UUID

from kakimetch_common.database import get_connection
from app.schemas.matching_workspace import (
    EscortOption,
    MatchingProfile,
    MatchingProfileUpdate,
    MatchingQueueItem,
)
from kakimetch_common.escort_rules import (
    get_hard_filter_issues,
    load_escorts_for_slot,
)


class ClientNotFoundError(Exception):
    pass


class TripNotFoundError(Exception):
    pass


class EscortOptionsNotAllowedError(Exception):
    pass


def get_matching_queue() -> list[MatchingQueueItem]:
    """Return accepted, escort-required appointments without sensitive identifiers."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select
                    trips.id as trip_id,
                    elderly_clients.id as elderly_id,
                    elderly_clients.name as elderly_name,
                    trips.appt_date,
                    trips.appt_time,
                    trips.destination,
                    nullif(trim(elderly_clients.dialect), '') as dialect,
                    elderly_clients.weight_kg,
                    elderly_clients.gender_preference,
                    elderly_clients.wheelchair_required
                from public.trips
                join public.elderly_clients
                    on elderly_clients.id = trips.elderly_id
                where trips.status = 'accepted'
                  and elderly_clients.escort_required = true
                  and elderly_clients.deleted_at is null
                order by trips.appt_date, trips.appt_time, elderly_clients.name
                """)
            rows: list[Mapping[str, object]] = cursor.fetchall()

    return [MatchingQueueItem.model_validate(row) for row in rows]


def update_matching_profile(
    elderly_id: UUID,
    request: MatchingProfileUpdate,
) -> MatchingProfile:
    """Update only the client fields an admin may correct during matching."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update public.elderly_clients
                set
                    dialect = %s,
                    weight_kg = %s,
                    gender_preference = %s,
                    updated_at = now()
                where id = %s
                  and deleted_at is null
                returning
                    id as elderly_id,
                    nullif(trim(dialect), '') as dialect,
                    weight_kg,
                    gender_preference
                """,
                (
                    request.dialect,
                    request.weight_kg,
                    request.gender_preference,
                    elderly_id,
                ),
            )
            client = cursor.fetchone()

    if client is None:
        raise ClientNotFoundError

    return MatchingProfile.model_validate(client)


def get_escort_options(trip_id: UUID) -> list[EscortOption]:
    """Return the escort roster with server-owned hard-filter explanations."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                    trips.escort_id,
                    trips.appt_date,
                    trips.appt_time,
                    trips.status,
                    elderly_clients.wheelchair_required
                from public.trips
                join public.elderly_clients
                    on elderly_clients.id = trips.elderly_id
                where trips.id = %s
                  and elderly_clients.deleted_at is null
                """,
                (trip_id,),
            )
            trip = cursor.fetchone()
            if trip is None:
                raise TripNotFoundError
            if trip["status"] not in ("accepted", "scheduled"):
                raise EscortOptionsNotAllowedError

            escorts: list[Mapping[str, object]] = [
                escort
                for escort in load_escorts_for_slot(
                    cursor, trip_id, trip["appt_date"], trip["appt_time"]
                )
                if escort["id"] != trip["escort_id"]
            ]

    options = [
        EscortOption(
            escort_id=escort["id"],
            name=str(escort["name"]),
            gender=escort["gender"],
            dialects=list(escort["dialects"]),
            available_days=list(escort["available_days"]),
            available_timeslot=str(escort["available_timeslot"]),
            wheelchair_handling_capable=bool(escort["wheelchair_handling_capable"]),
            issues=get_hard_filter_issues(
                trip,
                trip["appt_date"],
                trip["appt_time"],
                escort,
            ),
        )
        for escort in escorts
    ]
    return sorted(
        options, key=lambda option: (len(option.issues), option.name.casefold())
    )
