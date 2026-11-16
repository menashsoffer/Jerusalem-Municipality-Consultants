PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS registries (id INTEGER PRIMARY KEY, name TEXT NOT NULL, administration TEXT, department TEXT, published_on TEXT, source_url TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, identity_type TEXT, identity_value TEXT);
CREATE TABLE IF NOT EXISTS fields (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS registry_versions (id INTEGER PRIMARY KEY, registry_id INTEGER NOT NULL REFERENCES registries(id), source_url TEXT NOT NULL, published_on TEXT, valid_from TEXT, valid_until TEXT, review_status TEXT NOT NULL DEFAULT 'needs_review');
CREATE TABLE IF NOT EXISTS memberships (id INTEGER PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id), registry_version_id INTEGER NOT NULL REFERENCES registry_versions(id), field_id INTEGER REFERENCES fields(id), original_name TEXT, status TEXT NOT NULL DEFAULT 'unknown', valid_from TEXT, valid_until TEXT, source_page INTEGER);
CREATE TABLE IF NOT EXISTS contracts (id INTEGER PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id), starts_on TEXT, ends_on TEXT, source_reference TEXT, review_status TEXT NOT NULL DEFAULT 'needs_review');
