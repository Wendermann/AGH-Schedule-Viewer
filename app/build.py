"""Statyczna wersja strony dla GitHub Pages."""

from __future__ import annotations

import shutil
from pathlib import Path

import click
from flask import Flask, current_app
from flask.cli import with_appcontext

# Adres w aplikacji -> plik w zbudowanej stronie.
PAGES = {"/": "index.html", "/plan.html": "plan.html"}
MOCKUPS = Path(__file__).resolve().parent.parent / "mockups"


def normalize_base(base_path: str) -> str:
    inner = base_path.strip("/")
    return f"/{inner}/" if inner else "/"


def build_site(app: Flask, output: Path, base_path: str = "/", data: Path | None = None) -> list[Path]:
    if output.exists() and any(output.iterdir()):
        raise click.ClickException(f"Katalog {output} nie jest pusty.")
    app.config.update(SITE_MODE="static", SITE_BASE=normalize_base(base_path))

    written = []
    client = app.test_client()
    for route, filename in PAGES.items():
        response = client.get(route)
        if response.status_code != 200:
            raise click.ClickException(f"{route}: HTTP {response.status_code}")
        target = output / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(response.data)
        written.append(target)

    shutil.copytree(app.static_folder, output / "static", dirs_exist_ok=True)
    if data is not None:
        if not (data / "indeks.json").is_file():
            raise click.ClickException(f"W {data} nie ma indeks.json; najpierw uruchom flask fetch.")
        shutil.copytree(data, output / "dane")
    if MOCKUPS.is_dir():
        copy_mockups(Path(app.static_folder), output / "makiety")
    return written


def copy_mockups(static: Path, target: Path) -> None:
    shutil.copytree(MOCKUPS, target, ignore=shutil.ignore_patterns("*.py", "__pycache__"))
    # Makiety liczą ukrywanie, łączenie i kolizje tym samym kodem co strona.
    for name in ("plan.js", "share.js"):
        shutil.copy2(static / "js" / name, target / "wspolne" / name)


@click.command("build")
@click.option(
    "--output",
    default="_site",
    show_default=True,
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog wynikowy. Musi być pusty albo nie istnieć.",
)
@click.option(
    "--base-path",
    default="/",
    show_default=True,
    help="Ścieżka, pod którą strona będzie dostępna, np. /AGH-Schedule-Viewer/.",
)
@click.option(
    "--data",
    type=click.Path(file_okay=False, path_type=Path),
    help="Katalog z danymi z flask fetch; trafi do katalogu dane strony.",
)
@with_appcontext
def build_command(output: Path, base_path: str, data: Path | None) -> None:
    """Buduje statyczną wersję strony, np. dla GitHub Pages."""
    pages = build_site(current_app._get_current_object(), output, base_path, data)
    click.echo(
        f"Strona zbudowana w {output} (plików HTML: {len(pages)},"
        f" ścieżka bazowa {normalize_base(base_path)})."
    )
