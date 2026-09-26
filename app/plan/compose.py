"""Plan grupy przedmiotów: skład i prowadzący z USOSweb, daty spotkań z USOS API."""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median

from app.usos.api import Meeting
from app.usos.web import GroupPlanPage, PlanEntry

from .model import Activity, MovedMeeting


DAY_OFF_SHARE = 0.1


@dataclass(frozen=True)
class TeachingCalendar:
    first_class: date
    last_class: date
    days_off: tuple[date, ...]
    # Dzień -> dzień tygodnia, którego plan wtedy obowiązuje (np. 10.11 jak środa).
    swaps: dict[date, int]


def compose(page: GroupPlanPage, meetings: Iterable[Meeting]) -> list[Activity]:
    """Terminy z planu tygodniowego z datami ich spotkań.

    Spotkanie trafia do terminu tej samej grupy o tej samej godzinie, a gdy
    jest kilka takich terminów, do tego z tym samym dniem tygodnia. W dniu
    z przeniesionym planem (np. wtorek jak środa) dzień się nie zgadza, ale
    godzina tak. Spotkanie o innej godzinie niż w planie trafia do `moved`.
    """
    entries = list(page.entries)
    by_group = defaultdict(list)
    for i, entry in enumerate(entries):
        by_group[(entry.unit_id, entry.group_no)].append(i)
    dates = [[] for _ in entries]
    moved = [[] for _ in entries]
    for meeting in meetings:
        candidates = by_group.get((meeting.unit_id, meeting.group_no))
        if not candidates:
            continue
        matching = [i for i in candidates if (entries[i].start, entries[i].end) == (meeting.start, meeting.end)]
        pool = matching or candidates
        same_day = [i for i in pool if entries[i].weekday == meeting.day.weekday()]
        target = (same_day or pool)[0]
        if matching:
            dates[target].append(meeting.day)
        else:
            moved[target].append(MovedMeeting(meeting.day, meeting.start, meeting.end))
    return [_activity(e, sorted(d), sorted(m, key=lambda x: x.day)) for e, d, m in zip(entries, dates, moved)]


def _activity(entry: PlanEntry, dates: list[date], moved: list[MovedMeeting]) -> Activity:
    # „- Prodziekan” to konto zastępcze przedmiotów blokowych, nie prowadzący.
    people = [p for p in entry.lecturers if not p.name.startswith("- ")]
    return Activity(
        subject_code=entry.subject_code,
        subject_name=entry.subject_name,
        class_type=entry.class_type,
        group_no=entry.group_no,
        weekday=entry.weekday,
        start=entry.start,
        end=entry.end,
        recurrence=entry.recurrence,
        lecturers=tuple(p.name for p in people),
        lecturer_ids=tuple(p.id for p in people),
        room=entry.room,
        building=entry.building,
        unit_id=entry.unit_id,
        block=entry.subject_name.startswith("Blok "),
        dates=tuple(dates),
        moved=tuple(moved),
    )


def teaching_calendar(activities: Iterable[Activity], meetings: Iterable[Meeting]) -> TeachingCalendar:
    """Dni wolne i przeniesienia odczytane z potwierdzonych spotkań.

    Spotkania wyliczane przez USOS z częstotliwości nie uwzględniają
    przeniesień dni, więc nie biorą udziału w głosowaniu.

    Dzień wolny to dzień roboczy bez spotkań albo z garstką spotkań, np.
    11 listopada z kilkoma zajęciami jednego kierunku umówionymi osobno.
    Granica to ułamek mediany liczby spotkań w dni robocze.
    """
    origin = {}
    for a in activities:
        origin[(a.unit_id, a.group_no, a.start, a.end)] = a.weekday
    votes: dict[date, Counter] = defaultdict(Counter)
    for m in meetings:
        weekday = origin.get((m.unit_id, m.group_no, m.start, m.end))
        if m.confirmed and weekday is not None:
            votes[m.day][weekday] += 1
    if not votes:
        raise ValueError("brak potwierdzonych spotkań, z których dałoby się odczytać kalendarz")
    first, last = min(votes), max(votes)
    totals = {day: sum(counter.values()) for day, counter in votes.items()}
    workdays = [n for day, n in totals.items() if day.weekday() < 5]
    threshold = DAY_OFF_SHARE * median(workdays) if workdays else 0
    days_off = []
    day = first
    while day <= last:
        if day.weekday() < 5 and totals.get(day, 0) < threshold:
            days_off.append(day)
        day += timedelta(days=1)
    swaps = {}
    for day, counter in sorted(votes.items()):
        if day in days_off:
            continue
        weekday, count = counter.most_common(1)[0]
        if weekday != day.weekday() and count > sum(counter.values()) / 2:
            swaps[day] = weekday
    return TeachingCalendar(first, last, tuple(days_off), swaps)
