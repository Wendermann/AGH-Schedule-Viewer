from app import create_app


def test_health_endpoint(tmp_path):
    app = create_app({"USOS_CACHE_PATH": tmp_path / "cache.sqlite3", "TESTING": True})
    assert app.test_client().get("/healthz").json == {"status": "ok"}
