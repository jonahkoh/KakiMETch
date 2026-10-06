from fastapi import APIRouter

from app.schemas.trip import ScheduledTrip
from app.services.scheduling_service import get_scheduled_trips

router = APIRouter(tags=["schedule"])


@router.get("/schedule", response_model=list[ScheduledTrip])
def get_schedule() -> list[ScheduledTrip]:
    """Return confirmed trips for the frontend schedule view."""
    return get_scheduled_trips()
