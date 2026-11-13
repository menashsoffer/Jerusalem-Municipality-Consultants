# מאגרי יועצים – עיריית ירושלים

כלי פנימי לאיתור ספקים מתוך פרסומי מאגרי היועצים של העירייה, ולבדיקת מסלול ההתקשרות לפי תקנות העיריות (מכרזים). המערכת בפיתוח. הנתונים חולצו אוטומטית וטרם אומתו במלואם, והכלי אינו מאשר התקשרות.

## מה יש בריפו
| חלק | מיקום | מצב |
|---|---|---|
| האתר (המוצר העיקרי) | `web/` (מקור), `docs/` (תוצר) | אתר סטטי מול Supabase: התחברות מנהל, חיפוש בכ-787 שורות ספקים, הוספת ספק ויומן פעולות |
| בסיס הנתונים ב-Supabase | `supabase/migrations/` | כל הסכמה, ההרשאות וה-RLS כמיגרציות, לפי מסמך האפיון. נבדקות ב-`supabase/tests/`. החלה על הפרויקט החי רק באישור |
| מנוע בדיקת מסלול התקשרות | `supabase/functions/_shared/procurement/` | TypeScript. ראו `documentation/procurement-engine-he.md` |
| סקריפטי חילוץ | `scripts/` | חילוץ טבלאות מקובצי PDF ו-Excel של העירייה לקובץ לבדיקה |

הסכמה והמדיניות של טבלת `suppliers` הקיימת ב-Supabase עדיין לא נמצאות בריפו. יש לייצא אותן ל-`database/` לפני שינויים נוספים בהרשאות.

## הרצה ובדיקות
- אתר: לאחר `npm ci --ignore-scripts`, להריץ `npm run build:web`, ואז לפתוח את `docs/index.html` דרך שרת סטטי (למשל `python3 -m http.server -d docs`). ההתחברות דורשת חשבון מורשה ב-Supabase.
- טיפוסי הטבלאות והתצוגות ב־`web/src/database.types.ts` נוצרים מהמיגרציות במסד בדיקות מקומי באמצעות `npm run types:db`. בדיקת `npm run types:db:check` מזהה אי־התאמה. טיפוסי פונקציות וקשרים טרם נוצרים.
- תוצר `docs/` נשמר במאגר עבור GitHub Pages; תהליך הבדיקות בונה מחדש ומוודא שהתוצר מעודכן.
- נדרש Node 22.18 ומעלה ו-Python 3.12.
- `npm ci --ignore-scripts`, ואז `npm run check`: עיצוב, lint, בדיקת טיפוסים, ובדיקות TypeScript, JS ו-RLS.
- Python: `ruff format --check . && ruff check .` ו-`python3 -m unittest discover -s tests -t .`
- סקריפטי חילוץ: `pip install -r requirements-scripts.txt`, ואז `python3 scripts/extract.py --sources <תיקייה> --output <קובץ.json>` או `python3 scripts/extract_additional.py --sources <תיקייה> --output <קובץ.csv>`.

כל הבדיקות רצות ב-GitHub Actions בכל PR.

## כללי קוד
כל קוד חדש נכתב לפי [כללי הקוד](documentation/coding-standards-he.md): שפה לכל שכבה, גבולות גודל, שמות, Supabase ו-RLS, בדיקות ואבטחה. רוב הכללים נאכפים ב-CI.

## עקרונות
קובצי המקור אינם חלק מהריפו. תאריך פרסום אינו תוקף מאגר או חוזה. לכל רשומה נשמר מקור, וכל רשומה עוברת בדיקה אנושית לפני הסתמכות. ההרשאות נאכפות בבסיס הנתונים ולא בדפדפן.
