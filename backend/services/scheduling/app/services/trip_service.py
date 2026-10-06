import psycopg2

from kakimetch_common.database import get_connection
from app.schemas.trip import TripCreate, TripCreated


class PatientNotFoundError(Exception):
    pass


def create_trip(request: TripCreate) -> TripCreated:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into public.trips (
                        elderly_id,
                        appt_date,
                        appt_time,
                        destination
                    )
                    values (
                        %(elderly_id)s,
                        %(appt_date)s,
                        %(appt_time)s,
                        %(destination)s
                    )
                    returning
                        id as trip_id,
                        elderly_id,
                        appt_date,
                        appt_time,
                        destination,
                        status
                    """,
                    request.model_dump(),
                )

                trip = cursor.fetchone()

    except psycopg2.errors.ForeignKeyViolation as error:
        raise PatientNotFoundError from error

    return TripCreated.model_validate(trip)
