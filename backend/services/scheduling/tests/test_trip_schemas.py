from uuid import uuid4

import pytest
from pydantic import ValidationError

from datetime import date, time

from app.schemas.trip import ConfirmEscortRequest, TripCreate


def test_override_requires_a_reason():
    with pytest.raises(ValidationError, match="Override reason is required"):
        ConfirmEscortRequest(escort_id=uuid4(), assignment_override=True)


def test_override_accepts_a_reason():
    request = ConfirmEscortRequest(
        escort_id=uuid4(),
        assignment_override=True,
        assignment_override_reason="Escort agreed to cover the appointment.",
    )

    assert request.assignment_override is True


def test_trip_requires_appointment_specific_pickup_address():
    with pytest.raises(ValidationError, match="Pickup and destination"):
        TripCreate(
            elderly_id=uuid4(),
            appt_date=date(2026, 10, 7),
            appt_time=time(8, 30),
            pickup_address="   ",
            destination="National University Hospital",
            return_ready_time=time(11),
        )
