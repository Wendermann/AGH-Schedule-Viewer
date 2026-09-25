"""Zajęcia i kalendarz semestru jako JSON dla przeglądarki (app/static/js/plan.js)."""

from __future__ import annotations

from .compose import TeachingCalendar
from .model import Activity


def activity_json(activity: Activity) -> dict:
    ids = activity.lecturer_ids
    return {
        "subject": activity.subject_code,
        "subjectName": activity.subject_name,
        "type": activity.class_type,
        "group": activity.group_no,
        "unit": activity.unit_id,
        "weekday": activity.weekday,
        "start": activity.start.strftime("%H:%M"),
        "end": activity.end.strftime("%H:%M"),
        "recurrence": activity.recurrence.value,
        "lecturers": [
            {"id": ids[i] if i < len(ids) else None, "name": name} for i, name in enumerate(activity.lecturers)
        ],
        "room": activity.room,
        "building": activity.building,
        "block": activity.block,
        "dates": [d.isoformat() for d in activity.dates],
        "moved": [
            {"date": m.day.isoformat(), "start": m.start.strftime("%H:%M"), "end": m.end.strftime("%H:%M")}
            for m in activity.moved
        ],
    }


def calendar_json(calendar: TeachingCalendar) -> dict:
    return {
        "firstClass": calendar.first_class.isoformat(),
        "lastClass": calendar.last_class.isoformat(),
        "daysOff": [d.isoformat() for d in calendar.days_off],
        "swaps": {d.isoformat(): weekday for d, weekday in calendar.swaps.items()},
    }
