"""
Рахує статистику тривог для КОЖНОЇ локації, що має дані в alerts.db,
і експортує per-location JSON-файли для фронтенду (data/stats/{type}-{uid}.json)
+ маніфест (data/manifest.json).

Замінює одноразовий analyze_odesa.py (був хардкоджений під Одеський район) —
та ж математика, але параметризована для будь-якої локації.

Локація визначається через luid/alert_type записів у alerts.db,
зіставлених з офіційним довідником data/locations.json:
  t='o' -> luid = uid області/спецміста напряму
  t='r' -> luid = uid району напряму
  t='h' -> luid = uid громади напряму
  t='c' -> luid - 5000 = uid громади (міські тривоги зливаються зі своєю
           громадою, бо в офіційному довіднику місто й громада - один рядок)

Записи з luid, якого немає в locations.json (напр. області РФ, які теж
трапляються в фіді як контекст), пропускаються.
"""

import json
import sqlite3
from datetime import timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from common import DATA_DIR, DB_PATH, STATS_DIR

KYIV_TZ = ZoneInfo("Europe/Kyiv")
TYPE_PREFIX = {"oblast": "o", "special_city": "o", "raion": "r", "hromada": "h"}
DOW_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
DURATION_BINS = [0, 5, 15, 30, 60, 120, 1_000_000]
DURATION_LABELS = ["0-5", "5-15", "15-30", "30-60", "60-120", "120+"]
GAP_BINS = [0, 15, 60, 180, 360, 1_000_000]
GAP_LABELS = ["0-15", "15-60", "60-180", "180-360", "360+"]
RECENT_WINDOW_DAYS = 90


def load_locations() -> dict:
    path = DATA_DIR / "locations.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return {loc["uid"]: loc for loc in data["locations"]}


def resolve_location(alert_type: str, luid: int, locations: dict) -> tuple[str, int] | None:
    if alert_type in ("o", "r", "h"):
        loc = locations.get(luid)
        if loc is None:
            return None
        return TYPE_PREFIX[loc["type"]], luid
    if alert_type == "c":
        hromada_uid = luid - 5000
        loc = locations.get(hromada_uid)
        if loc is None or loc["type"] != "hromada":
            return None
        return "h", hromada_uid
    return None


def check_overlaps(df: pd.DataFrame) -> int:
    """Sweep-line check: any overlapping [start,finish] intervals in this group?"""
    d = df.dropna(subset=["started_at", "finished_at"]).sort_values("started_at")
    if len(d) < 2:
        return 0
    starts = d["started_at"].values
    ends = d["finished_at"].values
    overlaps = 0
    max_end_so_far = ends[0]
    for i in range(1, len(d)):
        if starts[i] < max_end_so_far:
            overlaps += 1
        if ends[i] > max_end_so_far:
            max_end_so_far = ends[i]
    return overlaps


def compute_stats(df: pd.DataFrame, uid: int, loc_type: str, name: str) -> dict:
    df = df.copy()
    df["started_at"] = pd.to_datetime(df["started_at"], utc=True)
    df["finished_at"] = pd.to_datetime(df["finished_at"], utc=True)
    df["started_local"] = df["started_at"].dt.tz_convert(KYIV_TZ)
    df["finished_local"] = df["finished_at"].dt.tz_convert(KYIV_TZ)
    df["duration_min"] = (df["finished_at"] - df["started_at"]).dt.total_seconds() / 60

    completed = df[df["is_active"] == 0].copy()
    active = df[df["is_active"] == 1]

    overlap_count = check_overlaps(df)

    first_date = df["started_local"].min().date()
    last_date = df["started_local"].max().date()
    n_days_total = (last_date - first_date).days + 1

    d = completed["duration_min"]
    summary = {
        "total_alerts": int(len(df)),
        "completed_alerts": int(len(completed)),
        "active_at_export": int(len(active)),
        "avg_per_day": round(len(df) / n_days_total, 2) if n_days_total else 0,
        "total_hours_under_alert": round(d.sum() / 60, 1) if len(d) else 0,
        "median_duration_min": round(d.median(), 1) if len(d) else None,
        "mean_duration_min": round(d.mean(), 1) if len(d) else None,
        "min_duration_min": round(d.min(), 1) if len(d) else None,
        "max_duration_min": round(d.max(), 1) if len(d) else None,
        "short_alerts_under_2min": int((d < 2).sum()) if len(d) else 0,
        "overlapping_record_pairs": overlap_count,
    }

    longest_alert = None
    if len(completed):
        row = completed.loc[d.idxmax()]
        longest_alert = {
            "started_at": row["started_at"].isoformat(),
            "finished_at": row["finished_at"].isoformat(),
            "duration_min": round(row["duration_min"], 1),
        }

    # проміжки між тривогами
    sorted_c = completed.sort_values("started_at").reset_index(drop=True)
    gaps = (sorted_c["started_at"].shift(-1) - sorted_c["finished_at"]).dt.total_seconds() / 60
    gaps_valid = gaps.dropna()
    gaps_positive = gaps_valid[gaps_valid > 0]

    if len(gaps_positive):
        summary["median_gap_min"] = round(gaps_positive.median(), 1)
        summary["mean_gap_min"] = round(gaps_positive.mean(), 1)
        summary["min_gap_min"] = round(gaps_positive.min(), 1)
        summary["max_gap_hours"] = round(gaps_positive.max() / 60, 1)
    else:
        summary["median_gap_min"] = summary["mean_gap_min"] = None
        summary["min_gap_min"] = summary["max_gap_hours"] = None

    longest_calm_period = None
    if len(gaps_positive):
        idx = gaps_positive.idxmax()
        longest_calm_period = {
            "from": sorted_c.loc[idx, "finished_at"].isoformat(),
            "to": sorted_c.loc[idx + 1, "started_at"].isoformat(),
            "hours": round(gaps_positive.loc[idx] / 60, 1),
        }

    hour_counts = df["started_local"].dt.hour.value_counts()
    hourly_histogram = [int(hour_counts.get(h, 0)) for h in range(24)]

    dow_counts = df["started_local"].dt.dayofweek.value_counts()
    day_of_week_histogram = [int(dow_counts.get(i, 0)) for i in range(7)]

    dur_cut = pd.cut(d, bins=DURATION_BINS, labels=DURATION_LABELS, right=False) if len(d) else None
    duration_hist_counts = (
        dur_cut.value_counts().reindex(DURATION_LABELS).fillna(0).astype(int).tolist()
        if dur_cut is not None
        else [0] * len(DURATION_LABELS)
    )

    gap_cut = pd.cut(gaps_positive, bins=GAP_BINS, labels=GAP_LABELS, right=False) if len(gaps_positive) else None
    gap_hist_counts = (
        gap_cut.value_counts().reindex(GAP_LABELS).fillna(0).astype(int).tolist()
        if gap_cut is not None
        else [0] * len(GAP_LABELS)
    )

    daily = df.groupby(df["started_local"].dt.date).agg(
        count=("started_local", "size"), total_duration_min=("duration_min", "sum")
    )
    daily_series = [
        {"date": str(idx), "count": int(row["count"]), "total_duration_min": round(row["total_duration_min"], 1)}
        for idx, row in daily.iterrows()
    ]

    monthly = df.groupby(df["started_local"].dt.strftime("%Y-%m")).agg(
        count=("started_local", "size"), total_duration_min=("duration_min", "sum")
    )
    monthly_series = [
        {"month": str(idx), "count": int(row["count"]), "total_hours": round(row["total_duration_min"] / 60, 1)}
        for idx, row in monthly.iterrows()
    ]

    top_days = (
        daily.sort_values("count", ascending=False)
        .head(5)
        .reset_index()
        .rename(columns={"started_local": "date"})
    )
    top_days_list = [
        {"date": str(row["date"]), "count": int(row["count"]), "total_duration_min": round(row["total_duration_min"], 1)}
        for _, row in top_days.iterrows()
    ]

    recent_cutoff = last_date - timedelta(days=RECENT_WINDOW_DAYS)
    all_recent_dates = pd.date_range(max(first_date, recent_cutoff), last_date, freq="D").date
    active_recent_dates = set(daily.index) & set(all_recent_dates)
    quiet_days_recent = [str(dt) for dt in all_recent_dates if dt not in active_recent_dates]
    quiet_days_total_count = n_days_total - len(daily)

    last_row = df.sort_values("started_at").iloc[-1]
    last_alert = {
        "started_at": last_row["started_at"].isoformat(),
        "finished_at": last_row["finished_at"].isoformat() if pd.notna(last_row["finished_at"]) else None,
        "is_active": bool(last_row["is_active"]),
        "duration_min": round(last_row["duration_min"], 1) if pd.notna(last_row["duration_min"]) else None,
    }

    return {
        "uid": uid,
        "type": loc_type,
        "name": name,
        "date_range": {
            "first": str(first_date),
            "last": str(last_date),
            "n_days_total": n_days_total,
            "n_days_with_alerts": int(len(daily)),
        },
        "summary": summary,
        "longest_alert": longest_alert,
        "longest_calm_period": longest_calm_period,
        "hourly_histogram": hourly_histogram,
        "day_of_week_histogram": day_of_week_histogram,
        "duration_histogram": {"bins": DURATION_LABELS, "counts": duration_hist_counts},
        "gap_histogram": {"bins": GAP_LABELS, "counts": gap_hist_counts},
        "daily_series": daily_series,
        "monthly_series": monthly_series,
        "top_days": top_days_list,
        "quiet_days_recent": quiet_days_recent,
        "quiet_days_total_count": int(quiet_days_total_count),
        "last_alert": last_alert,
        "sub_location_ranking": [],  # заповнюється другим проходом для областей/районів
    }


def main() -> None:
    locations = load_locations()
    conn = sqlite3.connect(DB_PATH)
    df_all = pd.read_sql_query(
        "SELECT day_index, u, i, started_at, finished_at, is_active, alert_type, luid FROM alerts",
        conn,
    )
    conn.close()

    resolved = df_all.apply(lambda r: resolve_location(r["alert_type"], r["luid"], locations), axis=1)
    skipped = int(resolved.isna().sum())
    df_all["res_type"] = resolved.apply(lambda x: x[0] if x else None)
    df_all["res_uid"] = resolved.apply(lambda x: x[1] if x else None)
    df_all = df_all.dropna(subset=["res_uid"])
    df_all["res_uid"] = df_all["res_uid"].astype(int)

    print(f"Пропущено записів без відповідної локації (зовнішні/невідомі): {skipped}")

    STATS_DIR.mkdir(parents=True, exist_ok=True)
    manifest_entries = []
    stats_by_uid: dict[int, dict] = {}

    for (res_type, uid), group in df_all.groupby(["res_type", "res_uid"]):
        uid = int(uid)
        loc = locations[uid]
        stats = compute_stats(group, uid, loc["type"], loc["name"])
        stats_by_uid[uid] = stats

        fname = f"{TYPE_PREFIX[loc['type']]}-{uid}.json"
        manifest_entries.append(
            {
                "uid": uid,
                "type": loc["type"],
                "name": loc["name"],
                "file": f"stats/{fname}",
                "alert_count": stats["summary"]["total_alerts"],
                "first_alert": stats["date_range"]["first"],
                "last_alert": stats["date_range"]["last"],
            }
        )

    # другий прохід: лідерборд для областей (по райнах) і районів (по громадах)
    for loc in locations.values():
        if loc["type"] in ("oblast", "special_city"):
            children = [
                l for l in locations.values() if l["type"] == "raion" and l["parent_oblast_uid"] == loc["uid"]
            ]
        elif loc["type"] == "raion":
            children = [
                l for l in locations.values() if l["type"] == "hromada" and l["parent_raion_uid"] == loc["uid"]
            ]
        else:
            continue

        ranking = []
        for child in children:
            child_stats = stats_by_uid.get(child["uid"])
            if child_stats is None:
                continue
            ranking.append(
                {
                    "uid": child["uid"],
                    "type": child["type"],
                    "name": child["name"],
                    "total_alerts": child_stats["summary"]["total_alerts"],
                    "total_hours": child_stats["summary"]["total_hours_under_alert"],
                }
            )
        ranking.sort(key=lambda r: r["total_alerts"], reverse=True)

        own_stats = stats_by_uid.get(loc["uid"])
        if own_stats is not None:
            own_stats["sub_location_ranking"] = ranking

    for uid, stats in stats_by_uid.items():
        loc = locations[uid]
        fname = f"{TYPE_PREFIX[loc['type']]}-{uid}.json"
        stats["generated_at"] = pd.Timestamp.now(tz="UTC").isoformat()
        (STATS_DIR / fname).write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")

    overlap_locations = [u for u, s in stats_by_uid.items() if s["summary"]["overlapping_record_pairs"] > 0]
    if overlap_locations:
        print(
            f"УВАГА: {len(overlap_locations)} локацій мають записи, що перекриваються в часі "
            f"(можливе подвійне врахування при об'єднанні типів c/h). Приклади uid: {overlap_locations[:10]}"
        )

    conn = sqlite3.connect(DB_PATH)
    day_range = conn.execute("SELECT MIN(day_index), MAX(day_index) FROM alerts").fetchone()
    conn.close()

    manifest = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "day_index_range": list(day_range),
        "locations": manifest_entries,
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    print(f"Готово: {len(manifest_entries)} локацій з даними -> data/stats/, data/manifest.json")


if __name__ == "__main__":
    main()
