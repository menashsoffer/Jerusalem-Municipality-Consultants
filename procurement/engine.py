"""מנוע כללים לבדיקת מסלול ההתקשרות לפי תקנות העיריות (מכרזים), התשמ"ח-1987.

המנוע מחזיר המלצה מנומקת ולא החלטה. כל תוצאה מצביעה על התקנה שעליה היא נשענת,
על הגורם המאשר ועל מה שצריך לתעד. ההכרעה בפועל נשארת אצל ועדות העירייה והייעוץ המשפטי.

עקרונות:
- הספים ארציים ומתעדכנים ב-16 בכל חודש לפי המדד (תקנה 2). הם נטענים מטבלה עם מקור
  ותאריך תחולה, ולא מקודדים בקוד.
- התקנות אינן קובעות אם ההשוואה לסף כוללת מע"מ. ברירת המחדל שמרנית: משווים ערך כולל מע"מ.
- כשחסר נתון שנדרש כדי להחיל פטור, המנוע לא מניח שהוא קיים. הוא מסמן מה חסר
  וחוזר למסלול שנגזר מהשווי.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Optional

# סכומי הבסיס בתקנות (תקנות 3(3) ו-8) והמדד היסודי (תקנה 2)
BASE_NO_TENDER = 26_000
BASE_ZUTA_4 = 63_500
BASE_ZUTA_6 = 127_000
BASE_INDEX_1985 = 175.3

DEFAULT_VAT_RATE = 0.18  # שיעור המע"מ מ-1.1.2025. ניתן לשינוי בקריאה.

# הוראת השעה של תקנה 3(20) חלה מ-21.4.2026 ועד 30 יום מתום ההכרזה על מצב מיוחד בעורף.
# מועד הסיום אינו ידוע מראש, ולכן הוא פרמטר.
REG_3_20_START = date(2026, 4, 21)


@dataclass(frozen=True)
class Thresholds:
    effective_from: date
    no_tender_max: int   # עד סכום זה: פטור לפי 3(3)
    zuta_4_max: int      # עד סכום זה: מכרז זוטא עם 4 פניות לפחות
    zuta_6_max: int      # עד סכום זה: מכרז זוטא עם 6 פניות לפחות. מעליו: מכרז פומבי
    source: str
    is_official: bool
    valid_until: Optional[date] = None   # ריק: עד יום העדכון הבא (16 בחודש הבא) פחות יום


def next_update_day(day: date) -> date:
    """יום העדכון הבא לפי תקנה 2: ה-16 בחודש שאחרי היום הנתון (או באותו חודש אם טרם הגיע)."""
    if day.day < 16:
        return day.replace(day=16)
    return date(day.year + (day.month == 12), day.month % 12 + 1, 16)


def threshold_valid_until(t: Thresholds) -> date:
    return t.valid_until or next_update_day(t.effective_from) - timedelta(days=1)


def indexed_amount(base_amount: int, index_ratio: float) -> int:
    """סכום מעודכן לפי תקנה 2: הסכום כפול יחס המדד, מעוגל ל-100 הקרובים."""
    return int(round(base_amount * index_ratio / 100.0)) * 100


def thresholds_from_index(index_on_1985_base: float, effective_from: date, source: str,
                          is_official: bool = False) -> Thresholds:
    ratio = index_on_1985_base / BASE_INDEX_1985
    return Thresholds(effective_from,
                      indexed_amount(BASE_NO_TENDER, ratio),
                      indexed_amount(BASE_ZUTA_4, ratio),
                      indexed_amount(BASE_ZUTA_6, ratio),
                      source, is_official)


def thresholds_for(day: date, table: Iterable[Thresholds]) -> Thresholds:
    candidates = [t for t in table if t.effective_from <= day]
    if not candidates:
        raise ValueError(f"אין טבלת ספים בתוקף ליום {day.isoformat()}")
    return max(candidates, key=lambda t: t.effective_from)


def comparable_value(value: float, value_includes_vat: bool, compare_incl_vat: bool = True,
                     vat_rate: float = DEFAULT_VAT_RATE) -> float:
    if value_includes_vat == compare_incl_vat:
        return float(value)
    return value * (1 + vat_rate) if compare_incl_vat else value / (1 + vat_rate)


@dataclass
class Decision:
    route: str                      # קוד מסלול, למשל public_tender, zuta_4, exemption_3_8
    regulation: str                 # התקנה שעליה נשענת התוצאה
    approver: str                   # הגורם שמאשר
    status: str = "ok"              # ok / needs_review (לא הוכרע, נדרשת בדיקה ידנית) / blocked
    requirements: list[str] = field(default_factory=list)   # מה צריך לתעד לפני ההתקשרות
    missing: list[str] = field(default_factory=list)        # נתונים שחסרים כדי להחיל את המסלול שהתבקש
    warnings: list[str] = field(default_factory=list)
    compared_value: Optional[float] = None
    thresholds_source: Optional[str] = None
    splitting_checked: Optional[bool] = None   # None: לא רלוונטי. False: הבדיקה לא בוצעה

    @property
    def allowed(self) -> bool:
        """True רק כשכל התנאים נבדקו ונמצאו מתקיימים. needs_review אינו אישור."""
        return self.status == "ok"

    def escalate(self, status: str, warning: Optional[str] = None) -> None:
        if STATUS_RANK[status] > STATUS_RANK[self.status]:
            self.status = status
        if warning:
            self.warnings.append(warning)

    def as_dict(self) -> dict:
        d = dict(self.__dict__)
        d["allowed"] = self.allowed
        return d


STATUS_RANK = {"ok": 0, "needs_review": 1, "blocked": 2}


TENDER_COMMITTEE = "ועדת המכרזים"
EXEMPTION_COMMITTEE = "ועדת הפטור (מנכ\"ל, גזבר, יועץ משפטי)"


def route_by_value(value: float, t: Thresholds) -> Decision:
    if value <= t.no_tender_max:
        return Decision("no_tender_low_value", "3(3)", "הגורם המוסמך לפי נוהל העירייה",
                        requirements=["תיעוד השווי ואופן חישובו",
                                      "השוואת הצעות לפי נוהל פנימי (התקנות אינן מחייבות)"])
    if value <= t.zuta_4_max:
        return Decision("zuta_4", "8(ד)(1)", TENDER_COMMITTEE,
                        requirements=["אומדן (תקנה 11)",
                                      "פנייה ל-4 ספקים לפחות מרשימת הספקים של תקנה 8(ב)",
                                      "פנייה בדואר רשום עם אישור מסירה או במסירה ידנית (תקנה 8(ד))",
                                      "תיעוד הספקים שפנו אליהם לדיווח השנתי (תקנה 8(ג))"])
    if value <= t.zuta_6_max:
        return Decision("zuta_6", "8(ד)(2)", TENDER_COMMITTEE,
                        requirements=["אומדן (תקנה 11)",
                                      "פנייה ל-6 ספקים לפחות מרשימת הספקים של תקנה 8(ב)",
                                      "פנייה בדואר רשום עם אישור מסירה או במסירה ידנית (תקנה 8(ד))",
                                      "תיעוד הספקים שפנו אליהם לדיווח השנתי (תקנה 8(ג))"])
    return Decision("public_tender", "סעיף 197 לפקודת העיריות ותקנה 3", TENDER_COMMITTEE,
                    requirements=["אומדן (תקנה 11)", "פרסום מכרז פומבי",
                                  "רישום בפנקס המכרזים (תקנה 7)"])


# כל פטור: (תקנה, גורם מאשר, עובדות חובה, דרישות תיעוד, תנאים שאינם ממודלים)
# תנאי שאינו ממודל משאיר את התוצאה במצב needs_review עד שאדם בודק אותו.
EXEMPTIONS: dict[str, tuple[str, str, dict[str, str], list[str], list[str]]] = {
    "3(4)": ("3(4)", TENDER_COMMITTEE,
             {"sole_supplier_expert_opinion": "חוות דעת בכתב של מומחה שמינתה הוועדה שהספק או המומחה יחיד בארץ"},
             ["אישור הוועדה לחוות הדעת"], []),
    "3(6)": ("3(6)", "לפי נוהל העירייה, עם דיווח לוועדה",
             {"urgent_life_or_property": "ההתקשרות דחופה להצלת נפש או רכוש"},
             ["נימוק הדחיפות ותיעוד בזמן אמת"], []),
    "3(8)": ("3(8)", EXEMPTION_COMMITTEE,
             {"professional_work": "עבודה מקצועית הדורשת ידע ומומחיות מיוחדים או יחסי אמון מיוחדים"},
             ["בחירה מתוך מאגר יועצים לפי חוזר מנכ\"ל משרד הפנים 8/2016",
              "פרסום ההחלטה באתר העירייה (לפי החוזר)",
              "נימוק בחירת היועץ מתוך המאגר"], []),
    "3(10א)": ("3(10א)", "לפי נוהל העירייה",
               {"counterparty_is_state": "הצד השני הוא המדינה"}, [], []),
    "3(14)": ("3(14)", "לפי נוהל העירייה",
              {"counterparty_is_npo": "התאגיד מוכר כמוסד ללא כוונת רווח",
               "city_holding_40": "העירייה מחזיקה 40% לפחות מההון, מההצבעה או מכוח המינוי",
               "purpose_education_culture_welfare_sport": "מיזם ללא כוונת רווח לחינוך, תרבות, רווחה או ספורט בתחום העירייה"},
              ["לקח מעניין התעוררות נ' עיריית ירושלים: נוהל מיזמים משותפים בוטל בבית המשפט, יש לבדוק כל מיזם לגופו"],
              ["התנאים הנוספים שבפסקאות המשנה של תקנה 3(14), כולל מימון התאגיד, לא נבדקו במנוע"]),
    "3(16)": ("3(16)", "לפי נוהל העירייה",
              {"counterparty_is_local_authority": "הצד השני הוא רשות מקומית אחרת, בשירות מתחום סמכותה",
               "savings_justified": "העירייה שוכנעה שההתקשרות חוסכת ויעילה"},
              ["תיעוד הנימוק לחיסכון וליעילות"], []),
}


def check_new_contract(value: float, on: date, table: Iterable[Thresholds], *,
                       value_includes_vat: bool, compare_incl_vat: bool = True,
                       vat_rate: float = DEFAULT_VAT_RATE, exemption: Optional[str] = None,
                       facts: Optional[dict] = None,
                       related_values: Optional[Iterable[float]] = None) -> Decision:
    """המסלול החוקי להתקשרות חדשה, לפי שווי ובקשת פטור אם יש.

    related_values: שווי בקשות קשורות לבדיקת פיצול (תקנה 5), כבר באותו בסיס מע"מ כמו ההשוואה.
    None פירושו שהבדיקה לא בוצעה, והתוצאה תאמר זאת במפורש.
    """
    facts = facts or {}
    t = thresholds_for(on, table)
    v = comparable_value(value, value_includes_vat, compare_incl_vat, vat_rate)
    d = _decide(v, t, exemption, facts)
    d.compared_value, d.thresholds_source = v, t.source

    if not t.is_official:
        d.warnings.append("הספים מחושבים ואינם פרסום רשמי של משרד הפנים. יש לאמת לפני הסתמכות.")
    until = threshold_valid_until(t)
    if on > until:
        d.escalate("needs_review", f"אין בטבלה סף מעודכן ליום {on.isoformat()}. הסף האחרון תקף עד "
                                   f"{until.isoformat()}. יש לעדכן את טבלת הספים לפני הסתמכות.")

    if related_values is None:
        d.splitting_checked = False
        d.warnings.append("בדיקת פיצול (תקנה 5) לא בוצעה: לא נמסרו בקשות קשורות.")
    else:
        d.splitting_checked = True
        split = check_splitting(v, related_values, t)
        if split:
            d.escalate("needs_review", split)
    return d


def _decide(v: float, t: Thresholds, exemption: Optional[str], facts: dict) -> Decision:
    by_value = route_by_value(v, t)
    if exemption is None:
        return by_value
    if exemption not in EXEMPTIONS:
        by_value.warnings.append(f"בסיס הפטור {exemption} אינו ממודל במנוע. נבדק לפי שווי בלבד.")
        return by_value

    reg, approver, needed, reqs, unmodeled = EXEMPTIONS[exemption]
    missing = [text for key, text in needed.items() if not facts.get(key)]
    if missing:
        by_value.missing = missing
        by_value.warnings.append(f"לא ניתן להחיל פטור לפי תקנה {reg} בלי הנתונים החסרים. המסלול נקבע לפי שווי.")
        return by_value

    code = "exemption_" + reg.replace("(", "_").replace(")", "")
    d = Decision(code, reg, approver, requirements=list(reqs))
    if unmodeled:
        d.missing = list(unmodeled)
        d.escalate("needs_review", f"הפטור לפי תקנה {reg} אפשרי רק אחרי בדיקה ידנית של תנאים שהמנוע אינו בודק.")
    if exemption == "3(6)":
        d.warnings.append("פטור דחיפות אינו מכשיר המשך התקשרות אחרי שהדחיפות חלפה.")
    return d


def check_continuation_3_20(on: date, *, first_value: float, first_months: float,
                            previous_continuations: Iterable[tuple[float, float]],
                            new_value: float, new_months: float, committee_convinced: bool,
                            special_state_end: Optional[date] = None,
                            special_state_active_confirmed: bool = False) -> Decision:
    """התקשרות המשך לפי הוראת השעה בתקנה 3(20).

    previous_continuations: זוגות (שווי, חודשים) של התקשרויות המשך קודמות, שנספרות במצטבר (3(20)(ג)).
    special_state_end: יום תום ההכרזה על מצב מיוחד בעורף, אם ידוע. ההוראה חלה עד 30 יום אחריו.
    special_state_active_confirmed: אישור שההכרזה עדיין בתוקף ביום הבדיקה. בלי אחד מהשניים התוצאה לא מוכרעת.
    """
    d = Decision("continuation_3_20", "3(20)", "ועדה: מנכ\"ל (יו\"ר), גזבר, יועץ משפטי",
                 requirements=["החלטה מנומקת של הוועדה",
                               "פרסום ההחלטה באתר העירייה בתוך 5 ימי עבודה (3(20)(ד))",
                               "תנאים זהים או מיטיבים עם העירייה"])
    prev = list(previous_continuations)
    total_value = new_value + sum(v for v, _ in prev)
    total_months = new_months + sum(m for _, m in prev)

    if on < REG_3_20_START:
        d.escalate("blocked", "הוראת השעה חלה רק מ-21.4.2026.")
    if special_state_end and (on - special_state_end).days > 30:
        d.escalate("blocked", "הוראת השעה פקעה: עברו יותר מ-30 יום מתום המצב המיוחד בעורף.")
    if special_state_end is None and not special_state_active_confirmed:
        d.missing.append("מועד תום ההכרזה על מצב מיוחד בעורף, או אישור שההכרזה עדיין בתוקף")
        d.escalate("needs_review", "תוקף הוראת השעה תלוי במועד תום המצב המיוחד בעורף, שלא הוזן. התוצאה לא הוכרעה.")
    if total_months > 6:
        d.escalate("blocked", f"משך מצטבר של {total_months:g} חודשים עולה על 6 (3(20)(ב)).")
    if total_value > first_value:
        d.escalate("blocked", "שווי מצטבר של התקשרויות ההמשך עולה על שווי ההתקשרות הראשונה (3(20)(א)).")
    if not committee_convinced:
        d.missing.append("קביעת הוועדה שמגבלות המצב הביטחוני מונעות עריכת מכרז")
        d.escalate("needs_review")
    return d


def check_increase(*, kind: str, base_amount: float, previous_increases: float, new_increase: float,
                   council_decided_tender_useless: bool = False) -> Decision:
    """הגדלת חוזה קיים לפי תקנה 3(7).

    kind="existing_item": base_amount הוא ההוצאה על אותו פרט בחוזה הקיים. תקרה 50% (3(7)(א)).
    kind="added_items": base_amount הוא כלל ההוצאות לפי החוזה הקיים. תקרה 25%, או 50% אם
    המועצה קבעה שמכרז לא יביא תועלת (3(7)(ב)).
    ההגדלות נספרות במצטבר. זו קריאה שמרנית: התקנה אינה מתירה לעקוף את התקרה בכמה הגדלות קטנות.
    """
    if kind == "existing_item":
        cap, reg = 0.50, "3(7)(א)"
    elif kind == "added_items":
        cap, reg = (0.50 if council_decided_tender_useless else 0.25), "3(7)(ב)"
    else:
        raise ValueError("kind חייב להיות existing_item או added_items")

    cumulative = previous_increases + new_increase
    pct = cumulative / base_amount if base_amount else float("inf")
    d = Decision(f"increase_{kind}", reg, "ועדת הרחבות והגדלות לפי נוהל העירייה",
                 requirements=["תיעוד שווי החוזה המקורי ושל כל הגדלה קודמת",
                               "החלטה מנומקת לפני ביצוע ההגדלה"],
                 compared_value=round(pct * 100, 2))
    if kind == "added_items" and council_decided_tender_useless:
        d.requirements.append("החלטת מועצה שעריכת מכרז לא תביא תועלת")
    if pct > cap:
        d.escalate("blocked", f"הגדלה מצטברת של {pct:.1%} עולה על התקרה של {cap:.0%} לפי תקנה {reg}. נדרש הליך תחרותי חדש.")
    elif pct > cap * 0.8:
        d.warnings.append(f"הגדלה מצטברת של {pct:.1%} קרובה לתקרה של {cap:.0%}.")
    return d


def check_splitting(new_value: float, related_values: Iterable[float], t: Thresholds) -> Optional[str]:
    """תקנה 5: חוזים לאותם טובין או לעבודה שלמה אחת, שנערכים בזמן אחד, נחשבים חוזה אחד.

    related_values: שווי בקשות קשורות (אותו נושא, אותה תקופה). ההגדרה מה "קשור" היא החלטת מדיניות
    של העירייה ואינה קבועה בתקנה. מחזיר אזהרה אם הצירוף משנה את המסלול, אחרת None.
    """
    related = list(related_values)
    if not related:
        return None
    alone = route_by_value(new_value, t).route
    combined = route_by_value(new_value + sum(related), t).route
    if alone != combined:
        return (f"חשש לפיצול (תקנה 5): לבדה הבקשה במסלול {alone}, "
                f"אך יחד עם {len(related)} בקשות קשורות היא במסלול {combined}.")
    return None
