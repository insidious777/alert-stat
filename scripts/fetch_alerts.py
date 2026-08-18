"""
Тягне історію тривог з приватного (недокументованого) API alerts.in.ua
і складає в локальну SQLite-базу (raw_cache/day_N.json -> alerts.db).

ВАЖЛИВО: цей API офіційно позначений як приватний ("This API is private
and may change anytime. Contact api@alerts.in.ua for public API access.").
Використовуємо обережно: невеликий інтервал між запитами, кешування сирих
відповідей на диск (committed to git), описовий User-Agent з контактом.

Формат id->час: реальний unix-час = id (поле "s" або "f") + EPOCH_OFFSET.
День 1 = 2022-02-24 (перший день повномасштабного вторгнення).

Режими роботи:
  (без аргументів)              інкрементальний режим — для щогодинного CI:
                                 добудовує пропущені дні від останнього
                                 закешованого до вчора, і завжди примусово
                                 перезаписує "сьогодні" + "вчора" (бо вони
                                 можуть змінюватись заднім числом).
  --rebuild-db-only             перебудувати alerts.db з raw_cache/, без
                                 жодного мережевого запиту.
  --backfill-from N --backfill-to M
                                 одноразовий історичний бекфіл діапазону
                                 днів (довіряє кешу — безпечно перезапускати
                                 після обриву).
"""

import argparse
import json
import sqlite3
import sys
import time
from datetime import date, datetime, timezone

import requests

from common import (
    BASE_URL,
    CACHE_DIR,
    DB_PATH,
    REQUEST_DELAY_SEC,
    USER_AGENT,
    date_for_day_index,
    day_index_for,
    decode_time,
)


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            row_id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_index INTEGER NOT NULL,
            u INTEGER,
            i INTEGER,
            s_id INTEGER,
            f_id INTEGER,
            started_at TEXT,
            finished_at TEXT,
            is_active INTEGER NOT NULL,
            alert_type TEXT,      -- t: o=область, r=район, h=громада, c=місто
            at_field INTEGER,     -- at: тип тривоги, якщо є
            name TEXT,
            loi INTEGER,
            lri INTEGER,
            lruid INTEGER,
            lhuid INTEGER,
            luid INTEGER,
            src INTEGER,
            note TEXT,
            source_url TEXT,
            raw_json TEXT NOT NULL,
            UNIQUE(day_index, u, i)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_luid ON alerts(alert_type, luid)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_started ON alerts(started_at)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fetch_log (
            day_index INTEGER PRIMARY KEY,
            fetched_at TEXT NOT NULL,
            record_count INTEGER NOT NULL
        )
        """
    )
    conn.commit()


def cached_day_indices() -> list[int]:
    if not CACHE_DIR.exists():
        return []
    out = []
    for p in CACHE_DIR.glob("day_*.json"):
        try:
            out.append(int(p.stem.split("_")[1]))
        except (IndexError, ValueError):
            continue
    return sorted(out)


def fetch_day(day_index: int, session: requests.Session, force: bool = False) -> dict:
    cache_file = CACHE_DIR / f"day_{day_index}.json"
    if cache_file.exists() and not force:
        return json.loads(cache_file.read_text(encoding="utf-8"))

    url = BASE_URL.format(day=day_index)
    resp = session.get(url, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    CACHE_DIR.mkdir(exist_ok=True)
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def store_day(conn: sqlite3.Connection, day_index: int, data: dict) -> int:
    alerts = data.get("alerts", [])
    rows = []
    for a in alerts:
        s_id = a.get("s")
        f_id = a.get("f")
        rows.append(
            (
                day_index,
                a.get("u"),
                a.get("i"),
                s_id,
                f_id,
                decode_time(s_id),
                decode_time(f_id),
                0 if f_id is not None else 1,
                a.get("t"),
                a.get("at"),
                a.get("n"),
                a.get("loi"),
                a.get("lri"),
                a.get("lruid"),
                a.get("lhuid"),
                a.get("luid"),
                a.get("src"),
                a.get("m"),
                a.get("su"),
                json.dumps(a, ensure_ascii=False),
            )
        )

    conn.executemany(
        """
        INSERT OR REPLACE INTO alerts (
            day_index, u, i, s_id, f_id, started_at, finished_at, is_active,
            alert_type, at_field, name, loi, lri, lruid, lhuid, luid, src,
            note, source_url, raw_json
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        rows,
    )
    conn.execute(
        "INSERT OR REPLACE INTO fetch_log (day_index, fetched_at, record_count) VALUES (?,?,?)",
        (day_index, datetime.now(timezone.utc).isoformat(), len(rows)),
    )
    conn.commit()
    return len(rows)


def rebuild_db_from_cache() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    indices = cached_day_indices()
    print(f"Перебудова alerts.db з {len(indices)} закешованих днів (raw_cache/), без мережі")
    for idx in indices:
        data = json.loads((CACHE_DIR / f"day_{idx}.json").read_text(encoding="utf-8"))
        count = store_day(conn, idx, data)
        print(f"  day {idx}: {count} записів")
    conn.close()
    print("Готово.")


def fetch_range(start: int, end: int, force: bool, label: str, descending: bool = False) -> None:
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    days = range(end, start - 1, -1) if descending else range(start, end + 1)
    order_note = " (від новіших до старіших)" if descending else ""
    print(f"{label}: дні {start}..{end}{order_note}")
    for idx in days:
        try:
            data = fetch_day(idx, session, force=force)
        except requests.RequestException as e:
            print(f"  day {idx}: помилка запиту — {e}", file=sys.stderr)
            continue

        if "disclaimer" not in data:
            print(f"  day {idx}: WARNING — дисклеймер відсутній, перевір формат відповіді", file=sys.stderr)

        count = store_day(conn, idx, data)
        d = date_for_day_index(idx)
        print(f"  day {idx} ({d}): {count} записів")
        time.sleep(REQUEST_DELAY_SEC)

    conn.close()
    print("Готово.")


def incremental() -> None:
    today = date.today()
    today_index = day_index_for(today)
    yesterday_index = today_index - 1

    cached = cached_day_indices()
    last_cached = max(cached) if cached else yesterday_index - 1

    # "сьогодні" й "вчора" оновлюємо першими й завжди примусово — вони
    # найважливіші (сьогодні ще триває, вчора інколи дозаписується заднім
    # числом) і мають з'явитись на сайті щонайшвидше
    fetch_range(yesterday_index, today_index, force=True, label="Примусове оновлення сьогодні+вчора")

    # добудовуємо пропущені дні (напр. якщо CI не запускався якийсь час) —
    # від новіших до старіших, щоб свіжіші дані наздогнались раніше за архів
    gap_start = last_cached + 1
    gap_end = yesterday_index - 1
    if gap_start <= gap_end:
        fetch_range(gap_start, gap_end, force=False, label="Добудова пропущених днів", descending=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild-db-only", action="store_true")
    parser.add_argument("--backfill-from", type=int)
    parser.add_argument("--backfill-to", type=int)
    args = parser.parse_args()

    if args.rebuild_db_only:
        rebuild_db_from_cache()
        return

    if args.backfill_from is not None or args.backfill_to is not None:
        if args.backfill_from is None or args.backfill_to is None:
            parser.error("--backfill-from і --backfill-to треба вказувати разом")
        fetch_range(args.backfill_from, args.backfill_to, force=False, label="Історичний бекфіл")
        return

    incremental()


if __name__ == "__main__":
    main()
