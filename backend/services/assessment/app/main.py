from app.routes import assessments
from kakimetch_common.web import create_app

app = create_app("KakiMETch assessment service", assessments.router)
