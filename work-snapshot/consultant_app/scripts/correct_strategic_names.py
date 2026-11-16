#!/usr/bin/env python3
"""Apply two visually checked OCR corrections while retaining the raw cells."""
import argparse
import csv
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    with args.source.open(encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames
        rows = list(reader)
    if len(rows) != 35:
        raise ValueError('Unexpected source row count')
    # The same name appears on lines 9 and 31 of the scanned table. Its image
    # reads "קו חשיבה התנהגותית"; OCR produced two different spellings.
    for position, expected in [(9, 'קיו חשיבה התנהגותית'), (31, 'קין חשיבה התנהגותית')]:
        row = rows[position - 1]
        if row['name'] != expected or row['email'] != 'roy@q-bt.co':
            raise ValueError(f'Unexpected source value on row {position}')
        row['name'] = 'קו חשיבה התנהגותית'
        row['review_flags'] += ';name_checked_against_scan'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print('Corrected two OCR names; other fields still require review')


if __name__ == '__main__':
    main()
