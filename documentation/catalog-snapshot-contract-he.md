# חוזה טעינת הקטלוג

המימוש נשען על אפיון טעינת המידע ב־#44. שתי הפונקציות הציבוריות פועלות כ־`security invoker`; כל קריאה לטבלה עוברת RLS. רק משתמש מזוהה יכול להריץ אותן.

`catalog_snapshot(known_version text default null)` מחזירה `user_id`, `access` ו־`version`. ב־`access` נמצאים `state`, `member`, `admin`, `editor`, `manager` ו־`grants` (כל מענק כולל `role` ו־`unitId`). משתמש שאינו חבר פעיל אינו מקבל קטלוג. חבר עם גרסה עדכנית מקבל `unchanged: true`. אחרת מוחזר `catalog`.

לצמצום התשובה, שורות הקטלוג הן מערכים עם סדר עמודות קבוע. אין חזרה על `supplier_id` בשורות המקוננות. אין ביומן המקומי נתוני ביקורת. שינוי חוזה בעתיד מחייב גם שינוי גרסת מפתח המטמון בדפדפן.

| מפתח | סדר העמודות |
|---|---|
| `suppliers` | `id, display_name, entity_kind, status, website, review_status, note, names, memberships, contacts` |
| `names` בתוך ספק | `id, name, kind, source_document_id` |
| `memberships` בתוך ספק | `id, registry_version_id, registry_field_id, name_as_published, source_page, registered_from, registered_until, engagement_started_on, dates_source, review_status` |
| `contacts` בתוך ספק | `id, kind, value, is_valid, source_document_id` (כולן `current`) |
| `registries` | `id, name, owner_unit_id, status` |
| `versions` | `id, registry_id, source_document_id, valid_from, valid_until` |
| `fields` | `id, registry_id, source_text` |
| `categories` | `id, name, parent_id` (כולן פעילות) |
| `fieldCategories` | `registry_field_id, category_id` |
| `units` | `id, name` |
| `documents` | `id, url` |

המזהים נשארים UUID מקוריים; כל שיוך מפנה לגרסה ולתחום לפי מזהה. הקטלוג אינו כולל ספקים ממוזגים, פרטי קשר שאינם נוכחיים או שיוכים שהוסרו או נדחו. שורות העזר מוחזרות פעם אחת, גם אם מספר ספקים משתמשים בהן.

הגרסה כוללת מונה משותף וטביעת מזהה המשתמש, מצבו והרשאותיו הפעילות. טריגר פקודה מגדיל את המונה בכל כתיבה לטבלה מהקטלוג. הטריגר פועל בהרשאות הכותב; הרשאת העדכון למונה מוגבלת בסכמה הפרטית לעדכון מתוך טריגר. אין הרשאת הוספה או מחיקה למשתמש רגיל. ביטול טרנזקציה מבטל גם את הגדלת המונה.

`supplier_detail(supplier_id uuid)` מחזירה `identifiers` לפי RLS, ו־`audit` למנהל או מבקר בלבד. לאחרים `audit: null`. גילוי רשומות שנמחקו או הועברו לספק אחר נעשה דרך יומן השינויים; התאמת רשומות נעשית גם לפי שם הטבלה, כדי לא לערבב מזהים זהים מטבלאות שונות.

בדיקות Advisor ומדידות על `hmophbeqelaycjdvgkys` יבוצעו בידי Claude אחרי המיזוג והפריסה האוטומטית לסביבת הבדיקה, לפי הנחיית בעל המוצר. בדיקות PGlite הן מבודדות ואינן מדידת רשת או תחליף ל־Advisor. אין במימוש זה אישור למיזוג או לפריסה לחי.
