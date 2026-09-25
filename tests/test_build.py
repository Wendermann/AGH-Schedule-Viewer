import pytest
from click import ClickException

from app import create_app
from app.build import build_site, normalize_base


@pytest.fixture
def app(tmp_path):
    return create_app({"USOS_CACHE_PATH": tmp_path / "cache.sqlite3", "TESTING": True})


@pytest.mark.parametrize(
    "given, expected",
    [("/", "/"), ("", "/"), ("/AGH-Schedule-Viewer", "/AGH-Schedule-Viewer/"), ("AGH-Schedule-Viewer/", "/AGH-Schedule-Viewer/")],
)
def test_base_path_is_normalized(given, expected):
    assert normalize_base(given) == expected


def test_pages_and_assets_use_the_base_path(app, tmp_path):
    out = tmp_path / "site"
    build_site(app, out, "/AGH-Schedule-Viewer")
    html = (out / "index.html").read_text()
    assert 'href="/AGH-Schedule-Viewer/static/css/site.css"' in html
    assert (out / "static" / "css" / "site.css").is_file()
    assert (out / "static" / "js" / "share.js").is_file()


def test_refuses_to_overwrite_a_non_empty_directory(app, tmp_path):
    (tmp_path / "site").mkdir()
    (tmp_path / "site" / "keep.txt").write_text("x")
    with pytest.raises(ClickException):
        build_site(app, tmp_path / "site", "/")


def test_cli_command(app, tmp_path):
    out = tmp_path / "site"
    result = app.test_cli_runner().invoke(args=["build", "--output", str(out), "--base-path", "/x"])
    assert result.exit_code == 0, result.output
    assert (out / "index.html").is_file()


def test_server_mode_serves_assets_from_root(app):
    html = app.test_client().get("/").get_data(as_text=True)
    assert 'href="/static/css/site.css"' in html
