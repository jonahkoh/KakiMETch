from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

GenderPreference = Literal["M", "F"]


MobilityStatus = Literal[
    "ambulant", "wheelchair_user", "walking_frame_user", "bed_bound", "unknown"
]
ServiceAgreementStatus = Literal["Y", "N", "Pending"]


class PatientSummary(BaseModel):
    id: UUID
    name: str
    nric: str | None
    postal_code: str | None
    nmtr_percentage: float | None
    escort_required: bool
    last_visit: date | None
    deleted_at: datetime | None = None


class PatientDetail(BaseModel):
    id: UUID
    name: str
    nric: str | None
    aic_registration_no: str | None
    postal_code: str | None
    block: str | None
    unit: str | None
    street_name: str | None
    address: str | None
    contact_no: str | None
    caregiver_name: str | None
    escort_required: bool
    co_payment: float | None
    date_of_birth: date | None
    nmts_effective_date: date | None
    nmts_expired_date: date | None
    date_of_entry: date | None
    action_updated_date: str | None
    lh_service_agreement: ServiceAgreementStatus | None
    sw_service_agreement: ServiceAgreementStatus | None
    wheelchair_required: bool
    walking_frame_required: bool
    caregiver_or_maid_available: bool | None
    gender: Literal["M", "F"] | None
    gender_preference: GenderPreference | None
    address_source: str | None
    dialect: str | None
    weight_kg: float | None
    nmtr_percentage: float | None
    aic_mobility_status: MobilityStatus
    lh_mobility_status: MobilityStatus
    last_visit: date | None
    deleted_at: datetime | None = None


class PatientWrite(BaseModel):
    name: str
    nric: str | None = None
    aic_registration_no: str | None = None
    postal_code: str | None = None
    block: str | None = None
    unit: str | None = None
    street_name: str | None = None
    contact_no: str | None = None
    caregiver_name: str | None = None
    escort_required: bool = False
    co_payment: float | None = Field(default=None, ge=0)
    date_of_birth: date | None = None
    nmts_effective_date: date | None = None
    nmts_expired_date: date | None = None
    date_of_entry: date | None = None
    action_updated_date: str | None = None
    lh_service_agreement: ServiceAgreementStatus | None = None
    sw_service_agreement: ServiceAgreementStatus | None = None
    wheelchair_required: bool = False
    walking_frame_required: bool = False
    caregiver_or_maid_available: bool | None = None
    gender: Literal["M", "F"] | None = None
    gender_preference: GenderPreference | None = None
    address_source: str | None = None
    dialect: str | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=999.99)
    nmtr_percentage: float | None = Field(default=None, ge=0, le=1)
    aic_mobility_status: MobilityStatus = "unknown"
    lh_mobility_status: MobilityStatus = "unknown"

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name is required.")
        return normalized

    @field_validator(
        "nric",
        "aic_registration_no",
        "postal_code",
        "block",
        "unit",
        "street_name",
        "contact_no",
        "caregiver_name",
        "action_updated_date",
        "address_source",
        "dialect",
    )
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ImportSummary(BaseModel):
    imported_count: int
    skipped_count: int
