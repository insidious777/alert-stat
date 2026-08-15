"""Shared constants and helpers for the alert-stat data pipeline."""

from datetime import date, datetime, timezone
from pathlib import Path

BASE_URL = "https://api.alerts.in.ua/v3/alerts/day/{day}.json"
EPOCH_OFFSET = 1_640_000_000  # verified against a real known alert start/end time
DAY_1_DATE = date(2022, 2, 24)
REQUEST_DELAY_SEC = 1.5

REPO_ROOT = Path(__file__).parent.parent
CACHE_DIR = REPO_ROOT / "raw_cache"
DB_PATH = REPO_ROOT / "alerts.db"
# data/ lives INSIDE docs/ on purpose: GitHub Pages serves only the /docs
# folder, so anything the frontend needs to fetch() must physically be here.
DATA_DIR = REPO_ROOT / "docs" / "data"
STATS_DIR = DATA_DIR / "stats"
LOCATIONS_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1XnTOzcPHd1LZUrarR1Fk43FUyl8Ae6a6M7pcwDRjNdA/export?format=csv"
)

USER_AGENT = (
    "alert-stat-dashboard/1.0 "
    "(personal non-commercial stats project; "
    "contact: 777insidious777@gmail.com)"
)


def day_index_for(d: date) -> int:
    return (d - DAY_1_DATE).days + 1


def date_for_day_index(idx: int) -> date:
    return DAY_1_DATE.fromordinal(DAY_1_DATE.toordinal() + idx - 1)


def decode_time(id_value: int | None) -> str | None:
    if id_value is None:
        return None
    return datetime.fromtimestamp(id_value + EPOCH_OFFSET, tz=timezone.utc).isoformat()
