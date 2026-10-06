from kakimetch_common.config import get_allowed_origins


def test_allowed_origins_includes_localhost_and_deployed_frontend(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://kakimetchfe-kappa.vercel.app/")

    assert get_allowed_origins() == [
        "http://localhost:3000",
        "https://kakimetchfe-kappa.vercel.app",
    ]
