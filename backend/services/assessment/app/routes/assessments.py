from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.schemas.assessment import AssessmentResult
from app.services.assessment_service import (
    AssessmentNotAllowedError,
    TripNotFoundError,
    assess_trip,
)

router = APIRouter(prefix="/trips", tags=["assessments"])


@router.post("/{trip_id}/assessment", response_model=AssessmentResult)
def assess_trip_endpoint(trip_id: UUID) -> AssessmentResult:
    try:
        return assess_trip(trip_id)
    except TripNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        ) from error
    except AssessmentNotAllowedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending trips can be assessed.",
        ) from error
