import pytest

from app import create_app


@pytest.fixture
def data(tmp_path):
    folder = tmp_path / "dane"
    (folder / "cykle").mkdir(parents=True)
    (folder / "indeks.json").write_text('{"groups": []}')
    (folder / "cykle" / "26-27-Z.json").write_text('{"term": {}}')
    return folder


def make_app(tmp_path, **config):
    return create_app({"USOS_CACHE_PATH": tmp_path / "cache.sqlite3", "TESTING": True, **config})


def test_health_endpoint(tmp_path):
    assert make_app(tmp_path).test_client().get("/healthz").json == {"status": "ok"}


def test_pages(tmp_path):
    client = make_app(tmp_path).test_client()
    start = client.get("/").get_data(as_text=True)
    plan = client.get("/plan.html").get_data(as_text=True)
    assert "Plan na tydzień" in start and 'x-data="startPage"' in start
    assert 'x-data="planPage"' in plan


def test_server_serves_site_data(tmp_path, data):
    client = make_app(tmp_path, SITE_DATA_DIR=data).test_client()
    assert client.get("/dane/indeks.json").json == {"groups": []}
    assert client.get("/dane/cykle/26-27-Z.json").json == {"term": {}}
    assert client.get("/dane/plany/26-27-Z/brak.json").status_code == 404
    assert client.get("/dane/../dane/indeks.json").status_code == 404


def test_missing_data_directory_is_404(tmp_path):
    client = make_app(tmp_path, SITE_DATA_DIR=tmp_path / "nie-ma").test_client()
    assert client.get("/dane/indeks.json").status_code == 404
