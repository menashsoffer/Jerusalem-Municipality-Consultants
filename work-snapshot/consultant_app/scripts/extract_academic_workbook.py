#!/usr/bin/env python3
"""Extract the published academic institutions workbook into review staging."""
import argparse
import csv
import json
from pathlib import Path

import openpyxl

URL = 'https://www.jerusalem.muni.il/media/zlsj0sog/מאגר-מוסדות-להשכלה-גבוהה-למתן-שירותי-לימודים-אקדמיים-לעובדי-עיריית-ירושלים.xlsx'
FIELDS = ['name', 'field', 'phone', 'contact', 'source_number', 'registry',
          'source_url', 'source_page', 'source_table', 'source_row',
          'raw_cells_json', 'review_flags', 'review_status']


def extract(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        # The second sheet repeats the same six institutions in a compact form.
        # Use the source rows on the first sheet, and verify the duplicate sheet.
        first, second = workbook.worksheets
        full = list(first.values)
        compact = list(second.values)
        if len(full) < 10 or len(compact) < 13:
            raise ValueError('Unexpected workbook dimensions')
        if str(full[3][1]).strip() != 'שם מוסד הלימודים' or str(compact[6][1]).strip() != 'שם מוסד הלימודים':
            raise ValueError('Unexpected workbook headers')
        rows = []
        for row_number, cells in enumerate(full[4:], 5):
            if not cells[0] and not cells[1]:
                continue
            if not isinstance(cells[0], int) or not cells[1]:
                raise ValueError(f'Unexpected data at row {row_number}')
            rows.append(dict(name=str(cells[1]).strip(), field='לימודים אקדמיים',
                             phone=str(cells[7] or '').strip(), contact=str(cells[6] or '').strip(),
                             source_number=str(cells[0]), registry='מוסדות להשכלה גבוהה לעובדי העירייה',
                             source_url=URL, source_page='', source_table=first.title, source_row=row_number,
                             raw_cells_json=json.dumps(cells, ensure_ascii=False, default=str),
                             review_flags='verify_source_and_local_file;verify_workbook_status',
                             review_status='needs_review'))
        repeat = [(str(r[0]), str(r[1]).strip()) for r in compact[7:] if r[0] and r[1]]
        if [(r['source_number'], r['name']) for r in rows] != repeat:
            raise ValueError('Workbook sheets disagree; review manually')
        return rows
    finally:
        workbook.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    rows = extract(args.workbook)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} rows extracted to {args.output}; all require review')


if __name__ == '__main__':
    main()
