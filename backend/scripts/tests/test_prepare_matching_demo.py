import httpx

from scripts.prepare_matching_demo import assess_trips


def test_assess_trips_posts_each_trip_and_counts_outcomes():
    requested_paths = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_paths.append((request.method, request.url.path))
        if request.url.path == "/trips/broken/assessment":
            return httpx.Response(500)
        decision = "accepted" if "ok" in request.url.path else "rejected"
        return httpx.Response(200, json={"decision": decision})

    client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url="http://assessment"
    )

    counts = assess_trips(["ok-1", "broken", "no-1", "ok-2"], client)

    assert counts == (2, 1, 1)
    assert requested_paths == [
        ("POST", "/trips/ok-1/assessment"),
        ("POST", "/trips/broken/assessment"),
        ("POST", "/trips/no-1/assessment"),
        ("POST", "/trips/ok-2/assessment"),
    ]
