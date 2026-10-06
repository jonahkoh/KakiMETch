from collections.abc import Iterator
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor, register_uuid

from kakimetch_common.config import get_database_url


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    """Provide a transaction and always close the direct Postgres connection."""
    connection = psycopg2.connect(
        get_database_url(),
        cursor_factory=RealDictCursor,
    )
    register_uuid(conn_or_curs=connection)

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
