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
| Pytania do użytkownika | Zrobione: 32 pytania w 8 rundach (ostatnia dotyczyła GitHub Pages). Odpowiedzi są w `docs/01-decyzje.md`. |
| Analiza USOSweb | **Nie zaczęta.** W poprzednim środowisku sieć blokowała wszystkie domeny AGH. |
| 3 makiety UI | Nie zaczęte. Czekają na analizę, bo mają powstać na prawdziwych danych. |
| Strona właściwa | Gotowy rdzeń niezależny od HTML-a USOS (szczegóły niżej). Brak parsera, danych i interfejsu. |
| Hosting | Workflow gotowy, ale publikacja czeka na ustawienia repo (sekcja „Publikacja”). |


## Co zrobić dalej, po kolei

1. **Sprawdź dostęp do USOS**, np.
   `curl -sS -o /dev/null -w "%{http_code}\n" https://web.usos.agh.edu.pl/`.
   Jeśli proxy odpowie 403, poproś użytkownika o dopisanie
   `web.usos.agh.edu.pl` do dozwolonych domen w ustawieniach sieci
   środowiska. Nie obchodź blokady przez zewnętrzne proxy ani przez GitHub
   Actions. Polityka sieci środowiska tego zabrania, a w poprzednim
   środowisku publiczne proxy i tak były zablokowane. Alternatywa: użytkownik
   zapisuje strony USOS jako HTML i wrzuca je do `tests/fixtures/usos/`.
2. **Sprawdź, czy w USOS nie trwa synchronizacja baz.** Użytkownik prosił,
   żeby na nią poczekać. Jeśli strona pokazuje taki komunikat, zapisz jego
   dokładną treść (przyda się do wykrywania w parserze) i zapytaj
   użytkownika, czy synchronizacja już się skończyła.
3. **Przeanalizuj USOSweb**, zaczynając od linku ze zlecenia (plan grupy
   przedmiotów `240-ZBI-1S-2R-Z`, cykl `26/27-Z`). Wynik zapisz
   w `docs/02-analiza-usos.md`. Ustal co najmniej:
   - strukturę HTML planu grupy przedmiotów (czy to tabela, czy komponenty
     typu `usos-timetable`, i jakie atrybuty niosą dane);
   - jak USOS zapisuje zajęcia co dwa tygodnie, zajęcia w wybrane daty
     i czy podaje konkretne daty spotkań. Od tego zależy widok konkretnego
     tygodnia i `.ics`;
   - jak AGH definiuje tygodnie parzyste i nieparzyste (od początku
     semestru czy według tygodni kalendarzowych);
   - kody typów zajęć (WYK, CW, LAB…) i ich pełne nazwy;
   - identyfikatory: przedmiot (`prz_kod`), grupa zajęciowa (`zaj_cyk_id`
     i `gr_nr`), cykl (`cdyd_kod`), oraz daty początku i końca cyklu;
   - skąd wziąć listę wszystkich grup przedmiotów, wydziałów i cykli do
     indeksu i drzewa (strony katalogu, wyszukiwarki);
   - czy USOS ma wersję angielską tych samych stron (parametr języka);
   - `robots.txt` i rozsądne tempo zapytań.
   Zapisz kilka stron jako fixture w `tests/fixtures/usos/` i przetestuj
   na nich parser.
4. **Po analizie zadaj pytania, które z niej wynikną.** Użytkownik lubi
   dużo pytań: używaj AskUserQuestion w rundach po 4 pytania.
5. **Zrób 3 makiety** w `mockups/`: klikalne HTML/CSS na prawdziwych
   danych, w trzech kierunkach opisanych w `docs/01-decyzje.md` (szwajcarski,
   narzędzie techniczne, gazeta z czterema wariantami animacji). Dołącz kilka
   propozycji nazwy strony. Każdą makietę sprawdź checklistą z fazy 0.
   Podgląd można dołączyć do budowy Pages (np. skopiować `mockups/` do
   `_site/makiety/` w `app/build.py`).
6. **Poczekaj, aż użytkownik wybierze kierunek**, i dopiero wtedy buduj
   właściwy interfejs (Jinja + Alpine.js). Potem dołóż pobieranie danych
   do budowy strony i codzienny `schedule` w `pages.yml`.


## Wymagania dla środowiska

- Dostęp sieciowy do `web.usos.agh.edu.pl`, a także do PyPI i npm.
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
| `app/plan/model.py` | Model w Pythonie: `PlanRef`, `Activity`, `Recurrence`, `Plan`. Kształt jest wstępny i do weryfikacji po analizie. |
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
    .venv/bin/python -m pytest        # 45 testów
    npm test                          # 32 testy, bez zależności npm
    .venv/bin/flask --app app run --debug
    .venv/bin/flask --app app build --output _site --base-path /AGH-Schedule-Viewer/

Oba zestawy testów przechodzą lokalnie i w GitHub Actions.


## Publikacja na GitHub Pages

Repo: `Wendermann/AGH-Schedule-Viewer`, publiczne. Gałęzie:
- `main`: publikacja. Każde wypchnięcie uruchamia `pages.yml`.
- `claude/keen-cray-pk2ipo`: gałąź robocza poprzedniego agenta. Na razie
  jest też domyślna, bo powstała pierwsza.

Czego jeszcze brakuje po stronie użytkownika (stan na 25.09):
1. Settings → General → Default branch: `main`. Jeszcze nie zmienione.
2. Settings → Pages → Source: GitHub Actions. Jeszcze nie włączone.

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
