# ממשק ה-API של גיידסטאר

נבדק ב-13.11.2026 מתוך אתר התיעוד `https://api.guidestar.org.il/s/` (דורש כניסה לחשבון) ומפרט
ה-OpenAPI שלו ב-SwaggerHub (`justice/guidestar`, גרסה 1.4).

## מה הממשק מכסה

גיידסטאר הוא אתר של משרד המשפטים על **ארגונים ללא כוונת רווח**: עמותות, חברות לתועלת הציבור
והקדשות. אין בו חברות בע"מ רגילות. לכן הוא מכסה רק חלק מהספקים. למספר חברה של חברה בע"מ צריך את
מאגר רשם החברות (data.gov.il).

## גישה

- כתובת: `https://www.guidestar.org.il/services/apexrest/api`
- `POST /login` עם `username` ו-`password` של חשבון הממשק. התשובה מחזירה `sessionId`.
- כל קריאה אחרת שולחת `Authorization: Bearer <sessionId>`.
- פרטי החשבון נשמרים כסוד של Supabase Edge Function, ולא בקוד ולא באתר.

## נקודות קצה רלוונטיות

| קריאה | שימוש אצלנו |
|-------|-------------|
| `GET /organizations?filter=...` | חיפוש ארגון לפי שם |
| `GET /organizations/{regNum}` | פרטי ארגון לפי מספר תאגיד, עם `fullObject=true` לפרטים מלאים |
| `GET /organizations/{regNum}/reports2` | דוחות כספיים ומילוליים |
| `GET /organizations/{regNum}/services` | השירותים שהארגון נותן |
| `GET /organizations/{regNum}/branches` | סניפים |

`filter`: כמה תנאים מופרדים ב-`;`, על כל שדה בסכמה, עם האופרטורים `:`, `!=`, `>=`, `<=`, `=`,
`>`, `<`, בלי רווחים. `sort` ו-`isDesc` לסידור.

## שדות שנשמור

- `regNum`: מספר התאגיד. נכנס ל-`supplier_identifiers` עם scheme `nonprofit` (עמותה) או `company`
  (חל"צ), ועם `source` שמציין את גיידסטאר.
- `name`, `fullName`: נכנסים כשמות נוספים ב-`supplier_names`.
- `malkarType`, `malkarStatus`, `isActive`: סוג התאגיד ומצבו. ארגון לא פעיל מסומן לבדיקה.
- `approval46`, `hasNihulTakin`: אישור סעיף 46 ואישור ניהול תקין. רלוונטיים לבדיקת התקשרות.
- `urlGuidestar`: קישור לדף הארגון, כמקור.

## לפני שמשתמשים

באתר התיעוד יש דף "הסתייגויות לנתונים בממשק". הנתונים נאספים ממקורות שונים, ולכן מזהה שהגיע מגיידסטאר
עדיין עובר אימות של אדם (משימה ה2 באפיון).
