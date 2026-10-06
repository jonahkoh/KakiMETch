from app.routes import registry
from kakimetch_common.web import create_app

app = create_app("KakiMETch registry service", registry.router)
