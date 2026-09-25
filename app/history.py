"""Historia zmian planu kierunku: migawki i porównanie kolejnych sprawdzeń.

USOS przechowuje tylko bieżący stan planu, więc historię trzeba zbierać
samemu. Migawka to lista zajęć w postaci JSON z `app/plan/export.py`.
Porównanie idzie po grupie zajęciowej `(unit, group)`: jej terminy
w tygodniu i konkretne daty spotkań.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

TERM_FIELDS = ("weekday", "start", "end", "recurrence", "room", "building", "lecturers")
WEEKDAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
PARITY = {"każdy": "weekly", "nieparzyste": "odd", "parzyste": "even"}


def _term(activity: dict) -> dict:
    term = {field: activity[field] for field in TERM_FIELDS}
    term["lecturers"] = [p["name"] if isinstance(p, dict) else p for p in activity["lecturers"]]
    return term


def _by_group(activities: list[dict]) -> dict[tuple[int, int], list[dict]]:
    groups = defaultdict(list)
    for activity in activities:
        groups[(activity["unit"], activity["group"])].append(activity)
    return groups


def _meetings(items: list[dict]) -> set[str]:
    found = set()
    for a in items:
        found.update(a.get("dates", []))
        found.update(f"{m['date']} {m['start']}–{m['end']}" for m in a.get("moved", []))
    return found


def diff(before: list[dict], after: list[dict], detected_at: str) -> list[dict]:
    """Zmiany między dwiema migawkami, po jednej na grupę zajęciową."""
    old, new = _by_group(before), _by_group(after)
    changes = []
    for key in sorted(old.keys() | new.keys()):
        old_terms = sorted((_term(a) for a in old.get(key, [])), key=lambda t: (t["weekday"], t["start"]))
        new_terms = sorted((_term(a) for a in new.get(key, [])), key=lambda t: (t["weekday"], t["start"]))
        fields = []
        if old_terms and new_terms:
            for field in TERM_FIELDS:
                if [t[field] for t in old_terms] != [t[field] for t in new_terms]:
                    fields.append(field)
        # Stan bazowy z monitora zmian nie ma dat, więc wtedy daty pomijamy.
        old_dates, new_dates = _meetings(old.get(key, [])), _meetings(new.get(key, []))
        dates_known = bool(old_dates) and bool(new_dates)
        if dates_known and old_dates != new_dates:
            fields.append("dates")
        if old_terms and new_terms and not fields:
            continue
        sample = (new.get(key) or old[key])[0]
        change = {
            "kind": "modified" if old_terms and new_terms else "added" if new_terms else "removed",
            "unit": key[0],
            "group": key[1],
            "subject": sample["subject"],
            "subjectName": sample["subjectName"],
            "type": sample["type"],
            "fields": fields,
            "before": old_terms or None,
            "after": new_terms or None,
            "detectedAt": detected_at,
        }
        if "dates" in fields:
            change["datesAdded"] = sorted(new_dates - old_dates)
            change["datesRemoved"] = sorted(old_dates - new_dates)
        changes.append(change)
    return changes


def record(path: Path, *, code: str, cycle: str, activities: list[dict], checked_at: str, seed: dict | None = None) -> list[dict]:
    """Dopisuje sprawdzenie do pliku historii kierunku i zwraca wykryte zmiany.

    Plik zmienia się tylko wtedy, gdy plan się zmienił (albo przy pierwszym
    sprawdzeniu), żeby zapis co 6 godzin nie tworzył pustych commitów.
    """
    if path.exists():
        history = json.loads(path.read_text(encoding="utf-8"))
    elif seed is not None:
        history = {"code": code, "cycle": cycle, "since": seed["takenAt"], "latest": seed["activities"], "latestAt": seed["takenAt"], "checks": [{"at": seed["takenAt"], "note": seed["note"], "changes": []}]}
    else:
        history = {"code": code, "cycle": cycle, "since": checked_at, "latest": activities, "latestAt": checked_at, "checks": [{"at": checked_at, "note": "stan bazowy", "changes": []}]}
        _write(path, history)
        return []
    changes = diff(history["latest"], activities, checked_at)
    if changes or not path.exists():
        history["latest"] = activities
        history["latestAt"] = checked_at
        history["checks"].append({"at": checked_at, "changes": changes})
        _write(path, history)
    return changes


def _write(path: Path, history: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(history, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def monitor_seed(path: Path) -> dict:
    """Migawka z wcześniejszego monitora zmian użytkownika jako stan początkowy.

    Monitor nie zapisywał dat spotkań ani identyfikatorów prowadzących.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    activities = []
    for e in data["entries"]:
        building = e["building"].rsplit("[", 1)[-1].rstrip("]") if e["building"] else None
        activities.append(
            {
                "subject": e["course_code"],
                "subjectName": e["course"],
                "type": e["type_short"],
                "group": int(e["gr_nr"]),
                "unit": int(e["zaj_cyk_id"]),
                "weekday": WEEKDAYS.index(e["day"]),
                "start": e["start"],
                "end": e["end"],
                "recurrence": PARITY[e["parity"]],
                "lecturers": [{"id": None, "name": n} for n in e["lecturers"] if not n.startswith("- ")],
                "room": e["room"].removeprefix("Sala ") if e["room"] else None,
                "building": building,
                "block": e["course"].startswith("Blok "),
                "dates": [],
                "moved": [],
            }
        )
    return {"takenAt": data["taken_at"], "note": "stan bazowy z monitora zmian", "activities": activities}
