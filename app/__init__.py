from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from flask import Flask, abort, render_template, send_from_directory

from .build import build_command
from .collect import history_command
from .config import Config
from .sitedata import data_dir, fetch_command
from .usos.api import UsosApi
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
        limiter=RateLimiter(app.config["USOS_WEB_MIN_INTERVAL"]),
        timeout=app.config["USOS_TIMEOUT"],
        user_agent=app.config["USOS_USER_AGENT"],
    )
    app.extensions["usos_api"] = UsosApi(
        app.config["USOS_API_URL"],
        limiter=RateLimiter(app.config["USOS_MIN_INTERVAL"]),
        timeout=app.config["USOS_TIMEOUT"],
        user_agent=app.config["USOS_USER_AGENT"],
    )

    @app.context_processor
    def site_context():
        return {
            "base": app.config["SITE_BASE"],
            "site_mode": app.config["SITE_MODE"],
            "site_name": app.config["SITE_NAME"],
        }

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/plan.html")
    def plan():
        return render_template("plan.html")

    # Na GitHub Pages te pliki kopiuje `flask build`; tu serwuje je Flask.
    @app.get("/dane/<path:name>")
    def site_data(name):
        folder = data_dir(app)
        if not folder.is_dir():
            abort(404)
        return send_from_directory(folder, name)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    app.cli.add_command(build_command)
    app.cli.add_command(history_command)
    app.cli.add_command(fetch_command)
    return app
