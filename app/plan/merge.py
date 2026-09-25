"""Łączenie planów i wykrywanie kolizji."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import replace
from itertools import combinations

from .model import Activity, Plan, Recurrence


def merge(plans: Sequence[Plan]) -> list[Activity]:
    merged: dict[tuple, Activity] = {}
    for plan in plans:
        key = plan.ref.key
        for activity in plan.activities:
            existing = merged.get(activity.identity)
            if existing is None:
                merged[activity.identity] = replace(activity, sources=(key,))
            elif key not in existing.sources:
                merged[activity.identity] = replace(
                    existing, sources=existing.sources + (key,)
                )
    return sorted(merged.values(), key=_chronological)


def _chronological(a: Activity) -> tuple:
    return (a.weekday, a.start, a.end, a.subject_name, a.class_type, a.group_no)


def overlaps_in_time(a: Activity, b: Activity) -> bool:
    return a.weekday == b.weekday and a.start < b.end and b.start < a.end


def collide(a: Activity, b: Activity) -> bool:
    """Czy da się fizycznie trafić na oba zajęcia naraz."""
    if not overlaps_in_time(a, b):
        return False
    if a.dates and b.dates:
        return not set(a.dates).isdisjoint(b.dates)
    return {a.recurrence, b.recurrence} != {Recurrence.ODD, Recurrence.EVEN}


def conflicts(activities: Iterable[Activity]) -> list[tuple[Activity, Activity]]:
    by_day: dict[int, list[Activity]] = {}
    for activity in activities:
        by_day.setdefault(activity.weekday, []).append(activity)
    found = []
    for day in sorted(by_day):
        for a, b in combinations(sorted(by_day[day], key=_chronological), 2):
            if collide(a, b):
                found.append((a, b))
    return found


def conflicts_per_day(activities: Iterable[Activity]) -> dict[int, int]:
    counts: dict[int, int] = {}
    for a, _ in conflicts(activities):
        counts[a.weekday] = counts.get(a.weekday, 0) + 1
    return counts
