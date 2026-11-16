import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'scripts' / 'audit_imports.py'
spec = importlib.util.spec_from_file_location('audit_imports', MODULE)
audit_imports = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_imports)


class AuditImportsTest(unittest.TestCase):
    def test_reports_source_provenance_and_possible_name_matches(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'rows.csv'
            fields = sorted(audit_imports.REQUIRED_COLUMNS)
            with path.open('w', encoding='utf-8', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerow(dict(name='חברת דוגמה', field='א', registry='אחד', source_url='https://example.org/a', source_page='1', review_status='needs_review'))
                writer.writerow(dict(name='חברת-דוגמה', field='ב', registry='שניים', source_url='https://example.org/b', source_page='', review_status='needs_review'))
            report = audit_imports.audit([path])
            self.assertEqual(report['total_rows'], 2)
            self.assertEqual(len(report['sources']), 2)
            self.assertEqual(len(report['duplicate_name_candidates']), 1)
            self.assertEqual(report['sources'][1]['missing']['source_page'], 1)

    def test_rejects_incomplete_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'bad.csv'
            path.write_text('name\nexample\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                audit_imports.audit([path])


if __name__ == '__main__':
    unittest.main()
