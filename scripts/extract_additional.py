"""Extract more registry tables into a review CSV; run with pdfplumber."""
import re,json,csv,argparse
from pathlib import Path
from collections import Counter
import pdfplumber
from source_text import clean, heb
parser=argparse.ArgumentParser(description='Extract additional municipal source tables')
parser.add_argument('--sources',type=Path,required=True,help='Directory containing the source documents')
parser.add_argument('--output',type=Path,required=True,help='Output CSV file')
args=parser.parse_args(); SRC=args.sources; OUT=args.output; rows=[]
def add(name,field,registry,url,page,email='',phone=''):
 if clean(name) and clean(field): rows.append({'name':clean(name),'field':clean(field),'registry':registry,'source_url':url,'source_page':page,'email':clean(email),'phone':clean(phone),'note':'חולץ אוטומטית – יש לאמת מול המקור','review_status':'needs_review'})
url='https://www.jerusalem.muni.il/media/3sydompm/מאגר-יועצים-מאושר-לשנת-2025-2027.pdf'; field=''
with pdfplumber.open(SRC/'מאגר-יועצים-מאושר-תחבורה ופיתוח תשתיות-לשנת-2025-2027.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)!=6:continue
    if clean(r[5]) and not clean(r[3]) and 'םוחת' not in clean(r[5]): field=heb(r[5])
    if clean(r[4]).isdigit() and clean(r[3]):add(heb(r[3]),field,'תחבורה ופיתוח תשתיות',url,i,clean(r[0]).replace(' ',''),clean(r[1]))
url='https://www.jerusalem.muni.il/media/0xrfvbbn/מאגר-יועצים-אגף-שיפור-פני-העיר.pdf'; field=''
with pdfplumber.open(SRC/'מאגר-יועצים-אגף-שיפור-פני-העיר.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)!=7:continue
    for cell in r:
     if cell and 'םיצעוי רגאמ' in cell: field=heb(cell).split(' - ',1)[-1]
    if clean(r[6]).isdigit() and clean(r[5]):add(heb(r[5]),field,'אגף שיפור פני העיר',url,i,clean(r[3]).replace(' ',''),clean(r[2]))
url='https://www.jerusalem.muni.il/media/tecnwz4z/מאגר-2024.pdf'
with pdfplumber.open(SRC/'מאגר יועצים תחומים פיזיים מינהל החינוך-2024.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)==5 and re.fullmatch(r'[0-9-]+',clean(r[4])) and clean(r[3]) and clean(r[1]): add(heb(r[3]),heb(r[1]),'תחומים פיזיים מינהל החינוך',url,i)
url='https://www.jerusalem.muni.il/media/tcbhbl5i/רשימת-יועצים-כלכלנים-2023.pdf'
with pdfplumber.open(SRC/'מאגר כלכלנים- ייעוץ כלכלי.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)==5 and clean(r[4]).isdigit():add(heb(r[3]),'ייעוץ כלכלי','מאגר כלכלנים',url,i,'',clean(r[0]))
if not rows: raise SystemExit('No rows were extracted. Check the source directory and file names.')
OUT.parent.mkdir(parents=True,exist_ok=True)
with open(OUT,'w',encoding='utf8',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print('total',len(rows),dict(Counter(r['registry'] for r in rows)))
for rg in sorted(set(r['registry'] for r in rows)):
 print(rg,[(r['name'],r['field']) for r in rows if r['registry']==rg][:3])
