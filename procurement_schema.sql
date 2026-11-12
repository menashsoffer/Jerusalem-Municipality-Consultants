-- הרחבת הסכמה לבדיקת חוקיות התקשרות. נטען אחרי schema.sql.
-- לכל טבלה מסומנת הנראות המתוכננת: internal (עובדי העירייה בלבד) או supplier (ניתן לחשוף לספק בהמשך).
PRAGMA foreign_keys = ON;

-- סוג המאגר. מאגר יועצים לפי 3(8) ורשימת ספקים למכרז זוטא לפי תקנה 8 הם מנגנונים שונים בחוק.
-- visibility: supplier
CREATE TABLE IF NOT EXISTS registry_kinds (
  registry_id INTEGER PRIMARY KEY REFERENCES registries(id),
  kind TEXT NOT NULL CHECK (kind IN ('consultant_pool_3_8', 'zuta_list_reg_8', 'other', 'unknown')),
  source_reference TEXT
);

-- ספי ההתקשרות לפי תקנה 2. ארציים, מתעדכנים ב-16 בכל חודש. is_official=0 לערך מחושב.
-- visibility: supplier
CREATE TABLE IF NOT EXISTS thresholds (
  id INTEGER PRIMARY KEY,
  effective_from TEXT NOT NULL UNIQUE,
  no_tender_max INTEGER NOT NULL,
  zuta_4_max INTEGER NOT NULL,
  zuta_6_max INTEGER NOT NULL,
  source TEXT NOT NULL,
  is_official INTEGER NOT NULL DEFAULT 0
);

-- בקשת התקשרות של אגף. ממנה נגזר המסלול החוקי.
-- visibility: internal
CREATE TABLE IF NOT EXISTS engagement_requests (
  id INTEGER PRIMARY KEY,
  requested_on TEXT NOT NULL,
  administration TEXT,
  department TEXT,
  subject TEXT NOT NULL,
  subject_key TEXT,                 -- מפתח לאיתור בקשות קשורות לבדיקת פיצול (תקנה 5)
  estimated_value REAL NOT NULL,
  value_includes_vat INTEGER NOT NULL,
  exemption_basis TEXT,             -- למשל 3(8). ריק אם לא התבקש פטור
  supplier_id INTEGER REFERENCES suppliers(id),
  registry_id INTEGER REFERENCES registries(id),
  contract_id INTEGER REFERENCES contracts(id),
  suggested_route TEXT,             -- פלט המנוע
  suggested_regulation TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled'))
);

-- יומן פניות לספקים: למי פנו, איך, ומי השיב. הבסיס לדיווח השנתי לפי תקנה 8(ג).
-- visibility: internal (הספק יראה בעתיד רק את הפניות אליו)
CREATE TABLE IF NOT EXISTS supplier_approaches (
  id INTEGER PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES engagement_requests(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  approached_on TEXT NOT NULL,
  method TEXT CHECK (method IN ('registered_mail', 'hand_delivery', 'email', 'other')),
  responded INTEGER,
  quote_amount REAL,
  source_reference TEXT
);

-- החלטות ועדה, מקושרות לבקשה או לחוזה.
-- visibility: internal (החלטות שפורסמו כדין יכולות להיות גלויות)
CREATE TABLE IF NOT EXISTS committee_decisions (
  id INTEGER PRIMARY KEY,
  request_id INTEGER REFERENCES engagement_requests(id),
  contract_id INTEGER REFERENCES contracts(id),
  committee TEXT NOT NULL CHECK (committee IN ('tender', 'exemption', 'continuation_3_20', 'increases', 'council', 'other')),
  decided_on TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'deferred')),
  regulation TEXT,
  reasoning TEXT,
  published_on TEXT,                -- 3(20) דורש פרסום בתוך 5 ימי עבודה; חוזר 8/2016 דורש פרסום החלטות 3(8)
  source_reference TEXT,
  CHECK (request_id IS NOT NULL OR contract_id IS NOT NULL)
);

-- שווי החוזה ושינוייו. שורת original אחת לכל חוזה, ואחריה הגדלות והמשכים.
-- visibility: internal (שווי החוזה גלוי לספק הרלוונטי)
CREATE TABLE IF NOT EXISTS contract_changes (
  id INTEGER PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  changed_on TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('original', 'existing_item_increase', 'added_items', 'continuation_3_20', 'option_exercised')),
  item_ref TEXT,                    -- לפרט בחוזה, נדרש להגדלה לפי 3(7)(א)
  amount REAL NOT NULL,
  amount_includes_vat INTEGER NOT NULL,
  months REAL,
  decision_id INTEGER REFERENCES committee_decisions(id),
  regulation TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_subject ON engagement_requests(subject_key, requested_on);
CREATE INDEX IF NOT EXISTS idx_changes_contract ON contract_changes(contract_id, kind);
