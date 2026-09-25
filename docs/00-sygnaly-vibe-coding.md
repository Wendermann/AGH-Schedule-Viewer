# Faza 0: po czym poznać aplikację „vibe-coded” i czego tu nie robimy

Dokument ma dwa zastosowania. Najpierw spisuje konkretne sygnały, po których
w kilka sekund widać, że aplikację wygenerowano bez decyzji projektowych.
Potem służy jako checklista, według której oceniamy makiety i gotową stronę
(sekcja 5).

Wspólny mianownik wszystkich sygnałów to nie samo użycie AI, tylko brak
decyzji: domyślne ustawienia bibliotek, domyślny ton modelu językowego
i brak kontaktu z prawdziwymi danymi. Każdy punkt poniżej to jakaś wartość
domyślna, której nikt nie zmienił.

Format: **sygnał**, dlaczego zdradza, co robimy zamiast.


## 1. Wygląd

**Gradient fiolet → róż lub indygo → niebieski, gradientowy tekst w nagłówku.**
To domyślna paleta Tailwinda (indigo-500/purple-600) i ulubiony akcent
generatorów.
Zamiast: kolor pojawia się tylko tam, gdzie niesie informację (typ zajęć,
kolizja, ukryty element). Paletę wyprowadzamy z danych, nie z „ładności”.

**Inter albo system-ui wszędzie, nagłówki 48–60 px z ciasnym trackingiem.**
Brak decyzji typograficznej, a do tego krój optymalizowany pod UI, nie pod
gęste tabele.
Zamiast: krój wybrany pod dane tabelaryczne, cyfry tabelaryczne
(`font-variant-numeric: tabular-nums`) dla godzin, skala 3–4 stopni. Nagłówek
strony nie jest większy niż to, czego wymaga hierarchia.

**Każdy element w karcie `rounded-2xl shadow-lg`, karty w kartach.**
To domyślny komponent `Card`, użyty jako jedyne narzędzie grupowania.
Zamiast: strukturę budują siatka, linie i odstępy. Cień dostają tylko warstwy,
które faktycznie leżą nad treścią (popover, menu).

**Glassmorphism, `backdrop-blur`, rozmyte plamy w tle, „aurora”.**
Efekt, który nie ma nic wspólnego z treścią.
Zamiast: płaskie tło. Jedyną „grafiką” jest sam plan.

**Emoji jako ikony (📅 🚀 ✨) albo ikona Lucide przy każdej etykiecie.**
Dekoracja, która udaje hierarchię.
Zamiast: ikona tylko tam, gdzie zastępuje słowo i jest jednoznaczna (strzałki
tygodnia, zamknięcie panelu). Wszędzie indziej tekst.

**Nietknięty shadcn/ui: paleta zinc, radius 0.5 rem, ten sam Button, ten sam
Dialog.**
Rozpoznawalne od pierwszego spojrzenia.
Zamiast: kilka własnych komponentów, zaprojektowanych pod ten jeden przypadek.

**Ciemny motyw slate-900 z neonowym akcentem jako jedyny wariant.**
Wygląda „technicznie” i niczemu nie służy.
Zamiast: motyw dobieramy świadomie (patrz pytania). Jeśli są dwa, każdy ma
własną paletę, a nie odwrócone kolory drugiego.

**Wszystko wyśrodkowane w `max-w-7xl mx-auto`, sekcje jak na landing page.**
Szablon strony marketingowej zastosowany do narzędzia.
Zamiast: układ narzędzia, czyli pasek wyboru oraz plan na pełną dostępną
szerokość.

**`hover:scale-105`, `transition-all`, fade-in przy scrollu, migoczące
skeletony.**
Ruch bez funkcji.
Zamiast: przejścia do 150 ms i tylko przy zmianie stanu (np. ukrycie
przedmiotu), obsługa `prefers-reduced-motion`. Wskaźnik ładowania dopiero po
ok. 300 ms.

**Losowe pastele przypisane do przedmiotów, bez legendy.**
Kolor bez znaczenia.
Zamiast: kolor ma jedno, stałe znaczenie (np. typ zajęć albo plan źródłowy
po połączeniu), z legendą. Zawsze jest też drugi nośnik tej samej informacji
(skrót typu: W, Ćw, Lab, P), żeby plan był czytelny dla daltonistów i na
wydruku czarno-białym.


## 2. Treść i język

**Marketingowy ton: „bezproblemowo”, „odblokuj”, „twój niezawodny
asystent”, hero „Witaj w X!” z dwoma przyciskami CTA przed właściwym
narzędziem.**
Zamiast: strona startowa to od razu wyszukiwarka i ostatnio oglądane plany.
Bez sloganów.

**Siatka „trzech zalet” (Szybko / Prosto / Bezpiecznie) z ikonami.**
Zamiast: nie istnieje.

**Title Case W Polskich Nagłówkach, wykrzykniki, „Ups! Coś poszło nie tak 😅”.**
Zamiast: zwykłe zdania. Komunikat błędu mówi, co się stało i co z tym
zrobić, np. „USOS nie odpowiada. Pokazuję dane pobrane 25.09 o 14:32.”

**Angielskie wstawki w polskim UI (Dashboard, Settings, Loading…).**
Zamiast: całość po polsku, terminologia jak w USOS: zajęcia, grupa zajęciowa,
cykl dydaktyczny, jednostka, prowadzący. Dzięki temu użytkownik nie musi
tłumaczyć pojęć między naszą stroną a USOS.

**Tekst pomocniczy powtarzający etykietę („Szukaj: wpisz frazę, aby
wyszukać”).**
Zamiast: podpowiedź tylko wtedy, gdy dodaje coś nowego, np. przykład formatu
kodu grupy.

**Nagłówki z dwukropkiem lub półpauzą („Plan zajęć – prosto i czytelnie”).**
Zamiast: nagłówek nazywa to, co jest pod nim. Tylko tyle.

**Stopka „Made with ❤️”, ikony social mediów, © z linkami donikąd.**
Zamiast: stopka podaje źródło danych, czas pobrania, link do tej samej strony
w USOS i informację, że to nieoficjalne narzędzie.

**Liczniki-ozdobniki („12 przedmiotów · 34 zajęcia · 5 prowadzących”).**
Zamiast: pokazujemy tylko liczby, które pomagają w decyzji, np. „2 kolizje
w środę”.


## 3. Zachowanie

**Kontrolki, które nic nie robią albo nie zapamiętują stanu.**
Zamiast: każda kontrolka działa. Jeśli coś nie jest gotowe, po prostu tego
nie ma.

**Stan trzymany tylko w pamięci: odświeżenie gubi wybór, linku nie da się
wysłać znajomemu.**
Zamiast: stan widoku (wybrane plany, ukryte przedmioty i grupy, tydzień)
jest w URL. Pamięć przeglądarki służy tylko wygodzie (ostatnio oglądane).

**Brak zaprojektowanych stanów pustych, błędów i danych częściowych.**
Zamiast: każdy widok ma zaprojektowane stany: ładowanie, brak zajęć, USOS
niedostępny, dane z cache (z datą), trwająca synchronizacja po stronie USOS.

**Makiety na wymyślonych danych: wszystkie zajęcia po 90 minut o pełnych
godzinach, krótkie nazwy.**
Zamiast: makiety robimy na prawdziwym planie i celowo pokazujemy przypadki
brzegowe:
- nakładające się zajęcia (dwie grupy laboratoryjne w tym samym czasie),
- zajęcia co dwa tygodnie albo tylko w wybrane daty,
- start 7:30 i koniec po 20:00,
- nazwę przedmiotu na 80–100 znaków,
- kilku prowadzących, brak sali, zajęcia zdalne,
- dzień bez zajęć i tydzień z jednym dniem zajęć.

**Modal do wszystkiego.**
Zamiast: szczegóły zajęć w panelu lub dymku, który nie zasłania planu.

**Brak obsługi klawiatury: `outline: none`, `<div>` jako przycisk.**
Zamiast: semantyczny HTML, widoczny `:focus-visible`, nawigacja tygodni
klawiszami.

**Wersja mobilna doklejona na końcu albo desktop jako rozciągnięta wersja
mobilna.**
Zamiast: dwa świadome układy, siatka tygodnia na dużym ekranie oraz lista
dnia lub agenda na telefonie.

**Brak wydruku.**
Zamiast: arkusz `@media print`, czyli plan tygodnia na A4 poziomo, bez
elementów interfejsu.


## 4. Kod i repozytorium

**Jeden `app.py` na 1500 linii albo odwrotnie: dwanaście warstw abstrakcji dla
trzech endpointów.**
Zamiast: kilka modułów nazwanych słowami z domeny (pobieranie z USOS,
parsowanie, łączenie planów). Nic „na zapas”.

**Komentarze opowiadające kod („# importujemy Flask”), zakomentowane bloki,
`print()` zamiast logowania, emoji w logach.**
Zamiast: komentarz tylko wtedy, gdy wyjaśnia „dlaczego”, np. osobliwość
HTML-a USOS.

**`except Exception: pass`, zapytania HTTP bez timeoutu.**
Zamiast: nazwane błędy („USOS niedostępny”, „nie rozpoznano struktury
strony”) obsłużone w UI, timeouty, ponawianie z odstępem.

**Scraper bez cache, bez limitu zapytań, z domyślnym User-Agentem.**
Zamiast: cache z czasem ważności, limit zapytań do USOS, User-Agent z nazwą
projektu i kontaktem. Nie obciążamy uczelnianego serwera.

**Parsowanie HTML regexami.**
Zamiast: parser HTML i testy na zapisanych kopiach stron USOS (fixtures),
żeby zmiana po stronie USOS dała czerwony test, a nie cichy błąd.

**Tailwind z CDN, React z Babelem w przeglądarce, 30 zależności dla jednej
strony.**
Zamiast: minimalny stos. Każda zależność ma uzasadnienie.

**`requirements.txt` bez wersji albo z nieużywanymi paczkami.**
Zamiast: przypięte wersje, tylko to, czego kod faktycznie używa.

**README z badge'ami, emoji w nagłówkach, „✨ Features”.**
Zamiast: README opisuje, czym jest projekt, jak go uruchomić, skąd pochodzą
dane i jakie ma ograniczenia.

**Commity „update”, „fix”, „wip” albo „✨ feat: amazing feature”.**
Zamiast: commit mówi, co się zmieniło i po co.


## 5. Checklista do oceny makiet i strony

Każda makieta i każdy ekran gotowej strony przechodzi przez tę listę.

- [ ] Kolor ma zawsze jedno znaczenie i ma legendę. Jest też drugi nośnik
      informacji (tekst lub skrót).
- [ ] Nie ma gradientów, rozmyć, plam w tle ani emoji.
- [ ] Nie ma cieni poza warstwami, które faktycznie leżą nad treścią.
- [ ] Godziny są złożone cyframi tabelarycznymi i wyrównane w pionie.
- [ ] Strona startowa pokazuje od razu narzędzie, bez hero i sloganów.
- [ ] Cały tekst jest po polsku, w terminologii USOS, zwykłymi zdaniami.
- [ ] Makieta pokazuje nakładające się zajęcia, zajęcia co dwa tygodnie,
      długą nazwę i dzień bez zajęć.
- [ ] Istnieje zaprojektowany stan błędu USOS i stan „dane z cache”.
- [ ] Widok da się odtworzyć z samego URL.
- [ ] Wszystko jest osiągalne klawiaturą, a focus jest widoczny.
- [ ] Istnieje układ telefonu i układ wydruku, zaprojektowane osobno.
- [ ] Każda widoczna kontrolka działa.
