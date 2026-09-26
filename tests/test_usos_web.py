from collections import Counter
from datetime import time
from pathlib import Path

import pytest

from app.plan.model import Recurrence
from app.usos.web import (
    Person,
    SubjectGroup,
    UsosLayoutError,
    parse_group_plan,
    parse_subject_groups,
)

FIXTURES = Path(__file__).parent / "fixtures" / "usos"


def fixture(name):
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def plan():
    return parse_group_plan(fixture("plan-240-ZBI-1S-2R-Z-26_27-Z.html"))


def find(plan, unit_id, group_no):
    return [e for e in plan.entries if (e.unit_id, e.group_no) == (unit_id, group_no)]


def test_plan_header(plan):
    assert plan.group_code == "240-ZBI-1S-2R-Z"
    assert plan.group_name == (
        "240 - Informatyka - Zarządzanie bezpieczeństwem informacji, semestr 3"
    )
    assert plan.faculty_code == "240-000"
    assert plan.faculty_name == "Wydział Informatyki"


def test_plan_entries_and_class_groups(plan):
    assert len(plan.entries) == 53
    # Lektorat gr. 1 ma dwa terminy w tygodniu, reszta po jednym.
    per_group = Counter((e.unit_id, e.group_no) for e in plan.entries)
    assert len(per_group) == 52
    assert per_group[(202732, 1)] == 2
    assert {e.weekday for e in plan.entries} == {0, 1, 2, 3, 4}


def test_weekly_lecture(plan):
    [lecture] = find(plan, 191059, 1)
    assert lecture.subject_code == "240-ZBI-1S-114"
    assert lecture.subject_name == "Fizyka 2"
    assert lecture.class_type == "W"
    assert (lecture.weekday, lecture.start, lecture.end) == (0, time(8), time(9, 30))
    assert lecture.recurrence is Recurrence.WEEKLY
    assert lecture.lecturers == (Person(101263, "Zbigniew Kąkol"),)
    assert (lecture.room, lecture.room_id, lecture.building) == ("on-line", 1825, "D17")


def test_fortnightly_classes(plan):
    counts = Counter(e.recurrence for e in plan.entries)
    assert counts == {Recurrence.ODD: 21, Recurrence.EVEN: 16, Recurrence.WEEKLY: 16}
    [even] = find(plan, 191580, 1)
    assert even.recurrence is Recurrence.EVEN
    assert (even.weekday, even.start, even.end) == (1, time(9, 45), time(11, 15))
    assert (even.room, even.building) == ("3.22", "D17")


def test_several_lecturers(plan):
    [lab] = find(plan, 191450, 3)
    assert [p.name for p in lab.lecturers] == ["Ada Brzoza-Zajęcka", "Wojciech Zaborowski"]


def test_block_subject_without_room(plan):
    # Przedmioty blokowe (WF, lektorat) nie mają sali, a prowadzącym jest
    # konto zastępcze „- Prodziekan”.
    [pe] = find(plan, 202735, 2)
    assert pe.class_type == "WF"
    assert (pe.room, pe.room_id, pe.building) == (None, None, None)
    assert pe.lecturers == (Person(103764, "- Prodziekan"),)


def test_plan_without_classes():
    plan = parse_group_plan(fixture("plan-240-INF-1S-2R-Z-22_23-Z.html"))
    assert plan.group_code == "240-INF-1S-2R-Z"
    assert plan.entries == ()


@pytest.mark.parametrize(
    "event, expected",
    [
        ("każdy poniedziałek, 8:00 - 9:30", Recurrence.WEEKLY),
        ("każda środa, 8:00 - 9:30", Recurrence.WEEKLY),
        ("co drugi wtorek (nieparzyste), 8:00 - 9:30", Recurrence.ODD),
        ("co druga środa (parzyste), 9:45 - 11:15", Recurrence.EVEN),
        ("zajęcia w wybrane dni, 8:00 - 9:30", Recurrence.IRREGULAR),
    ],
)
def test_recurrence_from_event_text(event, expected):
    html = fixture("plan-240-ZBI-1S-2R-Z-26_27-Z.html").replace(
        "każdy poniedziałek, 8:00 - 9:30", event, 1
    )
    [lecture] = find(parse_group_plan(html), 191059, 1)
    assert lecture.recurrence is expected


def test_plan_layout_change_is_reported():
    html = fixture("plan-240-ZBI-1S-2R-Z-26_27-Z.html").replace("<usos-timetable", "<div", 1)
    with pytest.raises(UsosLayoutError):
        parse_group_plan(html)


def test_subject_groups():
    groups = parse_subject_groups(fixture("groups-240-000.html"))
    assert len(groups) == 25
    assert groups[0] == SubjectGroup(
        "240-ZBI-1S-1R-Z",
        "240 - Informatyka - Zarządzanie Bezpieczeństwem Informacji, semestr 1",
    )
    # Kody nie zawsze trzymają się schematu wydział-kierunek-stopień-rok-semestr.
    assert SubjectGroup(
        "240_INF-1S,7sem,po", "240_INF,stacjonarne, 1S,przedmioty obieralne"
    ) in groups


def test_unit_without_subject_groups():
    assert parse_subject_groups(fixture("groups-170-000.html")) == []


def test_incomplete_subject_group_list_is_rejected():
    html = fixture("groups-240-000.html").replace("elements-count=25", "elements-count=40", 1)
    with pytest.raises(UsosLayoutError, match="25 z 40"):
        parse_subject_groups(html)
