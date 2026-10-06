from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.match import MatchResult
from app.services.matching_service import (
    MatchingNotAllowedError,
    TripNotFoundError,
    get_escort_suggestions,
)

router = APIRouter(prefix="/trips", tags=["matches"])


@router.get("/{trip_id}/escort-suggestions", response_model=MatchResult)
def get_match_suggestions(
    trip_id: UUID,
    limit: int = Query(default=3, ge=1, le=10),
) -> MatchResult:
    try:
        return get_escort_suggestions(trip_id, limit)
    except TripNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        ) from error
    except MatchingNotAllowedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted trips can be matched with escorts.",
        ) from error
