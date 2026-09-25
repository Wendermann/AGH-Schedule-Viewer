# Decyzje projektowe

Ustalone przed analizą USOS i makietami. Punkty oznaczone „do potwierdzenia
po analizie” zależą od tego, co faktycznie udostępnia USOSweb niezalogowanym.


## Dane

- Źródło: scraping publicznych stron USOSweb (`web.usos.agh.edu.pl`), bez
  USOS API i bez logowania.
- Cache: 24 godziny. Na stronie widać datę pobrania i jest akcja „odśwież
  z USOS”.
- Indeks do wyszukiwarki i drzewa: cała AGH, wszystkie dostępne cykle
  dydaktyczne. Budowany stopniowo, z limitem zapytań do USOS.
- Wyszukiwanie: pole z podpowiedziami (lokalny indeks, SQLite FTS) oraz
  drzewo wydział → kierunek → rok → semestr.


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
  `A–Z a–z 0–9 + - _`. Stanu nie zapisujemy na serwerze, link sam go niesie.
- Eksport `.ics` przede wszystkim jako subskrybowany URL. Zawiera ten sam
  zakodowany stan, więc kalendarz pokazuje dokładnie to, co widać
  (z ukryciami i wybranymi grupami) i sam się aktualizuje.
- Eksport do obrazka PNG.


## Technologia

- Flask, szablony Jinja i Alpine.js. Bez etapu budowania frontendu.
- Uruchamianie w Dockerze (docker-compose, gunicorn).


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
