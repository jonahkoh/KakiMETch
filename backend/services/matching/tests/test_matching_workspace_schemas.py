from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.matching_workspace import MatchingProfileUpdate


def test_matching_profile_normalizes_dialect():
    request = MatchingProfileUpdate(
        dialect="  Hokkien  ",
        weight_kg=62.5,
        gender_preference="F",
    )

    assert request.dialect == "Hokkien"


def test_matching_profile_treats_blank_dialect_as_missing():
    request = MatchingProfileUpdate(
        dialect="   ",
        weight_kg=None,
        gender_preference=None,
    )

    assert request.dialect is None


@pytest.mark.parametrize("weight", [0, -1, 1000])
def test_matching_profile_rejects_invalid_weight(weight):
    with pytest.raises(ValidationError):
        MatchingProfileUpdate(
            dialect="Hokkien",
            weight_kg=weight,
            gender_preference=None,
        )
