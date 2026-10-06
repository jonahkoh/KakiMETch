import os
from collections.abc import Iterable

import httpx

from kakimetch_common.database import get_connection

ASSESSMENT_API_URL = os.getenv("ASSESSMENT_API_URL", "http://localhost:8001")


def get_pending_trip_ids() -> list[str]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                select trips.id
                from public.trips
                join public.elderly_clients
                    on elderly_clients.id = trips.elderly_id
                where trips.status = 'pending'
                  and elderly_clients.escort_required = true
                order by trips.appt_date, trips.appt_time
                """)
            return [str(row["id"]) for row in cursor.fetchall()]


def assess_trips(trip_ids: Iterable[str], client: httpx.Client) -> tuple[int, int, int]:
    """Ask the assessment service to decide each trip; keep going past failures."""
    accepted = rejected = failed = 0
    for trip_id in trip_ids:
        response = client.post(f"/trips/{trip_id}/assessment")
        if response.is_error:
            failed += 1
            print(f"Assessment failed for trip {trip_id}: HTTP {response.status_code}")
        elif response.json()["decision"] == "accepted":
            accepted += 1
        else:
            rejected += 1

    return accepted, rejected, failed


if __name__ == "__main__":
    with httpx.Client(base_url=ASSESSMENT_API_URL, timeout=30) as client:
        accepted_count, rejected_count, failed_count = assess_trips(
            get_pending_trip_ids(), client
        )
    print(
        "Prepared matching demo: "
        f"{accepted_count} accepted, {rejected_count} rejected, "
        f"{failed_count} failed."
    )
