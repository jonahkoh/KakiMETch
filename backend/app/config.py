import os
from pathlib import Path

from dotenv import load_dotenv

# Load only the backend environment file so frontend settings stay separate.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Add it to backend/.env.")

    return database_url


def get_allowed_origins() -> list[str]:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url.rstrip("/"))

    return origins


def get_mapbox_access_token() -> str | None:
    token = os.getenv("MAPBOX_ACCESS_TOKEN", "").strip()
    return token or None
