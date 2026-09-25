"""Łączenie planów."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace

from .model import Activity, Plan


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
