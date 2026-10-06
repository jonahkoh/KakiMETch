from datetime import date, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class VehicleSummary(BaseModel):
    id: UUID
    plate_number: str
    driver_name: str
    available_from: time
    available_until: time
    passenger_pair_capacity: int
    max_daily_services: int


class ScheduleAppointment(BaseModel):
    trip_id: UUID
    elderly_id: UUID
    elderly_name: str
    appt_date: date
    appt_time: time
    pickup_address: str | None
    destination: str
    return_ready_time: time | None
    escort_required: bool
    escort_name: str | None


class RouteStop(BaseModel):
    kind: Literal[
        "depot_start",
        "outbound_pickup",
        "outbound_dropoff",
        "return_pickup",
        "return_dropoff",
        "depot_end",
    ]
    address: str
    planned_time: time


class RouteAssignment(BaseModel):
    trip_id: UUID
    sequence: int
    outbound_pickup_at: time | None
    outbound_dropoff_at: time | None
    return_pickup_at: time | None
    return_dropoff_at: time | None
    stops: list[RouteStop]


class VehicleLane(BaseModel):
    vehicle: VehicleSummary
    assignments: list[RouteAssignment]


class RoutePlan(BaseModel):
    id: UUID
    service_date: date
    status: Literal["optimised", "manually_adjusted"]
    matrix_source: str
    total_travel_minutes: int
    unallocated_returns: list[UUID]
    lanes: list[VehicleLane]


class DaySchedule(BaseModel):
    service_date: date
    vehicles: list[VehicleSummary]
    appointments: list[ScheduleAppointment]
    plan: RoutePlan | None


class OptimiseScheduleRequest(BaseModel):
    service_date: date


class ReturnReadyUpdate(BaseModel):
    return_ready_time: time


class ManualLane(BaseModel):
    vehicle_id: UUID
    trip_ids: list[UUID]


class ManualPlanUpdate(BaseModel):
    lanes: list[ManualLane] = Field(min_length=1)

    @model_validator(mode="after")
    def trips_must_be_unique(self) -> "ManualPlanUpdate":
        trip_ids = [trip_id for lane in self.lanes for trip_id in lane.trip_ids]
        if len(trip_ids) != len(set(trip_ids)):
            raise ValueError("Each appointment must appear in exactly one vehicle lane.")
        return self
