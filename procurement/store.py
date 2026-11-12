"""קריאת נתוני המנוע מבסיס הנתונים."""
from __future__ import annotations

import sqlite3
from datetime import date

from .engine import Thresholds


def load_thresholds(db: sqlite3.Connection) -> list[Thresholds]:
    rows = db.execute(
        "SELECT effective_from, no_tender_max, zuta_4_max, zuta_6_max, source, is_official FROM thresholds"
    ).fetchall()
    return [Thresholds(date.fromisoformat(r[0]), r[1], r[2], r[3], r[4], bool(r[5])) for r in rows]


def related_request_values(db: sqlite3.Connection, subject_key: str, around: date, days: int = 90,
                           exclude_id: int | None = None) -> list[float]:
    """שווי בקשות עם אותו מפתח נושא בחלון זמן. חלון ברירת המחדל (90 יום) הוא הנחת עבודה, לא הוראת דין."""
    rows = db.execute(
        "SELECT id, estimated_value FROM engagement_requests WHERE subject_key = ? "
        "AND status != 'cancelled' AND abs(julianday(requested_on) - julianday(?)) <= ?",
        (subject_key, around.isoformat(), days),
    ).fetchall()
    return [r[1] for r in rows if r[0] != exclude_id]
