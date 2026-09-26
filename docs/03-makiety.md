# Makiety

Trzy klikalne makiety w `mockups/`, na tych samych prawdziwych danych.
Budowa strony (`flask build`) kopiuje je do `_site/makiety/`, więc po
włączeniu GitHub Pages będą pod `…/AGH-Schedule-Viewer/makiety/`.

| Plik | Nazwa robocza | Kierunek |
| --- | --- | --- |
| `szwajcarska.html` | Rozkład | Typografia szwajcarska: siatka, Archivo w kilku szerokościach, czerń i biel, czerwień tylko dla kolizji. |
| `narzedzie.html` | Grafik | Narzędzie techniczne: trzy panele, IBM Plex Sans Condensed i Plex Mono, skróty klawiszowe, dziennik zmian jak `diff`. |
| `gazeta.html` | Tygodnik Zajęć | Klasyczna gazeta: tydzień to wydanie, dni to szpalty, zajęcia to notki, zmiany to wiadomości. Cztery warianty ruchu. |

**Wybrana: Rozkład**, z kolorem typów zajęć (sekcja „Wybrany kierunek”
w `docs/01-decyzje.md`). Przełącznik „Kolor” w pasku makiety pokazuje trzy
natężenia; użytkownik wybrał pełne pola i kolor także w winiecie
i zakładkach, więc przełącznik zniknął z makiety.

Propozycje nazwy strony: Rozkład, Grafik, Tygodnik Zajęć, Siatka, Plan na
tydzień, Kiedy zajęcia.

Podgląd do czasu włączenia Pages (prywatne artefakty użytkownika na
claude.ai, 25.09.2026):
[Rozkład](https://claude.ai/artifact/RY5jnsER6esA5noBnDZpfw),
[Grafik](https://claude.ai/artifact/28LhnrjJaF6BofCsLQ7m9t),
[Tygodnik Zajęć](https://claude.ai/artifact/64S3ESat6aNWmAzcQUK48B).
W podglądzie link „Udostępnij” wskazuje adres ramki podglądu, a nie stronę,
więc do testowania linków służy wersja z `flask build`.


## Dane

`mockups/build_data.py` pobiera plany `240-ZBI-1S-2R-Z` i `240-INF-1S-2R-Z`
w cyklu `26/27-Z` (3 strony USOSweb) i daty spotkań z USOS API, a wynik
zapisuje w `mockups/dane/plany.json`. Historia zmian ZBI to porównanie
z migawką z 30.06.2026 z monitora zmian użytkownika
(`mockups/dane/monitor-240-ZBI-1S-2R-Z-2026-06-30.json`): 18 dodanych grup
zajęciowych i 9 zmienionych (Kryptografia przeniesiona ze środy na
poniedziałek, nowi prowadzący w Fizyce 2, laboratorium z programowania
niskopoziomowego o 8:00 zamiast 11:30).

Przypadki brzegowe w danych: zajęcia co dwa tygodnie, kolizje, nazwy do
61 znaków, zajęcia do 20:30, zajęcia zdalne, kilku prowadzących, przedmioty
blokowe bez sali, laboratoria tylko w październiku, spotkania o zmienionej
godzinie, dzień wolny 11.11, dni z planem innego dnia (10.11 i 7.01) oraz
tydzień sprzed zajęć (28.09–4.10).

Logika wspólna dla makiet jest w `mockups/wspolne/model.js`. Ukrywanie,
łączenie i kolizje liczy `app/static/js/plan.js`, a link „Udostępnij”
koduje `app/static/js/share.js`, czyli ten sam kod co przyszła strona.


## Checklista fazy 0

Wszystkie trzy makiety:

- Kolor ma jedno znaczenie i legendę. Przy jednym planie to typ zajęć, po
  połączeniu plan źródłowy. Kod typu (W, CWL…) jest zawsze na bloczku.
  Czerwień oznacza tylko kolizję.
- Brak gradientów ozdobnych, rozmyć i emoji. Linie godzin i kreskowanie
  przedmiotów blokowych są rysowane wzorem CSS i niosą informację.
- Cień ma tylko lista wyników wyszukiwania w „Grafiku”, bo leży nad planem.
- Godziny cyframi tabelarycznymi.
- Strona od razu pokazuje plan, bez strony powitalnej.
- Tekst po polsku, w terminologii USOS.
- Stany danych do podejrzenia w pasku makiety: dane aktualne, dane z kopii,
  synchronizacja w USOS, USOS niedostępny, plan bez zajęć. Wczytywanie
  pokazuje się po 300 ms.
- Widok odtwarza się z samego adresu (token w `#`). Pamięć przeglądarki
  przechowuje tylko ostatni widok i motyw.
- Wszystko działa z klawiatury, fokus jest widoczny. Strzałki zmieniają
  tydzień, Esc zamyka szczegóły. „Grafik” ma pełny zestaw skrótów (`?`).
- Osobne układy: telefon (lista dnia, plan na górze) i wydruk (A4 poziomo,
  sam plan). Żadna strona nie przewija się w poziomie przy 390, 768
  i 1280 px.
- Każda widoczna kontrolka działa. Grupy bez danych w makiecie są
  wyszarzone z dopiskiem, a nie udają przycisków.


## Rozwiązania potwierdzone 26.09.2026

- **Równoległe grupy w jednym bloczku.** Grupy tego samego typu zajęć
  o tej samej porze (np. CWL gr. 1–4 z Fizyki 2) tworzą jeden bloczek, a po
  kliknięciu można wybrać swoją grupę. Bez tego w piątek stałoby obok siebie
  kilka wąskich bloczków.
- **Alternatywne grupy to nie kolizja.** `collide()` w `plan.js` nie liczy
  już kolizji między grupami tego samego typu zajęć w jednym przedmiocie, bo
  student chodzi tylko do jednej z nich.
- **Gazeta układa kolizje pod sobą**, w czerwonej ramce z podpisem.
  W szpalcie szerokiej na ok. 190 px notki obok siebie łamałyby tytuły
  w połowie wyrazów. Dwie pozostałe makiety stawiają kolizje obok siebie.
- **Makieta szwajcarska rozróżnia typ zajęć wypełnieniem** (pełne, ramka,
  szare, przerywane, kreskowane) zamiast barwą, żeby zostać przy czerni,
  bieli i jednym akcencie.
- Bez eksportu `.ics` i PNG. Makiety sprawdzają kierunek wizualny, a eksport
  nie zależy od stylu.


## Warianty ruchu w gazecie

Przełącznik „Ruch” w pasku makiety. Działa zawsze tylko jeden wariant,
a przy `prefers-reduced-motion` wszystkie są wyłączone.

- **A. Skład przy czytelniku**: po zmianie parzystości, dołączeniu planu
  albo ukryciu przedmiotu notki przepływają na nowe miejsca (FLIP).
- **B. Przewracanie stron**: przy zmianie tygodnia albo wydania stara strona
  odwraca się jak kartka.
- **C. Ruch przy przewijaniu**: winieta zwija się w wąski pasek.
- **D. Mikrointerakcje**: ukrywany przedmiot jest przekreślany w dziale,
  a jego notki przekreślają się i zwijają.
