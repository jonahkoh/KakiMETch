from __future__ import annotations

import hashlib
from dataclasses import dataclass
from itertools import product
from typing import Protocol

import httpx

from kakimetch_common.config import get_mapbox_access_token

LH_SERVICE_CENTRE = "600210, Singapore"


@dataclass(frozen=True)
class TravelTimeMatrix:
    durations_seconds: list[list[int]]
    source: str


class TravelTimeProvider(Protocol):
    def get_matrix(self, addresses: list[str]) -> TravelTimeMatrix: ...


class MapboxTravelTimeProvider:
    """Geocode Singapore addresses and obtain road travel times from Mapbox."""

    def __init__(self, access_token: str, timeout_seconds: float = 30) -> None:
        self.access_token = access_token
        self.timeout_seconds = timeout_seconds

    def get_matrix(self, addresses: list[str]) -> TravelTimeMatrix:
        coordinates = self._geocode(addresses)
        size = len(coordinates)
        durations = [[0 for _ in range(size)] for _ in range(size)]

        # Mapbox accepts at most 25 coordinates per matrix request. Splitting into
        # 12x12 asymmetric blocks supports a full day without truncating stops.
        groups = [
            list(range(start, min(start + 12, size))) for start in range(0, size, 12)
        ]
        with httpx.Client(timeout=self.timeout_seconds) as client:
            for source_indexes, destination_indexes in product(groups, groups):
                block_coordinates = [coordinates[index] for index in source_indexes]
                block_coordinates += [
                    coordinates[index] for index in destination_indexes
                ]
                coordinate_path = ";".join(
                    f"{longitude},{latitude}"
                    for longitude, latitude in block_coordinates
                )
                destination_offset = len(source_indexes)
                response = client.get(
                    "https://api.mapbox.com/directions-matrix/v1/mapbox/driving/"
                    + coordinate_path,
                    params={
                        "sources": ";".join(
                            str(index) for index in range(destination_offset)
                        ),
                        "destinations": ";".join(
                            str(index)
                            for index in range(
                                destination_offset,
                                destination_offset + len(destination_indexes),
                            )
                        ),
                        "annotations": "duration",
                        "access_token": self.access_token,
                    },
                )
                response.raise_for_status()
                block = response.json().get("durations")
                if not block:
                    raise RuntimeError("Mapbox did not return a duration matrix.")
                for source_position, source_index in enumerate(source_indexes):
                    for destination_position, destination_index in enumerate(
                        destination_indexes
                    ):
                        duration = block[source_position][destination_position]
                        if duration is None:
                            raise RuntimeError(
                                "Mapbox could not route between two schedule addresses."
                            )
                        durations[source_index][destination_index] = max(
                            1, round(float(duration))
                        )

        return TravelTimeMatrix(durations, "Mapbox road travel times")

    def _geocode(self, addresses: list[str]) -> list[tuple[float, float]]:
        payload = [
            {
                "q": address if "Singapore" in address else f"{address}, Singapore",
                "country": "sg",
                "limit": 1,
                "autocomplete": False,
            }
            for address in addresses
        ]
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                "https://api.mapbox.com/search/geocode/v6/batch",
                params={"access_token": self.access_token},
                json=payload,
            )
            response.raise_for_status()
            results = response.json().get("batch", [])

        if len(results) != len(addresses):
            raise RuntimeError("Mapbox did not return every requested address.")

        coordinates: list[tuple[float, float]] = []
        for address, result in zip(addresses, results, strict=True):
            features = result.get("features", [])
            if not features:
                raise RuntimeError(f"Could not locate schedule address: {address}")
            longitude, latitude = features[0]["geometry"]["coordinates"]
            coordinates.append((float(longitude), float(latitude)))
        return coordinates


class LocalEstimateTravelTimeProvider:
    """Deterministic prototype fallback; never presented as real road timing."""

    def get_matrix(self, addresses: list[str]) -> TravelTimeMatrix:
        durations: list[list[int]] = []
        for origin in addresses:
            row: list[int] = []
            for destination in addresses:
                if origin == destination:
                    row.append(0)
                    continue
                digest = hashlib.sha256(
                    "|".join(
                        sorted((origin.casefold(), destination.casefold()))
                    ).encode()
                ).digest()
                # 12-30 minutes gives the optimiser realistic-enough prototype
                # spacing while the UI clearly labels that these are estimates.
                row.append((12 + digest[0] % 19) * 60)
            durations.append(row)
        return TravelTimeMatrix(durations, "Local estimate — add Mapbox token")


def get_travel_time_provider() -> TravelTimeProvider:
    token = get_mapbox_access_token()
    if token:
        return MapboxTravelTimeProvider(token)
    return LocalEstimateTravelTimeProvider()
