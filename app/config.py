class Config:
    # "server": Flask obsługuje żądania na żywo (Docker).
    # "static": strona zbudowana poleceniem `flask build` (GitHub Pages).
    SITE_MODE = "server"
    # Ścieżka, pod którą strona jest dostępna; na GitHub Pages to nazwa repo.
    SITE_BASE = "/"

    USOS_BASE_URL = "https://web.usos.agh.edu.pl/kontroler.php"
    USOS_API_URL = "https://apps.usos.agh.edu.pl/services/"
    USOS_CACHE_HOURS = 24
    # Domyślnie instance/usos-cache.sqlite3.
    USOS_CACHE_PATH = None
    # Odstęp między zapytaniami do USOS w obrębie jednego procesu.
    USOS_MIN_INTERVAL = 1.0
    USOS_TIMEOUT = 20.0
    # Kierunki, dla których zbieramy historię zmian: "kod grupy przedmiotów@cykl".
    HISTORY_PLANS = ("240-ZBI-1S-2R-Z@26/27-Z",)
    # Stan początkowy historii, gdy dla kierunku nie ma jeszcze pliku.
    HISTORY_SEEDS = {"240-ZBI-1S-2R-Z@26/27-Z": "data/monitor-240-ZBI-1S-2R-Z-2026-06-30.json"}
    USOS_USER_AGENT = (
        "AGH-Schedule-Viewer/0.1 (+https://github.com/Wendermann/AGH-Schedule-Viewer)"
    )
