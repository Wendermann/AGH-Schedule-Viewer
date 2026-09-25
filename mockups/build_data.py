"""Prawdziwe dane do makiet: plany z USOSweb, daty spotkań z USOS API.

Uruchomienie z katalogu repozytorium:

    .venv/bin/python -m mockups.build_data

Pobiera 3 strony USOSweb (dwa plany i listę grup wydziału) i kilkadziesiąt
odpowiedzi API, z odstępami między zapytaniami. Wynik trafia do
`mockups/dane/plany.json`. Pobieranie i składanie planu to ten sam kod,
którego używa aplikacja.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

from app.config import Config
from app.history import diff, monitor_seed
from app.plan.compose import compose, teaching_calendar
from app.plan.export import activity_json, calendar_json
from app.usos.api import UsosApi
from app.usos.fetch import RateLimiter
from app.usos.web import parse_group_plan, parse_subject_groups

ROOT = Path(__file__).parent.parent
OUTPUT = Path(__file__).parent / "dane" / "plany.json"
BASELINE = ROOT / "data" / "monitor-240-ZBI-1S-2R-Z-2026-06-30.json"

CYCLE = "26/27-Z"
FACULTY = "240-000"
PLANS = ("240-ZBI-1S-2R-Z", "240-INF-1S-2R-Z")
HISTORY_PLAN = "240-ZBI-1S-2R-Z"
# USOSweb ma w robots.txt zakaz pobierania, więc tu odstęp jest dłuższy.
WEB_INTERVAL = 3.0


def web_page(session: requests.Session, limiter: RateLimiter, action: str, **params: str) -> str:
    limiter.wait()
    query = "_action=" + quote(action, safe="/")
    for name, value in params.items():
        query += f"&{name}={quote(value, safe='')}"
    response = session.get(f"{Config.USOS_BASE_URL}?{query}", timeout=Config.USOS_TIMEOUT)
    response.raise_for_status()
    response.encoding = "utf-8"
    return response.text


def main() -> None:
    session = requests.Session()
    session.headers["User-Agent"] = Config.USOS_USER_AGENT
    web_limiter = RateLimiter(WEB_INTERVAL)
    api = UsosApi(
        Config.USOS_API_URL,
        limiter=RateLimiter(Config.USOS_MIN_INTERVAL),
        timeout=Config.USOS_TIMEOUT,
        user_agent=Config.USOS_USER_AGENT,
    )
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    term = api.term(CYCLE)
    faculties = []
    for offset in (0, 20):
        found = api.call("fac/search", query="Wydział", lang="pl", num=20, start=offset, fields="id|name")
        faculties += [
            {"code": f["id"], "name": f["name"]["pl"]}
            for f in found["items"]
            if f["id"].endswith("-000") and f["name"]["pl"].startswith("Wydział")
        ]
    groups = parse_subject_groups(
        web_page(session, web_limiter, "katalog2/przedmioty/wybierzGrupePrzedmiotow", jed_org_kod=FACULTY, tab_limit="500")
    )

    plans, all_activities, all_meetings = [], [], []
    for code in PLANS:
        page = parse_group_plan(
            web_page(session, web_limiter, "katalog2/przedmioty/pokazPlanGrupyPrzedmiotow", grupa_kod=code, cdyd_kod=CYCLE)
        )
        meetings = api.meetings({(e.unit_id, e.group_no) for e in page.entries}, term.start, term.end)
        activities = compose(page, meetings)
        all_activities += activities
        all_meetings += meetings
        plan = {
            "code": page.group_code,
            "name": page.group_name,
            "cycle": CYCLE,
            "faculty": page.faculty_code,
            "usosUrl": f"{Config.USOS_BASE_URL}?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"
            f"&grupa_kod={quote(code, safe='')}&cdyd_kod={quote(CYCLE, safe='')}",
            "activities": [activity_json(a) for a in activities],
        }
        if code == HISTORY_PLAN:
            seed = monitor_seed(BASELINE)
            plan["history"] = {
                "checks": [
                    {"at": seed["takenAt"], "note": seed["note"], "changes": []},
                    {"at": fetched_at, "changes": diff(seed["activities"], plan["activities"], fetched_at)},
                ]
            }
        plans.append(plan)

    data = {
        "fetchedAt": fetched_at,
        "term": {"id": term.id, "name": term.name, "start": term.start.isoformat(), "end": term.end.isoformat()},
        "calendar": calendar_json(teaching_calendar(all_activities, all_meetings)),
        "classTypes": api.class_types(),
        "faculties": sorted(faculties, key=lambda f: f["code"]),
        "groups": [{"code": g.code, "name": g.name, "faculty": FACULTY} for g in groups],
        "plans": plans,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    meetings = sum(len(a["dates"]) + len(a["moved"]) for p in plans for a in p["activities"])
    print(f"Zapisano {OUTPUT}: {len(plans)} plany, {meetings} spotkań.")


if __name__ == "__main__":
    main()
