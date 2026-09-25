# Decyzje projektowe

Ustalone przed analizą USOS i makietami. Punkty oznaczone „do potwierdzenia
po analizie” zależą od tego, co faktycznie udostępnia USOSweb niezalogowanym.


## Dane

- Źródło: scraping publicznych stron USOSweb (`web.usos.agh.edu.pl`), bez
  USOS API i bez logowania.
- Świeżość danych zależy od trybu (patrz „Technologia i hosting”):
  - GitHub Pages: dane pobiera GitHub Action podczas budowania strony,
    docelowo raz dziennie. Na stronie widać datę pobrania, ale nie ma
    odświeżania na żądanie.
  - Serwer: cache 24 godziny i akcja „odśwież z USOS”.
- Indeks do wyszukiwarki i drzewa: cała AGH, wszystkie dostępne cykle
  dydaktyczne. Budowany stopniowo, z limitem zapytań do USOS. Zakończone
  cykle się nie zmieniają, więc pobieramy je raz.
- Wyszukiwanie: pole z podpowiedziami oraz drzewo wydział → kierunek →
  rok → semestr. Indeks to plik JSON przeszukiwany w przeglądarce, bo na
  GitHub Pages nie ma bazy danych. Serwer używa tego samego pliku.


## Zakres pierwszej wersji

- Plany grup przedmiotów (kierunek i semestr, np. `240-ZBI-1S-2R-Z`).
- Plany przedmiotu i konkretnej grupy zajęciowej.
- Poza zakresem na start: prowadzący, sale.
- Interfejs po polsku i angielsku. Nazwy z USOS w wersji językowej, którą
  USOS udostępnia (do potwierdzenia po analizie).


## Ukrywanie i łączenie

- Ukrywanie na trzech poziomach: cały przedmiot, typ zajęć w przedmiocie
  i numer grupy („moja grupa” dla danego typu zajęć).
- Łączenie planów w jednej siatce. Kolor oznacza plan źródłowy, typ zajęć
  pokazuje skrót.
- Kolizje: bloczki obok siebie, a kolizje zajęć, które zostały po ukryciach,
  są wyróżnione i zliczone w nagłówku dnia.


## Widoki

- Typowy tydzień semestru z przełącznikiem wszystkie / parzyste /
  nieparzyste. Zajęcia co dwa tygodnie oznaczone „P” lub „N”.
- Konkretny tydzień kalendarzowy z datami.
- Kolumny sobota i niedziela pojawiają się tylko wtedy, gdy w planie są
  zajęcia weekendowe.
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


## Makiety

Trzy klikalne makiety HTML w `mockups/`, każda na prawdziwych danych z USOS
i z opublikowanym podglądem:

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
