#!/usr/bin/env python3
"""Attach source headings to planning rows without inferring category mappings."""
import argparse
import csv
from pathlib import Path

import pdfplumber
from extract_review_sources import FIELDS, SOURCES, extract

# Headings were inspected on the source pages. Tables continuing a previous page
# inherit that same heading; every other table must have its heading immediately
# above it. Source labels are preserved, not mapped to an approved taxonomy.
LAYOUT = {
    1: [('אדריכלות', 'תולכירדא')],
    2: [('אדריכלות', None)],
    3: [('אדריכלות', None), ('אדריכל שימור', 'רומישלכירדא')],
    4: [('אדריכל נוף', 'ףונלכירדא')],
    5: [('ניהול פרויקטים', 'םיטקייורפלוהינ')],
    6: [('גיאוגרף/מתכנן ערים', 'םירעןנכתמ/ףרגואיג'),
        ('מהנדס תנועה/דרכים/כבישים', 'םישיבכ/םיכרד/העונתסדנהמ')],
    7: [('מהנדס תנועה/דרכים/כבישים', None), ('כלכלן', 'ןלכלכ'), ('אגרונום', 'םונורגא')],
    8: [('פרוגרמטור', 'רוטמרגורפ'), ('יועץ הנדסי תמ"א 38', '38א"מתיסדנהץעוי')],
    9: [('יועץ חוזים תעריפים והתקשרויות', 'תויורשקתהוםיפירעתםיזוחץעוי'),
        ('שירותי גרפיקה ותקשורת חזותית', 'תיתוזחתרושקתוהקיפרגיתוריש')],
}


def headings(path):
    result = {}
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != len(LAYOUT):
            raise ValueError('Page count changed')
        for page_no, page in enumerate(pdf.pages, 1):
            tables = page.find_tables()
            config = LAYOUT[page_no]
            if len(tables) != len(config):
                raise ValueError(f'Table count changed on page {page_no}')
            lines = page.extract_text_lines()
            for table_no, (table, (label, expected)) in enumerate(zip(tables, config), 1):
                if expected:
                    previous = [line for line in lines if line['bottom'] < table.bbox[1]]
                    if not previous or ''.join(previous[-1]['text'].split()) != expected:
                        raise ValueError(f'Heading mismatch on page {page_no}, table {table_no}')
                result[page_no, table_no] = label
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    mapping = headings(args.sources / SOURCES['planning']['file'])
    rows, unmapped = extract('planning', args.sources)
    if len(rows) != 158 or unmapped:
        raise ValueError('Source rows changed or contain unmapped data')
    for row in rows:
        row['field'] = mapping[row['source_page'], row['source_table']]
        row['source_section'] = row['field']
        row['review_flags'] = row['review_flags'].replace('category_heading_outside_table',
                                                           'source_heading_transcribed_check')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} rows enriched; all remain unverified')


if __name__ == '__main__':
    main()
