from __future__ import annotations

import atexit
import time
import psycopg2
import psycopg2.pool
from dotenv import load_dotenv
import os

load_dotenv()

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=8,
            user=os.getenv("PGUSER"),
            password=os.getenv("PGPASSWORD"),
            host=os.getenv("PGHOST"),
            port=os.getenv("PGPORT"),
            dbname=os.getenv("PGDATABASE"),
            sslmode="require",
        )
    return _pool


def _close_pool():
    global _pool
    if _pool is not None and not _pool.closed:
        try:
            _pool.closeall()
        except Exception:
            pass
        _pool = None


atexit.register(_close_pool)


class _PooledConnection:
    """
    Thin wrapper so existing routes can call conn.close() and the underlying
    connection is returned to the pool rather than destroyed.
    """

    def __init__(self, conn, pool: psycopg2.pool.ThreadedConnectionPool):
        self._conn = conn
        self._pool = pool
        self._broken = False

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        try:
            self._conn.rollback()
        except (psycopg2.InterfaceError, psycopg2.OperationalError):
            # Connection is already closed/broken — mark it so close() discards it
            self._broken = True

    def close(self):
        # Return to pool instead of closing — no other file needs to change
        if self._conn is not None:
            try:
                self._pool.putconn(self._conn, close=self._broken)
            except Exception:
                pass
            self._conn = None

    def __del__(self):
        # Safety net: return connection if caller forgot to call close()
        if getattr(self, "_conn", None) is not None:
            try:
                self._pool.putconn(self._conn, close=getattr(self, "_broken", False))
                self._conn = None
            except Exception:
                pass


def get_connection() -> _PooledConnection:
    global _pool
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            pool = _get_pool()
            conn = pool.getconn()
            # Verify the connection is alive before returning it
            conn.cursor().execute("SELECT 1")
            return _PooledConnection(conn, pool)
        except (psycopg2.pool.PoolError, psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            last_err = e
            # If the pool or connection itself is broken, recreate it next attempt
            try:
                if _pool is not None:
                    _pool.closeall()
            except Exception:
                pass
            _pool = None
            time.sleep(0.2 * (attempt + 1))
    raise last_err  # type: ignore[misc]
