#!/usr/bin/env python3
"""Extract the single-page cultural consultants table into a review-only CSV."""

import argparse
import csv
import re
from pathlib import Path

import pdfplumber

SOURCE_URL = 'https://www.jerusalem.muni.il/media/dn3jnavb/cultural-and-art-consultants-database.pdf'
HEADER = ['תבותכ', 'דיינ ןופלט', 'דרשמב ןופלט', 'ץעויה םש']
FIELDS = ['name', 'raw_name', 'field', 'registry', 'source_url', 'source_page',
          'source_row', 'phone_mobile', 'phone_office', 'raw_address', 'review_status']


def hebrew_display(value):
    value = ' '.join((value or '').split())
    if re.search('[א-ת]', value):
        value = value[::-1]
        value = re.sub(r'[A-Za-z0-9@._+/-]{2,}', lambda match: match.group()[::-1], value)
    return value


def extract(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                if not table or table[0] != HEADER:
                    continue
                for row_number, row in enumerate(table[1:], start=2):
                    if len(row) != 4 or not row[3] or not row[3].strip():
                        raise ValueError(f'Unexpected row at page {page_number}, row {row_number}')
                    address, mobile, office, raw_name = [value or '' for value in row]
                    rows.append({'name': hebrew_display(raw_name), 'raw_name': raw_name,
                                 'field': 'תרבות ואמנות', 'registry': 'מאגר יועצים לתחום התרבות והאמנות',
                                 'source_url': SOURCE_URL, 'source_page': page_number, 'source_row': row_number,
                                 'phone_mobile': mobile.strip(), 'phone_office': office.strip(),
                                 'raw_address': address, 'review_status': 'needs_review'})
    if not rows:
        raise ValueError('Expected source table was not found; no output was written')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    rows = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Extracted {len(rows)} rows for review: {args.output}')


if __name__ == '__main__':
    main()
