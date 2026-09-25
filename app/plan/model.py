"""Model planu, niezależny od tego, jak USOSweb go wyświetla."""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import date, datetime, time


class PlanKind(enum.Enum):
    SUBJECT_GROUP = "g"  # grupa przedmiotów, np. 240-ZBI-1S-2R-Z
    SUBJECT = "p"        # przedmiot w cyklu dydaktycznym
    CLASS_GROUP = "z"    # konkretna grupa zajęciowa przedmiotu


class Recurrence(enum.Enum):
    WEEKLY = "weekly"
    ODD = "odd"
    EVEN = "even"
    # Zajęcia w wybrane daty; wtedy Activity.dates jest niepuste.
    IRREGULAR = "irregular"


@dataclass(frozen=True)
class PlanRef:
    kind: PlanKind
    code: str
    cycle: str = ""
    group_no: int | None = None

    @property
    def key(self) -> str:
        key = f"{self.kind.value}:{self.code}"
        if self.cycle:
            key += f"@{self.cycle}"
        if self.group_no is not None:
            key += f"#{self.group_no}"
        return key


@dataclass(frozen=True)
class Activity:
    """Jeden termin w tygodniu jednej grupy zajęciowej."""

    subject_code: str
    subject_name: str
    class_type: str
    group_no: int
    weekday: int  # 0 = poniedziałek
    start: time
    end: time
    recurrence: Recurrence = Recurrence.WEEKLY
    lecturers: tuple[str, ...] = ()
    room: str | None = None
    dates: tuple[date, ...] = ()
    sources: tuple[str, ...] = ()

    @property
    def identity(self) -> tuple:
        # Wspólny wykład występuje w planach kilku kierunków; po połączeniu
        # planów ma zostać jeden bloczek z kilkoma źródłami.
        return (
            self.subject_code,
            self.class_type,
            self.group_no,
            self.weekday,
            self.start,
            self.end,
        )


@dataclass(frozen=True)
class Plan:
    ref: PlanRef
    title: str
    activities: tuple[Activity, ...]
    fetched_at: datetime
