#!/usr/bin/env python3
"""Extract the scanned strategic-consultants table's existing OCR layer."""
import argparse
import csv
import json
from pathlib import Path

import pdfplumber
from pdfplumber.utils import cluster_objects
from extract_culture import hebrew_display

URL = 'https://www.jerusalem.muni.il/media/j1yeqolc/מאגר-יועצים-אתר-עירוני.pdf'
FIELDS = ['name', 'field', 'email', 'registry', 'source_url', 'source_page',
          'source_row', 'raw_cells_json', 'review_flags', 'review_status']


def extract(path):
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != 2:
            raise ValueError('Unexpected page count')
        page = pdf.pages[0]
        if not (590 < page.width < 600 and 835 < page.height < 850):
            raise ValueError('Unexpected page dimensions')
        # This PDF is a scanned page with an imperfect OCR text layer. Table
        # coordinates and the 35 expected rows were checked against the image.
        chars = [c for c in page.chars if 174 < c['top'] < 675 and 130 < c['x0'] < 470]
        lines = cluster_objects(chars, 'top', 7)
        if len(lines) != 35:
            raise ValueError('Unexpected OCR row count; inspect the scan')
        rows = []
        for number, line in enumerate(lines, 1):
            def column(left):
                return ''.join(c['text'] for c in sorted(
                    (c for c in line if (c['x0'] < 327) == left), key=lambda c: c['x0'])).strip()
            email, raw_name = column(True), column(False)
            if '@' not in email or not raw_name:
                raise ValueError(f'Incomplete OCR row {number}; inspect the scan')
            rows.append(dict(name=hebrew_display(raw_name), field='', email=email,
                             registry='יועצים לאגף למדיניות ותכנון אסטרטגי', source_url=URL,
                             source_page=1, source_row=number,
                             raw_cells_json=json.dumps([raw_name, email], ensure_ascii=False),
                             review_flags='ocr_scan_verify_every_field;verify_source_and_local_file',
                             review_status='needs_review'))
        return rows


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
    print(f'{len(rows)} OCR rows extracted; every field requires review')


if __name__ == '__main__':
    main()
