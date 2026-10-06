from datetime import date, time

from kakimetch_common.escort_rules import get_hard_filter_issues, load_escorts_for_slot

TUESDAY = date(2026, 9, 1)
TEN_AM = time(10, 0)
ESCORT = {
    "available_days": ["Tue"],
    "available_timeslot": "9am-1pm",
    "wheelchair_handling_capable": False,
    "has_conflict": False,
}


def issues(client=None, appt_time=TEN_AM, **escort_changes):
    return get_hard_filter_issues(
        client or {}, TUESDAY, appt_time, {**ESCORT, **escort_changes}
    )


def test_available_escort_has_no_issues():
    assert issues() == []


def test_escort_off_that_day_is_unavailable():
    assert issues(available_days=["Wed"]) == [
        "Escort is unavailable at this appointment time."
    ]


def test_appointment_outside_timeslot_is_unavailable():
    assert issues(appt_time=time(14, 0)) == [
        "Escort is unavailable at this appointment time."
    ]


def test_wheelchair_client_needs_capable_escort():
    assert issues({"wheelchair_required": True}) == [
        "Escort cannot provide required wheelchair handling."
    ]


def test_conflicting_trip_is_reported():
    assert issues(has_conflict=True) == [
        "Escort already has a scheduled trip at this appointment time."
    ]


class RecordingCursor:
    def execute(self, sql, params):
        self.sql, self.params = sql, params

    def fetchall(self):
        return []


def test_single_escort_load_is_filtered_and_row_locked():
    cursor = RecordingCursor()

    load_escorts_for_slot(cursor, "trip-1", TUESDAY, TEN_AM, escort_id="escort-1")

    assert "where escorts.id = %s for update" in cursor.sql
    assert cursor.params == (TUESDAY, TEN_AM, "trip-1", "escort-1")


def test_roster_load_is_unfiltered_and_unlocked():
    cursor = RecordingCursor()

    load_escorts_for_slot(cursor, "trip-1", TUESDAY, TEN_AM)

    assert "for update" not in cursor.sql
    assert cursor.params == (TUESDAY, TEN_AM, "trip-1")
