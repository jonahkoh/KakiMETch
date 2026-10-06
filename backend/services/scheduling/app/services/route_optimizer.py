from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, time
from uuid import UUID

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.services.travel_time_service import LH_SERVICE_CENTRE, TravelTimeProvider


def minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def as_time(value: int) -> time:
    bounded = max(0, min(value, 23 * 60 + 59))
    return time(hour=bounded // 60, minute=bounded % 60)


@dataclass(frozen=True)
class OptimisationVehicle:
    id: UUID
    available_from: time
    available_until: time
    passenger_pair_capacity: int
    max_daily_services: int


@dataclass(frozen=True)
class OptimisationTrip:
    id: UUID
    appointment_time: time
    pickup_address: str
    destination: str
    return_ready_time: time


@dataclass(frozen=True)
class OptimisedStop:
    kind: str
    address: str
    planned_time: time


@dataclass
class OptimisedAssignment:
    trip_id: UUID
    sequence: int
    stops: list[OptimisedStop] = field(default_factory=list)


@dataclass(frozen=True)
class OptimisedLane:
    vehicle_id: UUID
    assignments: list[OptimisedAssignment]


@dataclass(frozen=True)
class OptimisationResult:
    matrix_source: str
    total_travel_minutes: int
    unallocated_returns: list[UUID]
    lanes: list[OptimisedLane]


class NoFeasibleRouteError(Exception):
    pass


def optimise_routes(
    service_date: date,
    vehicles: list[OptimisationVehicle],
    trips: list[OptimisationTrip],
    travel_time_provider: TravelTimeProvider,
) -> OptimisationResult:
    del service_date  # Reserved for traffic-aware providers.
    if not vehicles:
        raise NoFeasibleRouteError("No active vehicle and driver are available.")
    if not trips:
        return OptimisationResult(
            matrix_source="Not required",
            total_travel_minutes=0,
            unallocated_returns=[],
            lanes=[OptimisedLane(vehicle.id, []) for vehicle in vehicles],
        )

    addresses = [LH_SERVICE_CENTRE]
    node_metadata: list[tuple[UUID | None, str, str]] = [
        (None, "depot", LH_SERVICE_CENTRE)
    ]
    pairs: list[tuple[int, int, UUID, bool]] = []

    for trip in trips:
        pickup_index = len(addresses)
        addresses.append(trip.pickup_address)
        node_metadata.append((trip.id, "outbound_pickup", trip.pickup_address))
        dropoff_index = len(addresses)
        addresses.append(trip.destination)
        node_metadata.append((trip.id, "outbound_dropoff", trip.destination))
        pairs.append((pickup_index, dropoff_index, trip.id, False))

        return_pickup_index = len(addresses)
        addresses.append(trip.destination)
        node_metadata.append((trip.id, "return_pickup", trip.destination))
        return_dropoff_index = len(addresses)
        addresses.append(trip.pickup_address)
        node_metadata.append((trip.id, "return_dropoff", trip.pickup_address))
        pairs.append((return_pickup_index, return_dropoff_index, trip.id, True))

    matrix_result = travel_time_provider.get_matrix(addresses)
    travel_minutes = [
        [math.ceil(seconds / 60) for seconds in row]
        for row in matrix_result.durations_seconds
    ]
    manager = pywrapcp.RoutingIndexManager(len(addresses), len(vehicles), 0)
    routing = pywrapcp.RoutingModel(manager)

    def travel_callback(from_index: int, to_index: int) -> int:
        return travel_minutes[manager.IndexToNode(from_index)][
            manager.IndexToNode(to_index)
        ]

    transit_index = routing.RegisterTransitCallback(travel_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_index)
    routing.AddDimension(transit_index, 24 * 60, 24 * 60, False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")

    trip_by_id = {trip.id: trip for trip in trips}
    for pickup_node, dropoff_node, trip_id, is_return in pairs:
        trip = trip_by_id[trip_id]
        pickup_index = manager.NodeToIndex(pickup_node)
        dropoff_index = manager.NodeToIndex(dropoff_node)
        if is_return:
            ready = minutes(trip.return_ready_time)
            time_dimension.CumulVar(pickup_index).SetRange(
                ready, min(ready + 60, 24 * 60)
            )
            time_dimension.CumulVar(dropoff_index).SetRange(ready, 24 * 60)
            # Return work is optional so it can never make an outbound late.
            routing.AddDisjunction([pickup_index], 480)
            routing.AddDisjunction([dropoff_index], 480)
            routing.solver().Add(
                routing.ActiveVar(pickup_index) == routing.ActiveVar(dropoff_index)
            )
            routing.AddVariableMinimizedByFinalizer(
                time_dimension.CumulVar(pickup_index)
            )
            routing.AddVariableMinimizedByFinalizer(
                time_dimension.CumulVar(dropoff_index)
            )
        else:
            appointment = minutes(trip.appointment_time)
            earliest_arrival = max(0, appointment - 60)
            latest_arrival = max(0, appointment - 15)
            time_dimension.CumulVar(pickup_index).SetRange(0, latest_arrival)
            time_dimension.CumulVar(dropoff_index).SetRange(
                earliest_arrival, latest_arrival
            )
            # With travel time fixed, prefer the latest feasible outbound
            # movement so patients do not wait in the vehicle unnecessarily.
            routing.AddVariableMaximizedByFinalizer(
                time_dimension.CumulVar(pickup_index)
            )
            routing.AddVariableMaximizedByFinalizer(
                time_dimension.CumulVar(dropoff_index)
            )

        routing.AddPickupAndDelivery(pickup_index, dropoff_index)
        routing.solver().Add(
            routing.VehicleVar(pickup_index) == routing.VehicleVar(dropoff_index)
        )
        routing.solver().Add(
            time_dimension.CumulVar(pickup_index)
            <= time_dimension.CumulVar(dropoff_index)
        )

    def load_callback(index: int) -> int:
        node = manager.IndexToNode(index)
        if node == 0:
            return 0
        kind = node_metadata[node][1]
        if kind in ("outbound_pickup", "return_pickup"):
            return 1
        if kind in ("outbound_dropoff", "return_dropoff"):
            return -1
        return 0

    load_index = routing.RegisterUnaryTransitCallback(load_callback)
    routing.AddDimensionWithVehicleCapacity(
        load_index,
        0,
        [vehicle.passenger_pair_capacity for vehicle in vehicles],
        True,
        "Passenger pairs",
    )

    def service_callback(index: int) -> int:
        node = manager.IndexToNode(index)
        return int(node != 0 and node_metadata[node][1] == "outbound_pickup")

    service_index = routing.RegisterUnaryTransitCallback(service_callback)
    routing.AddDimensionWithVehicleCapacity(
        service_index,
        0,
        [vehicle.max_daily_services for vehicle in vehicles],
        True,
        "Daily services",
    )

    for vehicle_index, vehicle in enumerate(vehicles):
        time_dimension.CumulVar(routing.Start(vehicle_index)).SetRange(
            minutes(vehicle.available_from), minutes(vehicle.available_until)
        )
        time_dimension.CumulVar(routing.End(vehicle_index)).SetRange(
            minutes(vehicle.available_from), minutes(vehicle.available_until)
        )
        time_dimension.SetCumulVarSoftUpperBound(
            routing.End(vehicle_index), minutes(vehicle.available_until), 1000
        )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 5
    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise NoFeasibleRouteError(
            "No route can meet every outbound arrival window with the available vehicles."
        )

    lanes: list[OptimisedLane] = []
    total_travel = 0
    allocated_return_trips: set[UUID] = set()
    for vehicle_index, vehicle in enumerate(vehicles):
        index = routing.Start(vehicle_index)
        assignments_by_trip: dict[UUID, OptimisedAssignment] = {}
        appointment_order: list[UUID] = []
        while not routing.IsEnd(index):
            next_index = solution.Value(routing.NextVar(index))
            total_travel += routing.GetArcCostForVehicle(
                index, next_index, vehicle_index
            )
            node = manager.IndexToNode(index)
            trip_id, kind, address = node_metadata[node]
            if trip_id is not None:
                if trip_id not in assignments_by_trip:
                    assignments_by_trip[trip_id] = OptimisedAssignment(
                        trip_id=trip_id,
                        sequence=len(appointment_order),
                    )
                    appointment_order.append(trip_id)
                planned_minutes = solution.Min(time_dimension.CumulVar(index))
                assignments_by_trip[trip_id].stops.append(
                    OptimisedStop(kind, address, as_time(planned_minutes))
                )
                if kind == "return_pickup":
                    allocated_return_trips.add(trip_id)
            index = next_index

        lanes.append(
            OptimisedLane(
                vehicle_id=vehicle.id,
                assignments=[
                    assignments_by_trip[trip_id] for trip_id in appointment_order
                ],
            )
        )

    return OptimisationResult(
        matrix_source=matrix_result.source,
        total_travel_minutes=total_travel,
        unallocated_returns=[
            trip.id for trip in trips if trip.id not in allocated_return_trips
        ],
        lanes=lanes,
    )
