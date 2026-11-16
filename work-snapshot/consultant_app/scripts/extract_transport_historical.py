#!/usr/bin/env python3
"""Extract the locally supplied older transport registry for reconciliation."""
import argparse
import csv
import json
from pathlib import Path

import pdfplumber
from extract_culture import hebrew_display

URL = 'https://www.jerusalem.muni.il/media/wlqdetya/מאגר-יועצים-מאושר.pdf'
FIELDS = ['name', 'field', 'phone', 'email', 'registry', 'source_url', 'source_page',
          'source_table', 'source_row', 'raw_cells_json', 'review_flags', 'review_status']


def clean(value):
    return ' '.join(str(value or '').split())


def extract(path):
    rows, headings, unnumbered = [], 0, 0
    field = ''
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != 5:
            raise ValueError('Unexpected page count')
        for page_no, page in enumerate(pdf.pages, 1):
            for table_no, table in enumerate(page.extract_tables(), 1):
                for row_no, cells in enumerate(table, 1):
                    if not any(cells):
                        continue
                    if len(cells) != 6:
                        raise ValueError(f'Unexpected table on page {page_no}')
                    cells = [clean(value) for value in cells]
                    if cells[5] and not cells[3] and 'םוחת' not in cells[5]:
                        field = hebrew_display(cells[5])
                        headings += 1
                        continue
                    if 'דרשמה םש' in cells[3] or (page_no == 1 and row_no == 1):
                        continue
                    if cells[3] and (cells[4].isdigit() or (not cells[4] and (cells[0] or cells[1]))):
                        if not field:
                            raise ValueError('Supplier row appears before a field heading')
                        flags = ['historical_version_compare_before_import', 'verify_source_and_local_file',
                                 'source_identifier_not_interpreted']
                        if not cells[4]:
                            flags.append('unnumbered_source_row')
                            unnumbered += 1
                        rows.append(dict(name=hebrew_display(cells[3]), field=field, phone=cells[1],
                                         email=cells[0], registry='תחבורה ופיתוח תשתיות - גרסה קודמת',
                                         source_url=URL, source_page=page_no, source_table=table_no,
                                         source_row=row_no, raw_cells_json=json.dumps(cells, ensure_ascii=False),
                                         review_flags=';'.join(flags), review_status='needs_review'))
                    else:
                        raise ValueError(f'Unmapped row: page {page_no}, table {table_no}, row {row_no}')
    if len(rows) != 151 or headings != 11 or unnumbered != 2:
        raise ValueError('Unexpected table, heading, or unnumbered-row count')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    rows = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} historical rows, including two unnumbered rows; source mapping requires verification')


if __name__ == '__main__':
    main()
