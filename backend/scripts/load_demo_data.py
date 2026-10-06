from collections.abc import Iterator, Mapping
from datetime import time
import os
from pathlib import Path
from typing import Any

import httpx
import openpyxl

from kakimetch_common.database import get_connection
from kakimetch_common.excel import (
    as_text,
    is_yes,
    parse_excel_date,
)

DATA_DIRECTORY = Path(__file__).resolve().parents[2] / "data"
REGISTRY_API_URL = os.getenv("REGISTRY_API_URL", "http://localhost:8003")
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def expand_available_days(value: object) -> list[str]:
    days = as_text(value).split("/")
    if len(days) == 1 and "-" in days[0]:
        start_day, end_day = (part.strip().title() for part in days[0].split("-", 1))
        if start_day in WEEKDAYS and end_day in WEEKDAYS:
            return WEEKDAYS[WEEKDAYS.index(start_day) : WEEKDAYS.index(end_day) + 1]

    return [day.strip().title() for day in days if day.strip().title() in WEEKDAYS]


def load_demo_data(
    registry: httpx.Client, data_directory: Path = DATA_DIRECTORY
) -> tuple[int, int, int]:
    """Import the provided demo workbooks and return client, escort, and trip counts."""
    # Clients first: trips are linked to them by NRIC.
    client_count = upload_clients(
        data_directory / "Dummy_MasterData_Updated.xlsx", registry
    )
    with get_connection() as connection:
        with connection.cursor() as cursor:
            escort_count = load_escorts(
                cursor, data_directory / "Dummy_EscortRoster.xlsx"
            )
            trip_count = load_trips(
                cursor, data_directory / "Dummy_ScheduleData_September_2026.xlsx"
            )

    return client_count, escort_count, trip_count


def upload_clients(workbook_path: Path, client: httpx.Client) -> int:
    """Send the master workbook through the registry service's own .xlsx import."""
    with workbook_path.open("rb") as workbook:
        response = client.post(
            "/registry/import",
            files={"file": (workbook_path.name, workbook, XLSX_MEDIA_TYPE)},
        )
    response.raise_for_status()
    return response.json()["imported_count"]


def load_escorts(cursor: Any, workbook_path: Path) -> int:
    count = 0
    for row in read_rows(workbook_path):
        cursor.execute(
            """
            insert into public.escorts (
                external_id, name, gender, dialects, available_days, available_timeslot,
                wheelchair_handling_capable, contact_no
            ) values (
                %(external_id)s, %(name)s, %(gender)s, %(dialects)s, %(available_days)s,
                %(available_timeslot)s, %(wheelchair_handling_capable)s, %(contact_no)s
            ) on conflict (external_id) do update set
                name = excluded.name,
                gender = excluded.gender,
                dialects = excluded.dialects,
                available_days = excluded.available_days,
                available_timeslot = excluded.available_timeslot,
                wheelchair_handling_capable = excluded.wheelchair_handling_capable,
                contact_no = excluded.contact_no,
                updated_at = now()
            """,
            {
                "external_id": as_text(row["Escort ID"]),
                "name": as_text(row["Name"]),
                "gender": as_text(row["Gender (M/F)"]),
                "dialects": split_dialects(row["Dialect(s) Spoken"]),
                "available_days": expand_available_days(row["Available Days"]),
                "available_timeslot": as_text(row["Available Timeslot"]),
                "wheelchair_handling_capable": is_yes(row["Wheelchair Handling (Y/N)"]),
                "contact_no": as_text(row["Contact No"]),
            },
        )
        count += 1

    return count


def load_trips(cursor: Any, workbook_path: Path) -> int:
    count = 0
    for row in read_rows(workbook_path):
        appt_date = parse_excel_date(row["Appt Date"])
        destination = as_text(row["Destination"])
        if appt_date is None or not destination:
            continue

        for appointment_time in (row["1st Appt"], row["2nd Appt"]):
            if not isinstance(appointment_time, time):
                continue
            cursor.execute(
                """
                insert into public.trips (elderly_id, appt_date, appt_time, destination)
                select elderly_clients.id, %s, %s, %s
                from public.elderly_clients
                where elderly_clients.nric = %s
                  and not exists (
                      select 1
                      from public.trips
                      where trips.elderly_id = elderly_clients.id
                        and trips.appt_date = %s
                        and trips.appt_time = %s
                        and trips.destination = %s
                  )
                """,
                (
                    appt_date,
                    appointment_time,
                    destination,
                    as_text(row["NRIC"]),
                    appt_date,
                    appointment_time,
                    destination,
                ),
            )
            count += cursor.rowcount

    return count


def read_rows(workbook_path: Path) -> Iterator[dict[str, object]]:
    worksheet = openpyxl.load_workbook(
        workbook_path,
        read_only=True,
        data_only=True,
    ).active
    headers = next(worksheet.iter_rows(values_only=True))
    for values in worksheet.iter_rows(min_row=2, values_only=True):
        yield dict(zip(headers, values, strict=True))


def build_address(row: Mapping[str, object]) -> str:
    return " ".join(
        part
        for part in (as_text(row["BLK"]), as_text(row["St Name"]), as_text(row["UNIT"]))
        if part
    )


def split_dialects(value: object) -> list[str]:
    return [dialect.strip() for dialect in as_text(value).split(",") if dialect.strip()]


if __name__ == "__main__":
    with httpx.Client(base_url=REGISTRY_API_URL, timeout=120) as registry:
        clients, escorts, trips = load_demo_data(registry)
    print(f"Imported {clients} clients, {escorts} escorts, and {trips} new trips.")
