#!/usr/bin/env python3
"""Extract selected municipal PDFs to staging, retaining source rows for review."""

import argparse
import csv
import json
from pathlib import Path

import pdfplumber
from extract_culture import hebrew_display

SOURCES = {
    'lecturers': {
        'file': 'מאגר-מרצים-אוניברסיטה עממית.pdf', 'media_id': 'ciwlkdzx',
        'url': 'https://www.jerusalem.muni.il/media/ciwlkdzx/מאגר-מרצים-מאושר-לא-לעריכה.pdf',
        'registry': 'מאגר מרצים אוניברסיטה עממית',
    },
    'surveyors': {
        'file': 'מאגר-מודדים-למחלקת-מידע-ומיפוי-באגף-לרישוי-ופיקוח.pdf', 'media_id': 'cs2lkiri',
        'url': 'https://www.jerusalem.muni.il/media/cs2lkiri/מאגר-מודדים-למחלקת-מידע-ומיפוי-באגף-לרישוי-ופיקוח.pdf',
        'registry': 'מאגר מודדים',
    },
    'institutions': {
        'file': 'רשימת-מוסדות-לימוד-הרחבת המאגר מוסדות להשכלה גבוהה : להנדסאים.pdf', 'media_id': 'fhcajuaq',
        'url': 'https://www.jerusalem.muni.il/media/fhcajuaq/רשימת-מוסדות-לימוד-שאושרו-להרחבת-המאגר.pdf',
        'registry': 'הרחבת מאגר מוסדות להשכלה גבוהה והנדסאים',
    },
    'logistics': {
        'file': 'מאגר אגף לוגיסטיקה יועצי מיזוג אוויר : יועצים לשירותים פיננסים ובדיקות שכר.pdf', 'media_id': 'i2dexgag',
        'url': 'https://www.jerusalem.muni.il/media/i2dexgag/מאגר-יועצים-לפרסום.pdf',
        'registry': 'מאגר יועצים - אגף לוגיסטיקה',
    },
    'planning': {
        'file': 'מאגר יועצים אגף תכנון - 2024.pdf', 'media_id': '0ebjnauh',
        'url': 'https://www.jerusalem.muni.il/media/0ebjnauh/רשימת-יועצים-2024-מאושרת.pdf',
        'registry': 'מאגר יועצים אגף תכנון - 2024',
    },
}
FIELDS = ['name', 'field', 'phone', 'phone_office', 'email', 'contact', 'source_number', 'source_section',
          'registry', 'source_url', 'source_page', 'source_table', 'source_row',
          'raw_cells_json', 'review_flags', 'review_status']


def nonempty(row):
    return [str(value or '').strip() for value in row]


def extract(kind, root):
    config = SOURCES[kind]
    results, notes = [], []
    section = ''
    with pdfplumber.open(root / config['file']) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            for table_no, table in enumerate(page.extract_tables(), 1):
                for row_no, cells in enumerate(table, 1):
                    row = nonempty(cells)
                    name = field = phone = phone_office = email = contact = number = ''
                    flags = ['verify_source_and_local_file']
                    if kind == 'lecturers' and len(row) == 5:
                        if row[0].startswith('2024') or row[0].startswith('2025-26'):
                            section = hebrew_display(row[0]); continue
                        if row[4] == "'סמ" or not any(row): continue
                        if row[4].isdigit() or (row[0] and (row[2] or row[3])):
                            name = ' '.join(filter(None, (hebrew_display(row[2]), hebrew_display(row[3]))))
                            field, phone, number = hebrew_display(row[1]), row[0], row[4]
                            if not number: flags.append('unnumbered_source_row')
                            if not field: flags.append('missing_field')
                            if not phone: flags.append('missing_phone')
                        else:
                            notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    elif kind == 'surveyors' and len(row) == 3:
                        if row[2].isdigit():
                            name, field, number = hebrew_display(row[1]), 'מדידות', row[2]
                            flags.append('source_identifier_not_interpreted')
                        elif row_no == 1: continue
                        else: notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    elif kind == 'institutions' and len(row) == 4:
                        if row[3].isdigit():
                            name, field, contact, phone, number = hebrew_display(row[2]), 'לימודים אקדמיים והנדסאים', hebrew_display(row[1]), row[0], row[3]
                            flags.append('check_separate_notes_page')
                        elif row_no == 1: continue
                        else: notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    elif kind == 'logistics' and len(row) == 6:
                        if row[1] and 'יצעוי' in row[1]:
                            section = hebrew_display(row[1]); continue
                        if row[0] and row[3].isdigit():
                            name, field, number = hebrew_display(row[0]), section, row[3]
                            if number == '0': flags.append('zero_supplier_number')
                        elif not any(row) or row[1] == 'ץ עוי םש': continue
                        else: notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    elif kind == 'planning' and len(row) == 5:
                        if row == ['דרשמ', 'ירלולס', 'ליימ', '.פ.ח', 'דרשמ םש']:
                            continue
                        if row[4]:
                            phone_office, phone, email, number, name = row[0], row[1], row[2], row[3], hebrew_display(row[4])
                            flags.extend(['category_heading_outside_table', 'phone_format_as_extracted',
                                          'source_identifier_not_interpreted'])
                        else:
                            notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    else:
                        if any(row): notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells})
                        continue
                    if not name:
                        notes.append({'page': page_no, 'table': table_no, 'row': row_no, 'cells': cells}); continue
                    results.append(dict(name=name, field=field, phone=phone, phone_office=phone_office,
                                        email=email, contact=contact,
                                        source_number=number, source_section=section, registry=config['registry'],
                                        source_url=config['url'], source_page=page_no, source_table=table_no,
                                        source_row=row_no, raw_cells_json=json.dumps(cells, ensure_ascii=False),
                                        review_flags=';'.join(flags), review_status='needs_review'))
    if not results:
        raise ValueError(f'No source rows found for {kind}; no output written')
    return results, notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=sorted(SOURCES))
    parser.add_argument('--sources', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    rows, notes = extract(args.kind, args.sources)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = args.output_dir / f"{args.kind}-{SOURCES[args.kind]['media_id']}.csv"
    notes_target = args.output_dir / f"{args.kind}-{SOURCES[args.kind]['media_id']}-unmapped.json"
    # Check both before writing: never silently overwrite a previous extraction.
    if target.exists() or notes_target.exists():
        raise FileExistsError('Output already exists; choose a new staging directory')
    with target.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader(); writer.writerows(rows)
    notes_target.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{args.kind}: {len(rows)} candidate rows, {len(notes)} non-data or unmapped rows; {target}')


if __name__ == '__main__':
    main()
