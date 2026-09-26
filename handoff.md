# Przekazanie projektu

Dokument dla agenta, który przejmuje pracę w nowym środowisku. Przeczytaj
go w całości, potem `docs/00-sygnaly-vibe-coding.md`
i `docs/01-decyzje.md`. Stan na 26.09.2026.


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
| 3 makiety UI | Gotowe. Użytkownik wybrał „Rozkład” (szwajcarski) z pełnymi polami koloru typów zajęć i kolorem w winiecie (`docs/01-decyzje.md`, „Wybrany kierunek”). |
| Strona właściwa | Pierwsza wersja gotowa: „Plan na tydzień” w Alpine.js, Wydział Informatyki, cykl 26/27-Z (`docs/01-decyzje.md`, „Pierwsza wersja strony”). Dane z `flask fetch`. Sprawdzona w przeglądarce na prawdziwych danych: komputer, telefon, motyw ciemny, wydruk, łączenie planów, link „Udostępnij”. Podgląd strony planu dla użytkownika (artefakt, dane z 26.09): https://claude.ai/artifact/7ncFBVxfKPNdiXMTZbnUDF |
| Historia zmian | Gotowe: `flask history` i workflow `historia.yml` (co 6 godzin, zapis do gałęzi `dane`). Ruszy po przeniesieniu kodu na gałąź domyślną. Strona pokazuje historię z codziennej budowy. |
| Hosting | `pages.yml` pobiera dane codziennie o 3:41 UTC i publikuje stronę. Publikacja czeka na ustawienia repo (sekcja „Publikacja”). |


## Co zrobić dalej, po kolei

1. **Publikacja.** Bez ustawień z sekcji „Publikacja” strona nie ruszy,
   a historia zmian nie jest zbierana. To pierwsza rzecz do sprawdzenia
   z użytkownikiem.
2. **Pierwsza budowa na GitHub Actions.** Po włączeniu Pages sprawdź log
   kroku „Dane z USOS”: czas (lokalnie ok. 9 minut dla Wydziału
   Informatyki, prawie wszystko to zapytania do API co 1 s), liczbę planów
   (26.09: 16 z 25 grup) i ewentualne „Pominięty”. Gałęzi `dane` może
   jeszcze nie być; wtedy strona powstaje bez historii, a log to mówi.
3. **Cała AGH** (następny krok według `docs/01-decyzje.md`). Wystarczy
   dopisać wydziały do `SITE_FACULTIES`, ale czas pobierania rośnie
   liniowo: szacunkowo 2–3 godziny dziennie dla wszystkich wydziałów.
   Zanim to zrobisz, zmierz liczbę zapytań `tt/classgroups` i rozważ
   pobieranie dat tylko dla grup zajęciowych, które zmieniły się od
   poprzedniego dnia, albo rzadsze odświeżanie dat. Drzewo kierunków
   i wyszukiwarka są gotowe na wiele wydziałów.
4. **Synchronizacja baz.** 25 i 26.09.2026 plany cyklu `26/27-Z` były
   kompletne i bez komunikatu o synchronizacji. Jeśli komunikat się
   pojawi, zapisz jego dokładną treść, żeby parser mógł go wykrywać.
5. **Znane ograniczenia pierwszej wersji:**
   - Historia na stronie jest tak świeża jak ostatnia codzienna budowa,
     choć `historia.yml` sprawdza plany co 6 godzin.
   - Kilka kierunków (np. 240-INF-1S-2R-Z) ma w planie wszystkie
     przedmioty obieralne naraz, więc bez ukrywania pokazuje kilkadziesiąt
     kolizji dziennie. Tak wygląda plan w USOSweb.
   - Makiety w `mockups/` mają własną kopię modelu
     (`mockups/wspolne/model.js`); strona używa `app/static/js/model.js`.
     Makiet już nie rozwijamy.


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
| `app/__init__.py` | Fabryka aplikacji, trasy `/`, `/plan.html`, `/dane/…` (dane strony w trybie serwera) i `/healthz`, rejestracja poleceń `build`, `fetch` i `history`. |
| `app/config.py` | Konfiguracja, nadpisywalna zmiennymi `FLASK_*`. `SITE_MODE` to `server` albo `static`, `SITE_BASE` to ścieżka bazowa. |
| `app/build.py` | Budowanie statycznej strony (lista `PAGES`, kopiowanie `static/`, `--data` kopiuje dane do `_site/dane`, makiety do `_site/makiety`). |
| `app/sitedata.py` | `flask fetch`: `indeks.json` (wydziały, cykle, grupy przedmiotów), `cykle/<cykl>.json` (cykl, kalendarz, typy zajęć), `plany/<cykl>/<kod>.json` (zajęcia z datami, historia zmian). |
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
| `app/templates/` | `index.html` (start: wyszukiwarka, drzewo, ostatnio oglądane), `plan.html` (plan), `_finder.html` (wyszukiwarka i drzewo jako makra Jinja). |
| `app/static/js/model.js` | Stan i logika strony planu: wczytywanie planów na żądanie, tydzień typowy i kalendarzowy, kolizje, historia, token w adresie. Testy w `tests/js/model.test.js`. |
| `app/static/js/planview.js`, `start.js`, `ui.js` | Komponenty Alpine.js. Po każdej zmianie `planview.js` składa z modelu zamrożony opis widoku (`s`), żeby Alpine nie owijał obiektów modelu w proxy. |
| `app/static/vendor/`, `app/static/fonts/` | Alpine.js 3.17.4 (MIT) i Archivo (OFL), bez CDN. |
| `.github/workflows/ci.yml` | Testy Python i JS na gałęziach innych niż `main`. Wywoływany też przez `pages.yml`. |
| `.github/workflows/pages.yml` | Codziennie, po wypchnięciu na `main` i ręcznie: testy, `flask fetch` (USOSweb z cache na tydzień), historia z gałęzi `dane`, `flask build --data`, publikacja. |

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
    .venv/bin/python -m pytest        # 103 testy
    npm test                          # 45 testów, bez zależności npm
    .venv/bin/flask --app app fetch   # ok. 9 minut, do instance/dane
    .venv/bin/flask --app app run --debug
    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/ --data instance/dane

Oba zestawy testów przechodzą lokalnie i w GitHub Actions.


## Publikacja na GitHub Pages

Repo: `Wendermann/AGH-Schedule-Viewer`, publiczne. Gałęzie:
- `main`: publikacja. Każde wypchnięcie uruchamia `pages.yml`.
- `claude/keen-cray-pk2ipo`: gałąź robocza poprzedniego agenta. Na razie
  jest też domyślna, bo powstała pierwsza.

Czego jeszcze brakuje po stronie użytkownika (stan na 26.09):
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

- Statyczny, niefiltrowany `.ics` na Pages: 26.09 użytkownik odpowiedział
  „na razie bez .ics”. Wrócić do tematu przy kolejnej wersji.


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
