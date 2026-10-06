from app.main import app

EXPECTED_ROUTES = {
    ("GET", "/health"),
    ("POST", "/trips"),
    ("POST", "/trips/{trip_id}/confirm-escort"),
    ("POST", "/trips/{trip_id}/cancel-assignment"),
    ("GET", "/schedule"),
}


def test_service_exposes_exactly_its_endpoints():
    routes = {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
    }

    assert routes == EXPECTED_ROUTES
