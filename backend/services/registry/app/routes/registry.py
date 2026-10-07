from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, UploadFile, status

from app.schemas.registry import (
    ImportSummary,
    PatientDetail,
    PatientSummary,
    PatientWrite,
)
from app.services.registry_service import (
    DuplicateNricError,
    ImportFormatError,
    PatientNotFoundError,
    create_patient,
    delete_patient,
    get_patient,
    get_patients,
    import_patients,
    restore_patient,
    update_patient,
)

router = APIRouter(prefix="/registry", tags=["registry"])


@router.get("/patients", response_model=list[PatientSummary])
def get_patients_endpoint(deleted: bool = Query(default=False)) -> list[PatientSummary]:
    return get_patients(deleted)


@router.get("/patients/{patient_id}", response_model=PatientDetail)
def get_patient_endpoint(patient_id: UUID) -> PatientDetail:
    try:
        return get_patient(patient_id)
    except PatientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        ) from error


@router.post(
    "/patients", response_model=PatientDetail, status_code=status.HTTP_201_CREATED
)
def create_patient_endpoint(request: PatientWrite) -> PatientDetail:
    try:
        return create_patient(request)
    except DuplicateNricError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A patient with this NRIC already exists.",
        ) from error


@router.put("/patients/{patient_id}", response_model=PatientDetail)
def update_patient_endpoint(patient_id: UUID, request: PatientWrite) -> PatientDetail:
    try:
        return update_patient(patient_id, request)
    except PatientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        ) from error
    except DuplicateNricError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A patient with this NRIC already exists.",
        ) from error


@router.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient_endpoint(patient_id: UUID) -> None:
    try:
        delete_patient(patient_id)
    except PatientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        ) from error


@router.post("/patients/{patient_id}/restore", response_model=PatientDetail)
def restore_patient_endpoint(patient_id: UUID) -> PatientDetail:
    try:
        return restore_patient(patient_id)
    except PatientNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        ) from error
    except DuplicateNricError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active patient with this NRIC already exists.",
        ) from error


@router.post("/import", response_model=ImportSummary)
async def import_patients_endpoint(file: UploadFile) -> ImportSummary:
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .xlsx file.",
        )

    contents = await file.read()
    try:
        return import_patients(contents)
    except ImportFormatError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
