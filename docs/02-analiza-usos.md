# Analiza USOSweb i USOS API

Stan na 25.09.2026. Przykłady pochodzą z planu grupy przedmiotów
`240-ZBI-1S-2R-Z` (Informatyka – Zarządzanie bezpieczeństwem informacji,
semestr 3) w cyklu `26/27-Z` i z danych USOS API dla tych samych zajęć.
Zapisane strony są w `tests/fixtures/usos/`, parser w `app/usos/web.py`.


## 1. Źródła

| | USOSweb | USOS API |
| --- | --- | --- |
| Adres | `https://web.usos.agh.edu.pl/kontroler.php` | `https://apps.usos.agh.edu.pl/services/` |
| Wersja | 7.3.1.0-AGH (2026-07-14) | 7.3.1.0 |
| `robots.txt` | `User-agent: *`, `Disallow: /` | brak (404) |
| Format | HTML | JSON |

Podział (decyzja w `docs/01-decyzje.md`): API daje zajęcia, konkretne daty,
cykle i słowniki. USOSweb daje tylko to, czego API nie ma.

**Metody API bez klucza i bez logowania** (`auth_options.consumer = ignored`,
sprawdzone przez `services/apiref/method`):

- plan: `tt/classgroup`, `tt/classgroups`, `tt/classgroup_dates2`,
  `tt/course_edition`, `tt/course_editions`;
- słowniki: `terms/term(s)`, `terms/terms_index`, `terms/search`,
  `courses/classtypes_index`, `courses/course`, `courses/courses`,
  `courses/search`, `geo/building_index`, `geo/building(s)`;
- z opcjonalnym kluczem, działające bez niego: `fac/faculty`, `fac/search`,
  `groups/class_group`, `tt/staff`, `geo/room(s)`.

**Czego API nie ma:**

- grup przedmiotów: nie ma metody, która przyjmuje `grupa_kod`, ani listy
  grup jednostki;
- nazwisk prowadzących: plan w API podaje tylko `lecturer_ids`,
  a `users/user(s)` wymaga klucza konsumenta.

**Błędy API, które trzeba obchodzić:**

- `tt/course_editions` (liczba mnoga) z dowolnym parametrem `fields` zwraca
  HTTP 500. Bez `fields` zwraca tylko `start_time`, `end_time` i `name`.
  Zamiast niej: `tt/classgroups` albo `tt/course_edition` dla każdego
  przedmiotu osobno.
- Zapytanie o edycję przedmiotu, której nie ma (przedmiot w cyklu, w którym
  się nie odbywał), zwraca HTTP 500 z `{"message": "Internal USOS API error
  has occured..."}` zamiast 404.
- Metody `tt/*` oprócz `tt/classgroup_dates2` zwracają najwyżej 7 dni
  (`days` ≤ 7).


## 2. Plan grupy przedmiotów w USOSweb

Adres: `kontroler.php?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow&grupa_kod=240-ZBI-1S-2R-Z&cdyd_kod=26%2F27-Z`.

**Nagłówek** to `<dl class="inline-keyvalue-list">` z polami „Jednostka”
(link `pokazJednostke&kod=240-000`), „Grupa przedmiotów” (link z parametrem
`grupaKod`) i „Cykl dydaktyczny” (sama nazwa, np. „Semestr zimowy
2026/2027”, bez kodu).

**Siatka** to komponent `<usos-timetable start="7" end="20">`. Zawiera po
jednym `<div>` na dzień: nagłówek `<h4>` z nazwą dnia po polsku
i `<timetable-day>` z wpisami. Parser rozpoznaje dzień po nazwie, a nie po
kolejności kolumn.

**Wpis** `<timetable-entry>` to jeden termin w tygodniu jednej grupy
zajęciowej:

| Miejsce | Przykład | Znaczenie |
| --- | --- | --- |
| atrybut `name` | `Fizyka 2` | nazwa przedmiotu |
| atrybut `name-id` | `240-ZBI-1S-114` | kod przedmiotu |
| atrybut `style` | `grid-row-start: g0800; grid-row-end: g0930` | godziny |
| atrybut `color` | `6` albo `2` | kolor USOS: 6 dla wykładów i przedmiotów blokowych, 2 dla reszty. Nieprzydatny. |
| slot `info` | `W, gr. 1 (on-line, bud. D17)` | skrót typu, numer grupy, sala |
| slot `time` | `13:15` i `<span title="raz na dwa tygodnie - nieparzyste">` z ikoną `one.svg` lub `two.svg` | godzina i parzystość |
| slot `dialog-info` | link `pokazZajecia&zaj_cyk_id=191059&gr_nr=1`, tekst „wykład, grupa 1” | grupa zajęciowa |
| slot `dialog-event` | „co drugi wtorek (nieparzyste), 8:00 - 9:30” | częstotliwość |
| slot `dialog-person` | linki `pokazOsobe&os_id=101263` | prowadzący |
| slot `dialog-place` | linki `pokazSale&sala_id=1825` („Sala on-line,”) i `pokazBudynek&bud_kod=D17` | sala i budynek |

Opisy częstotliwości spotkane w czterech planach (ok. 430 wpisów):
„każdy/każda <dzień>” i „co drugi/co druga <dzień> (parzyste|nieparzyste)”.
Legenda planu ma też ikonę `warn.svg` dla zajęć „w inny sposób, nie przez
cały semestr”, ale żaden z tych planów jej nie używa. Parser traktuje każdy
inny opis jako `irregular`.

**Osobliwości:**

- Plan pokazuje wszystkie grupy zajęciowe każdego przedmiotu z grupy
  przedmiotów. W API (`tt/course_edition` dla 15 przedmiotów, dwa pierwsze
  tygodnie) nie było żadnej grupy spoza planu. Jedyna grupa z planu, której
  API wtedy nie pokazało, zaczyna zajęcia 20.10.
- Grupa zajęciowa może mieć kilka terminów w tygodniu. Lektorat gr. 1 ma
  poniedziałek 15:00 i czwartek 11:30, więc 53 wpisy dają 52 grupy.
- Przedmioty blokowe (`240-1S-BJO-2` lektorat, `240-1S-BWF-3` WF) to
  zaślepki. Mają jedną lub dwie grupy bez sali, a prowadzącym jest konto
  „- Prodziekan” (`os_id=103764`). Prawdziwe grupy językowe i WF są
  w innych jednostkach.
- „Każdy piątek” nie znaczy „przez cały semestr”. Laboratoria z Fizyki 2
  (CWL gr. 1–4) mają w API tylko 5 spotkań, od 2.10 do 30.10, a USOSweb
  nie oznacza ich ikoną `warn`.
- Dla cyklu bez zajęć (np. `240-INF-1S-2R-Z` w `22/23-Z`) strona ma pusty
  `usos-timetable`.
- USOSweb ma też widok jednego tygodnia (`plan_division=week`,
  `plan_week_sel_week=RRRR-MM-DD`). Nie jest potrzebny, bo daty podaje API.


## 3. Konkretne daty spotkań (API)

- Jedna grupa zajęciowa, cały cykl:
  `tt/classgroup_dates2?unit_id=191059&group_number=1`.
- Wiele grup naraz, okno 7 dni:
  `tt/classgroups?classgroup_ids=191059|1|191410|3|…&start=2026-10-05&days=7`.
  Jedno zapytanie z 52 grupami trwało poniżej sekundy. Górnej granicy
  liczby grup nie sprawdzałem.

Każde spotkanie ma pola `start_time`, `end_time` (czas lokalny),
`course_id`, `course_name`, `classtype_id`, `classtype_name`,
`group_number`, `unit_id`, `lecturer_ids`, `room_number`, `room_id`,
`building_id`, `building_name`, `cgwm_id` (termin tygodniowy) i `sm_id`
(pojedyncze spotkanie).

Są dwa rodzaje spotkań:

- `classgroup2`: potwierdzone pojedyncze spotkania z własnym `sm_id`, bez
  pola `frequency`. W tym planie to 391 z 481 spotkań.
- `classgroup`: USOS wylicza je z częstotliwości (`frequency`:
  `every_week`, `every_fortnight_odd`, `every_fortnight_even`, …) i dni
  wolnych. Tu tylko przedmioty blokowe. Dla `frequency` równego `other` albo
  `once` API zwraca wszystkie możliwe dni cyklu, więc takich dat nie wolno
  pokazywać jako spotkań.

**Kalendarz semestru zimowego 2026/27**, odczytany z dat spotkań
`classgroup2`:

- cykl `26/27-Z` trwa od 1.10.2026 do 28.02.2027 (`terms/term`), ostatnie
  spotkanie `classgroup2` jest 26.01.2027;
- dni powszednie bez zajęć: 2.11, 11.11, 23.12–1.01, 6.01;
- przeniesienia: we wtorek 10.11 i w czwartek 7.01 odbywają się zajęcia
  środowe, a wtorkowych i czwartkowych tego dnia nie ma. Przeniesione są
  tylko zajęcia z pasującą parzystością: 10.11 przypada w miejsce środy
  11.11 z tygodnia parzystego, więc odbywają się środowe zajęcia
  cotygodniowe i parzyste;
- spotkania `classgroup` nie uwzględniają przeniesień. Lektorat ma
  spotkanie w czwartek 7.01, choć tego dnia obowiązuje plan środowy.

Wniosek: widok konkretnego tygodnia i `.ics` trzeba budować z dat z API.
Z reguły „co tydzień / co dwa tygodnie” wyszłyby błędne daty. Typowy
tydzień semestru (z parzystością) może zostać przy danych z USOSweb.


## 4. Tygodnie parzyste i nieparzyste

USOSweb pod planem opisuje regułę tak: „Zajęcia prowadzone z częstotliwością
«co dwa tygodnie (nieparzyste)» odbywają się w pierwszym tygodniu od
rozpoczęcia cyklu dydaktycznego (np. semestru), a potem co dwa tygodnie. […]
Jeśli zajęcia wypadają w dniu wolnym, to nie odbywają się, natomiast nie ma
to wpływu na terminy kolejnych zajęć”.

Tydzień 1 to 7 dni od początku cyklu, a nie tydzień kalendarzowy. Cykl
`26/27-Z` zaczyna się w czwartek 1.10, więc tydzień 1 trwa od czwartku
1.10 do środy 7.10. Dla każdej daty:
`nieparzysty = ((data − początek_cyklu).dni // 7) % 2 == 0`. Sprawdzone na
wszystkich 37 zajęciach co dwa tygodnie w tym planie (21 nieparzystych,
16 parzystych). Tygodnie ISO nie pasują.

Skutek dla interfejsu: w tygodniu kalendarzowym od poniedziałku do niedzieli
parzystość zmienia się w czwartek. Na przykład w tygodniu 5–11.10 dni od
poniedziałku do środy są nieparzyste, a od czwartku do piątku parzyste.
Przełącznik „parzyste / nieparzyste” ma sens tylko w widoku typowego
tygodnia. Widok konkretnego tygodnia pokazuje po prostu daty z API.
Semestr letni `26/27-L` zaczyna się w poniedziałek 1.03.2027, więc tam
tygodnie parzystości pokryją się z kalendarzowymi.


## 5. Typy zajęć

Skróty w slocie `info` to te same kody co `classtype_id` w API.
`courses/classtypes_index` zwraca 28 typów z nazwami po polsku
i angielsku. W planie występują:

| Kod | Nazwa | English |
| --- | --- | --- |
| W | wykład | lecture |
| CWA | ćwiczenia audytoryjne | auditorium classes |
| CWL | ćwiczenia laboratoryjne | laboratory classes |
| CWP | ćwiczenia projektowe | project classes |
| LEKT | lektorat | foreign language classes |
| WF | zajęcia z wf | physical education classes |

Pozostałe: KONW, ZS, ZP, ZW, ZT, PK, PP, OK, PRAC_DYPL, PROJ_DYPL, eL, BIBL,
LEKT_EGZ, CL, K, E, PZ, KN, EGK-o, EGK-p, BHP, BN. Część z nich nie ma
nazwy angielskiej.

Skróty `WYK` i `LAB` z dotychczasowych testów i z `handoff.md` nie są kodami
USOS. Właściwe kody są wyżej.


## 6. Identyfikatory

| Pojęcie | USOSweb | API | Przykład |
| --- | --- | --- | --- |
| grupa przedmiotów | `grupa_kod`, `grupaKod` | brak | `240-ZBI-1S-2R-Z` |
| cykl dydaktyczny | `cdyd_kod` | `term_id` | `26/27-Z` |
| przedmiot | `prz_kod`, atrybut `name-id` | `course_id` | `240-ZBI-1S-114` |
| zajęcia jednego typu w przedmiocie i cyklu | `zaj_cyk_id` | `unit_id` | `191059` |
| grupa zajęciowa | `zaj_cyk_id` + `gr_nr` | `unit_id` + `group_number` | `191059`, `1` |
| termin tygodniowy | brak | `cgwm_id` | `240025` |
| pojedyncze spotkanie | brak | `sm_id` | `2645202` |
| osoba | `os_id` | `lecturer_ids`, `user_id` | `101263` |
| sala | `sala_id` | `room_id` | `1825` |
| budynek | `bud_kod` | `building_id` | `D17` |
| jednostka | `kod`, `jed_org_kod` | `fac_id` | `240-000` |

`zaj_cyk_id` jest osobny dla każdego typu zajęć w przedmiocie i każdego
cyklu. Fizyka 2 w `26/27-Z` ma W `191059`, CWA `191304` i CWL `191381`.
W kolejnym cyklu te same zajęcia dostaną nowe numery. Stabilny klucz
między cyklami to więc `(course_id, classtype_id, group_number)`, a w obrębie
cyklu `(unit_id, group_number)`.

**Kody grup przedmiotów** zwykle mają postać
`<wydział>-<kierunek>-<stopień i forma>-<rok>R-<Z|L>`, np.
`240-ZBI-1S-2R-Z` to 2. rok, semestr zimowy, czyli semestr 3. Nie wszystkie
jednak trzymają się tego schematu: `240_INF-1S,7sem,po` („przedmioty
obieralne”), `240-IDS-2S-0R-Z` („0 semestr”). Nazwy też są niejednolite:
„240 - Informatyka - …”, „240_Informatyka, stacjonarne, …”, „Informatyka
-Uczenie maszynowe …”. Drzewo wydział → kierunek → rok → semestr trzeba
więc budować z kodów z regułą awaryjną dla nietypowych przypadków.


## 7. Katalog: wydziały, grupy przedmiotów, cykle

- **Wydziały**: `fac/search?query=Wydział` w API. Daje 18 wydziałów
  o kodach `NNN-000` (od `100-000` do `430-000`).
- **Grupy przedmiotów jednostki**: USOSweb
  `katalog2/przedmioty/wybierzGrupePrzedmiotow&jed_org_kod=240-000&tab_limit=500`.
  Domyślnie strona pokazuje 30 pozycji, a element `<table-nav-bar
  elements-count="25">` podaje ich łączną liczbę, więc parser odrzuca
  niepełną listę. Wydział Informatyki ma 25 grup. Link z
  `szukajPrzedmiotu&method=faculty_groups&jed_org_kod=240-000` przekierowuje
  (303) na tę stronę. Strona ma też eksport CSV, ale jego adres zależy od
  sesji.
- **Cykle**: `terms/terms_index` w API. Daje 57 cykli od `08/09`
  z datami początku i końca. Semestry mają kody `RR/RR-Z` i `RR/RR-L`, lata
  akademickie `RR/RR`.
- **Przedmioty grupy**: strona planu podaje je już sama (atrybut `name-id`),
  więc osobna lista przedmiotów
  (`szukajPrzedmiotu&method=faculty_groups&grupaKod=…`) nie jest potrzebna.

Nie sprawdzałem, czy grupy przedmiotów definiują też jednostki inne niż
wydziały, np. studium języków obcych.


## 8. Poprzednie cykle

- USOSweb zwraca plany z poprzednich cykli, gdy poda się `cdyd_kod` wprost.
  `240-INF-1S-2R-Z` ma plan w `23/24-Z` (103 wpisy), `24/25-Z` (140)
  i `25/26-Z` (136). Plan w `22/23-Z` jest pusty. Lista „Zmień cykl
  dydaktyczny” na stronie proponuje tylko `25/26-Z` i `26/27-Z`, więc
  starsze cykle trzeba wywoływać bezpośrednio.
- API ma daty spotkań z `23/24-Z` (sprawdzone na `210-ENR-1S-037`), a dla
  `22/23-Z` zwraca pustą listę.
- Między cyklami widać zmiany składu. W `240-INF-1S-2R-Z` pomiędzy `23/24-Z`
  a `24/25-Z` doszły 3 przedmioty i ubyły 2.
- Nie wiadomo, czy plan starego cyklu korzysta z dzisiejszej definicji
  grupy przedmiotów, czy z tej sprzed lat. Jeśli z dzisiejszej, to przedmiot
  usunięty z grupy zniknie też z jej starych planów.
- USOS nie przechowuje historii zmian w trakcie cyklu (przeniesionych zajęć,
  zmian sal czy prowadzących), tylko stan bieżący. Takie zmiany da się
  śledzić wyłącznie przez własne, regularne migawki.


## 9. Język

API podaje nazwy jako `{"pl": …, "en": …}`. Pole `en` bywa puste (przedmioty
blokowe, część typów zajęć, nazwy budynków), więc potrzebny jest powrót do
wersji polskiej. Angielskiej wersji stron USOSweb nie sprawdzałem, bo
nazwy do interfejsu i tak pochodzą z API.


## 10. Tempo i koszt pobierania

Jeden plan grupy przedmiotów w jednym cyklu kosztuje:

- 1 stronę USOSweb (ok. 150 KB);
- około 18–22 zapytań `tt/classgroups` w oknach 7-dniowych, od początku cyklu
  do ostatnich zajęć, albo po jednym `tt/classgroup_dates2` na grupę
  zajęciową (tu 52).

Wydział Informatyki ma 25 grup przedmiotów. Przy 18 wydziałach cała AGH to
najpewniej kilkaset grup w cyklu, choć tego nie liczyłem. Pełny indeks
oznacza więc kilkaset stron USOSweb. `robots.txt` USOSweb zabrania pobierania
czegokolwiek, dlatego te strony warto pobierać rzadko (np. raz w tygodniu
i tylko dla bieżącego oraz następnego cyklu), z odstępem co najmniej 2 s.
Zakończone cykle wystarczy pobrać raz. Dla API rozsądny odstęp to 1 s.
Zapytania z wieloma grupami naraz zmniejszają ich liczbę kilkadziesiąt razy.

Projekt z archiwum użytkownika (monitor zmian) przedstawiał się
User-Agentem przeglądarki Chrome. Tu zostaje własny, jawny User-Agent
z adresem repozytorium (`USOS_USER_AGENT` w `app/config.py`).
