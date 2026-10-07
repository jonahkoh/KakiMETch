from collections.abc import Mapping
from uuid import UUID

from kakimetch_common.database import get_connection
from app.schemas.trip import (
    ConfirmEscortRequest,
    ScheduledTrip,
    TripCancellation,
    TripConfirmation,
)
from kakimetch_common.escort_rules import (
    get_hard_filter_issues,
    load_escorts_for_slot,
)


class TripNotFoundError(Exception):
    pass


class ConfirmationNotAllowedError(Exception):
    pass


class EscortNotFoundError(Exception):
    pass


class AssignmentOverrideRequiredError(Exception):
    def __init__(self, issues: list[str]) -> None:
        self.issues = issues


def confirm_escort(
    trip_id: UUID,
    request: ConfirmEscortRequest,
) -> TripConfirmation:
    """Confirm an admin-selected escort after a final, transaction-safe conflict check."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                    trips.appt_date,
                    trips.appt_time,
                    trips.status,
                    elderly_clients.wheelchair_required
                from public.trips
                join public.elderly_clients on elderly_clients.id = trips.elderly_id
                where trips.id = %s
                  and elderly_clients.deleted_at is null
                for update of trips
                """,
                (trip_id,),
            )
            trip = cursor.fetchone()
            if trip is None:
                raise TripNotFoundError
            if trip["status"] not in ("accepted", "scheduled"):
                raise ConfirmationNotAllowedError

            escort = next(
                iter(
                    load_escorts_for_slot(
                        cursor,
                        trip_id,
                        trip["appt_date"],
                        trip["appt_time"],
                        escort_id=request.escort_id,
                    )
                ),
                None,
            )
            if escort is None:
                raise EscortNotFoundError

            issues = get_hard_filter_issues(
                trip,
                trip["appt_date"],
                trip["appt_time"],
                escort,
            )
            if issues and not request.assignment_override:
                raise AssignmentOverrideRequiredError(issues)

            cursor.execute(
                """
                update public.trips
                set
                    escort_id = %s,
                    status = 'scheduled',
                    assignment_override = %s,
                    assignment_override_reason = %s,
                    confirmed_at = now(),
                    updated_at = now()
                where id = %s
                """,
                (
                    request.escort_id,
                    request.assignment_override,
                    request.assignment_override_reason,
                    trip_id,
                ),
            )

    return TripConfirmation(
        trip_id=trip_id,
        escort_id=request.escort_id,
        status="scheduled",
        assignment_override=request.assignment_override,
    )


def get_scheduled_trips() -> list[ScheduledTrip]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select
                    trips.id as trip_id,
                    elderly_clients.id as elderly_id,
                    elderly_clients.name as elderly_name,
                    escorts.id as escort_id,
                    escorts.name as escort_name,
                    trips.appt_date,
                    trips.appt_time,
                    trips.destination,
                    nullif(trim(elderly_clients.dialect), '') as dialect,
                    elderly_clients.weight_kg,
                    elderly_clients.gender_preference,
                    elderly_clients.wheelchair_required
                from public.trips
                join public.elderly_clients on elderly_clients.id = trips.elderly_id
                join public.escorts on escorts.id = trips.escort_id
                where trips.status = 'scheduled'
                  and elderly_clients.deleted_at is null
                order by trips.appt_date, trips.appt_time, elderly_clients.name
                """)
            trips: list[Mapping[str, object]] = cursor.fetchall()

    return [ScheduledTrip.model_validate(trip) for trip in trips]


def cancel_assignment(trip_id: UUID) -> TripCancellation:
    """Free up a scheduled trip's escort and return it to the matching queue."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select status
                from public.trips
                where id = %s
                for update
                """,
                (trip_id,),
            )
            trip = cursor.fetchone()
            if trip is None:
                raise TripNotFoundError
            if trip["status"] != "scheduled":
                raise ConfirmationNotAllowedError

            cursor.execute(
                """
                update public.trips
                set
                    status = 'accepted',
                    escort_id = null,
                    assignment_override = false,
                    assignment_override_reason = null,
                    updated_at = now()
                where id = %s
                returning id as trip_id, status
                """,
                (trip_id,),
            )
            updated = cursor.fetchone()

    return TripCancellation.model_validate(updated)
