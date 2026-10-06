import os

from dotenv import find_dotenv, load_dotenv

# Local runs pick up backend/.env by walking up from the working directory;
# containers get real environment variables and have no .env file.
load_dotenv(find_dotenv(usecwd=True))


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Add it to backend/.env.")

    return database_url


def get_allowed_origins() -> list[str]:
    origins = ["http://localhost:3000"]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url.rstrip("/"))

    return origins
