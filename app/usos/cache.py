"""Trwały cache stron USOS w SQLite, współdzielony przez procesy gunicorna."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class CachedPage:
    url: str
    html: str
    fetched_at: datetime


class PageCache:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS pages ("
                " url TEXT PRIMARY KEY,"
                " html TEXT NOT NULL,"
                " fetched_at TEXT NOT NULL)"
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, url: str) -> CachedPage | None:
        with self._connect() as db:
            row = db.execute(
                "SELECT html, fetched_at FROM pages WHERE url = ?", (url,)
            ).fetchone()
        if row is None:
            return None
        return CachedPage(url, row[0], datetime.fromisoformat(row[1]))

    def put(self, url: str, html: str, fetched_at: datetime) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT INTO pages (url, html, fetched_at) VALUES (?, ?, ?)"
                " ON CONFLICT(url) DO UPDATE SET"
                " html = excluded.html, fetched_at = excluded.fetched_at",
                (url, html, fetched_at.isoformat()),
            )
