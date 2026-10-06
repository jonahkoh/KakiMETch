from typing import Annotated, Literal
from uuid import UUID
from datetime import date, time

from pydantic import BaseModel, Field, field_validator

GenderPreference = Literal["M", "F"]
WeightKg = Annotated[float, Field(gt=0, le=999.99)]


class MatchingQueueItem(BaseModel):
    trip_id: UUID
    elderly_id: UUID
    elderly_name: str
    appt_date: date
    appt_time: time
    destination: str
    dialect: str | None
    weight_kg: float | None
    gender_preference: GenderPreference | None
    wheelchair_required: bool


class MatchingProfileUpdate(BaseModel):
    dialect: str | None
    weight_kg: WeightKg | None
    gender_preference: GenderPreference | None

    @field_validator("dialect")
    @classmethod
    def normalize_dialect(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        if not normalized:
            return None
        if len(normalized) > 100:
            raise ValueError("Dialect must be 100 characters or fewer.")
        return normalized


class MatchingProfile(BaseModel):
    elderly_id: UUID
    dialect: str | None
    weight_kg: float | None
    gender_preference: GenderPreference | None


class EscortOption(BaseModel):
    escort_id: UUID
    name: str
    gender: Literal["M", "F"]
    dialects: list[str]
    available_days: list[str]
    available_timeslot: str
    wheelchair_handling_capable: bool
    issues: list[str]
