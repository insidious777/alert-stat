"""
Будує data/locations.json — ієрархічний довідник область -> район -> громада
з офіційного Google Sheet, на який посилається документація alerts.in.ua.

У таблиці немає явної колонки parent-id: ієрархія визначається порядком
рядків (рядок "Область" -> за ним ідуть її "Район"-и -> за кожним районом
ідуть його "Громада"-и, аж до наступного району/області).
"""

import csv
import io
import json
from datetime import datetime, timezone

import requests

from common import DATA_DIR, LOCATIONS_CSV_URL, USER_AGENT

TYPE_MAP = {
    "Область": "oblast",
    "Район": "raion",
    "Громада": "hromada",
    "Місто з спеціальним статусом": "special_city",
}


def fetch_csv_rows() -> list[list[str]]:
    resp = requests.get(LOCATIONS_CSV_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    text = resp.content.decode("utf-8")  # Google doesn't send a charset, requests defaults wrong
    reader = csv.reader(io.StringIO(text))
    return list(reader)


def parse_locations(rows: list[list[str]]) -> list[dict]:
    locations = []
    current_oblast_uid = None
    current_raion_uid = None

    for row in rows:
        if len(row) < 3:
            continue
        uid_raw, name, type_ua = row[0].strip(), row[1].strip(), row[2].strip()
        if not uid_raw.isdigit():
            continue  # заголовки/порожні рядки
        loc_type = TYPE_MAP.get(type_ua)
        if loc_type is None:
            continue
        uid = int(uid_raw)

        entry = {"uid": uid, "name": name, "type": loc_type}

        if loc_type == "oblast":
            entry["parent_oblast_uid"] = None
            entry["parent_raion_uid"] = None
            current_oblast_uid = uid
            current_raion_uid = None
        elif loc_type == "special_city":
            entry["parent_oblast_uid"] = None
            entry["parent_raion_uid"] = None
        elif loc_type == "raion":
            entry["parent_oblast_uid"] = current_oblast_uid
            entry["parent_raion_uid"] = None
            current_raion_uid = uid
        elif loc_type == "hromada":
            entry["parent_oblast_uid"] = current_oblast_uid
            entry["parent_raion_uid"] = current_raion_uid
            entry["city_luid"] = uid + 5000

        locations.append(entry)

    return locations


def main() -> None:
    rows = fetch_csv_rows()
    locations = parse_locations(rows)

    counts: dict[str, int] = {}
    for loc in locations:
        counts[loc["type"]] = counts.get(loc["type"], 0) + 1
    print("Розібрано локацій:", counts, "всього:", len(locations))

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": LOCATIONS_CSV_URL,
        "locations": locations,
    }

    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / "locations.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=None), encoding="utf-8")
    print(f"Записано {out_path}")


if __name__ == "__main__":
    main()
