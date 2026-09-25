"""Ukrywanie przedmiotów, typów zajęć i cudzych grup."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from .model import Activity


@dataclass(frozen=True)
class Selection:
    hidden_subjects: frozenset[str] = frozenset()
    hidden_types: frozenset[tuple[str, str]] = frozenset()
    # (kod przedmiotu, typ zajęć) -> numer grupy, do której się chodzi.
    # Pozostałe grupy tego typu w tym przedmiocie są ukryte.
    chosen_groups: Mapping[tuple[str, str], int] = field(default_factory=dict)

    def shows(self, activity: Activity) -> bool:
        if activity.subject_code in self.hidden_subjects:
            return False
        type_key = (activity.subject_code, activity.class_type)
        if type_key in self.hidden_types:
            return False
        chosen = self.chosen_groups.get(type_key)
        return chosen is None or chosen == activity.group_no

    def apply(self, activities: Iterable[Activity]) -> list[Activity]:
        return [a for a in activities if self.shows(a)]

    @property
    def is_empty(self) -> bool:
        return not (self.hidden_subjects or self.hidden_types or self.chosen_groups)
