# Decyzje projektowe

Większość ustalona przed analizą USOS. Po analizie (25.09.2026) doszły
zmiany źródła danych, historia planu kierunku i sposób pokazywania
osobliwości kalendarza AGH (`docs/02-analiza-usos.md`).


## Dane

- Źródło: dwa, oba bez logowania i bez klucza (zmienione 25.09.2026, po
  sprawdzeniu dostępu):
  - USOS API (`apps.usos.agh.edu.pl/services/`) dostarcza zajęcia, ich
    konkretne daty, daty cykli i słowniki. Metody planu nie wymagają klucza.
  - USOSweb (`web.usos.agh.edu.pl`) tylko dla tego, czego API nie ma: listy
    grup przedmiotów i przedmiotów w każdej z nich. Pobierana rzadko
    i małą liczbą zapytań, bo `robots.txt` USOSweb zabrania automatycznego
    pobierania. Pierwotnie źródłem miał być wyłącznie scraping USOSweb.
- Świeżość danych zależy od trybu (patrz „Technologia i hosting”):
  - GitHub Pages: dane pobiera GitHub Action podczas budowania strony.
    Plany całej AGH są odświeżane raz dziennie (daty z API), a skład grup
    przedmiotów z USOSweb raz w tygodniu. Kierunki z historią zmian są
    sprawdzane co 6 godzin (patrz „Historia planu kierunku”). Na stronie
    widać datę pobrania, ale nie ma odświeżania na żądanie.
  - Serwer: cache 24 godziny i akcja „odśwież z USOS”.
- Indeks do wyszukiwarki i drzewa: cała AGH, wszystkie dostępne cykle
  dydaktyczne (USOS ma plany od `23/24`). Budowany stopniowo, z limitem
  zapytań do USOS. Zakończone cykle się nie zmieniają, więc pobieramy je raz.
- Wyszukiwanie: pole z podpowiedziami oraz drzewo wydział → kierunek →
  rok → semestr. Drzewo powstaje z kodów grup przedmiotów
  (`240-ZBI-1S-2R-Z`). Grupy o nietypowych kodach (np. `240_INF-1S,7sem,po`)
  trafiają do gałęzi „Inne” swojego wydziału. Wyszukiwarka znajduje
  wszystkie. Indeks to plik JSON przeszukiwany w przeglądarce, bo na
  GitHub Pages nie ma bazy danych. Serwer używa tego samego pliku.


## Zakres pierwszej wersji

- Plany grup przedmiotów (kierunek i semestr, np. `240-ZBI-1S-2R-Z`).
- Plany przedmiotu i konkretnej grupy zajęciowej.
- Poza zakresem na start: prowadzący, sale.
- Interfejs po polsku i angielsku. Nazwy przedmiotów i typów zajęć z API,
  które podaje obie wersje. Gdy USOS nie ma nazwy angielskiej, pokazujemy
  polską.


## Ukrywanie i łączenie

- Ukrywanie na trzech poziomach: cały przedmiot, typ zajęć w przedmiocie
  i numer grupy („moja grupa” dla danego typu zajęć).
- Łączenie planów w jednej siatce. Kolor oznacza plan źródłowy, typ zajęć
  pokazuje skrót.
- Kolizje: bloczki obok siebie, a kolizje zajęć, które zostały po ukryciach,
  są wyróżnione i zliczone w nagłówku dnia.


## Historia planu kierunku

Dodane 25.09.2026 na prośbę użytkownika. Wzorem jest jego wcześniejszy
projekt „Monitor zmian w planie USOS”. Monitor co 12 godzin pobierał plan
jednej grupy przedmiotów, zapisywał migawkę, gdy treść się zmieniła,
i porównywał zajęcia po `(zaj_cyk_id, gr_nr)`. Pokazywał karty „było → jest”
dla zmian dnia, godzin, typu, grupy, prowadzących, sali, budynku,
parzystości i przedmiotu, a także zajęcia dodane i usunięte. Zajęcia
zmienione niedawno miały bardziej nasycony kolor, który z każdą kolejną
kontrolą bladł, a najnowsze zmiany dostawały oznaczenie „nowe”. Pierwsza
kontrola tworzyła stan bazowy bez kart.

U nas historia ma dwie warstwy, bo mają różne źródła (szczegóły w
`docs/02-analiza-usos.md`, sekcja 8):

- **Zmiany w trakcie cyklu.** USOS przechowuje tylko stan bieżący, więc tę
  historię trzeba zbierać samemu: przy każdym pobraniu danych zapisać
  migawkę i porównać ją z poprzednią. Historia zaczyna się od dnia
  uruchomienia zbierania i nie da się jej odtworzyć wstecz. Migawka
  obejmuje też konkretne daty z API, więc widać również pojedyncze
  spotkania przeniesione albo odwołane, czego monitor nie wykrywał. Na
  GitHub Pages migawki muszą przetrwać między kolejnymi budowami, więc
  trzeba je gdzieś trwale zapisywać (do ustalenia).
- **Porównanie cykli.** Plan tej samej grupy przedmiotów w kolejnych latach,
  np. semestr 3 w `23/24-Z`, `24/25-Z`, `25/26-Z` i `26/27-Z`: które
  przedmioty doszły, które ubyły i jak zmieniły się godziny. Dane z USOS
  sięgają `23/24`, więc ta warstwa działa od razu.

Ustalenia:

- W pierwszej wersji są tylko zmiany w trakcie cyklu. Porównanie cykli
  zostaje na później.
- Historia obejmuje kierunki z listy w pliku konfiguracyjnym w repo. Strona
  pokazuje, które kierunki mają historię. Na start `240-ZBI-1S-2R-Z`.
  Plany reszty AGH są na stronie, ale bez historii.
- Kierunki z historią są sprawdzane co 6 godzin: strona planu z USOSweb
  i daty z API. Cała AGH raz dziennie.
- Migawki i wykryte zmiany zapisuje workflow jako JSON w osobnej gałęzi
  `dane`. Gałąź `main` zostaje bez commitów z danymi, a historia jest
  trwała i jawna.
- Sposób pokazywania zmian rozstrzygną makiety: każda pokaże historię
  w swoim stylu (karty „było → jest”, blednięcie koloru, oś czasu albo coś
  innego).
- Przycisk „Sprawdź teraz” może działać tylko w trybie serwerowym.


## Widoki

- Typowy tydzień semestru z przełącznikiem wszystkie / parzyste /
  nieparzyste. Zajęcia co dwa tygodnie oznaczone „P” lub „N”.
- Konkretny tydzień kalendarzowy z datami.
- Kolumny sobota i niedziela pojawiają się tylko wtedy, gdy w planie są
  zajęcia weekendowe.
- Widok konkretnego tygodnia bierze zajęcia z dat w API. Przy nagłówku
  każdego dnia jest numer tygodnia semestru i parzystość, bo w semestrze
  zimowym parzystość zmienia się w czwartek. Dzień z przeniesionym planem
  ma adnotację w nagłówku, np. „wtorek 10.11 · zajęcia jak w środę”.
- W widoku typowego tygodnia zajęcia krótsze niż semestr mają na bloczku
  zakres dat i liczbę spotkań, np. „2.10–30.10, 5 spotkań”.
- Przedmioty blokowe (lektorat, WF) są na planie z oznaczeniem, że to blok
  i właściwą grupę wybiera się osobno. Bez zastępczego prowadzącego
  „- Prodziekan”.
- Priorytet: komputer. Telefon ma działać, ale jest drugorzędny.


## Stan, udostępnianie, eksport

- Bez kont. Bieżący stan w `localStorage` i w URL.
- Przycisk „Udostępnij” generuje link z zakodowanym stanem: ciąg znaków
  `A–Z a–z 0–9 - _`. Link tworzy przeglądarka i sam niesie cały stan, więc
  działa tak samo na GitHub Pages i na serwerze.
- Subskrybowany kalendarz `.ics` z ukryciami i wybranymi grupami działa
  tylko w trybie serwerowym. Adres zawiera ten sam token co link
  „Udostępnij”, więc kalendarz pokazuje dokładnie to, co widać, i sam się
  aktualizuje. Na GitHub Pages nie ma kalendarza generowanego na żądanie.
- Eksport do obrazka PNG.


## Technologia i hosting

- Flask, szablony Jinja i Alpine.js. Bez etapu budowania frontendu.
- Ukrywanie, łączenie, kolizje i link „Udostępnij” działają w przeglądarce
  (`app/static/js`), więc strona nie potrzebuje serwera. Python
  odpowiada za pobieranie i parsowanie USOS, budowanie strony i kalendarz
  w trybie serwerowym.
- Dwa tryby z jednego kodu:
  - **GitHub Pages** (główny): `flask build` renderuje stronę do
    statycznych plików, a workflow `pages.yml` publikuje ją z gałęzi `main`.
  - **Serwer** (opcjonalny): ten sam Flask w Dockerze (docker-compose,
    gunicorn) dodaje filtrowany kalendarz i odświeżanie na żądanie.


## Styl

- Neutralnie, bez identyfikacji wizualnej AGH. Strona jest nieoficjalna
  i nie może udawać uczelnianej.
- Jasny i ciemny motyw, domyślnie według systemu, z ręcznym przełącznikiem.
  Oba zaprojektowane osobno.
- Gęstość umiarkowana: tydzień mieści się na ekranie, pełne szczegóły po
  kliknięciu.
- Bloczek zajęć: nazwa przedmiotu, typ zajęć z numerem grupy, prowadzący.
  Sala dopiero w szczegółach.
- Kolor bloczka przy pojedynczym planie: według typu zajęć.
- Kroje pisma dobrane osobno do każdej makiety, hostowane lokalnie,
  z pełnymi polskimi znakami.
- Nazwa: do zaproponowania przy makietach.


## Wybrany kierunek

26.09.2026 użytkownik wybrał makietę szwajcarską („Rozkład”) z prośbą
o więcej koloru. Siatka, typografia i układ zostają, a kolor pojawia się
w danych:

- Każdy typ zajęć ma własną barwę: wykład niebieski, laboratorium zielone,
  ćwiczenia audytoryjne żółte, projekt fioletowy, pozostałe typy morskie.
  Po połączeniu planów te same barwy oznaczają plany źródłowe. Przedmioty
  blokowe są kreskowane.
- Czerwień zostaje wyłącznie dla kolizji, więc żaden typ zajęć nie jest
  czerwony ani pomarańczowy.
- Kod typu (W, CWL…) nadal stoi na każdym bloczku jako drugi nośnik
  informacji.
- Bloczki są pełnymi polami koloru (wybór z trzech natężeń w makiecie).
- Kolor ma też winieta (pole z nazwą strony) i podkreślenie aktywnej
  zakładki. To jedyne miejsca, gdzie kolor nie niesie informacji.
- Równoległe grupy tego samego typu zajęć tworzą jeden bloczek
  (np. „CWL gr. 1–4”), a po kliknięciu wybiera się swoją grupę.
- Kolizje: grupy tego samego typu zajęć w jednym przedmiocie to
  alternatywy, a nie kolizja. Zajęcia w tygodnie nieparzyste nie kolidują
  z zajęciami w parzyste, a przy znanych datach liczy się część wspólna dat.
  Przy kolizji widać, w które tygodnie występuje i których grup dotyczy
  (np. „1 kolizja, tyg. N”).


## Makiety

Trzy klikalne makiety HTML w `mockups/`, każda na prawdziwych danych z USOS
i z opublikowanym podglądem. Każda pokazuje też historię zmian planu
kierunku po swojemu:

1. **Typografia szwajcarska.** Siatka, jeden grotesk, czerń i biel plus
   jeden akcent.
2. **Narzędzie techniczne.** Gęsto, monospace dla godzin i kodów,
   obsługa klawiaturą.
3. **Klasyczna gazeta, bogato animowana.** Cztery podwarianty ruchu do
   porównania:
   - skład „przy czytelniku”: przy zmianie planu tekst i bloczki
     przepływają do nowych pozycji,
   - przewracanie stron: kolejny tydzień to kolejne „wydanie”,
   - ruch sterowany przewijaniem: winieta zwija się w pasek,
   - mikrointerakcje: ukrycie jako przekreślenie i zwinięcie.

Animacje w wariancie gazetowym to świadomy wyjątek od reguły „ruch tylko
z funkcją” z fazy 0. Każda z nich ma jednak coś komunikować (skąd przyszedł
bloczek, że zmienił się tydzień, co zostało ukryte) i każda wyłącza się przy
`prefers-reduced-motion`.
