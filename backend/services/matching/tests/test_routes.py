from app.main import app

EXPECTED_ROUTES = {
    ("GET", "/health"),
    ("GET", "/trips/{trip_id}/escort-suggestions"),
    ("GET", "/trips/{trip_id}/escort-options"),
    ("GET", "/matching-queue"),
    ("PATCH", "/elderly-clients/{elderly_id}/matching-profile"),
}


def test_service_exposes_exactly_its_endpoints():
    routes = {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
    }

    assert routes == EXPECTED_ROUTES
