#!/usr/bin/env python3
"""Extract an older education registry as a separate historical source."""
import argparse
import csv
import json
import re
from pathlib import Path

import pdfplumber
from extract_culture import hebrew_display

URL = 'https://www.jerusalem.muni.il/media/lymhcxle/מאגר-2024.pdf'
FIELDS = ['name', 'field', 'registry', 'source_url', 'source_page', 'source_table',
          'source_row', 'raw_cells_json', 'review_flags', 'review_status']


def extract(path):
    results, ignored = [], []
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != 14:
            raise ValueError('Unexpected page count')
        for page_no, page in enumerate(pdf.pages, 1):
            for table_no, table in enumerate(page.extract_tables(), 1):
                for row_no, cells in enumerate(table, 1):
                    if not any(cells):
                        continue
                    if len(cells) != 5:
                        raise ValueError(f'Unexpected row shape: page {page_no}, row {row_no}')
                    number = str(cells[4] or '').strip()
                    if re.fullmatch(r'[0-9-]+', number) and cells[3] and cells[1]:
                        results.append(dict(name=hebrew_display(cells[3]), field=hebrew_display(cells[1]),
                                            registry='תחומים פיזיים מינהל החינוך - גרסה קודמת',
                                            source_url=URL, source_page=page_no, source_table=table_no,
                                            source_row=row_no, raw_cells_json=json.dumps(cells, ensure_ascii=False),
                                            review_flags='historical_version_compare_before_import;verify_source_and_local_file',
                                            review_status='needs_review'))
                    elif (cells[0] or '').strip() == 'תורעה' and (cells[1] or '').strip() == 'םוחת':
                        ignored.append((page_no, table_no, row_no))
                    else:
                        raise ValueError(f'Unmapped row: page {page_no}, table {table_no}, row {row_no}')
    if len(results) != 210 or len(ignored) != 27:
        raise ValueError('Unexpected source row count')
    return results


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
    print(f'{len(rows)} historical rows extracted; compare to the newer registry before import')


if __name__ == '__main__':
    main()
