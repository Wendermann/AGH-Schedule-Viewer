"""Dane strony: indeks grup przedmiotów, plany z datami spotkań i kalendarz cyklu.

`flask fetch` zapisuje je jako JSON w katalogu danych, a `flask build`
kopiuje ten katalog do zbudowanej strony (`_site/dane`). Układ katalogu:

    indeks.json                       wydziały, cykle i grupy przedmiotów
    cykle/26-27-Z.json                cykl, kalendarz semestru, typy zajęć
    plany/26-27-Z/240-ZBI-1S-2R-Z.json
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import click
from flask import current_app
from flask.cli import with_appcontext

from .plan.compose import compose, teaching_calendar
from .plan.export import activity_json, calendar_json
from .usos.fetch import UsosError
from .usos.web import parse_group_plan, parse_subject_groups

PLAN_ACTION = "katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"
GROUPS_ACTION = "katalog2/przedmioty/wybierzGrupePrzedmiotow"


def cycle_dir(cycle: str) -> str:
    return cycle.replace("/", "-")


@dataclass
class FetchReport:
    plans: int = 0
    # Kopie z cache, bo USOSweb nie odpowiadał.
    stale: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _history(history_dir: Path | None, code: str, cycle: str) -> dict | None:
    if history_dir is None:
        return None
    path = history_dir / cycle_dir(cycle) / f"{code}.json"
    if not path.exists():
        return None
    return {"checks": json.loads(path.read_text(encoding="utf-8"))["checks"]}


def fetch_site_data(output: Path, *, history_dir: Path | None = None) -> FetchReport:
    config = current_app.config
    web = current_app.extensions["usos"]
    api = current_app.extensions["usos_api"]
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report = FetchReport()
    # Stare pliki planów usuwamy, żeby nie została grupa, której już nie ma.
    for sub in ("plany", "cykle"):
        shutil.rmtree(output / sub, ignore_errors=True)

    class_types = api.class_types()
    faculties, groups = [], []
    for faculty in config["SITE_FACULTIES"]:
        info = api.call("fac/faculty", fac_id=faculty, fields="id|name")
        faculties.append({"code": faculty, "name": info["name"]["pl"]})
        page = web.get(GROUPS_ACTION, jed_org_kod=faculty, tab_limit="500")
        groups += [{"code": g.code, "name": g.name, "faculty": faculty, "plans": []} for g in parse_subject_groups(page.html)]

    cycles = []
    for cycle in config["SITE_CYCLES"]:
        term = api.term(cycle)
        pages = {}
        for group in groups:
            try:
                page = web.get(PLAN_ACTION, grupa_kod=group["code"], cdyd_kod=cycle)
            except UsosError as error:
                report.skipped.append(f"{group['code']} ({cycle}): {error}")
                continue
            plan = parse_group_plan(page.html)
            # Grupa bez zajęć w tym cyklu nie dostaje planu.
            if plan.entries:
                pages[group["code"]] = (group, page, plan)
        ids = {(e.unit_id, e.group_no) for _, _, plan in pages.values() for e in plan.entries}
        meetings = api.meetings(ids, term.start, term.end) if ids else []

        everything = []
        for code, (group, page, plan) in pages.items():
            activities = compose(plan, meetings)
            everything += activities
            history = _history(history_dir, code, cycle)
            data = {
                "code": code,
                "name": plan.group_name,
                "cycle": cycle,
                "faculty": plan.faculty_code,
                "usosUrl": web.url_for(PLAN_ACTION, grupa_kod=code, cdyd_kod=cycle),
                "fetchedAt": now,
                "pageFetchedAt": page.fetched_at.isoformat(timespec="seconds"),
                "stale": page.stale,
                "activities": [activity_json(a) for a in activities],
            }
            if history:
                data["history"] = history
            _write(output / "plany" / cycle_dir(cycle) / f"{code}.json", data)
            group["plans"].append({"cycle": cycle, "history": bool(history)})
            report.plans += 1
            if page.stale:
                report.stale.append(f"{code} ({cycle})")

        cycle_data = {
            "term": {"id": term.id, "name": term.name, "start": term.start.isoformat(), "end": term.end.isoformat()},
            "classTypes": class_types,
        }
        if meetings:
            cycle_data["calendar"] = calendar_json(teaching_calendar(everything, meetings))
        _write(output / "cykle" / f"{cycle_dir(cycle)}.json", cycle_data)
        cycles.append(cycle_data["term"])

    _write(output / "indeks.json", {"fetchedAt": now, "cycles": cycles, "faculties": faculties, "groups": groups})
    return report


@click.command("fetch")
@click.option(
    "--output",
    default="dane",
    show_default=True,
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog, do którego trafią dane strony.",
)
@click.option(
    "--history",
    "history_dir",
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog historii zmian z gałęzi dane, np. dane-historia/historia.",
)
@with_appcontext
def fetch_command(output: Path, history_dir: Path | None) -> None:
    """Pobiera z USOS dane strony: indeks grup, plany i kalendarz cyklu."""
    report = fetch_site_data(output, history_dir=history_dir)
    click.echo(f"Zapisano {report.plans} planów w {output}.")
    for line in report.stale:
        click.echo(f"Kopia z cache (USOSweb nie odpowiadał): {line}")
    for line in report.skipped:
        click.echo(f"Pominięty: {line}", err=True)
