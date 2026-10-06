from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.trip import ScheduledTrip
from app.schemas.vehicle_schedule import (
    DaySchedule,
    ManualPlanUpdate,
    OptimiseScheduleRequest,
    ReturnReadyUpdate,
    RoutePlan,
)
from app.services.route_optimizer import NoFeasibleRouteError
from app.services.scheduling_service import get_scheduled_trips
from app.services.vehicle_schedule_service import (
    IncompleteAppointmentError,
    InvalidManualPlanError,
    RoutePlanNotFoundError,
    ScheduleAppointmentNotFoundError,
    delete_schedule_appointment,
    get_day_schedule,
    optimise_day,
    update_manual_plan,
    update_return_ready_time,
)

router = APIRouter(tags=["schedule"])


@router.get("/schedule", response_model=list[ScheduledTrip])
def get_schedule() -> list[ScheduledTrip]:
    """Return confirmed trips for the frontend schedule view."""
    return get_scheduled_trips()


@router.get("/schedule/day", response_model=DaySchedule)
def get_vehicle_day_schedule(service_date: date) -> DaySchedule:
    return get_day_schedule(service_date)


@router.post("/schedule/optimise", response_model=RoutePlan)
def optimise_vehicle_schedule(request: OptimiseScheduleRequest) -> RoutePlan:
    try:
        return optimise_day(request.service_date)
    except IncompleteAppointmentError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Every appointment needs a pickup address and estimated return-ready time.",
                "issues": error.patient_names,
            },
        ) from error
    except NoFeasibleRouteError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error


@router.put("/schedule/plans/{plan_id}", response_model=RoutePlan)
def save_manual_vehicle_schedule(
    plan_id: UUID,
    update: ManualPlanUpdate,
) -> RoutePlan:
    try:
        return update_manual_plan(plan_id, update)
    except RoutePlanNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route plan not found.",
        ) from error
    except InvalidManualPlanError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The manual plan must contain every allocated appointment exactly once.",
        ) from error


@router.delete(
    "/schedule/appointments/{trip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_schedule_appointment(trip_id: UUID) -> Response:
    try:
        delete_schedule_appointment(trip_id)
    except ScheduleAppointmentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/schedule/appointments/{trip_id}/return-ready",
    status_code=status.HTTP_204_NO_CONTENT,
)
def set_return_ready_time(trip_id: UUID, update: ReturnReadyUpdate) -> Response:
    try:
        update_return_ready_time(trip_id, update.return_ready_time)
    except ScheduleAppointmentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
