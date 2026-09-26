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
    for page, script in (("index.html", "start.js"), ("plan.html", "planview.js")):
        html = (out / page).read_text()
        assert 'href="/AGH-Schedule-Viewer/static/css/site.css"' in html
        assert f'src="/AGH-Schedule-Viewer/static/js/{script}"' in html
        # Skrypty składają adresy danych z tej ścieżki.
        assert 'data-base="/AGH-Schedule-Viewer/"' in html
    for asset in ("css/site.css", "js/share.js", "js/model.js", "vendor/alpinejs/alpine-3.17.4.esm.min.js", "fonts/archivo/archivo-latin-ext-wdth-normal.woff2"):
        assert (out / "static" / asset).is_file(), asset


def test_site_data_is_copied(app, tmp_path):
    data = tmp_path / "dane"
    (data / "plany" / "26-27-Z").mkdir(parents=True)
    (data / "indeks.json").write_text("{}")
    (data / "plany" / "26-27-Z" / "240-ZBI-1S-2R-Z.json").write_text("{}")
    out = tmp_path / "site"
    build_site(app, out, "/", data)
    assert (out / "dane" / "indeks.json").is_file()
    assert (out / "dane" / "plany" / "26-27-Z" / "240-ZBI-1S-2R-Z.json").is_file()


def test_refuses_data_without_index(app, tmp_path):
    (tmp_path / "dane").mkdir()
    with pytest.raises(ClickException, match="indeks.json"):
        build_site(app, tmp_path / "site", "/", tmp_path / "dane")


def test_mockups_are_published_with_shared_scripts(app, tmp_path):
    out = tmp_path / "site"
    build_site(app, out, "/")
    assert (out / "makiety" / "index.html").is_file()
    assert (out / "makiety" / "dane" / "plany.json").is_file()
    assert (out / "makiety" / "wspolne" / "plan.js").is_file()
    assert not list((out / "makiety").glob("*.py"))


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
