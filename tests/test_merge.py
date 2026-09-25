from datetime import date, datetime

from app.plan.merge import collide, conflicts, conflicts_per_day, merge
from app.plan.model import Plan, PlanKind, PlanRef, Recurrence


def plan(code, *activities):
    return Plan(PlanRef(PlanKind.SUBJECT_GROUP, code, "26/27-Z"), code, activities, datetime(2026, 9, 25))


def test_shared_lecture_appears_once_with_both_sources(activity):
    lecture = activity(subject="FIZ", kind="WYK")
    merged = merge([plan("A", lecture), plan("B", lecture, activity(subject="MAT"))])
    assert len(merged) == 2
    fiz = next(a for a in merged if a.subject_code == "FIZ")
    assert fiz.sources == ("g:A@26/27-Z", "g:B@26/27-Z")


def test_merge_orders_chronologically(activity):
    merged = merge(
        [plan("A", activity(subject="B", day=1), activity(subject="A", day=0, start="12:00", end="13:30"))]
    )
    assert [a.subject_code for a in merged] == ["A", "B"]


def test_touching_classes_do_not_collide(activity):
    assert not collide(activity(end="9:30"), activity(start="9:30", end="11:00"))


def test_odd_and_even_weeks_do_not_collide(activity):
    odd = activity(recurrence=Recurrence.ODD)
    even = activity(recurrence=Recurrence.EVEN, subject="MAT")
    weekly = activity(subject="CHE")
    assert not collide(odd, even)
    assert collide(odd, weekly)


def test_concrete_dates_decide_when_both_are_known(activity):
    a = activity(recurrence=Recurrence.IRREGULAR, dates=[date(2026, 10, 5)])
    b = activity(recurrence=Recurrence.IRREGULAR, dates=[date(2026, 10, 12)], subject="MAT")
    c = activity(recurrence=Recurrence.IRREGULAR, dates=[date(2026, 10, 12)], subject="CHE")
    assert not collide(a, b)
    assert collide(b, c)


def test_conflicts_are_counted_per_day(activity):
    acts = [
        activity(subject="A", day=2, start="10:00", end="11:30"),
        activity(subject="B", day=2, start="11:00", end="12:30"),
        activity(subject="C", day=2, start="12:00", end="13:00"),
        activity(subject="D", day=3),
    ]
    assert len(conflicts(acts)) == 2
    assert conflicts_per_day(acts) == {2: 2}
