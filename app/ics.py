"""Kalendarz iCalendar z konkretnych terminów zajęć."""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event

from .plan.model import Activity

WARSAW = ZoneInfo("Europe/Warsaw")
PRODID = "-//AGH Schedule Viewer//PL"


def build_calendar(
    activities: Iterable[Activity],
    *,
    name: str,
    generated_at: datetime,
    refresh: timedelta = timedelta(hours=24),
) -> bytes:
    """Zajęcia bez konkretnych dat są pomijane: kalendarz zawiera tylko to,
    co na pewno się odbędzie."""
    calendar = Calendar()
    calendar.add("prodid", PRODID)
    calendar.add("version", "2.0")
    calendar.add("calscale", "GREGORIAN")
    calendar.add("x-wr-calname", name)
    calendar.add("x-wr-timezone", "Europe/Warsaw")
    calendar.add("refresh-interval", refresh, parameters={"VALUE": "DURATION"})
    calendar.add("x-published-ttl", refresh)

    days = []
    for activity in activities:
        for day in activity.dates:
            calendar.add_component(_event(activity, day, activity.start, activity.end, generated_at))
            days.append(day)
        for meeting in activity.moved:
            calendar.add_component(_event(activity, meeting.day, meeting.start, meeting.end, generated_at))
            days.append(meeting.day)

    if days:
        calendar.add_missing_timezones(
            first_date=min(days) - timedelta(days=1),
            last_date=max(days) + timedelta(days=1),
        )
    return calendar.to_ical()


def _event(activity: Activity, day: date, start: time, end: time, generated_at: datetime) -> Event:
    event = Event()
    # UID zależy tylko od tożsamości zajęć i daty, więc przy odświeżeniu
    # subskrypcji kalendarz aktualizuje wydarzenie zamiast je dublować.
    identity = "|".join(str(part) for part in activity.identity) + f"|{day}"
    uid = hashlib.sha1(identity.encode()).hexdigest()
    event.add("uid", f"{uid}@agh-schedule-viewer")
    event.add("dtstamp", generated_at)
    event.add("dtstart", datetime.combine(day, start, WARSAW))
    event.add("dtend", datetime.combine(day, end, WARSAW))
    event.add("summary", f"{activity.subject_name} ({activity.class_type} {activity.group_no})")
    if activity.room:
        event.add("location", activity.room)
    if activity.lecturers:
        event.add("description", ", ".join(activity.lecturers))
    return event
