"""Dane strony: indeks grup przedmiotów, plany z datami spotkań i kalendarz cyklu.

`flask fetch` zapisuje je jako JSON w katalogu danych, a `flask build`
kopiuje ten katalog do zbudowanej strony (`_site/dane`). Układ katalogu:

    indeks.json                       wydziały, cykle, grupy przedmiotów, kierunki
    cykle/26-27-Z.json                cykl, kalendarz semestru, typy zajęć
    plany/26-27-Z/240-ZBI-1S-2R-Z.json
"""

from __future__ import annotations

import json
import shutil
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import click
from flask import Flask, current_app
from flask.cli import with_appcontext

from .catalog import place
from .plan.compose import compose, teaching_calendar
from .plan.export import activity_json, calendar_json
from .usos.fetch import UsosError
from .usos.web import parse_group_plan, parse_subject_groups
from .words import plural

PLAN_ACTION = "katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"
GROUPS_ACTION = "katalog2/przedmioty/wybierzGrupePrzedmiotow"
# Bez tab_offset i tab_order USOSweb ignoruje tab_limit i pokazuje 30 grup.
GROUPS_PAGE = {"tab_limit": "500", "tab_offset": "0", "tab_order": "2a1a"}
# Grupy przedmiotów zdefiniowane dla całej uczelni (języki obce, HES).
ROOT_UNIT = "000-000"
UNIT_NAMES = {ROOT_UNIT: "Grupy ogólnouczelniane"}
PROGRESS_EVERY = 50


def cycle_dir(cycle: str) -> str:
    return cycle.replace("/", "-")


def data_dir(app: Flask) -> Path:
    return Path(app.config["SITE_DATA_DIR"] or Path(app.instance_path) / "dane")


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


def _units(api, configured: tuple[str, ...] | None) -> list[tuple[str, str]]:
    if configured is None:
        return [*api.faculties(), (ROOT_UNIT, UNIT_NAMES[ROOT_UNIT])]
    return [(unit, UNIT_NAMES.get(unit) or api.unit_name(unit)) for unit in configured]


def _group(code: str, name: str, unit: str) -> dict:
    where = asdict(place(code, name))
    return {"code": code, "name": name, "faculty": unit, "plans": [], **{k: v for k, v in where.items() if v is not None}}


def fetch_site_data(output: Path, *, history_dir: Path | None = None, log: Callable[[str], None] = lambda line: None) -> FetchReport:
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
    for unit, unit_name in _units(api, config["SITE_FACULTIES"]):
        try:
            page = web.get(GROUPS_ACTION, jed_org_kod=unit, **GROUPS_PAGE)
            found = parse_subject_groups(page.html)
        except UsosError as error:
            report.skipped.append(f"{unit}: {error}")
            continue
        faculties.append({"code": unit, "name": unit_name})
        groups += [_group(g.code, g.name, unit) for g in found]
    log(f"Grupy przedmiotów: {len(groups)} w {len(faculties)} jednostkach.")
    programmes = api.programmes()

    cycles = []
    for cycle in config["SITE_CYCLES"]:
        term = api.term(cycle)
        pages = {}
        for done, group in enumerate(groups, 1):
            if done % PROGRESS_EVERY == 0:
                log(f"{cycle}: plany {done} z {len(groups)}.")
            try:
                page = web.get(PLAN_ACTION, grupa_kod=group["code"], cdyd_kod=cycle)
                plan = parse_group_plan(page.html)
            except UsosError as error:
                report.skipped.append(f"{group['code']} ({cycle}): {error}")
                continue
            # Grupa bez zajęć w tym cyklu nie dostaje planu.
            if plan.entries:
                pages[group["code"]] = (group, page, plan)
        ids = {(e.unit_id, e.group_no) for _, _, plan in pages.values() for e in plan.entries}
        log(f"{cycle}: daty spotkań dla {len(ids)} grup zajęciowych.")
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

    # Nazwy tylko tych kierunków, które mają grupy przedmiotów na stronie.
    used = {f"{g['faculty'][:3]}-{g['programme']}-" for g in groups if "programme" in g}
    programmes = {key: name for key, name in sorted(programmes.items()) if key[: key.rfind("-") + 1] in used}
    _write(
        output / "indeks.json",
        {"fetchedAt": now, "cycles": cycles, "faculties": faculties, "groups": groups, "programmes": programmes},
    )
    return report


@click.command("fetch")
@click.option(
    "--output",
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog, do którego trafią dane strony. Domyślnie ten, z którego czyta serwer (SITE_DATA_DIR albo instance/dane).",
)
@click.option(
    "--history",
    "history_dir",
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog historii zmian z gałęzi dane, np. dane-historia/historia.",
)
@with_appcontext
def fetch_command(output: Path | None, history_dir: Path | None) -> None:
    """Pobiera z USOS dane strony: indeks grup, plany i kalendarz cyklu."""
    output = output or data_dir(current_app)
    report = fetch_site_data(output, history_dir=history_dir, log=click.echo)
    click.echo(f"Zapisano {report.plans} {plural(report.plans, 'plan', 'plany', 'planów')} w {output}.")
    for line in report.stale:
        click.echo(f"Kopia z cache (USOSweb nie odpowiadał): {line}")
    for line in report.skipped:
        click.echo(f"Pominięty: {line}", err=True)
