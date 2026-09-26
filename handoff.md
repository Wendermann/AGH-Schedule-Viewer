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
| Strona właściwa | Działa: „Plan na tydzień” w Alpine.js, cała AGH (wszystkie wydziały i grupy ogólnouczelniane), cykl 26/27-Z (`docs/01-decyzje.md`, „Pierwsza wersja strony”). Domyślnie żaden plan nie jest wybrany. Dane z `flask fetch`. Sprawdzona w przeglądarce na prawdziwych danych: komputer, telefon, motyw ciemny, wydruk, łączenie planów, link „Udostępnij”. Podgląd strony planu dla użytkownika (artefakt, dane z 26.09): https://claude.ai/artifact/7ncFBVxfKPNdiXMTZbnUDF |
| Historia zmian | Gotowe: `flask history` i workflow `historia.yml` (co 6 godzin, zapis do gałęzi `dane`). Harmonogram działa od scalenia do `main` 26.09.2026. Strona pokazuje historię z codziennej budowy. |
| Hosting | Strona jest na https://wendermann.github.io/AGH-Schedule-Viewer/ od 26.09.2026. `pages.yml` pobiera dane codziennie o 3:41 UTC i publikuje stronę. |


## Co zrobić dalej, po kolei

1. **Budowa całej AGH na GitHub Actions.** Lokalnie 26.09.2026 pełne
   pobranie trwało 116 minut: ok. 1 h stron USOSweb (1199 grup, co 3 s)
   i ok. 1 h dat z USOS API (13 059 grup zajęciowych, 21 okien
   tygodniowych, ok. 12 s na zapytanie o 1000 grup). Wynik: 575 planów
   z zajęciami, 8,8 MB danych, indeks 217 KB (20 KB po kompresji).
   Pierwsza budowa w tygodniu robi całość, kolejne biorą strony USOSweb
   z cache Actions. Limit zadania to 240 minut. Sprawdź w logu kroku „Dane
   z USOS” czas, liczbę planów i linie „Pominięty”.
2. **Szybsze daty spotkań**, jeśli codzienna godzina okaże się problemem:
   czas API rośnie z liczbą grup, więc większe paczki nie pomagają.
   Możliwości: pobierać daty tylko od bieżącego tygodnia do końca cyklu
   (przeszłe tygodnie z poprzedniej budowy) albo odświeżać je rzadziej niż
   codziennie. Równoległych zapytań celowo nie ma, żeby nie obciążać USOS.
3. **Synchronizacja baz.** 25 i 26.09.2026 plany cyklu `26/27-Z` były
   kompletne i bez komunikatu o synchronizacji. Jeśli komunikat się
   pojawi, zapisz jego dokładną treść, żeby parser mógł go wykrywać.
4. **Nowe zapisy kodów grup.** `app/catalog.py` rozpoznaje 1173 z 1199 grup
   (26.09.2026). Grupy z nowym zapisem trafią do „Inne” swojego wydziału;
   wtedy dopisz przypadek do `tests/test_catalog.py` i poszerz parser.
5. **Znane ograniczenia:**
   - Historia na stronie jest tak świeża jak ostatnia codzienna budowa,
     choć `historia.yml` sprawdza plany co 6 godzin.
   - Kilka kierunków (np. 240-INF-1S-2R-Z) ma w planie wszystkie
     przedmioty obieralne naraz, więc bez ukrywania pokazuje kilkadziesiąt
     kolizji dziennie. Tak wygląda plan w USOSweb.
   - Wydziały Odlewnictwa i Fizyki i Informatyki Stosowanej nie mają grup
     przedmiotów w USOSweb, więc ich planów na stronie nie ma.
   - Warianty grup (dopiski po semestrze, np. `PP`, `AiM`, `POSangETM`) są
     pokazywane tak, jak zapisał je wydział.
   - 18 skrótów kierunków (np. HES, SWY, SPT) nie ma nazwy w `progs/search`;
     drzewo pokazuje wtedy sam skrót.
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
| `app/catalog.py` | Kierunek, stopień, semestr i wariant odczytane z kodu grupy przedmiotów (różne zapisy wydziałów). |
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
    .venv/bin/python -m pytest        # 131 testów
    npm test                          # 49 testów, bez zależności npm
    FLASK_SITE_FACULTIES='["240-000"]' .venv/bin/flask --app app fetch   # jeden wydział, do instance/dane
    .venv/bin/flask --app app run --debug
    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/ --data instance/dane

Oba zestawy testów przechodzą lokalnie i w GitHub Actions.


## Publikacja na GitHub Pages

Repo: `Wendermann/AGH-Schedule-Viewer`, publiczne. Gałąź domyślna i gałąź
publikacji to `main`; każde wypchnięcie na nią uruchamia `pages.yml`.
Pages działa ze źródłem „GitHub Actions”. Pierwsza wersja weszła przez
PR https://github.com/Wendermann/AGH-Schedule-Viewer/pull/1 (26.09.2026).
Adres strony: `https://wendermann.github.io/AGH-Schedule-Viewer/`.

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
