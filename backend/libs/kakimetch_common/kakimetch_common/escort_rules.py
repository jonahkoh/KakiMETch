from collections.abc import Mapping
from typing import Any
from datetime import date, datetime, time
import re

TIMESLOT_PATTERN = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
    re.IGNORECASE,
)


def get_hard_filter_issues(
    client: Mapping[str, object],
    appt_date: date,
    appt_time: time,
    escort: Mapping[str, object],
) -> list[str]:
    """Return every hard constraint an escort fails for a specific appointment."""
    issues: list[str] = []

    if escort.get("has_conflict"):
        issues.append("Escort already has a scheduled trip at this appointment time.")
    if not is_available(escort, appt_date, appt_time):
        issues.append("Escort is unavailable at this appointment time.")
    if client.get("wheelchair_required") and not escort.get(
        "wheelchair_handling_capable"
    ):
        issues.append("Escort cannot provide required wheelchair handling.")

    return issues


def load_escorts_for_slot(
    cursor: Any,
    trip_id: object,
    appt_date: date,
    appt_time: time,
    escort_id: object = None,
) -> list[Mapping[str, object]]:
    """Load escorts with `has_conflict`: already scheduled on another trip at this slot.

    With `escort_id`, load only that escort and row-lock it, so concurrent
    confirmations for the same escort run in order.
    """
    # ponytail: a conflict is an identical date+time; switch to overlapping ranges
    # once trips carry a duration.
    cursor.execute(
        f"""
        select
            escorts.id,
            escorts.name,
            escorts.gender,
            escorts.dialects,
            escorts.available_days,
            escorts.available_timeslot,
            escorts.wheelchair_handling_capable,
            exists (
                select 1
                from public.trips assigned_trips
                where assigned_trips.escort_id = escorts.id
                  and assigned_trips.appt_date = %s
                  and assigned_trips.appt_time = %s
                  and assigned_trips.status = 'scheduled'
                  and assigned_trips.id <> %s
            ) as has_conflict
        from public.escorts as escorts
        {"where escorts.id = %s for update" if escort_id is not None else ""}
        """,
        (appt_date, appt_time, trip_id)
        + ((escort_id,) if escort_id is not None else ()),
    )
    return cursor.fetchall()


def is_available(
    escort: Mapping[str, object], appt_date: date, appt_time: time
) -> bool:
    available_days = _as_text_set(escort.get("available_days"))
    if appt_date.strftime("%a").casefold() not in available_days:
        return False

    timeslot = _parse_timeslot(_as_text(escort.get("available_timeslot")))
    if timeslot is None:
        return False

    start_time, end_time = timeslot
    return start_time <= appt_time <= end_time


def _parse_timeslot(timeslot: str) -> tuple[time, time] | None:
    match = TIMESLOT_PATTERN.search(timeslot)
    if match is None:
        return None

    return (_parse_clock_time(match.group(1)), _parse_clock_time(match.group(2)))


def _parse_clock_time(value: str) -> time:
    normalized_value = value.replace(" ", "").upper()
    time_format = "%I:%M%p" if ":" in normalized_value else "%I%p"
    return datetime.strptime(normalized_value, time_format).time()


def _as_text_set(value: object) -> set[str]:
    if not isinstance(value, (list, tuple)):
        return set()

    return {_as_text(item).casefold() for item in value if _as_text(item)}


def _as_text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""
