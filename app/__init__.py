from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from flask import Flask

from .config import Config
from .usos.cache import PageCache
from .usos.fetch import RateLimiter, UsosFetcher


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    # Np. FLASK_USOS_MIN_INTERVAL=2 w docker-compose.
    app.config.from_prefixed_env()
    if overrides:
        app.config.update(overrides)

    cache_path = app.config["USOS_CACHE_PATH"] or Path(app.instance_path) / "usos-cache.sqlite3"
    app.extensions["usos"] = UsosFetcher(
        app.config["USOS_BASE_URL"],
        PageCache(cache_path),
        max_age=timedelta(hours=app.config["USOS_CACHE_HOURS"]),
        limiter=RateLimiter(app.config["USOS_MIN_INTERVAL"]),
        timeout=app.config["USOS_TIMEOUT"],
        user_agent=app.config["USOS_USER_AGENT"],
    )

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    return app
