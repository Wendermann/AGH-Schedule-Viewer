import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from app import create_app
from app.sitedata import fetch_site_data
from app.usos.api import Term, _meeting
from app.usos.fetch import Page, UsosUnavailable

FIXTURES = Path(__file__).parent / "fixtures" / "usos"
PLAN = (FIXTURES / "plan-240-ZBI-1S-2R-Z-26_27-Z.html").read_text(encoding="utf-8")
EMPTY = (FIXTURES / "plan-240-INF-1S-2R-Z-22_23-Z.html").read_text(encoding="utf-8")
GROUPS = (FIXTURES / "groups-240-000.html").read_text(encoding="utf-8")
FETCHED = datetime(2026, 9, 25, 16, tzinfo=timezone.utc)


class FakeWeb:
    """ZBI ma plan, INF 1. rok nie odpowiada, reszta grup jest pusta."""

    def get(self, action, *, refresh=False, **params):
        if "wybierzGrupePrzedmiotow" in action:
            return Page("groups", GROUPS, FETCHED)
        code = params["grupa_kod"]
        if code == "240-INF-1S-1R-Z":
            raise UsosUnavailable("timeout")
        return Page(code, PLAN if code == "240-ZBI-1S-2R-Z" else EMPTY, FETCHED, stale=code == "240-ZBI-1S-2R-Z")

    def url_for(self, action, **params):
        return f"https://usos.example/?_action={action}&grupa_kod={params['grupa_kod']}"


class FakeApi:
    def call(self, method, **params):
        assert method == "fac/faculty"
        return {"id": params["fac_id"], "name": {"pl": "Wydział Informatyki"}}

    def class_types(self):
        return {"W": "wykład", "CWL": "ćwiczenia laboratoryjne"}

    def term(self, term_id):
        return Term(term_id, "Semestr zimowy 2026/2027", date(2026, 10, 1), date(2027, 2, 28))

    def meetings(self, groups, start, end):
        items = []
        for week in ("2026-10-26", "2026-11-09"):
            items += json.loads((FIXTURES / f"api-classgroups-{week}.json").read_text(encoding="utf-8"))
        return [m for item in items if (m := _meeting(item)) and (m.unit_id, m.group_no) in groups]


@pytest.fixture
def app(tmp_path):
    app = create_app({"USOS_CACHE_PATH": tmp_path / "cache.sqlite3", "TESTING": True})
    app.extensions["usos"] = FakeWeb()
    app.extensions["usos_api"] = FakeApi()
    return app


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_site_data_files(app, tmp_path):
    out = tmp_path / "dane"
    (out / "plany" / "stary").mkdir(parents=True)
    with app.app_context():
        report = fetch_site_data(out)
    assert report.plans == 1
    assert report.stale == ["240-ZBI-1S-2R-Z (26/27-Z)"]
    assert [line.split(" ")[0] for line in report.skipped] == ["240-INF-1S-1R-Z"]
    assert not (out / "plany" / "stary").exists()

    index = read(out / "indeks.json")
    assert index["faculties"] == [{"code": "240-000", "name": "Wydział Informatyki"}]
    assert index["cycles"][0]["id"] == "26/27-Z"
    assert len(index["groups"]) == 25
    zbi = next(g for g in index["groups"] if g["code"] == "240-ZBI-1S-2R-Z")
    assert zbi["plans"] == [{"cycle": "26/27-Z", "history": False}]
    assert all(not g["plans"] for g in index["groups"] if g is not zbi)

    plan = read(out / "plany" / "26-27-Z" / "240-ZBI-1S-2R-Z.json")
    assert len(plan["activities"]) == 53
    assert plan["stale"] is True and plan["pageFetchedAt"] == "2026-09-25T16:00:00+00:00"
    assert "history" not in plan

    cycle = read(out / "cykle" / "26-27-Z.json")
    assert cycle["term"]["start"] == "2026-10-01"
    assert cycle["calendar"]["swaps"] == {"2026-11-10": 2}
    assert cycle["classTypes"]["W"] == "wykład"


def test_history_is_attached_to_the_plan(app, tmp_path):
    history = tmp_path / "historia"
    (history / "26-27-Z").mkdir(parents=True)
    checks = [{"at": "2026-06-30T22:09:09", "note": "stan bazowy", "changes": []}]
    (history / "26-27-Z" / "240-ZBI-1S-2R-Z.json").write_text(json.dumps({"checks": checks, "latest": []}), encoding="utf-8")
    out = tmp_path / "dane"
    with app.app_context():
        fetch_site_data(out, history_dir=history)
    assert read(out / "plany" / "26-27-Z" / "240-ZBI-1S-2R-Z.json")["history"] == {"checks": checks}
    zbi = next(g for g in read(out / "indeks.json")["groups"] if g["code"] == "240-ZBI-1S-2R-Z")
    assert zbi["plans"] == [{"cycle": "26/27-Z", "history": True}]


def test_cli_writes_where_the_server_reads(app, tmp_path):
    app.config["SITE_DATA_DIR"] = tmp_path / "serwer"
    result = app.test_cli_runner().invoke(args=["fetch"])
    assert result.exit_code == 0, result.output
    assert "Zapisano 1 plan w" in result.output
    assert app.test_client().get("/dane/indeks.json").json["cycles"][0]["id"] == "26/27-Z"
