import csv
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pipeline'))
from staging_store import duplicate_candidates, field_candidates, import_csv, open_store, summary


class StagingStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = open_store(self.root / 'review.sqlite3')
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self.db.close)

    def write_rows(self, name, rows):
        path = self.root / name
        with path.open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=['name', 'field', 'source_url', 'review_status'])
            writer.writeheader(); writer.writerows(rows)
        return path

    def row(self, name, status='needs_review'):
        return {'name': name, 'field': 'תחום מקורי',
                'source_url': 'https://www.jerusalem.muni.il/media/a1/file.pdf', 'review_status': status}

    def test_idempotent_import_retains_same_name_rows_separately(self):
        path = self.write_rows('source.csv', [self.row('דוגמה בע״מ'), self.row('דוגמה בע״מ')])
        self.assertEqual(import_csv(self.db, path)['inserted'], 2)
        self.assertEqual(import_csv(self.db, path)['status'], 'already_imported')
        self.assertEqual(summary(self.db)['records'], 2)
        self.assertEqual(summary(self.db)['name_review_groups'], 1)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM extracted_records').fetchone()[0], 2)
        candidates = duplicate_candidates(self.db)
        self.assertEqual(candidates[0]['source_count'], 1)
        self.assertEqual(candidates[0]['record_count'], 2)
        self.assertFalse(candidates[0]['shared_phone'])
        self.assertEqual(candidates[0]['status'], 'needs_review')
        fields = field_candidates(self.db)
        self.assertEqual(fields[0]['row_count'], 2)
        self.assertIsNone(fields[0]['parent_category'])
        self.assertEqual(fields[0]['status'], 'needs_review')

    def test_invalid_row_aborts_whole_file(self):
        path = self.write_rows('bad.csv', [self.row('תקין'), self.row('לא תקין', 'approved')])
        with self.assertRaises(ValueError):
            import_csv(self.db, path)
        self.assertEqual(summary(self.db)['records'], 0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM import_files').fetchone()[0], 0)

    def test_unrelated_database_is_never_modified(self):
        other = self.root / 'other.sqlite3'
        with sqlite3.connect(other) as connection:
            connection.execute('CREATE TABLE existing (value TEXT)')
            connection.execute("INSERT INTO existing VALUES ('preserved')")
        with self.assertRaises(ValueError):
            open_store(other)
        with sqlite3.connect(other) as connection:
            self.assertEqual(connection.execute('SELECT value FROM existing').fetchone()[0], 'preserved')

    def test_rejects_nonmunicipal_source(self):
        row = self.row('ספק')
        row['source_url'] = 'https://example.org/media/a1/file.pdf'
        with self.assertRaises(ValueError):
            import_csv(self.db, self.write_rows('foreign.csv', [row]))
        self.assertEqual(summary(self.db)['records'], 0)


if __name__ == '__main__':
    unittest.main()
