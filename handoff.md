# Przekazanie projektu

Dokument dla agenta, który przejmuje pracę w nowym środowisku. Przeczytaj
go w całości, potem `docs/00-sygnaly-vibe-coding.md`
i `docs/01-decyzje.md`. Stan na 25.09.2026.


## Zlecenie użytkownika

Oryginalna treść, bez zmian:

> Chciałbym byś, napisał stronę we flasku z dowolnym frontendem, która będzie
> pozwalała na łatwe i czytelne czytanie planów przedmiotów/grup/pracowników/etc.
> z usosa AGH (https://web.usos.agh.edu.pl). Ma to działać tylko na bazie
> warstwy dostępnej dla niezalogowanych użytkowników i być łatwe w obsłudze
> dodatkowo, jak wybierze się plan dowolnego semestru, danego kierunku to
> powinna być opcja ukrywania/pokazywania przedmiotów/grup należących do planu
> na semestr oraz łączeniu różnych planów. Zacznij od przeanalizowania tego, co
> tam jest i czego potrzebujesz, potem zrób makiety UI (3, każda unikalna
> stylistycznie), a potem sama strona właściwa. UI mają nie mieć znamion vibe
> coded aplikacji więc fazą 0 będzie analiza tego, co wskazuje na to, że
> aplikacja jest vibe coded i nierobienie tego u siebie
> obecnie trwa synchronizacja baz danych więc czekaj na jej zakończenie
> swoje badania zacznij od tej podstrony
> (https://web.usos.agh.edu.pl/kontroler.php?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow&grupa_kod=240-ZBI-1S-2R-Z&cdyd_kod=26%2F27-Z)
> Przed rozpoczęciem prac dot. ui zadawaj mi pytania implementacyjne oraz
> stylistyczne (im więcej, tym lepiej)

Później użytkownik dołożył dwa wymagania:
- hosting na GitHub Pages, z możliwością publikacji bezpośrednio przez
  agenta;
- ten plik przekazania.


## Stan faz

| Faza | Stan |
| --- | --- |
| 0. Sygnały „vibe coding” | Zrobiona: `docs/00-sygnaly-vibe-coding.md`. Sekcja 5 to checklista dla makiet i strony. |
| Pytania do użytkownika | Przed analizą: 32 pytania w 8 rundach. Po analizie: 12 pytań w 3 rundach (historia planu, zasięg danych, osobliwości kalendarza AGH, drzewo kierunków). Wszystkie odpowiedzi są w `docs/01-decyzje.md`. |
| Analiza USOS | Zrobiona: `docs/02-analiza-usos.md`. Źródło danych: USOS API i USOSweb (decyzja w `docs/01-decyzje.md`). Parser USOSweb w `app/usos/web.py`. |
| 3 makiety UI | Gotowe. Użytkownik wybrał „Rozkład” (szwajcarski) z kolorem typów zajęć; natężenie koloru do potwierdzenia (`docs/01-decyzje.md`, „Wybrany kierunek”). |
| Strona właściwa | Gotowe: rdzeń w przeglądarce (ukrywanie, łączenie, kolizje, link „Udostępnij”), `.ics`, parser USOSweb, klient USOS API, składanie planu i eksport do JSON. Brak interfejsu i pobierania danych całej AGH do budowy strony. |
| Historia zmian | Gotowe: `flask history` i workflow `historia.yml` (co 6 godzin, zapis do gałęzi `dane`). Ruszy po przeniesieniu kodu na gałąź domyślną. |
| Hosting | Workflow gotowy, ale publikacja czeka na ustawienia repo (sekcja „Publikacja”). |


## Co zrobić dalej, po kolei

1. **Przeczytaj nowe ustalenia** w `docs/01-decyzje.md`: sekcje „Dane”,
   „Historia planu kierunku” i „Widoki” zmieniły się po analizie
   25.09.2026.
2. **Synchronizacja baz.** 25.09.2026 plany cyklu `26/27-Z` były kompletne
   i bez komunikatu o synchronizacji. Jeśli komunikat się pojawi, zapisz
   jego dokładną treść, żeby parser mógł go wykrywać.
3. **Klient USOS API i składanie planu są gotowe**: `app/usos/api.py`
   (daty spotkań w oknach 7-dniowych, po 50 grup na zapytanie),
   `app/plan/compose.py` (spotkania przypisane do terminów, spotkania
   o innej godzinie w `moved`, dni wolne i przeniesienia),
   `app/plan/export.py` (JSON dla przeglądarki). Z tego samego kodu
   korzysta `mockups/build_data.py`.
4. **Historia zmian jest gotowa**: `app/history.py` (porównanie migawek po
   grupie zajęciowej, łącznie z datami spotkań), `flask history`
   (`app/collect.py`) i `.github/workflows/historia.yml`. Pierwsze
   sprawdzenie ZBI zaczyna od migawki z monitora zmian
   (`data/monitor-…json`, `HISTORY_SEEDS`), więc od razu zapisze 27 zmian
   od 30.06. Workflow ruszy dopiero, gdy trafi na gałąź domyślną (patrz
   „Publikacja”). Stary plik w cache albo pusty plan z USOS nie są
   zapisywane, żeby awaria nie wyglądała jak usunięcie zajęć.
5. **Makiety są gotowe** (`docs/03-makiety.md`), wybrany kierunek:
   „Rozkład” z kolorem typów zajęć. Dane odświeża
   `.venv/bin/python -m mockups.build_data`. Budowa strony kopiuje
   `mockups/` do `_site/makiety/` razem z `plan.js` i `share.js`. Użytkownik
   ma wybrać kierunek i potwierdzić rozwiązania z sekcji „Rozwiązania do
   potwierdzenia”.
6. **Właściwy interfejs w stylu „Rozkładu”** (Jinja + Alpine.js). Przed
   startem potwierdź z użytkownikiem natężenie koloru i rozwiązania z sekcji
   „Rozwiązania do potwierdzenia” w `docs/03-makiety.md`. Potem dołóż pobieranie danych
   do budowy strony i harmonogram w `pages.yml`: cała AGH raz dziennie,
   kierunki z historią co 6 godzin, skład grup z USOSweb raz w tygodniu.


## Dostęp do USOS

25.09.2026 sieć środowiska przepuszczała domeny AGH bez proxy. `robots.txt`
USOSweb zabrania automatycznego pobierania całej domeny, dlatego USOSweb
służy tylko do tego, czego nie ma w API, i jest pobierany rzadko. USOS API
nie ma `robots.txt`, a metody planu działają bez klucza. Szczegóły, limity
i błędy API są w `docs/02-analiza-usos.md`.


## Wymagania dla środowiska

- Dostęp sieciowy do `web.usos.agh.edu.pl` i `apps.usos.agh.edu.pl`,
  a także do PyPI i npm.
- Python 3.11 lub nowszy (CI używa 3.12) oraz Node 22 (testy JS korzystają
  z `CompressionStream("deflate-raw")`).
- Docker jest potrzebny tylko do trybu serwerowego. W poprzednim
  środowisku nie było demona Dockera, więc obraz nie był nigdy budowany.


## Architektura

Dwa tryby z jednego kodu (szczegóły w `docs/01-decyzje.md`):

- **GitHub Pages (główny).** `flask build` renderuje stronę do statycznych
  plików. Logika widoku działa w przeglądarce. Dane z USOS mają być
  pobierane podczas budowy, w GitHub Actions. Nie ma kalendarza `.ics`
  z filtrami generowanego na żądanie.
- **Serwer (opcjonalny).** Flask w Dockerze. Dodaje subskrybowany `.ics`
  z filtrami (token z linku „Udostępnij” w adresie) i odświeżanie danych
  na żądanie.

Mapa plików:

| Plik | Rola |
| --- | --- |
| `app/__init__.py` | Fabryka aplikacji, trasy `/` i `/healthz`, rejestracja `flask build`. |
| `app/config.py` | Konfiguracja, nadpisywalna zmiennymi `FLASK_*`. `SITE_MODE` to `server` albo `static`, `SITE_BASE` to ścieżka bazowa. |
| `app/build.py` | Budowanie statycznej strony (lista `PAGES`, kopiowanie `static/`). |
| `app/usos/fetch.py` | Pobieranie USOSweb z limitem zapytań, ponawianiem i kopią z cache przy awarii. `url_for` odtwarza format linków USOS. |
| `app/usos/cache.py` | Cache stron w SQLite (24 h). |
| `mockups/` | Trzy makiety, wspólna logika (`wspolne/model.js`), dane (`dane/plany.json`) i skrypt, który je pobiera (`build_data.py`). |
| `app/usos/api.py` | Klient USOS API: cykle, typy zajęć, daty spotkań grup zajęciowych. |
| `app/plan/compose.py`, `app/plan/export.py` | Składanie planu z USOSweb i API, kalendarz semestru, JSON dla przeglądarki. |
| `app/history.py`, `app/collect.py` | Historia zmian: porównanie migawek i polecenie `flask history`. |
| `.github/workflows/historia.yml` | Co 6 godzin `flask history` i zapis do gałęzi `dane`. |
| `data/` | Migawka z monitora zmian użytkownika (stan początkowy historii ZBI). |
| `app/usos/web.py` | Parser USOSweb: plan grupy przedmiotów (`parse_group_plan`) i lista grup jednostki (`parse_subject_groups`). Zmiana HTML po stronie USOS kończy się `UsosLayoutError`. |
| `app/plan/model.py` | Model w Pythonie: `PlanRef`, `Activity`, `Recurrence`, `Plan`. Kształt wstępny, do dopasowania przy kliencie API (krok 3). |
| `app/plan/selection.py`, `app/plan/merge.py` | Ukrywanie i łączenie po stronie serwera (dla filtrowanego `.ics`). |
| `app/share.py` | Kodek tokenu „Udostępnij” w Pythonie (odczyt po stronie serwera). |
| `app/ics.py` | Generowanie iCalendar ze stałymi UID. Pomija zajęcia bez konkretnych dat. |
| `app/static/js/plan.js` | W przeglądarce: ukrywanie, łączenie, kolizje (z parzystością tygodni) i tory nakładających się bloczków. Na początku pliku jest opisany kształt danych JSON zajęć. |
| `app/static/js/share.js` | W przeglądarce: kodek tokenu, zgodny z `app/share.py`. |
| `app/templates/` | Na razie tylko strona „w budowie”. Właściwy interfejs powstanie po makietach. |
| `.github/workflows/ci.yml` | Testy Python i JS na gałęziach innych niż `main`. Wywoływany też przez `pages.yml`. |
| `.github/workflows/pages.yml` | Na `main`: testy, `flask build`, publikacja na Pages. |

Format tokenu „Udostępnij”: znak wersji `1` i JSON skompresowany
deflate-raw w base64url, np.
`{"p":[["g","240-ZBI-1S-2R-Z","26/27-Z"]],"hs":[…],"ht":[[przedmiot,typ]],"mg":[[przedmiot,typ,grupa]],"m":"week","par":"odd","w":"2026-10-05"}`.
Rodzaje planów to `g` (grupa przedmiotów), `p` (przedmiot) i `z` (grupa
zajęciowa). Przy każdej zmianie formatu podbij wersję i zaktualizuj oba
kodeki. Testy zgodności to `BROWSER_TOKEN` w `tests/test_share.py`
i `PYTHON_TOKEN` w `tests/js/share.test.js`.


## Uruchamianie i testy

    python3 -m venv .venv
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/python -m pytest        # 87 testów
    npm test                          # 33 testy, bez zależności npm
    .venv/bin/flask --app app run --debug
    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/

Oba zestawy testów przechodzą lokalnie i w GitHub Actions.


## Publikacja na GitHub Pages

Repo: `Wendermann/AGH-Schedule-Viewer`, publiczne. Gałęzie:
- `main`: publikacja. Każde wypchnięcie uruchamia `pages.yml`.
- `claude/keen-cray-pk2ipo`: gałąź robocza poprzedniego agenta. Na razie
  jest też domyślna, bo powstała pierwsza.

Czego jeszcze brakuje po stronie użytkownika (stan na 25.09, wieczór):
1. Settings → General → Default branch: `main`. Jeszcze nie zmienione.
2. Settings → Pages → Source: GitHub Actions. Jeszcze nie włączone.
3. Scalenie gałęzi roboczej `claude/quirky-mendel-jp83mz` do `main`
   (np. przez PR). `main` stoi na commicie `3dd3d39`. Harmonogram
   `historia.yml` działa tylko z gałęzi domyślnej, więc bez punktów 1 i 3
   historia zmian nie jest zbierana. Każdy dzień zwłoki to luka w historii.

Dopóki Pages jest wyłączone, `pages.yml` kończy się błędem w kroku
`configure-pages` („Get Pages site failed”). To oczekiwane zachowanie, nie
błąd w kodzie. Po włączeniu Pages uruchom workflow ręcznie
(`workflow_dispatch`) albo wypchnij zmianę na `main`. Adres strony:
`https://wendermann.github.io/AGH-Schedule-Viewer/`.

Drobiazg: `actions/configure-pages@v5` celuje w Node 20, który jest
wycofywany (na razie tylko ostrzeżenie). Warto przejść na nowszą wersję
akcji, jeśli już istnieje.


## Otwarte pytania do użytkownika

- Czy na Pages ma być statyczny, niefiltrowany `.ics` dla każdego planu,
  odświeżany razem z danymi? Użytkownik napisał „w wersji GH pages bez ics
  na życzenie”. Zrozumieliśmy to jako brak wersji z filtrami, ale nie
  zostało to potwierdzone.
- Nazwa strony: użytkownik poprosił o kilka propozycji przy makietach.


## Jak pracować z tym użytkownikiem

- Komunikacja, UI, dokumentacja i opisy commitów po polsku. Identyfikatory
  w kodzie po angielsku, komentarze po polsku i tylko wtedy, gdy wyjaśniają
  „dlaczego”.
- Przed pracą nad UI zadawaj dużo pytań implementacyjnych i stylistycznych.
- Pilnuj reguł z fazy 0 także w kodzie i dokumentacji: bez emoji, bez
  marketingowego tonu, bez kontrolek, które nie działają, i bez martwego
  kodu.
- Zmiany architektury, które odwracają wcześniejsze decyzje, najpierw
  konsultuj z użytkownikiem (tak było przy przejściu na GitHub Pages).
