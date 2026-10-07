from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.schemas.trip import (
    ConfirmEscortRequest,
    TripCancellation,
    TripConfirmation,
    TripCreate,
    TripCreated,
)
from app.services.scheduling_service import (
    AssignmentOverrideRequiredError,
    ConfirmationNotAllowedError,
    EscortNotFoundError,
    TripNotFoundError,
    cancel_assignment,
    confirm_escort,
)
from app.services.trip_service import (
    PatientNotFoundError,
    create_trip,
)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripCreated, status_code=status.HTTP_201_CREATED)
def create_trip_endpoint(request: TripCreate) -> TripCreated:
    try:
        return create_trip(request)
    except PatientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        ) from error


@router.post("/{trip_id}/confirm-escort", response_model=TripConfirmation)
def confirm_escort_endpoint(
    trip_id: UUID,
    request: ConfirmEscortRequest,
) -> TripConfirmation:
    try:
        return confirm_escort(trip_id, request)
    except TripNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        ) from error
    except EscortNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escort not found.",
        ) from error
    except ConfirmationNotAllowedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted trips can be scheduled.",
        ) from error
    except AssignmentOverrideRequiredError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "This assignment needs an override reason.",
                "issues": error.issues,
            },
        ) from error


@router.post("/{trip_id}/cancel-assignment", response_model=TripCancellation)
def cancel_assignment_endpoint(trip_id: UUID) -> TripCancellation:
    try:
        return cancel_assignment(trip_id)
    except TripNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        ) from error
    except ConfirmationNotAllowedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only scheduled trips can have their assignment cancelled.",
        ) from error
