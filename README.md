# AGH Schedule Viewer

Nieoficjalna przeglądarka planów zajęć AGH. Korzysta wyłącznie z danych
dostępnych bez logowania: publicznego USOS API (`apps.usos.agh.edu.pl`)
i stron USOSweb (`web.usos.agh.edu.pl`). Pozwala ukrywać przedmioty, typy
zajęć i cudze grupy oraz łączyć kilka planów w jeden.

Projekt jest w budowie. Stan prac i ustalenia są w katalogu `docs/`.

## Dwa tryby działania

**GitHub Pages.** Polecenie `flask build` renderuje stronę do statycznych
plików. Ukrywanie, łączenie i link „Udostępnij” działają w przeglądarce,
więc serwer nie jest potrzebny. Workflow `.github/workflows/pages.yml`
buduje i publikuje stronę po każdym wypchnięciu na gałąź `main`. Można go
też uruchomić ręcznie z zakładki Actions.

**Historia zmian.** Workflow `.github/workflows/historia.yml` co 6 godzin
uruchamia `flask history`. Polecenie sprawdza kierunki z `HISTORY_PLANS`
i zapisuje wykryte zmiany jako JSON w gałęzi `dane`. USOS przechowuje tylko
bieżący stan planu, więc historia zaczyna się od pierwszego sprawdzenia.
Harmonogram działa tylko w gałęzi domyślnej repozytorium.

**Serwer.** Ta sama aplikacja uruchomiona w Dockerze. Dochodzi
subskrybowany kalendarz `.ics` z ukryciami i odświeżanie danych z USOS na
żądanie.

## Pierwsza publikacja na GitHub Pages

Jednorazowo, w ustawieniach repozytorium:

1. Settings → General → Default branch: `main`.
2. Settings → General → Danger Zone → Change visibility: Public. Na
   darmowym koncie GitHub Pages działa tylko dla publicznych repozytoriów.
3. Settings → Pages → Build and deployment → Source: GitHub Actions.

Potem uruchom workflow „GitHub Pages” (Actions → GitHub Pages → Run
workflow) albo wypchnij zmianę na `main`. Strona będzie dostępna pod
`https://wendermann.github.io/AGH-Schedule-Viewer/`.

## Uruchomienie lokalne

    python3 -m venv .venv
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/flask --app app run --debug

Statyczna wersja, tak jak na GitHub Pages:

    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/

Testy (Python i JavaScript, ten drugi wymaga Node 22):

    .venv/bin/python -m pytest
    npm test

Serwer w Dockerze:

    docker compose up --build

Aplikacja nasłuchuje na porcie 8000. Cache stron USOS jest w wolumenie
`usos-cache`.

## Konfiguracja

Każdą opcję z `app/config.py` można nadpisać zmienną środowiskową
z prefiksem `FLASK_`, np. `FLASK_USOS_CACHE_HOURS=12`.

| Opcja | Domyślnie | Znaczenie |
| --- | --- | --- |
| `USOS_CACHE_HOURS` | 24 | Po ilu godzinach strona z USOS jest pobierana ponownie. |
| `USOS_MIN_INTERVAL` | 1.0 | Minimalny odstęp w sekundach między zapytaniami do USOS (na proces). |
| `USOS_TIMEOUT` | 20 | Limit czasu jednego zapytania, w sekundach. |
| `USOS_CACHE_PATH` | `instance/usos-cache.sqlite3` | Plik bazy z cache. |
| `HISTORY_PLANS` | `["240-ZBI-1S-2R-Z@26/27-Z"]` | Kierunki z historią zmian: kod grupy przedmiotów i cykl. |

## Skąd dane i jak się z nimi obchodzimy

Zajęcia i konkretne daty spotkań pochodzą z USOS API, które udostępnia je
bez klucza. Z USOSweb bierzemy tylko to, czego API nie ma: skład grup
przedmiotów i nazwiska prowadzących. `robots.txt` USOSweb zabrania
automatycznego pobierania, więc te strony są pobierane rzadko. Wszystkie
zapytania idą z identyfikującym User-Agentem, z limitem i z cache. Jeśli
USOS nie odpowiada, aplikacja pokazuje ostatnią pobraną wersję z datą
pobrania. Szczegóły są w `docs/02-analiza-usos.md`.
