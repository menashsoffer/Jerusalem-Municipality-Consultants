"""קריאת נתוני המנוע מבסיס הנתונים."""
from __future__ import annotations

import sqlite3
from datetime import date

from .engine import DEFAULT_VAT_RATE, Thresholds, comparable_value


def load_thresholds(db: sqlite3.Connection) -> list[Thresholds]:
    rows = db.execute(
        "SELECT effective_from, no_tender_max, zuta_4_max, zuta_6_max, source, is_official, valid_until FROM thresholds"
    ).fetchall()
    return [Thresholds(date.fromisoformat(r[0]), r[1], r[2], r[3], r[4], bool(r[5]),
                       date.fromisoformat(r[6]) if r[6] else None) for r in rows]


def related_request_values(db: sqlite3.Connection, subject_key: str, around: date, days: int = 90,
                           exclude_id: int | None = None, compare_incl_vat: bool = True,
                           vat_rate: float = DEFAULT_VAT_RATE) -> list[float]:
    """שווי בקשות עם אותו מפתח נושא בחלון זמן, מומר לבסיס המע"מ של ההשוואה.

    חלון ברירת המחדל (90 יום) הוא הנחת עבודה, לא הוראת דין.
    בקשות שבוטלו או נדחו אינן נספרות. טיוטות והגשות נספרות, כי הן התקשרויות מתוכננות.
    """
    rows = db.execute(
        "SELECT id, estimated_value, value_includes_vat FROM engagement_requests WHERE subject_key = ? "
        "AND status NOT IN ('cancelled', 'rejected') AND abs(julianday(requested_on) - julianday(?)) <= ?",
        (subject_key, around.isoformat(), days),
    ).fetchall()
    return [comparable_value(r[1], bool(r[2]), compare_incl_vat, vat_rate) for r in rows if r[0] != exclude_id]
