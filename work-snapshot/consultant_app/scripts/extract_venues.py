#!/usr/bin/env python3
"""Extract venue listings, preserving their full source row for review."""
import argparse
import csv
import json
from pathlib import Path

import pdfplumber
from extract_culture import hebrew_display

URL = 'https://www.jerusalem.muni.il/media/5sadsxmp/טבלת-נתונים-למאגר-אולמות-2024.pdf'
FIELDS = ['name', 'field', 'phone', 'email', 'contact', 'source_number',
          'registry', 'source_url', 'source_page', 'source_table', 'source_row',
          'raw_cells_json', 'review_flags', 'review_status']


def extract(path):
    result = []
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != 1:
            raise ValueError('Unexpected page count')
        tables = pdf.pages[0].extract_tables()
        if len(tables) != 1 or len(tables[0][0]) != 32:
            raise ValueError('Unexpected table structure')
        for row_number, cells in enumerate(tables[0][1:], 2):
            if not cells[31] and not cells[30]:
                if any(cells):
                    raise ValueError(f'Unmapped content at row {row_number}')
                continue
            number, name = str(cells[31] or '').strip(), str(cells[30] or '').strip()
            if not number.isdigit() or not name:
                raise ValueError(f'Unexpected venue row {row_number}')
            result.append(dict(name=hebrew_display(name), field='אולמות לאירועי תרבות',
                               phone=str(cells[28] or '').strip(), email=str(cells[26] or '').strip(),
                               contact=hebrew_display(cells[25] or ''), source_number=number,
                               registry='מאגר אולמות 2024', source_url=URL, source_page=1,
                               source_table=1, source_row=row_number,
                               raw_cells_json=json.dumps(cells, ensure_ascii=False),
                               review_flags='verify_source_and_local_file;venue_not_legal_entity;verify_contacts',
                               review_status='needs_review'))
    if [int(row['source_number']) for row in result] != list(range(1, 53)):
        raise ValueError('Venue numbering is incomplete or changed')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    rows = extract(args.pdf)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} venue listings extracted to {args.output}; all require review')


if __name__ == '__main__':
    main()
