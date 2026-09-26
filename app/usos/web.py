"""Odczyt stron USOSweb: plan grupy przedmiotów i lista grup jednostki.

Z USOSweb bierzemy tylko to, czego nie ma w USOS API: skład grupy
przedmiotów (które grupy zajęciowe należą do planu) i nazwiska
prowadzących. Konkretne daty spotkań podaje API.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import time
from urllib.parse import parse_qs, urlsplit

from selectolax.parser import HTMLParser, Node

from app.plan.model import Recurrence

from .fetch import UsosError

WEEKDAYS = {
    "Poniedziałek": 0,
    "Wtorek": 1,
    "Środa": 2,
    "Czwartek": 3,
    "Piątek": 4,
    "Sobota": 5,
    "Niedziela": 6,
}

_GRID_ROW = re.compile(r"grid-row-(start|end):\s*g(\d{2})(\d{2})")


class UsosLayoutError(UsosError):
    """Strona nie ma oczekiwanej struktury, czyli USOSweb zmienił HTML."""


@dataclass(frozen=True)
class Person:
    id: int  # os_id w USOSweb, ten sam numer co user_id w API
    name: str


@dataclass(frozen=True)
class PlanEntry:
    """Jeden termin w tygodniu, tak jak pokazuje go plan grupy przedmiotów."""

    subject_code: str
    subject_name: str
    class_type: str  # skrót, np. CWL
    unit_id: int  # zaj_cyk_id; w API unit_id
    group_no: int
    weekday: int  # 0 = poniedziałek
    start: time
    end: time
    recurrence: Recurrence
    lecturers: tuple[Person, ...]
    room: str | None
    room_id: int | None
    building: str | None  # kod budynku, np. D17


@dataclass(frozen=True)
class GroupPlanPage:
    group_code: str
    group_name: str
    faculty_code: str
    faculty_name: str
    entries: tuple[PlanEntry, ...]


@dataclass(frozen=True)
class SubjectGroup:
    code: str
    name: str


def parse_group_plan(html: str) -> GroupPlanPage:
    """Plan grupy przedmiotów (`katalog2/przedmioty/pokazPlanGrupyPrzedmiotow`).

    Plan cyklu, dla którego USOS nie ma zajęć, daje pustą listę `entries`.
    """
    tree = HTMLParser(html)
    header = _definition_list(tree)
    faculty = _link_in(header, "Jednostka:")
    group = _link_in(header, "Grupa przedmiotów:")

    timetable = tree.css_first("usos-timetable")
    if timetable is None:
        raise UsosLayoutError("brak elementu usos-timetable")
    entries = []
    for column in timetable.css("usos-timetable > div"):
        day_name = _text(column.css_first("h4"))
        if day_name not in WEEKDAYS:
            raise UsosLayoutError(f"nieznany dzień tygodnia: {day_name!r}")
        for node in column.css("timetable-entry"):
            entries.append(_entry(node, WEEKDAYS[day_name]))

    return GroupPlanPage(
        group_code=_query_param(group.attributes["href"], "grupaKod"),
        group_name=_text(group),
        faculty_code=_query_param(faculty.attributes["href"], "kod"),
        faculty_name=_text(faculty),
        entries=tuple(entries),
    )


def parse_subject_groups(html: str) -> list[SubjectGroup]:
    """Grupy przedmiotów jednostki (`katalog2/przedmioty/wybierzGrupePrzedmiotow`).

    USOSweb dzieli tę listę na strony (domyślnie po 30), więc trzeba ją
    pobierać z dużym `tab_limit` (działa tylko razem z `tab_offset`
    i `tab_order`). Niepełna lista kończy się błędem, żeby indeks nie zgubił
    po cichu części kierunków. Jednostka bez grup (np. Wydział Odlewnictwa
    26.09.2026) daje pustą listę.
    """
    tree = HTMLParser(html)
    table = tree.css_first("table.wrnav")
    if table is None:
        notice = tree.css_first("notice-box")
        if notice is not None and "nie zdefiniowała żadnych grup" in notice.text():
            return []
        raise UsosLayoutError("brak tabeli z grupami przedmiotów")
    groups = []
    for row in table.css("tbody > tr"):
        cells = row.css("td")
        link = row.css_first("a[href*='grupaKod=']")
        if len(cells) != 3 or link is None:
            continue
        code = _text(cells[0])
        if _query_param(link.attributes["href"], "grupaKod") != code:
            raise UsosLayoutError(f"kod grupy {code!r} nie zgadza się z linkiem")
        groups.append(SubjectGroup(code=code, name=_text(cells[1])))

    nav = tree.css_first("table-nav-bar")
    total = int(nav.attributes["elements-count"]) if nav is not None else len(groups)
    if len(groups) != total:
        raise UsosLayoutError(f"lista niepełna: {len(groups)} z {total} grup")
    return groups


def _entry(node: Node, weekday: int) -> PlanEntry:
    attrs = node.attributes
    rows = dict(
        (edge, time(int(hour), int(minute)))
        for edge, hour, minute in _GRID_ROW.findall(attrs.get("style") or "")
    )
    info = _slot(node, "info")
    group_link = _slot(node, "dialog-info").css_first("a")
    if group_link is None or "start" not in rows or "end" not in rows:
        raise UsosLayoutError(f"niepełny wpis planu: {attrs.get('name-id')!r}")
    group_href = group_link.attributes["href"]

    room = room_id = building = None
    place = node.css_first("[slot=dialog-place]")
    if place is not None:
        for link in place.css("a"):
            href = link.attributes["href"]
            if "sala_id=" in href:
                room = _text(link).rstrip(",").removeprefix("Sala ").strip()
                room_id = int(_query_param(href, "sala_id"))
            elif "bud_kod=" in href:
                building = _query_param(href, "bud_kod")

    return PlanEntry(
        subject_code=attrs["name-id"],
        subject_name=attrs["name"],
        class_type=_text(info).split(",")[0].strip(),
        unit_id=int(_query_param(group_href, "zaj_cyk_id")),
        group_no=int(_query_param(group_href, "gr_nr")),
        weekday=weekday,
        start=rows["start"],
        end=rows["end"],
        recurrence=_recurrence(_text(_slot(node, "dialog-event"))),
        lecturers=tuple(
            Person(id=int(_query_param(link.attributes["href"], "os_id")), name=_text(link))
            for link in node.css("[slot=dialog-person] a")
        ),
        room=room,
        room_id=room_id,
        building=building,
    )


def _recurrence(event: str) -> Recurrence:
    # Przykłady: „każdy poniedziałek, 8:00 - 9:30”,
    # „co drugi wtorek (nieparzyste), 9:45 - 11:15”.
    if "(nieparzyste)" in event:
        return Recurrence.ODD
    if "(parzyste)" in event:
        return Recurrence.EVEN
    if event.startswith(("każdy ", "każda ")):
        return Recurrence.WEEKLY
    # Tak USOSweb opisuje zajęcia „w inny sposób, nie przez cały semestr”.
    # Konkretne daty takich zajęć i tak przychodzą z API.
    return Recurrence.IRREGULAR


def _definition_list(tree: HTMLParser) -> dict[str, Node]:
    dl = tree.css_first("main dl.inline-keyvalue-list")
    if dl is None:
        raise UsosLayoutError("brak nagłówka planu")
    pairs = {}
    label = None
    for child in dl.iter():
        if child.tag == "dt":
            label = _text(child)
        elif child.tag == "dd" and label is not None:
            pairs[label] = child
    return pairs


def _link_in(header: dict[str, Node], label: str) -> Node:
    cell = header.get(label)
    link = cell.css_first("a") if cell is not None else None
    if link is None:
        raise UsosLayoutError(f"brak pola {label!r} w nagłówku planu")
    return link


def _slot(node: Node, name: str) -> Node:
    slot = node.css_first(f"[slot={name}]")
    if slot is None:
        raise UsosLayoutError(f"brak slotu {name!r} we wpisie planu")
    return slot


def _query_param(href: str, name: str) -> str:
    values = parse_qs(urlsplit(href).query).get(name)
    if not values:
        raise UsosLayoutError(f"brak parametru {name!r} w linku {href!r}")
    return values[0]


def _text(node: Node | None) -> str:
    # USOSweb wstawia twarde spacje, np. w „gr.&nbsp;1”.
    return " ".join((node.text() if node is not None else "").split())
