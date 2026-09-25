from datetime import date, datetime, timezone

from icalendar import Calendar

from app.ics import build_calendar
from app.plan.model import Recurrence

GENERATED = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)


def test_one_event_per_date_in_warsaw_time(activity):
    lab = activity(
        name="Fizyka", kind="LAB", group=3, start="9:45", end="11:15",
        recurrence=Recurrence.IRREGULAR, dates=[date(2026, 10, 5), date(2026, 10, 19)],
    )
    cal = Calendar.from_ical(build_calendar([lab], name="Mój plan", generated_at=GENERATED))
    events = list(cal.walk("VEVENT"))
    assert len(events) == 2
    start = events[0].decoded("dtstart")
    assert (start.hour, start.minute, str(start.tzinfo)) == (9, 45, "Europe/Warsaw")
    assert str(events[0]["summary"]) == "Fizyka (LAB 3)"
    assert list(cal.walk("VTIMEZONE"))


def test_uid_is_stable_between_refreshes(activity):
    lab = activity(dates=[date(2026, 10, 5)])
    first = Calendar.from_ical(build_calendar([lab], name="x", generated_at=GENERATED))
    later = Calendar.from_ical(
        build_calendar([lab], name="x", generated_at=datetime(2026, 10, 1, tzinfo=timezone.utc))
    )
    uid = lambda cal: str(next(iter(cal.walk("VEVENT")))["uid"])
    assert uid(first) == uid(later)


def test_classes_without_dates_are_left_out(activity):
    cal = Calendar.from_ical(build_calendar([activity()], name="x", generated_at=GENERATED))
    assert not list(cal.walk("VEVENT"))
