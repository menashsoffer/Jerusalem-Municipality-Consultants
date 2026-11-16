import csv
import sys
import tempfile
import unittest
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP / 'scripts'))
try:
    import extract_review_sources as extractor
except ModuleNotFoundError:
    extractor = None


@unittest.skipIf(extractor is None, 'pdfplumber is unavailable')
class ReviewExtractionTest(unittest.TestCase):
    def test_numberless_lecturer_is_preserved_for_review(self):
        source_dir = APP.parent / 'sources'
        rows, notes = extractor.extract('lecturers', source_dir)
        self.assertEqual(len(rows), 57)
        self.assertEqual(sum('unnumbered_source_row' in row['review_flags'] for row in rows), 1)
        self.assertTrue(all(row['review_status'] == 'needs_review' for row in rows))
        self.assertEqual(notes, [])

    def test_educational_institution_notes_are_not_silently_discarded(self):
        source_dir = APP.parent / 'sources'
        rows, notes = extractor.extract('institutions', source_dir)
        self.assertEqual(len(rows), 5)
        self.assertTrue(any(note['page'] == 2 for note in notes))
        self.assertTrue(all('check_separate_notes_page' in row['review_flags'] for row in rows))

    def test_planning_rows_remain_separate_without_invented_categories(self):
        rows, notes = extractor.extract('planning', APP.parent / 'sources')
        self.assertEqual(len(rows), 158)
        self.assertEqual({row['source_page'] for row in rows}, set(range(1, 10)))
        self.assertTrue(all(not row['field'] for row in rows))
        self.assertTrue(all('category_heading_outside_table' in row['review_flags'] for row in rows))
        self.assertEqual(notes, [])


if __name__ == '__main__':
    unittest.main()
