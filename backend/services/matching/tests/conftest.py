from contextlib import contextmanager

import pytest


class FakeCursor:
    """Replays one canned result per execute; like psycopg2, each result can be read once."""

    def __init__(self, responses):
        self.responses = iter(responses)
        self.current = None
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))
        self.current = next(self.responses)

    def fetchone(self):
        row, self.current = self.current, None
        return row

    def fetchall(self):
        rows, self.current = self.current, []
        return rows


class FakeConnection:
    def __init__(self, cursor):
        self.fake_cursor = cursor

    def cursor(self):
        return self.fake_cursor


@pytest.fixture
def fake_db(monkeypatch):
    """Point `module.get_connection` at a cursor that replays `responses`."""

    def install(module, responses):
        cursor = FakeCursor(responses)

        @contextmanager
        def fake_get_connection():
            yield FakeConnection(cursor)

        monkeypatch.setattr(module, "get_connection", fake_get_connection)
        return cursor

    return install
