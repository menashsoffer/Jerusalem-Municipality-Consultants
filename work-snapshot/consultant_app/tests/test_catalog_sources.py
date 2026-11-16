import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'scripts' / 'catalog_sources.py'
spec = importlib.util.spec_from_file_location('catalog_sources', MODULE)
catalog_sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog_sources)


class CatalogTest(unittest.TestCase):
    def test_matches_encoded_and_unencoded_urls_by_media_id(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / 'sources.tsv'
            catalog.write_text('name\tadministration\tdepartment\tupdated\tmedia_path\nשם\t\t\t\tabcd/שם.pdf\n', encoding='utf-8')
            imports = root / 'rows.csv'
            with imports.open('w', encoding='utf-8', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=['source_url'])
                writer.writeheader()
                writer.writerow({'source_url': 'https://www.jerusalem.muni.il/media/abcd/%D7%A9%D7%9D.pdf'})
            report = catalog_sources.reconcile(catalog, [imports])
            self.assertEqual(report['publications'][0]['imported_rows'], 1)
            self.assertEqual(report['unmatched_import_media_ids'], [])
            self.assertEqual(catalog_sources.media_id(report['publications'][0]['source_url']), 'abcd')

    def test_local_candidates_are_hashed_and_not_treated_as_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / 'sources.tsv'
            catalog.write_text('name\tadministration\tdepartment\tupdated\tmedia_path\nשם\t\t\t\tabcd/name.pdf\n', encoding='utf-8')
            imports = root / 'rows.csv'
            imports.write_text('source_url\n', encoding='utf-8')
            (root / 'file.pdf').write_bytes(b'local document')
            manifest = root / 'manifest.tsv'
            manifest.write_text('media_id\tlocal_file\tbasis\nabcd\tfile.pdf\tuser_supplied_filename\n', encoding='utf-8')
            report = catalog_sources.reconcile(catalog, [imports], manifest, root)
            candidate = report['publications'][0]['local_candidates'][0]
            self.assertTrue(candidate['exists'])
            self.assertEqual(len(candidate['sha256']), 64)
            self.assertEqual(candidate['match_status'], 'candidate_needs_content_verification')

    def test_local_manifest_cannot_access_files_outside_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / 'sources.tsv'
            catalog.write_text('name\tadministration\tdepartment\tupdated\tmedia_path\n', encoding='utf-8')
            imports = root / 'rows.csv'
            imports.write_text('source_url\n', encoding='utf-8')
            manifest = root / 'manifest.tsv'
            manifest.write_text('media_id\tlocal_file\tbasis\nabcd\t../secret\tuser_supplied_filename\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                catalog_sources.reconcile(catalog, [imports], manifest, root)

    def test_staged_rows_are_separate_from_imported_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / 'sources.tsv'
            catalog.write_text('name\tadministration\tdepartment\tupdated\tmedia_path\nשם\t\t\t\tabcd/name.pdf\n', encoding='utf-8')
            imports = root / 'rows.csv'
            imports.write_text('source_url\n', encoding='utf-8')
            staging = root / 'staged.csv'
            staging.write_text('source_url,review_status\nhttps://www.jerusalem.muni.il/media/abcd/name.pdf,needs_review\n', encoding='utf-8')
            item = catalog_sources.reconcile(catalog, [imports], staging=[staging])['publications'][0]
            self.assertEqual(item['staged_rows'], 1)
            self.assertEqual(item['imported_rows'], 0)
            self.assertEqual(item['import_status'], 'not_in_import_files')


if __name__ == '__main__':
    unittest.main()
