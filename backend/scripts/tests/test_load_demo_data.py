import httpx

from scripts.load_demo_data import (
    expand_available_days,
    upload_clients,
)


def test_expand_available_days_supports_ranges_and_slashes():
    assert expand_available_days("Mon-Fri") == ["Mon", "Tue", "Wed", "Thu", "Fri"]
    assert expand_available_days("Tue/Thu") == ["Tue", "Thu"]


def test_upload_clients_sends_master_workbook_to_registry_import(tmp_path):
    workbook = tmp_path / "Dummy_MasterData_Updated.xlsx"
    workbook.write_bytes(b"xlsx-bytes")
    received = {}

    def handler(request: httpx.Request) -> httpx.Response:
        received["path"] = request.url.path
        received["body"] = request.read()
        return httpx.Response(200, json={"imported_count": 300, "skipped_count": 0})

    client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url="http://registry"
    )

    assert upload_clients(workbook, client) == 300
    assert received["path"] == "/registry/import"
    assert b'filename="Dummy_MasterData_Updated.xlsx"' in received["body"]
    assert b"xlsx-bytes" in received["body"]
