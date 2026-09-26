# Plan na tydzień

Nieoficjalna przeglądarka planów zajęć AGH. Korzysta wyłącznie z danych
dostępnych bez logowania: publicznego USOS API (`apps.usos.agh.edu.pl`)
i stron USOSweb (`web.usos.agh.edu.pl`). Pozwala ukrywać przedmioty, typy
zajęć i cudze grupy, łączyć kilka planów w jeden i sprawdzać kolizje
z podziałem na tygodnie parzyste i nieparzyste. Dla wybranych kierunków
pokazuje historię zmian planu.

Strona obejmuje wszystkie wydziały AGH i grupy ogólnouczelniane w cyklu
26/27-Z. Ustalenia i stan prac są w katalogu `docs/` i w `handoff.md`.

## Dwa tryby działania

**GitHub Pages.** Polecenie `flask fetch` pobiera z USOS dane strony
(indeks grup przedmiotów, plany z datami spotkań, kalendarz cyklu) jako
pliki JSON, a `flask build --data` renderuje stronę do statycznych plików
razem z tymi danymi. Ukrywanie, łączenie i link „Udostępnij” działają
w przeglądarce, więc serwer nie jest potrzebny. Workflow
`.github/workflows/pages.yml` pobiera dane i publikuje stronę codziennie
rano, po każdym wypchnięciu na gałąź `main` i na żądanie z zakładki
Actions. Strony USOSweb trzyma w cache GitHub Actions przez tydzień.

**Historia zmian.** Workflow `.github/workflows/historia.yml` co 6 godzin
uruchamia `flask history`. Polecenie sprawdza kierunki z `HISTORY_PLANS`
i zapisuje wykryte zmiany jako JSON w gałęzi `dane`. USOS przechowuje tylko
bieżący stan planu, więc historia zaczyna się od pierwszego sprawdzenia.
Strona dostaje historię przy codziennej budowie. Harmonogramy obu
workflow działają tylko w gałęzi domyślnej repozytorium.

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
    FLASK_SITE_FACULTIES='["240-000"]' .venv/bin/flask --app app fetch   # jeden wydział, ok. 3 minut
    .venv/bin/flask --app app run --debug

Bez `FLASK_SITE_FACULTIES` polecenie pobiera całą AGH: za pierwszym razem
około godziny, bo strony USOSweb idą co 3 s; kolejne pobrania biorą je
z cache.

Statyczna wersja, tak jak na GitHub Pages:

    .venv/bin/flask --app app fetch --output dane-strony
    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/ --data dane-strony

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
| `USOS_MIN_INTERVAL` | 1.0 | Minimalny odstęp w sekundach między zapytaniami do USOS API (na proces). |
| `USOS_WEB_MIN_INTERVAL` | 3.0 | To samo dla stron USOSweb, które mają zakaz w `robots.txt`. |
| `USOS_TIMEOUT` | 20 | Limit czasu jednego zapytania, w sekundach. |
| `USOS_CACHE_PATH` | `instance/usos-cache.sqlite3` | Plik bazy z cache. |
| `HISTORY_PLANS` | `["240-ZBI-1S-2R-Z@26/27-Z"]` | Kierunki z historią zmian: kod grupy przedmiotów i cykl. |
| `SITE_FACULTIES` | wszystkie | Jednostki, których grupy przedmiotów trafiają na stronę. Domyślnie wszystkie wydziały z USOS API i grupy ogólnouczelniane (`000-000`); lista kodów zawęża zakres. |
| `SITE_CYCLES` | `["26/27-Z"]` | Cykle dydaktyczne na stronie. |
| `SITE_DATA_DIR` | `instance/dane` | Katalog danych strony: tu zapisuje `flask fetch`, stąd czyta serwer. |

## Skąd dane i jak się z nimi obchodzimy

Zajęcia i konkretne daty spotkań pochodzą z USOS API, które udostępnia je
bez klucza. Z USOSweb bierzemy tylko to, czego API nie ma: skład grup
przedmiotów i nazwiska prowadzących. `robots.txt` USOSweb zabrania
automatycznego pobierania, więc te strony są pobierane rzadko. Wszystkie
zapytania idą z identyfikującym User-Agentem, z limitem i z cache. Jeśli
USOS nie odpowiada, aplikacja pokazuje ostatnią pobraną wersję z datą
pobrania. Szczegóły są w `docs/02-analiza-usos.md`.
