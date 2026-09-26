import json
from dataclasses import replace
from datetime import date, time
from pathlib import Path

import pytest

from app.plan.compose import compose, teaching_calendar
from app.plan.export import activity_json, calendar_json
from app.plan.model import MovedMeeting
from app.usos.api import _meeting
from app.usos.web import parse_group_plan

FIXTURES = Path(__file__).parent / "fixtures" / "usos"


@pytest.fixture(scope="module")
def meetings():
    items = []
    for week in ("2026-10-26", "2026-11-09"):
        items += json.loads((FIXTURES / f"api-classgroups-{week}.json").read_text(encoding="utf-8"))
    return [m for item in items if (m := _meeting(item))]


@pytest.fixture(scope="module")
def activities(meetings):
    page = parse_group_plan((FIXTURES / "plan-240-ZBI-1S-2R-Z-26_27-Z.html").read_text(encoding="utf-8"))
    return compose(page, meetings)


def find(activities, unit, group, weekday=None):
    found = [a for a in activities if (a.unit_id, a.group_no) == (unit, group) and weekday in (None, a.weekday)]
    assert len(found) == 1
    return found[0]


def test_every_weekly_term_is_kept(activities):
    assert len(activities) == 53


def test_meeting_at_another_time_is_kept_apart(activities):
    lab = find(activities, 191381, 4)
    assert lab.moved == (MovedMeeting(date(2026, 10, 30), time(15, 45), time(17, 15)),)
    assert date(2026, 10, 30) not in lab.dates


def test_wednesday_classes_on_swapped_tuesday(activities):
    # 10.11 (wtorek) obowiązuje plan środowy; 11.11 to święto.
    lecture = find(activities, 191194, 1)
    assert lecture.weekday == 2
    assert date(2026, 11, 10) in lecture.dates
    assert date(2026, 11, 11) not in lecture.dates
    tuesday_lab = find(activities, 191410, 3)
    assert date(2026, 11, 10) not in tuesday_lab.dates


def test_group_with_two_terms_gets_each_date_once(activities):
    monday = find(activities, 202732, 1, weekday=0)
    thursday = find(activities, 202732, 1, weekday=3)
    assert all(d.weekday() == 0 for d in monday.dates)
    assert all(d.weekday() == 3 for d in thursday.dates)


def test_block_subject_without_placeholder_lecturer(activities):
    pe = find(activities, 202735, 2)
    assert pe.block is True
    assert pe.lecturers == () and pe.lecturer_ids == ()


def test_teaching_calendar(activities, meetings):
    calendar = teaching_calendar(activities, meetings)
    assert calendar.first_class == date(2026, 10, 26)
    assert calendar.last_class == date(2026, 11, 13)
    assert date(2026, 11, 11) in calendar.days_off
    assert calendar.swaps == {date(2026, 11, 10): 2}
    assert calendar_json(calendar)["swaps"] == {"2026-11-10": 2}


def test_a_few_meetings_do_not_cancel_a_day_off(activities, meetings):
    # Jak w danych wydziału z 26.09.2026: około 140 spotkań dziennie
    # i 3 spotkania jednego kierunku 11 listopada.
    faculty = meetings * 30
    extra = [replace(m, day=date(2026, 11, 11)) for m in meetings if m.confirmed and m.day == date(2026, 11, 12)][:3]
    assert len(extra) == 3
    calendar = teaching_calendar(activities, faculty + extra)
    assert date(2026, 11, 11) in calendar.days_off
    assert calendar.swaps == {date(2026, 11, 10): 2}


def test_activity_json_matches_browser_shape(activities):
    data = activity_json(find(activities, 191381, 4))
    assert data["subject"] == "240-ZBI-1S-114"
    assert (data["type"], data["group"], data["unit"], data["weekday"]) == ("CWL", 4, 191381, 4)
    assert (data["start"], data["end"], data["recurrence"]) == ("15:45", "18:00", "weekly")
    assert data["lecturers"] == [{"id": 100776, "name": "Marek Ciechanowski"}]
    assert (data["room"], data["building"]) == ("303", "D10")
    assert data["moved"] == [{"date": "2026-10-30", "start": "15:45", "end": "17:15"}]
