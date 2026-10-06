from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.trip import ConfirmEscortRequest


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
