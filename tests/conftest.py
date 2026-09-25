from datetime import time

import pytest

from app.plan.model import Activity, Recurrence


def make_activity(
    subject="FIZ",
    kind="LAB",
    group=1,
    day=0,
    start="8:00",
    end="9:30",
    recurrence=Recurrence.WEEKLY,
    dates=(),
    name=None,
):
    h1, m1 = map(int, start.split(":"))
    h2, m2 = map(int, end.split(":"))
    return Activity(
        subject_code=subject,
        subject_name=name or subject,
        class_type=kind,
        group_no=group,
        weekday=day,
        start=time(h1, m1),
        end=time(h2, m2),
        recurrence=recurrence,
        dates=tuple(dates),
    )


@pytest.fixture
def activity():
    return make_activity
