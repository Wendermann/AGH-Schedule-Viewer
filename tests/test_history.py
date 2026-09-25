import json
from pathlib import Path

from app.history import diff, monitor_seed, record

ROOT = Path(__file__).parent.parent
MONITOR = ROOT / "data" / "monitor-240-ZBI-1S-2R-Z-2026-06-30.json"
AT = "2026-09-25T18:00:00+00:00"


def activity(**overrides):
    base = {
        "subject": "240-ZBI-1S-074",
        "subjectName": "Kryptografia i podstawy kryptoanalizy",
        "type": "CWL",
        "group": 1,
        "unit": 191410,
        "weekday": 2,
        "start": "11:30",
        "end": "13:00",
        "recurrence": "weekly",
        "lecturers": [{"id": 1, "name": "Paweł Topa"}],
        "room": "4.30",
        "building": "D17",
        "block": False,
        "dates": ["2026-10-07", "2026-10-14"],
        "moved": [],
    }
    return {**base, **overrides}


def test_unchanged_plan_has_no_changes():
    assert diff([activity()], [activity()], AT) == []


def test_moved_class_lists_changed_fields():
    [change] = diff([activity()], [activity(weekday=0, start="16:45", end="18:15", dates=["2026-10-05", "2026-10-12"])], AT)
    assert change["kind"] == "modified"
    assert change["fields"] == ["weekday", "start", "end", "dates"]
    assert change["before"][0]["weekday"] == 2 and change["after"][0]["weekday"] == 0
    assert change["datesAdded"] == ["2026-10-05", "2026-10-12"]
    assert change["detectedAt"] == AT


def test_cancelled_meeting_is_a_change_of_dates():
    [change] = diff([activity()], [activity(dates=["2026-10-07"])], AT)
    assert change["fields"] == ["dates"]
    assert change["datesRemoved"] == ["2026-10-14"]


def test_added_and_removed_groups():
    changes = diff([activity(group=1)], [activity(group=2)], AT)
    assert [(c["kind"], c["group"]) for c in changes] == [("removed", 1), ("added", 2)]


def test_dates_are_ignored_when_one_side_has_none():
    # Migawka z monitora zmian nie ma dat spotkań.
    assert diff([activity(dates=[])], [activity()], AT) == []


def test_record_writes_only_when_the_plan_changes(tmp_path):
    path = tmp_path / "historia" / "26-27-Z" / "240-ZBI-1S-2R-Z.json"
    kwargs = {"code": "240-ZBI-1S-2R-Z", "cycle": "26/27-Z"}
    assert record(path, activities=[activity()], checked_at="2026-09-25T12:00:00+00:00", **kwargs) == []
    first = path.read_text(encoding="utf-8")
    assert record(path, activities=[activity()], checked_at="2026-09-25T18:00:00+00:00", **kwargs) == []
    assert path.read_text(encoding="utf-8") == first
    changes = record(path, activities=[activity(room="3.23")], checked_at="2026-09-26T00:00:00+00:00", **kwargs)
    assert [c["fields"] for c in changes] == [["room"]]
    history = json.loads(path.read_text(encoding="utf-8"))
    assert [c["at"] for c in history["checks"]] == ["2026-09-25T12:00:00+00:00", "2026-09-26T00:00:00+00:00"]
    assert history["latest"][0]["room"] == "3.23"


def test_record_starts_from_the_monitor_snapshot(tmp_path):
    seed = monitor_seed(MONITOR)
    assert len(seed["activities"]) == 34
    lecture = next(a for a in seed["activities"] if a["unit"] == 191059)
    assert (lecture["room"], lecture["building"], lecture["weekday"]) == ("on-line", "D17", 0)
    path = tmp_path / "zbi.json"
    moved = activity(weekday=0, start="16:45", end="18:15", lecturers=[{"id": 1, "name": "Paweł Topa"}])
    changes = record(path, code="240-ZBI-1S-2R-Z", cycle="26/27-Z", activities=[moved], checked_at=AT, seed=seed)
    kinds = {(c["unit"], c["group"]): c["kind"] for c in changes}
    assert kinds[(191410, 1)] == "modified"
    assert kinds[(191059, 1)] == "removed"
    history = json.loads(path.read_text(encoding="utf-8"))
    assert history["since"] == "2026-06-30T22:09:09"
    assert history["checks"][0]["note"] == "stan bazowy z monitora zmian"
