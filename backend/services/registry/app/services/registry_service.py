from collections.abc import Mapping
from io import BytesIO
from uuid import UUID

import openpyxl
import psycopg2
from psycopg2.extras import RealDictCursor

from kakimetch_common.database import get_connection
from app.schemas.registry import (
    ImportSummary,
    PatientDetail,
    PatientSummary,
    PatientWrite,
)
from kakimetch_common.excel import (
    as_text,
    is_yes,
    mobility_from_equipment,
    parse_excel_date,
)

REQUIRED_IMPORT_COLUMNS = ("NAME",)

WRITABLE_COLUMNS = (
    "name",
    "nric",
    "aic_registration_no",
    "postal_code",
    "block",
    "unit",
    "street_name",
    "contact_no",
    "caregiver_name",
    "escort_required",
    "co_payment",
    "date_of_birth",
    "nmts_effective_date",
    "nmts_expired_date",
    "date_of_entry",
    "action_updated_date",
    "lh_service_agreement",
    "sw_service_agreement",
    "wheelchair_required",
    "walking_frame_required",
    "caregiver_or_maid_available",
    "gender",
    "gender_preference",
    "address_source",
    "dialect",
    "weight_kg",
    "nmtr_percentage",
    "aic_mobility_status",
    "lh_mobility_status",
)


class PatientNotFoundError(Exception):
    pass


class DuplicateNricError(Exception):
    pass


class ImportFormatError(Exception):
    pass


def get_patients(deleted: bool = False) -> list[PatientSummary]:
    deleted_filter = "is not null" if deleted else "is null"
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(f"""
                select
                    elderly_clients.id,
                    elderly_clients.name,
                    elderly_clients.nric,
                    elderly_clients.postal_code,
                    elderly_clients.nmtr_percentage,
                    elderly_clients.escort_required,
                    elderly_clients.deleted_at,
                    (
                        select max(trips.appt_date)
                        from public.trips
                        where trips.elderly_id = elderly_clients.id
                          and trips.appt_date <= current_date
                    ) as last_visit
                from public.elderly_clients
                where elderly_clients.deleted_at {deleted_filter}
                order by elderly_clients.name
                """)
            rows: list[Mapping[str, object]] = cursor.fetchall()

    return [PatientSummary.model_validate(row) for row in rows]


def get_patient(patient_id: UUID) -> PatientDetail:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _fetch_patient_row(cursor, patient_id)

    if row is None:
        raise PatientNotFoundError

    return PatientDetail.model_validate(row)


def create_patient(request: PatientWrite) -> PatientDetail:
    address = build_address(request.block, request.street_name, request.unit)
    columns = [*WRITABLE_COLUMNS, "address"]
    params = {**request.model_dump(), "address": address}

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    insert into public.elderly_clients ({", ".join(columns)})
                    values ({", ".join(f"%({column})s" for column in columns)})
                    returning id
                    """,
                    params,
                )
                new_id = cursor.fetchone()["id"]
    except psycopg2.errors.UniqueViolation as error:
        raise DuplicateNricError from error

    return get_patient(new_id)


def update_patient(patient_id: UUID, request: PatientWrite) -> PatientDetail:
    address = build_address(request.block, request.street_name, request.unit)
    params = {**request.model_dump(), "address": address, "patient_id": patient_id}
    assignments = ", ".join(f"{column} = %({column})s" for column in WRITABLE_COLUMNS)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    update public.elderly_clients
                    set {assignments}, address = %(address)s, updated_at = now()
                    where id = %(patient_id)s
                      and deleted_at is null
                    returning id
                    """,
                    params,
                )
                updated = cursor.fetchone()
    except psycopg2.errors.UniqueViolation as error:
        raise DuplicateNricError from error

    if updated is None:
        raise PatientNotFoundError

    return get_patient(patient_id)


def delete_patient(patient_id: UUID) -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update public.elderly_clients
                set deleted_at = now(), updated_at = now()
                where id = %s
                  and deleted_at is null
                returning id
                """,
                (patient_id,),
            )
            deleted = cursor.fetchone()

    if deleted is None:
        raise PatientNotFoundError


def restore_patient(patient_id: UUID) -> PatientDetail:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update public.elderly_clients
                    set deleted_at = null, updated_at = now()
                    where id = %s
                      and deleted_at is not null
                    returning id
                    """,
                    (patient_id,),
                )
                restored = cursor.fetchone()
    except psycopg2.errors.UniqueViolation as error:
        raise DuplicateNricError from error

    if restored is None:
        raise PatientNotFoundError

    return get_patient(patient_id)


def import_patients(file_bytes: bytes) -> ImportSummary:
    headers, rows = _read_workbook_rows(file_bytes)
    missing = [column for column in REQUIRED_IMPORT_COLUMNS if column not in headers]
    if missing:
        raise ImportFormatError(f"Missing required column(s): {', '.join(missing)}.")

    imported = 0
    skipped = 0
    with get_connection() as connection:
        with connection.cursor() as cursor:
            for row in rows:
                # Clearing cell contents in Excel (rather than deleting the rows outright)
                # leaves fully blank rows inside the sheet's used range; openpyxl still
                # yields them, so they must not count as a "missing name" data problem.
                if _is_blank_row(row):
                    continue
                if not as_text(row.get("NAME")):
                    skipped += 1
                    continue
                _upsert_patient_from_excel_row(cursor, row)
                imported += 1

    return ImportSummary(imported_count=imported, skipped_count=skipped)


def _is_blank_row(row: Mapping[str, object]) -> bool:
    return all(as_text(value) == "" for value in row.values())


def build_address(
    block: str | None, street_name: str | None, unit: str | None
) -> str | None:
    parts = [part for part in (block, street_name, unit) if part]
    return " ".join(parts) or None


def _fetch_patient_row(
    cursor: RealDictCursor, patient_id: UUID
) -> Mapping[str, object] | None:
    cursor.execute(
        """
        select
            elderly_clients.*,
            (
                select max(trips.appt_date)
                from public.trips
                where trips.elderly_id = elderly_clients.id
                  and trips.appt_date <= current_date
            ) as last_visit
        from public.elderly_clients
        where elderly_clients.id = %s
        """,
        (patient_id,),
    )
    return cursor.fetchone()


def _read_workbook_rows(
    file_bytes: bytes,
) -> tuple[tuple[str, ...], list[dict[str, object]]]:
    try:
        workbook = openpyxl.load_workbook(
            BytesIO(file_bytes), read_only=True, data_only=True
        )
        worksheet = workbook.active
        if worksheet is None:
            raise ImportFormatError("The uploaded file has no worksheet.")

        rows_iter = worksheet.iter_rows(values_only=True)
        headers = next(rows_iter)
        rows = [dict(zip(headers, values, strict=True)) for values in rows_iter]
    except ImportFormatError:
        raise
    except StopIteration as error:
        raise ImportFormatError("The uploaded file is empty.") from error
    except Exception as error:
        raise ImportFormatError(
            "Could not read the uploaded file. Please upload a valid .xlsx file."
        ) from error

    return headers, rows


def _upsert_patient_from_excel_row(
    cursor: RealDictCursor, row: Mapping[str, object]
) -> None:
    mobility_status = mobility_from_equipment(
        row.get("Wheelchair (WC)"), row.get("Walking Frame/ Stick")
    )
    cursor.execute(
        """
        insert into public.elderly_clients (
            name, nric, aic_registration_no, postal_code, block, unit, street_name,
            address, contact_no, caregiver_name, escort_required, co_payment,
            date_of_birth, nmts_effective_date, nmts_expired_date, date_of_entry,
            action_updated_date, lh_service_agreement, sw_service_agreement,
            wheelchair_required, walking_frame_required, caregiver_or_maid_available,
            gender, address_source, dialect, weight_kg, nmtr_percentage,
            aic_mobility_status, lh_mobility_status
        ) values (
            %(name)s, %(nric)s, %(aic_registration_no)s, %(postal_code)s, %(block)s,
            %(unit)s, %(street_name)s, %(address)s, %(contact_no)s, %(caregiver_name)s,
            %(escort_required)s, %(co_payment)s, %(date_of_birth)s,
            %(nmts_effective_date)s, %(nmts_expired_date)s, %(date_of_entry)s,
            %(action_updated_date)s, %(lh_service_agreement)s, %(sw_service_agreement)s,
            %(wheelchair_required)s, %(walking_frame_required)s,
            %(caregiver_or_maid_available)s, %(gender)s, %(address_source)s, %(dialect)s,
            %(weight_kg)s, %(nmtr_percentage)s, %(aic_mobility_status)s, %(lh_mobility_status)s
        ) on conflict (nric) where deleted_at is null and nric is not null do update set
            -- aic/lh_mobility_status are intentionally left untouched on conflict: a re-import
            -- must not clobber a mobility assessment the admin has since corrected by hand,
            -- since the master data export never carries that field, only equipment flags.
            name = excluded.name,
            aic_registration_no = excluded.aic_registration_no,
            postal_code = excluded.postal_code,
            block = excluded.block,
            unit = excluded.unit,
            street_name = excluded.street_name,
            address = excluded.address,
            contact_no = excluded.contact_no,
            caregiver_name = excluded.caregiver_name,
            escort_required = excluded.escort_required,
            co_payment = excluded.co_payment,
            date_of_birth = excluded.date_of_birth,
            nmts_effective_date = excluded.nmts_effective_date,
            nmts_expired_date = excluded.nmts_expired_date,
            date_of_entry = excluded.date_of_entry,
            action_updated_date = excluded.action_updated_date,
            lh_service_agreement = excluded.lh_service_agreement,
            sw_service_agreement = excluded.sw_service_agreement,
            wheelchair_required = excluded.wheelchair_required,
            walking_frame_required = excluded.walking_frame_required,
            caregiver_or_maid_available = excluded.caregiver_or_maid_available,
            gender = excluded.gender,
            address_source = excluded.address_source,
            dialect = excluded.dialect,
            weight_kg = excluded.weight_kg,
            nmtr_percentage = excluded.nmtr_percentage,
            updated_at = now()
        """,
        {
            "name": as_text(row.get("NAME")),
            "nric": as_text(row.get("NRIC")) or None,
            "aic_registration_no": as_text(row.get("AIC Reg No")) or None,
            "postal_code": as_text(row.get("Postal Code")) or None,
            "block": as_text(row.get("BLK")) or None,
            "unit": as_text(row.get("UNIT")) or None,
            "street_name": as_text(row.get("St Name")) or None,
            "address": build_address(
                as_text(row.get("BLK")) or None,
                as_text(row.get("St Name")) or None,
                as_text(row.get("UNIT")) or None,
            ),
            "contact_no": as_text(row.get("Contact No")) or None,
            "caregiver_name": as_text(row.get("Caregiver")) or None,
            "escort_required": is_yes(row.get("Escort (Y/N)")),
            "co_payment": row.get("Co-payment"),
            "date_of_birth": parse_excel_date(row.get("DOB (YYYYMMDD)")),
            "nmts_effective_date": parse_excel_date(
                row.get("NMTS effective date (YYYYMMDD)")
            ),
            "nmts_expired_date": parse_excel_date(
                row.get("NMTS expired date (YYYYMMDD)")
            ),
            "date_of_entry": parse_excel_date(row.get("Date Of Entry (YYYMMDD)")),
            "action_updated_date": as_text(row.get("Action/updated date")) or None,
            "lh_service_agreement": as_text(row.get("LH Service Agreement")) or None,
            "sw_service_agreement": as_text(row.get("SW Service Agreement")) or None,
            "wheelchair_required": is_yes(row.get("Wheelchair (WC)")),
            "walking_frame_required": is_yes(row.get("Walking Frame/ Stick")),
            "caregiver_or_maid_available": is_yes(row.get("Caregiver/Maid")),
            "gender": as_text(row.get("M/F")) or None,
            "address_source": as_text(row.get("Address Source")) or None,
            "dialect": as_text(row.get("Dialect")) or None,
            "weight_kg": row.get("Weight (kg)"),
            "nmtr_percentage": row.get("NMTR %"),
            "aic_mobility_status": mobility_status,
            "lh_mobility_status": mobility_status,
        },
    )
