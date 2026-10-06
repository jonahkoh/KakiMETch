from collections.abc import Mapping
from datetime import date
from uuid import UUID

from psycopg2.extras import Json

from kakimetch_common.database import get_connection
from app.schemas.assessment import AssessmentResult

# MVP geographic boundary based on South West Singapore place names.
SOUTHWEST_AREA_KEYWORDS = (
    "boon lay",
    "bukit batok",
    "bukit panjang",
    "choa chu kang",
    "clementi",
    "hong kah",
    "jurong",
    "pioneer",
    "teban",
    "tengah",
    "toh guan",
    "tuas",
    "west coast",
    "yuhua",
)
VALID_MOBILITY_STATUSES = {
    "ambulant",
    "wheelchair_user",
    "walking_frame_user",
    "bed_bound",
}
VALID_AGREEMENT_STATUSES = {"Y", "Pending"}


class TripNotFoundError(Exception):
    pass


class AssessmentNotAllowedError(Exception):
    pass


def assess_client(
    client: Mapping[str, object],
    destination: str,
    assessment_date: date | None = None,
) -> AssessmentResult:
    """Apply the fixed MVP assessment rules to one referral."""
    reasons: list[str] = []
    warnings: list[str] = []
    assessment_date = assessment_date or date.today()

    if not is_southwest_destination(destination):
        reasons.append("Destination is outside the South West service area.")

    lh_mobility_status = _as_text(client.get("lh_mobility_status"))
    if lh_mobility_status == "bed_bound":
        reasons.append("LH assessment indicates the client is bed-bound.")
    elif lh_mobility_status not in VALID_MOBILITY_STATUSES:
        reasons.append("LH mobility assessment is required.")

    aic_mobility_status = _as_text(client.get("aic_mobility_status"))
    if (
        aic_mobility_status in VALID_MOBILITY_STATUSES
        and lh_mobility_status in VALID_MOBILITY_STATUSES
        and aic_mobility_status != lh_mobility_status
    ):
        warnings.append("AIC and LH mobility assessments differ.")

    effective_date = client.get("nmts_effective_date")
    expiry_date = client.get("nmts_expired_date")
    if (
        not isinstance(effective_date, date)
        or not isinstance(expiry_date, date)
        or assessment_date < effective_date
        or assessment_date > expiry_date
    ):
        reasons.append("NMTS certification is not currently valid.")

    if _as_text(client.get("lh_service_agreement")) not in VALID_AGREEMENT_STATUSES:
        reasons.append("A valid LH Service Agreement is required.")

    if _as_text(client.get("sw_service_agreement")) not in VALID_AGREEMENT_STATUSES:
        reasons.append("A valid SW Service Agreement is required.")

    decision = "rejected" if reasons else "accepted"
    return AssessmentResult(decision=decision, reasons=reasons, warnings=warnings)


def assess_trip(trip_id: UUID) -> AssessmentResult:
    """Assess a pending trip and persist its decision for frontend review."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                    trips.destination,
                    trips.status,
                    elderly_clients.aic_mobility_status,
                    elderly_clients.lh_mobility_status,
                    elderly_clients.nmts_effective_date,
                    elderly_clients.nmts_expired_date,
                    elderly_clients.lh_service_agreement,
                    elderly_clients.sw_service_agreement
                from public.trips
                join public.elderly_clients on elderly_clients.id = trips.elderly_id
                where trips.id = %s
                  and elderly_clients.deleted_at is null
                for update
                """,
                (trip_id,),
            )
            trip = cursor.fetchone()

            if trip is None:
                raise TripNotFoundError
            if trip["status"] != "pending":
                raise AssessmentNotAllowedError

            result = assess_client(trip, trip["destination"])
            cursor.execute(
                """
                update public.trips
                set
                    status = %s,
                    assessment_reasons = %s,
                    assessment_warnings = %s,
                    assessed_at = now(),
                    updated_at = now()
                where id = %s
                """,
                (result.decision, Json(result.reasons), Json(result.warnings), trip_id),
            )

    return result


def is_southwest_destination(destination: str) -> bool:
    normalized_destination = destination.casefold()
    return any(keyword in normalized_destination for keyword in SOUTHWEST_AREA_KEYWORDS)


def _as_text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""
