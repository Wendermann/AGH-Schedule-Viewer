import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from app import create_app
from app.usos.api import Term, _meeting
from app.usos.fetch import Page

FIXTURES = Path(__file__).parent / "fixtures" / "usos"
PLAN = (FIXTURES / "plan-240-ZBI-1S-2R-Z-26_27-Z.html").read_text(encoding="utf-8")
EMPTY = (FIXTURES / "plan-240-INF-1S-2R-Z-22_23-Z.html").read_text(encoding="utf-8")


class FakeWeb:
    def __init__(self, html, stale=False):
        self.page = Page("https://usos.example/plan", html, datetime(2026, 9, 25, tzinfo=timezone.utc), stale)
        self.calls = []

    def get(self, action, *, refresh=False, **params):
        self.calls.append((action, refresh, params))
        return self.page


class FakeApi:
    def term(self, term_id):
        return Term(term_id, "Semestr zimowy 2026/2027", date(2026, 10, 1), date(2027, 2, 28))

    def meetings(self, groups, start, end):
        items = json.loads((FIXTURES / "api-classgroups-2026-10-26.json").read_text(encoding="utf-8"))
        return [m for item in items if (m := _meeting(item)) and (m.unit_id, m.group_no) in groups]


@pytest.fixture
def app(tmp_path):
    return create_app({"USOS_CACHE_PATH": tmp_path / "cache.sqlite3", "TESTING": True})


def run(app, tmp_path, web):
    app.extensions["usos"] = web
    app.extensions["usos_api"] = FakeApi()
    out = tmp_path / "dane" / "historia"
    result = app.test_cli_runner().invoke(args=["history", "--output", str(out)])
    return result, out / "26-27-Z" / "240-ZBI-1S-2R-Z.json"


def test_first_check_starts_from_the_monitor_snapshot(app, tmp_path):
    web = FakeWeb(PLAN)
    result, path = run(app, tmp_path, web)
    assert result.exit_code == 0, result.output
    assert "240-ZBI-1S-2R-Z (26/27-Z): 27 zmian" in result.output
    # Historia zawsze pobiera świeżą stronę, nie kopię z cache.
    assert web.calls[0][1] is True
    history = json.loads(path.read_text(encoding="utf-8"))
    assert history["since"] == "2026-06-30T22:09:09"
    assert len(history["checks"]) == 2


def test_stale_copy_is_not_recorded(app, tmp_path):
    result, path = run(app, tmp_path, FakeWeb(PLAN, stale=True))
    assert result.exit_code == 1
    assert "pominięty" in result.output
    assert not path.exists()


def test_empty_plan_is_not_recorded(app, tmp_path):
    result, path = run(app, tmp_path, FakeWeb(EMPTY))
    assert result.exit_code == 1
    assert "pusty plan" in result.output
    assert not path.exists()
