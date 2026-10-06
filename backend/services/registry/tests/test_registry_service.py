from contextlib import contextmanager
from uuid import uuid4

from app.services import registry_service


class FakeCursor:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.current = None
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))
        self.current = next(self.responses)

    def fetchone(self):
        return self.current

    def fetchall(self):
        return self.current


class FakeConnection:
    def __init__(self, cursor):
        self.fake_cursor = cursor

    def cursor(self):
        return self.fake_cursor


def install_fake_connection(monkeypatch, responses):
    cursor = FakeCursor(responses)

    @contextmanager
    def fake_get_connection():
        yield FakeConnection(cursor)

    monkeypatch.setattr(registry_service, "get_connection", fake_get_connection)
    return cursor


def test_registry_hides_soft_deleted_patients(monkeypatch):
    cursor = install_fake_connection(monkeypatch, [[]])

    assert registry_service.get_patients() == []

    query = " ".join(cursor.executed[0][0].split()).casefold()
    assert "deleted_at is null" in query


def test_registry_can_list_soft_deleted_patients(monkeypatch):
    cursor = install_fake_connection(monkeypatch, [[]])

    assert registry_service.get_patients(deleted=True) == []

    query = " ".join(cursor.executed[0][0].split()).casefold()
    assert "deleted_at is not null" in query


def test_delete_patient_marks_deleted_at(monkeypatch):
    patient_id = uuid4()
    cursor = install_fake_connection(monkeypatch, [{"id": patient_id}])

    registry_service.delete_patient(patient_id)

    query = " ".join(cursor.executed[0][0].split()).casefold()
    assert "set deleted_at = now()" in query
    assert "deleted_at is null" in query
    assert cursor.executed[0][1] == (patient_id,)


def test_restore_patient_clears_deleted_at(monkeypatch):
    patient_id = uuid4()
    cursor = install_fake_connection(
        monkeypatch,
        [
            {"id": patient_id},
            {
                "id": patient_id,
                "name": "Mdm Lim Siew Hoon",
                "nric": None,
                "aic_registration_no": None,
                "postal_code": None,
                "block": None,
                "unit": None,
                "street_name": None,
                "address": None,
                "contact_no": None,
                "caregiver_name": None,
                "escort_required": False,
                "co_payment": None,
                "date_of_birth": None,
                "nmts_effective_date": None,
                "nmts_expired_date": None,
                "date_of_entry": None,
                "action_updated_date": None,
                "lh_service_agreement": None,
                "sw_service_agreement": None,
                "wheelchair_required": False,
                "walking_frame_required": False,
                "caregiver_or_maid_available": None,
                "gender": None,
                "gender_preference": None,
                "address_source": None,
                "dialect": None,
                "weight_kg": None,
                "nmtr_percentage": None,
                "aic_mobility_status": "unknown",
                "lh_mobility_status": "unknown",
                "last_visit": None,
                "deleted_at": None,
            },
        ],
    )

    assert registry_service.restore_patient(patient_id).id == patient_id

    query = " ".join(cursor.executed[0][0].split()).casefold()
    assert "set deleted_at = null" in query
    assert "deleted_at is not null" in query
