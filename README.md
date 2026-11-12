# מאגרי יועצים – עיריית ירושלים

כלי פנימי לאיתור ספקים מתוך פרסומי מאגרי היועצים של העירייה, ולבדיקת מסלול ההתקשרות לפי תקנות העיריות (מכרזים). המערכת בפיתוח. הנתונים חולצו אוטומטית וטרם אומתו במלואם, והכלי אינו מאשר התקשרות.

## מה יש בריפו
| חלק | מיקום | מצב |
|---|---|---|
| האתר (המוצר העיקרי) | `docs/` | אתר סטטי מול Supabase: התחברות מנהל, חיפוש בכ-787 שורות ספקים, הוספת ספק ויומן פעולות |
| בסיס הנתונים ב-Supabase | `database/drafts/` | טיוטות SQL עם RLS לבקשות גישה, יחידות, קטגוריות, והגנת כתיבה לטבלת הספקים. טרם הוחלו על הפרויקט החי |
| מנוע בדיקת מסלול התקשרות | `supabase/functions/_shared/procurement/` | TypeScript. ראו `documentation/procurement-engine-he.md`. הגרסה הישנה ב-Python (`procurement/`) תימחק כשהמנוע יחובר ל-Edge Function |
| אב טיפוס מקומי | `app.py`, `index.html`, `schema.sql` | SQLite עם 10 פרסומים ונקודת קצה למנוע. לא לפריסה |
| סקריפטי חילוץ | `scripts/` | חילוץ טבלאות מקובצי PDF ו-Excel של העירייה לקובץ לבדיקה |

הסכמה והמדיניות של טבלת `suppliers` הקיימת ב-Supabase עדיין לא נמצאות בריפו. יש לייצא אותן ל-`database/` לפני שינויים נוספים בהרשאות.

## הרצה ובדיקות
- אתר: לפתוח את `docs/index.html` דרך שרת סטטי (למשל `python3 -m http.server -d docs`). ההתחברות דורשת חשבון מורשה ב-Supabase.
- אב טיפוס מקומי: `python3 app.py` ואז http://127.0.0.1:8000. מיקום בסיס הנתונים ניתן לשינוי ב-`CONSULTANTS_DB`.
- נדרש Node 22.18 ומעלה ו-Python 3.12.
- `npm ci --ignore-scripts`, ואז `npm run check`: עיצוב, lint, בדיקת טיפוסים, ובדיקות TypeScript, JS ו-RLS.
- Python: `ruff format --check . && ruff check .` ו-`python3 -m unittest discover -s tests -t .`
- סקריפטי חילוץ: `pip install -r requirements-scripts.txt`, ואז `python3 scripts/extract.py --sources <תיקייה> --output <קובץ.json>` או `python3 scripts/extract_additional.py --sources <תיקייה> --output <קובץ.csv>`.

כל הבדיקות רצות ב-GitHub Actions בכל PR.

## כללי קוד
כל קוד חדש נכתב לפי [כללי הקוד](documentation/coding-standards-he.md): שפה לכל שכבה, גבולות גודל, שמות, Supabase ו-RLS, בדיקות ואבטחה. רוב הכללים נאכפים ב-CI.

## עקרונות
קובצי המקור אינם חלק מהריפו. תאריך פרסום אינו תוקף מאגר או חוזה. לכל רשומה נשמר מקור, וכל רשומה עוברת בדיקה אנושית לפני הסתמכות. ההרשאות נאכפות בבסיס הנתונים ולא בדפדפן.
