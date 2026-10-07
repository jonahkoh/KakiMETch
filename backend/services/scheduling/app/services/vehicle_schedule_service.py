from __future__ import annotations

from collections.abc import Mapping
from datetime import date, time
from uuid import UUID

from psycopg2.extras import Json

from kakimetch_common.database import get_connection
from app.schemas.vehicle_schedule import (
    DaySchedule,
    ManualPlanUpdate,
    RouteAssignment,
    RoutePlan,
    RouteStop,
    ScheduleAppointment,
    VehicleLane,
    VehicleSummary,
)
from app.services.route_optimizer import (
    NoFeasibleRouteError,
    OptimisationTrip,
    OptimisationVehicle,
    optimise_routes,
)
from app.services.travel_time_service import get_travel_time_provider


class IncompleteAppointmentError(Exception):
    def __init__(self, patient_names: list[str]) -> None:
        self.patient_names = patient_names


class RoutePlanNotFoundError(Exception):
    pass


class InvalidManualPlanError(Exception):
    pass


class ScheduleAppointmentNotFoundError(Exception):
    pass


def _load_vehicles(cursor) -> list[Mapping[str, object]]:
    cursor.execute("""
        select
            vehicles.id,
            vehicles.plate_number,
            drivers.name as driver_name,
            drivers.available_from,
            drivers.available_until,
            vehicles.passenger_pair_capacity,
            vehicles.max_daily_services
        from public.vehicles
        join public.drivers on drivers.id = vehicles.driver_id
        where vehicles.active = true and drivers.active = true
        order by vehicles.plate_number
        """)
    return cursor.fetchall()


def _load_appointments(cursor, service_date: date) -> list[Mapping[str, object]]:
    cursor.execute(
        """
        select
            trips.id as trip_id,
            elderly_clients.id as elderly_id,
            elderly_clients.name as elderly_name,
            trips.appt_date,
            trips.appt_time,
            nullif(trim(trips.pickup_address), '') as pickup_address,
            trips.destination,
            trips.return_ready_time,
            elderly_clients.escort_required,
            escorts.name as escort_name
        from public.trips
        join public.elderly_clients on elderly_clients.id = trips.elderly_id
        left join public.escorts on escorts.id = trips.escort_id
        where trips.appt_date = %s
          and trips.status in ('accepted', 'scheduled')
          and elderly_clients.deleted_at is null
        order by trips.appt_time, elderly_clients.name
        """,
        (service_date,),
    )
    return cursor.fetchall()


def _latest_plan(cursor, service_date: date) -> RoutePlan | None:
    cursor.execute(
        """
        select id, service_date, status, matrix_source, total_travel_minutes,
               unallocated_returns
        from public.route_plans
        where service_date = %s
        order by created_at desc
        limit 1
        """,
        (service_date,),
    )
    plan = cursor.fetchone()
    if plan is None:
        return None

    vehicles = [VehicleSummary.model_validate(row) for row in _load_vehicles(cursor)]
    cursor.execute(
        """
        select vehicle_id, trip_id, sequence, outbound_pickup_at,
               outbound_dropoff_at, return_pickup_at, return_dropoff_at,
               stop_summary
        from public.route_plan_assignments
        where route_plan_id = %s
        order by vehicle_id, sequence
        """,
        (plan["id"],),
    )
    assignments_by_vehicle: dict[UUID, list[RouteAssignment]] = {
        vehicle.id: [] for vehicle in vehicles
    }
    for row in cursor.fetchall():
        stops = [RouteStop.model_validate(stop) for stop in row["stop_summary"]]
        assignments_by_vehicle.setdefault(row["vehicle_id"], []).append(
            RouteAssignment(
                trip_id=row["trip_id"],
                sequence=row["sequence"],
                outbound_pickup_at=row["outbound_pickup_at"],
                outbound_dropoff_at=row["outbound_dropoff_at"],
                return_pickup_at=row["return_pickup_at"],
                return_dropoff_at=row["return_dropoff_at"],
                stops=stops,
            )
        )
    return RoutePlan(
        **plan,
        lanes=[
            VehicleLane(
                vehicle=vehicle,
                assignments=assignments_by_vehicle.get(vehicle.id, []),
            )
            for vehicle in vehicles
        ],
    )


def get_day_schedule(service_date: date) -> DaySchedule:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            vehicles = [
                VehicleSummary.model_validate(row) for row in _load_vehicles(cursor)
            ]
            appointments = [
                ScheduleAppointment.model_validate(row)
                for row in _load_appointments(cursor, service_date)
            ]
            plan = _latest_plan(cursor, service_date)
    return DaySchedule(
        service_date=service_date,
        vehicles=vehicles,
        appointments=appointments,
        plan=plan,
    )


def optimise_day(service_date: date) -> RoutePlan:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            vehicle_rows = _load_vehicles(cursor)
            appointment_rows = _load_appointments(cursor, service_date)
            incomplete = [
                str(row["elderly_name"])
                for row in appointment_rows
                if not row["pickup_address"] or not row["return_ready_time"]
            ]
            if incomplete:
                raise IncompleteAppointmentError(incomplete)

            result = optimise_routes(
                service_date,
                [
                    OptimisationVehicle(
                        id=row["id"],
                        available_from=row["available_from"],
                        available_until=row["available_until"],
                        passenger_pair_capacity=row["passenger_pair_capacity"],
                        max_daily_services=row["max_daily_services"],
                    )
                    for row in vehicle_rows
                ],
                [
                    OptimisationTrip(
                        id=row["trip_id"],
                        appointment_time=row["appt_time"],
                        pickup_address=row["pickup_address"],
                        destination=row["destination"],
                        return_ready_time=row["return_ready_time"],
                    )
                    for row in appointment_rows
                ],
                get_travel_time_provider(),
            )
            cursor.execute(
                """
                insert into public.route_plans (
                    service_date, status, matrix_source, total_travel_minutes,
                    unallocated_returns
                ) values (%s, 'optimised', %s, %s, %s)
                returning id
                """,
                (
                    service_date,
                    result.matrix_source,
                    result.total_travel_minutes,
                    result.unallocated_returns,
                ),
            )
            plan_id = cursor.fetchone()["id"]
            for lane in result.lanes:
                for assignment in lane.assignments:
                    stop_by_kind = {stop.kind: stop for stop in assignment.stops}
                    cursor.execute(
                        """
                        insert into public.route_plan_assignments (
                            route_plan_id, vehicle_id, trip_id, sequence,
                            outbound_pickup_at, outbound_dropoff_at,
                            return_pickup_at, return_dropoff_at, stop_summary
                        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            plan_id,
                            lane.vehicle_id,
                            assignment.trip_id,
                            assignment.sequence,
                            _stop_time(stop_by_kind, "outbound_pickup"),
                            _stop_time(stop_by_kind, "outbound_dropoff"),
                            _stop_time(stop_by_kind, "return_pickup"),
                            _stop_time(stop_by_kind, "return_dropoff"),
                            Json(
                                [
                                    {
                                        "kind": stop.kind,
                                        "address": stop.address,
                                        "planned_time": stop.planned_time.isoformat(),
                                    }
                                    for stop in assignment.stops
                                ]
                            ),
                        ),
                    )
            return _latest_plan(cursor, service_date)  # type: ignore[return-value]


def _stop_time(stops: dict[str, object], kind: str) -> time | None:
    stop = stops.get(kind)
    return stop.planned_time if stop is not None else None  # type: ignore[attr-defined]


def update_manual_plan(plan_id: UUID, update: ManualPlanUpdate) -> RoutePlan:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select service_date from public.route_plans where id = %s for update",
                (plan_id,),
            )
            plan = cursor.fetchone()
            if plan is None:
                raise RoutePlanNotFoundError
            cursor.execute(
                "select trip_id from public.route_plan_assignments where route_plan_id = %s",
                (plan_id,),
            )
            existing = {row["trip_id"] for row in cursor.fetchall()}
            submitted = {trip_id for lane in update.lanes for trip_id in lane.trip_ids}
            if existing != submitted:
                raise InvalidManualPlanError
            cursor.execute("select id from public.vehicles where active = true")
            valid_vehicles = {row["id"] for row in cursor.fetchall()}
            if any(lane.vehicle_id not in valid_vehicles for lane in update.lanes):
                raise InvalidManualPlanError

            cursor.execute(
                "delete from public.route_plan_assignments where route_plan_id = %s",
                (plan_id,),
            )
            for lane in update.lanes:
                for sequence, trip_id in enumerate(lane.trip_ids):
                    cursor.execute(
                        """
                        insert into public.route_plan_assignments (
                            route_plan_id, vehicle_id, trip_id, sequence, stop_summary
                        ) values (%s, %s, %s, %s, '[]'::jsonb)
                        """,
                        (plan_id, lane.vehicle_id, trip_id, sequence),
                    )
            cursor.execute(
                """
                update public.route_plans
                set status = 'manually_adjusted', updated_at = now()
                where id = %s
                """,
                (plan_id,),
            )
            return _latest_plan(cursor, plan["service_date"])  # type: ignore[return-value]


def delete_schedule_appointment(trip_id: UUID) -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("delete from public.trips where id = %s", (trip_id,))
            if cursor.rowcount == 0:
                raise ScheduleAppointmentNotFoundError


def update_return_ready_time(trip_id: UUID, return_ready_time: time) -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update public.trips
                set return_ready_time = %s, updated_at = now()
                where id = %s
                """,
                (return_ready_time, trip_id),
            )
            if cursor.rowcount == 0:
                raise ScheduleAppointmentNotFoundError
