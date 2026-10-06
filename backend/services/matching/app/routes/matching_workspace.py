from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.schemas.matching_workspace import (
    EscortOption,
    MatchingProfile,
    MatchingProfileUpdate,
    MatchingQueueItem,
)
from app.services.matching_workspace_service import (
    ClientNotFoundError,
    EscortOptionsNotAllowedError,
    TripNotFoundError,
    get_escort_options,
    get_matching_queue,
    update_matching_profile,
)

router = APIRouter(tags=["matching workspace"])


@router.get("/matching-queue", response_model=list[MatchingQueueItem])
def get_matching_queue_endpoint() -> list[MatchingQueueItem]:
    return get_matching_queue()


@router.patch(
    "/elderly-clients/{elderly_id}/matching-profile",
    response_model=MatchingProfile,
)
def update_matching_profile_endpoint(
    elderly_id: UUID,
    request: MatchingProfileUpdate,
) -> MatchingProfile:
    try:
        return update_matching_profile(elderly_id, request)
    except ClientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        ) from error


@router.get(
    "/trips/{trip_id}/escort-options",
    response_model=list[EscortOption],
)
def get_escort_options_endpoint(trip_id: UUID) -> list[EscortOption]:
    try:
        return get_escort_options(trip_id)
    except TripNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        ) from error
    except EscortOptionsNotAllowedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Escort options are only available for accepted trips.",
        ) from error
