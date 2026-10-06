from app.routes import matches, matching_workspace
from kakimetch_common.web import create_app

app = create_app(
    "KakiMETch matching service", matches.router, matching_workspace.router
)
