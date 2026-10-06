from app.routes import trips, schedule
from kakimetch_common.web import create_app

app = create_app("KakiMETch scheduling service", trips.router, schedule.router)
