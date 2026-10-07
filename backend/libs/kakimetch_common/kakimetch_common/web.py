from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from kakimetch_common.config import get_allowed_origins


def create_app(title: str, *routers: APIRouter) -> FastAPI:
    """Build a service app with the shared CORS policy and a /health endpoint."""
    app = FastAPI(title=title)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def get_health() -> dict[str, str]:
        """Report that the service process is running."""
        return {"status": "ok"}

    for router in routers:
        app.include_router(router)
    return app
