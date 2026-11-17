# מאגרי יועצים – עיריית ירושלים

כלי פנימי לאיתור ספקים מתוך פרסומי מאגרי היועצים של העירייה, ולבדיקת מסלול ההתקשרות לפי תקנות העיריות (מכרזים). המערכת בפיתוח. הנתונים חולצו אוטומטית וטרם אומתו במלואם, והכלי אינו מאשר התקשרות.

הכיוון והשלבים: [תוכנית הארכיטקטורה](documentation/architecture-plan-he.md). החלטות: [`documentation/decisions/`](documentation/decisions/).

## מה יש בריפו
| חלק | מיקום | מצב |
|---|---|---|
| האתר | `web/` | אתר React ב-TypeScript מול Supabase, בעיצוב לפי [DESIGN.md](DESIGN.md): כניסה, קטלוג ספקים ומתקנים, כרטיס ספק, הוספה ועריכה, בקשת התקשרות ובדיקת מסלול, ומסכי ניהול (משתמשים, ספים, מזהים, קטגוריות, בקרת טעינה). נבנה ונפרס ב-GitHub Actions |
| בסיס הנתונים | `supabase/migrations/` | כל הסכמה, ההרשאות וה-RLS כמיגרציות. נבדקות ב-`supabase/tests/` |
| נתוני דמה | `supabase/seed/dummy.sql` | לסביבה המקומית ולסביבת הבדיקה בלבד |
| פונקציות שרת | `supabase/functions/` | מנוע בדיקת המסלול (`_shared/procurement/`, ראו `documentation/procurement-engine-he.md`) עדכון ספים חודשי (`threshold-index`) וחיפוש מזהי ספקים (`supplier-identifiers`). שלושתן פרוסות, לפי `supabase/functions/deployed.txt` |
| נתוני הקובץ המאוחד | `data/pool-file/` | קובצי JSON של המאגרים, פרטי הקשר והאולמות שנטענו מהקובץ המאוחד. ראו [טעינת מאגרים](documentation/pool-file-load-he.md) |
| סקריפטי חילוץ | `scripts/` | Python. חילוץ טבלאות מקובצי PDF ו-Excel של העירייה לקובץ לבדיקה |
| תהליכי CI ופריסה | `.github/workflows/` | בדיקות בכל PR, פריסת אתר, פריסת Supabase, טעינת הקובץ המאוחד והפעלת עדכון הספים. ראו [סביבות ופריסה](documentation/environments-he.md) |

## מצב הנתונים במסד החי (17.11.2026)
49 מאגרים, 1,293 ספקים פעילים (106 רשומות מוזגו לספק אחר), 2,831 שיוכים, 434 תחומי מקור (124 מהם
משויכים לקטגוריות), 468 מזהי ספק מאושרים ו-226 מועמדים ממתינים, ופרטי אולם ל-115 אולמות. כל הספקים
והשיוכים עדיין במצב "ממתין לבדיקה".

## הרצה ובדיקות
- נדרש Node 22.18 ומעלה ו-Python 3.12.
- `npm ci --ignore-scripts`, ואז `npm run check`: עיצוב, lint, בדיקת טיפוסים, ובדיקות TypeScript, ממשק ו-RLS. חובה לפני דחיפה.
- אתר: `npm run dev:web`. בלי `.env` האתר פונה לפרויקט החי. למסד מקומי או לסביבת הבדיקה, ראו `.env.example`.
- מסד מקומי (דורש Docker): `npx supabase@2.122.0 start`, ואז `npx supabase@2.122.0 db reset` למיגרציות ולנתוני הדמה.
- טיפוסי הטבלאות ב-`web/src/database.types.ts` נוצרים מהמיגרציות עם `npm run types:db`, ו-`npm run types:db:check` מזהה אי-התאמה.
- Python: `ruff format --check . && ruff check .` ו-`python3 -m unittest discover -s tests -t .`
- סקריפטי חילוץ: `pip install -r requirements-scripts.txt`, ואז `python3 scripts/extract.py --sources <תיקייה> --output <קובץ.json>` או `python3 scripts/extract_additional.py --sources <תיקייה> --output <קובץ.csv>`.

## פריסה
שינוי מגיע לסביבה החיה רק דרך GitHub Actions. מיגרציות מוחלות קודם על סביבת הבדיקה, ועל החי רק בהפעלה ידנית ואחרי אישור בלחיצה. האתר, לעומת זאת, מתפרסם מיד עם המיזוג ל-`main`, ולכן מיגרציה שהאתר תלוי בה מוחלת על החי לפני המיזוג. הפרטים וההגדרה החד פעמית: [סביבות ופריסה](documentation/environments-he.md).

## כללי קוד
כל קוד חדש נכתב לפי [כללי הקוד](documentation/coding-standards-he.md). רוב הכללים נאכפים ב-CI.

## עקרונות
קובצי המקור אינם חלק מהריפו. תאריך פרסום אינו תוקף מאגר או חוזה. לכל רשומה נשמר מקור, וכל רשומה עוברת בדיקה אנושית לפני הסתמכות. ההרשאות נאכפות בבסיס הנתונים ולא בדפדפן.
