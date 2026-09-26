import json
from datetime import date, time
from pathlib import Path

import pytest
import requests

from app.usos.api import UsosApi
from app.usos.fetch import RateLimiter, UsosError, UsosUnavailable

FIXTURES = Path(__file__).parent / "fixtures" / "usos"
BASE = "https://api.example/services/"


def fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class Response:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self._data = data
        self.text = json.dumps(data)

    def json(self):
        return self._data


class WeekSession:
    """Odpowiada zapisanymi tygodniami tt/classgroups, tylko dla pytanych grup."""

    def __init__(self):
        self.headers = {}
        self.calls = []

    def get(self, url, params, timeout):
        self.calls.append(params)
        path = FIXTURES / f"api-classgroups-{params['start']}.json"
        meetings = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        ids = params["classgroup_ids"].split("|")
        wanted = set(zip(map(int, ids[::2]), map(int, ids[1::2])))
        return Response(data=[m for m in meetings if (m["unit_id"], m["group_number"]) in wanted])


class ScriptedSession:
    def __init__(self, *responses):
        self.headers = {}
        self.responses = list(responses)

    def get(self, url, params, timeout):
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def api(session):
    return UsosApi(BASE, limiter=RateLimiter(0), timeout=5, user_agent="test", session=session, sleep=lambda s: None)


def zbi_groups():
    meetings = fixture("api-classgroups-2026-10-26.json") + fixture("api-classgroups-2026-11-09.json")
    return {(m["unit_id"], m["group_number"]) for m in meetings}


def test_meetings_are_fetched_in_weekly_windows_and_batches():
    session = WeekSession()
    groups = zbi_groups()
    meetings = api(session).meetings(groups, date(2026, 10, 26), date(2026, 11, 15))
    # Trzy tygodnie, a w każdym grupy podzielone na paczki po najwyżej 50.
    starts = [call["start"] for call in session.calls]
    assert sorted(set(starts)) == ["2026-10-26", "2026-11-02", "2026-11-09"]
    assert all(len(call["classgroup_ids"].split("|")) // 2 <= 50 for call in session.calls)
    assert len(session.calls) == 3 * -(-len(groups) // 50)
    assert len(meetings) == 32 + 21
    assert meetings == sorted(meetings, key=lambda m: (m.day, m.start, m.unit_id, m.group_no))


def test_last_window_is_shortened_to_the_end_date():
    session = WeekSession()
    api(session).meetings({(191059, 1)}, date(2026, 10, 26), date(2026, 10, 28))
    assert [call["days"] for call in session.calls] == [3]


def test_meeting_fields():
    meetings = api(WeekSession()).meetings(zbi_groups(), date(2026, 10, 26), date(2026, 11, 1))
    lab = next(m for m in meetings if (m.unit_id, m.group_no, m.day) == (191381, 4, date(2026, 10, 30)))
    assert (lab.start, lab.end, lab.confirmed) == (time(15, 45), time(17, 15), True)
    language = next(m for m in meetings if m.unit_id == 202732)
    assert language.confirmed is False


def test_meetings_without_real_dates_are_skipped():
    item = {"type": "classgroup", "start_time": "2026-10-05 08:00:00", "end_time": "2026-10-05 09:30:00", "unit_id": 1, "group_number": 1}
    session = ScriptedSession(Response(data=[{**item, "frequency": "other"}, {**item, "frequency": "every_week"}]))
    assert len(api(session).meetings({(1, 1)}, date(2026, 10, 5), date(2026, 10, 5))) == 1


def test_term():
    session = ScriptedSession(Response(data=fixture("api-term-26_27-Z.json")))
    term = api(session).term("26/27-Z")
    assert (term.id, term.start, term.end) == ("26/27-Z", date(2026, 10, 1), date(2027, 2, 28))
    assert term.name == "Semestr zimowy 2026/2027"


def test_server_errors_are_retried():
    session = ScriptedSession(Response(500, {"message": "Internal USOS API error"}), Response(data={"W": {"name": {"pl": "wykład"}}}))
    assert api(session).class_types() == {"W": "wykład"}


def test_client_errors_are_not_retried():
    session = ScriptedSession(Response(400, {"message": "Parameter 'fields' has invalid value."}))
    with pytest.raises(UsosError, match="HTTP 400"):
        api(session).class_types()


def test_unavailable_after_all_retries():
    session = ScriptedSession(*[requests.ConnectionError("timeout")] * 3)
    with pytest.raises(UsosUnavailable):
        api(session).class_types()
