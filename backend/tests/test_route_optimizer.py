from datetime import date, time
from uuid import uuid4

from app.services.route_optimizer import (
    OptimisationTrip,
    OptimisationVehicle,
    optimise_routes,
)
from app.services.travel_time_service import TravelTimeMatrix


class FixedTravelTimes:
    def get_matrix(self, addresses: list[str]) -> TravelTimeMatrix:
        return TravelTimeMatrix(
            [
                [0 if row == column else 10 * 60 for column in range(len(addresses))]
                for row in range(len(addresses))
            ],
            "Test road times",
        )


class ClusteredTravelTimes:
    def get_matrix(self, addresses: list[str]) -> TravelTimeMatrix:
        def duration(origin: str, destination: str) -> int:
            if origin == destination:
                return 0
            if origin.startswith("600210") or destination.startswith("600210"):
                return 10 * 60
            if origin.split()[0] == destination.split()[0]:
                return 2 * 60
            return 90 * 60

        return TravelTimeMatrix(
            [[duration(origin, destination) for destination in addresses] for origin in addresses],
            "Clustered test times",
        )


def test_optimizer_meets_outbound_arrival_window_and_allocates_returns():
    vehicles = [
        OptimisationVehicle(uuid4(), time(6, 30), time(15), 3, 8),
        OptimisationVehicle(uuid4(), time(6, 30), time(15), 3, 8),
    ]
    trip = OptimisationTrip(
        uuid4(),
        time(8, 30),
        "320 Bukit Batok Street 33",
        "National University Hospital",
        time(11),
    )

    result = optimise_routes(
        date(2026, 10, 7), vehicles, [trip], FixedTravelTimes()
    )

    assignments = [item for lane in result.lanes for item in lane.assignments]
    assert len(assignments) == 1
    stops = {stop.kind: stop for stop in assignments[0].stops}
    assert time(7, 30) <= stops["outbound_dropoff"].planned_time <= time(8, 15)
    assert time(11) <= stops["return_pickup"].planned_time <= time(12)
    assert result.unallocated_returns == []
    assert result.matrix_source == "Test road times"


def test_optimizer_uses_second_vehicle_when_it_reduces_total_travel():
    vehicles = [
        OptimisationVehicle(uuid4(), time(6, 30), time(15), 3, 8),
        OptimisationVehicle(uuid4(), time(6, 30), time(15), 3, 8),
    ]
    trips = [
        OptimisationTrip(uuid4(), time(8), "West pickup", "West hospital", time(13)),
        OptimisationTrip(uuid4(), time(8), "East pickup", "East hospital", time(13)),
    ]

    result = optimise_routes(
        date(2026, 10, 7), vehicles, trips, ClusteredTravelTimes()
    )

    assert sum(bool(lane.assignments) for lane in result.lanes) == 2
