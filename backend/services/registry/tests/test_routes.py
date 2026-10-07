from app.main import app

EXPECTED_ROUTES = {
    ("GET", "/health"),
    ("GET", "/registry/patients"),
    ("GET", "/registry/patients/{patient_id}"),
    ("POST", "/registry/patients"),
    ("PUT", "/registry/patients/{patient_id}"),
    ("DELETE", "/registry/patients/{patient_id}"),
    ("POST", "/registry/patients/{patient_id}/restore"),
    ("POST", "/registry/import"),
}


def test_service_exposes_exactly_its_endpoints():
    routes = {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
    }

    assert routes == EXPECTED_ROUTES
