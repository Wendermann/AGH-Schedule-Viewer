"""Polecenie `flask history`: sprawdza plany kierunków z historią i zapisuje zmiany."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import click
from flask import current_app
from flask.cli import with_appcontext

from .history import monitor_seed, record
from .plan.compose import compose
from .plan.export import activity_json
from .usos.fetch import UsosError
from .usos.web import parse_group_plan

ROOT = Path(__file__).resolve().parent.parent
PLAN_ACTION = "katalog2/przedmioty/pokazPlanGrupyPrzedmiotow"


def history_file(output: Path, code: str, cycle: str) -> Path:
    return output / cycle.replace("/", "-") / f"{code}.json"


def check_plan(code: str, cycle: str, output: Path, checked_at: str) -> str:
    config = current_app.config
    page = current_app.extensions["usos"].get(PLAN_ACTION, refresh=True, grupa_kod=code, cdyd_kod=cycle)
    # Kopia z cache albo pusty plan oznaczają problem po stronie USOS, a nie
    # zmianę planu. Zapisanie ich zrobiłoby z każdej grupy „usuniętą”.
    if page.stale:
        raise UsosError("USOSweb nie odpowiedział, a jest tylko starsza kopia strony")
    plan = parse_group_plan(page.html)
    if not plan.entries:
        raise UsosError("USOSweb zwrócił pusty plan")
    api = current_app.extensions["usos_api"]
    term = api.term(cycle)
    meetings = api.meetings({(e.unit_id, e.group_no) for e in plan.entries}, term.start, term.end)
    activities = [activity_json(a) for a in compose(plan, meetings)]
    seed_path = config["HISTORY_SEEDS"].get(f"{code}@{cycle}")
    seed = monitor_seed(ROOT / seed_path) if seed_path else None
    changes = record(
        history_file(output, code, cycle),
        code=code,
        cycle=cycle,
        activities=activities,
        checked_at=checked_at,
        seed=seed,
    )
    if not changes:
        return "bez zmian"
    n = len(changes)
    word = "zmiana" if n == 1 else "zmiany" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "zmian"
    return f"{n} {word}"


@click.command("history")
@click.option(
    "--output",
    required=True,
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog historii, np. katalog z gałęzią dane.",
)
@with_appcontext
def history_command(output: Path) -> None:
    """Sprawdza plany kierunków z listy HISTORY_PLANS i dopisuje zmiany."""
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failed = []
    for spec in current_app.config["HISTORY_PLANS"]:
        code, cycle = spec.split("@")
        try:
            click.echo(f"{code} ({cycle}): {check_plan(code, cycle, output, checked_at)}")
        except UsosError as error:
            failed.append(code)
            click.echo(f"{code} ({cycle}): pominięty, {error}", err=True)
    if failed:
        raise click.ClickException(f"Nie sprawdzono: {', '.join(failed)}.")
