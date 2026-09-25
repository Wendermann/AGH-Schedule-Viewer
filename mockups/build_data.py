"""Prawdziwe dane do makiet: plany z USOSweb, daty spotkań z USOS API.

Uruchomienie z katalogu repozytorium:

    .venv/bin/python -m mockups.build_data

Pobiera 3 strony USOSweb (dwa plany i listę grup wydziału) i kilkadziesiąt
odpowiedzi API, z odstępami między zapytaniami. Wynik trafia do
`mockups/dane/plany.json`.
"""

from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

from app.config import Config
from app.usos.web import PlanEntry, parse_group_plan, parse_subject_groups

HERE = Path(__file__).parent
OUTPUT = HERE / "dane" / "plany.json"
BASELINE = HERE / "dane" / "monitor-240-ZBI-1S-2R-Z-2026-06-30.json"

API = "https://apps.usos.agh.edu.pl/services/"
CYCLE = "26/27-Z"
FACULTY = "240-000"
PLANS = ("240-ZBI-1S-2R-Z", "240-INF-1S-2R-Z")
HISTORY_PLAN = "240-ZBI-1S-2R-Z"

# USOSweb ma w robots.txt zakaz pobierania, więc tu odstęp jest dłuższy.
WEB_INTERVAL = 3.0
API_INTERVAL = 1.0
# Tyle grup zajęciowych mieści się bez problemu w jednym tt/classgroups.
BATCH = 50
MEETING_FIELDS = "type|start_time|end_time|unit_id|group_number|frequency"
WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
PARITY = {"każdy": "weekly", "nieparzyste": "odd", "parzyste": "even"}


class Client:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers["User-Agent"] = Config.USOS_USER_AGENT
        self._last: dict[str, float] = {}

    def _wait(self, kind: str, interval: float) -> None:
        delay = self._last.get(kind, 0.0) + interval - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        self._last[kind] = time.monotonic()

    def web(self, action: str, **params: str) -> str:
        self._wait("web", WEB_INTERVAL)
        query = "_action=" + quote(action, safe="/")
        for name, value in params.items():
            query += f"&{name}={quote(value, safe='')}"
        response = self.session.get(f"{Config.USOS_BASE_URL}?{query}", timeout=30)
        response.raise_for_status()
        response.encoding = "utf-8"
        return response.text

    def api(self, method: str, **params: str | int):
        self._wait("api", API_INTERVAL)
        response = self.session.get(API + method, params=params, timeout=30)
        response.raise_for_status()
        return response.json()


def plan_url(code: str) -> str:
    return (
        f"{Config.USOS_BASE_URL}?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"
        f"&grupa_kod={quote(code, safe='')}&cdyd_kod={quote(CYCLE, safe='')}"
    )


def hhmm(value) -> str:
    return value.strftime("%H:%M")


def activity_from(entry: PlanEntry) -> dict:
    return {
        "subject": entry.subject_code,
        "subjectName": entry.subject_name,
        "type": entry.class_type,
        "group": entry.group_no,
        "unit": entry.unit_id,
        "weekday": entry.weekday,
        "start": hhmm(entry.start),
        "end": hhmm(entry.end),
        "recurrence": entry.recurrence.value,
        # „- Prodziekan” to konto zastępcze przedmiotów blokowych, nie prowadzący.
        "lecturers": [
            {"id": p.id, "name": p.name} for p in entry.lecturers if not p.name.startswith("- ")
        ],
        "room": entry.room,
        "building": entry.building,
        "block": entry.subject_name.startswith("Blok "),
        "dates": [],
        # Pojedyncze spotkania o innej godzinie niż w planie tygodniowym.
        "changed": [],
    }


def attach_meetings(client: Client, activities: list[dict], term: dict) -> list[tuple[date, int]]:
    """Dopisuje daty spotkań do zajęć. Zwraca (data, dzień tygodnia z planu)
    dla spotkań potwierdzonych, z których potem wynikają dni wolne i przeniesienia."""
    by_group = defaultdict(list)
    for activity in activities:
        by_group[(activity["unit"], activity["group"])].append(activity)
    ids = [f"{unit}|{group}" for unit, group in by_group]

    confirmed = []
    day = date.fromisoformat(term["start_date"])
    last = date.fromisoformat(term["end_date"])
    while day <= last:
        for i in range(0, len(ids), BATCH):
            meetings = client.api(
                "tt/classgroups",
                classgroup_ids="|".join(ids[i : i + BATCH]),
                start=day.isoformat(),
                days=7,
                fields=MEETING_FIELDS,
            )
            for meeting in meetings:
                # Dla takich częstotliwości API zwraca wszystkie możliwe dni cyklu.
                if meeting.get("frequency") in ("other", "once"):
                    continue
                when = datetime.fromisoformat(meeting["start_time"])
                start, end = meeting["start_time"][11:16], meeting["end_time"][11:16]
                candidates = by_group[(meeting["unit_id"], meeting["group_number"])]
                matching = [a for a in candidates if (a["start"], a["end"]) == (start, end)]
                same_day = [a for a in matching or candidates if a["weekday"] == when.weekday()]
                target = (same_day or matching or candidates)[0]
                if matching:
                    target["dates"].append(when.date().isoformat())
                else:
                    target["changed"].append(
                        {"date": when.date().isoformat(), "start": start, "end": end}
                    )
                if meeting["type"] == "classgroup2":
                    confirmed.append((when.date(), target["weekday"]))
        day += timedelta(days=7)
    for activity in activities:
        activity["dates"].sort()
        activity["changed"].sort(key=lambda m: m["date"])
    return confirmed


def calendar_from(confirmed: list[tuple[date, int]]) -> dict:
    origins = defaultdict(Counter)
    for day, weekday in confirmed:
        origins[day][weekday] += 1
    first, last = min(origins), max(origins)
    days_off = []
    day = first
    while day <= last:
        if day.weekday() < 5 and day not in origins:
            days_off.append(day.isoformat())
        day += timedelta(days=1)
    swaps = {}
    for day, counter in origins.items():
        weekday, count = counter.most_common(1)[0]
        if weekday != day.weekday() and count > sum(counter.values()) / 2:
            swaps[day.isoformat()] = weekday
    return {
        "firstClass": first.isoformat(),
        "lastClass": last.isoformat(),
        "daysOff": days_off,
        "swaps": dict(sorted(swaps.items())),
    }


def terms_of(items: list[dict]) -> list[dict]:
    keys = ("weekday", "start", "end", "recurrence", "room", "building", "lecturers")
    return sorted(({k: item[k] for k in keys} for item in items), key=lambda t: (t["weekday"], t["start"]))


def baseline_terms(entries: list[dict]) -> dict:
    groups = defaultdict(list)
    for e in entries:
        building = e["building"].rsplit("[", 1)[-1].rstrip("]") if e["building"] else None
        room = e["room"].removeprefix("Sala ") if e["room"] else None
        groups[(int(e["zaj_cyk_id"]), int(e["gr_nr"]))].append(
            {
                "weekday": WEEKDAY_NAMES.index(e["day"]),
                "start": e["start"],
                "end": e["end"],
                "recurrence": PARITY[e["parity"]],
                "room": room,
                "building": building,
                "lecturers": [n for n in e["lecturers"] if not n.startswith("- ")],
                "subject": e["course_code"],
                "subjectName": e["course"],
                "type": e["type_short"],
            }
        )
    return groups


def history_from(activities: list[dict], checked_at: str) -> dict:
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    before = baseline_terms(baseline["entries"])
    now = defaultdict(list)
    for a in activities:
        now[(a["unit"], a["group"])].append(
            {**a, "lecturers": [p["name"] for p in a["lecturers"]]}
        )

    changes = []
    for key in sorted(before.keys() | now.keys()):
        old = terms_of(before[key]) if key in before else None
        new = terms_of(now[key]) if key in now else None
        if old == new:
            continue
        sample = (now.get(key) or before[key])[0]
        fields = []
        if old and new:
            for field in ("weekday", "start", "end", "recurrence", "room", "building", "lecturers"):
                if [t[field] for t in old] != [t[field] for t in new]:
                    fields.append(field)
        changes.append(
            {
                "kind": "modified" if old and new else "added" if new else "removed",
                "unit": key[0],
                "group": key[1],
                "subject": sample["subject"],
                "subjectName": sample["subjectName"],
                "type": sample["type"],
                "fields": fields,
                "before": old,
                "after": new,
                "detectedAt": checked_at,
            }
        )
    return {
        "checks": [
            {"at": baseline["taken_at"], "note": "stan bazowy z monitora zmian"},
            {"at": checked_at, "note": ""},
        ],
        "changes": changes,
    }


def main() -> None:
    client = Client()
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    term = client.api("terms/term", term_id=CYCLE)
    class_types = {
        code: item["name"]["pl"] for code, item in client.api("courses/classtypes_index").items()
    }
    faculties = []
    for offset in (0, 20):
        found = client.api("fac/search", query="Wydział", lang="pl", num=20, start=offset, fields="id|name")
        faculties += [
            {"code": f["id"], "name": f["name"]["pl"]}
            for f in found["items"]
            if f["id"].endswith("-000") and f["name"]["pl"].startswith("Wydział")
        ]

    groups = parse_subject_groups(
        client.web("katalog2/przedmioty/wybierzGrupePrzedmiotow", jed_org_kod=FACULTY, tab_limit="500")
    )

    plans, confirmed = [], []
    for code in PLANS:
        page = parse_group_plan(
            client.web("katalog2/przedmioty/pokazPlanGrupyPrzedmiotow", grupa_kod=code, cdyd_kod=CYCLE)
        )
        activities = [activity_from(e) for e in page.entries]
        confirmed += attach_meetings(client, activities, term)
        plan = {
            "code": page.group_code,
            "name": page.group_name,
            "cycle": CYCLE,
            "faculty": page.faculty_code,
            "usosUrl": plan_url(code),
            "activities": activities,
        }
        if code == HISTORY_PLAN:
            plan["history"] = history_from(activities, fetched_at)
        plans.append(plan)

    data = {
        "fetchedAt": fetched_at,
        "term": {
            "id": term["id"],
            "name": term["name"]["pl"],
            "start": term["start_date"],
            "end": term["end_date"],
        },
        "calendar": calendar_from(confirmed),
        "classTypes": class_types,
        "faculties": sorted(faculties, key=lambda f: f["code"]),
        "groups": [{"code": g.code, "name": g.name, "faculty": FACULTY} for g in groups],
        "plans": plans,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    meetings = sum(len(a["dates"]) for p in plans for a in p["activities"])
    print(f"Zapisano {OUTPUT}: {len(plans)} plany, {meetings} spotkań.")


if __name__ == "__main__":
    main()
