from datetime import datetime

from app.plan.merge import merge
from app.plan.model import Plan, PlanKind, PlanRef


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
