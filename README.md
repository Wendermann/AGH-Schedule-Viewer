# AGH Schedule Viewer

Nieoficjalna przeglądarka planów zajęć z USOSweb AGH
(`web.usos.agh.edu.pl`). Korzysta wyłącznie z publicznych stron, dostępnych
bez logowania. Pozwala ukrywać przedmioty, typy zajęć i cudze grupy, łączyć
kilka planów w jeden oraz subskrybować wynik jako kalendarz `.ics`.

Projekt jest w budowie. Stan prac i ustalenia są w katalogu `docs/`.

## Uruchomienie

W Dockerze:

    docker compose up --build

Aplikacja nasłuchuje na porcie 8000. Cache stron USOS jest w wolumenie
`usos-cache`.

Lokalnie, do pracy nad kodem:

    python3 -m venv .venv
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/flask --app app run --debug
    .venv/bin/python -m pytest

## Konfiguracja

Każdą opcję z `app/config.py` można nadpisać zmienną środowiskową
z prefiksem `FLASK_`, np. `FLASK_USOS_CACHE_HOURS=12`.

| Opcja | Domyślnie | Znaczenie |
| --- | --- | --- |
| `USOS_CACHE_HOURS` | 24 | Po ilu godzinach strona z USOS jest pobierana ponownie. |
| `USOS_MIN_INTERVAL` | 1.0 | Minimalny odstęp w sekundach między zapytaniami do USOS (na proces). |
| `USOS_TIMEOUT` | 20 | Limit czasu jednego zapytania, w sekundach. |
| `USOS_CACHE_PATH` | `instance/usos-cache.sqlite3` | Plik bazy z cache. |

## Skąd dane i jak się z nimi obchodzimy

Strony USOSweb są pobierane z identyfikującym User-Agentem, z limitem
zapytań i z cache. Jeśli USOS nie odpowiada, aplikacja pokazuje ostatnią
pobraną wersję z datą pobrania.
