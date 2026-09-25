class Config:
    USOS_BASE_URL = "https://web.usos.agh.edu.pl/kontroler.php"
    USOS_CACHE_HOURS = 24
    # Domyślnie instance/usos-cache.sqlite3.
    USOS_CACHE_PATH = None
    # Odstęp między zapytaniami do USOS w obrębie jednego procesu.
    USOS_MIN_INTERVAL = 1.0
    USOS_TIMEOUT = 20.0
    USOS_USER_AGENT = (
        "AGH-Schedule-Viewer/0.1 (+https://github.com/Wendermann/AGH-Schedule-Viewer)"
    )
