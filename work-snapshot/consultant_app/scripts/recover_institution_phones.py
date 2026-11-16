#!/usr/bin/env python3
"""Recover phone text outside the detected table cells in the source PDF."""
import argparse
import csv
import re
from pathlib import Path

import pdfplumber


def recover(pdf_path, source_path):
    with source_path.open(encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames
        rows = list(reader)
    if len(rows) != 5 or any(row['phone'] for row in rows):
        raise ValueError('Unexpected original extraction')
    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 2:
            raise ValueError('Unexpected source page count')
        page = pdf.pages[0]
        tables = page.find_tables()
        if len(tables) != 1 or len(tables[0].rows) != 6:
            raise ValueError('Unexpected source table structure')
        words = page.extract_words()
        for row, table_row in zip(rows, tables[0].rows[1:]):
            # Detected phone cells are missing because the column boundary
            # is absent. Use words horizontally left of the contact column,
            # and vertically inside the exact detected source row.
            words_in_row = sorted(
                (w for w in words if 0 <= w['x0'] < 250 and
                 table_row.bbox[1] <= (w['top'] + w['bottom']) / 2 < table_row.bbox[3]),
                key=lambda w: w['x0'])
            phone = ' '.join(w['text'] for w in words_in_row).strip()
            if not re.fullmatch(r'[0-9\s/\-]+', phone) or len(re.findall(r'\d', phone)) < 9:
                raise ValueError(f"Unusable phone text on source row {row['source_row']}")
            row['phone'] = phone
            row['review_flags'] += ';phone_recovered_from_page_layout_verify'
    return columns, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    columns, rows = recover(args.pdf, args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Recovered phone text for {len(rows)} institutions; all rows require review')


if __name__ == '__main__':
    main()
