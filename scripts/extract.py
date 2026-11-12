"""Extract selected public tables into reviewable records; run with pdfplumber/openpyxl."""
from pathlib import Path
import json,re,argparse
import pdfplumber,openpyxl
parser=argparse.ArgumentParser(description='Extract selected municipal source tables')
parser.add_argument('--sources',type=Path,required=True,help='Directory containing the source documents')
parser.add_argument('--output',type=Path,required=True,help='Output JSON file')
args=parser.parse_args(); SRC=args.sources; OUT=args.output
OUT.parent.mkdir(parents=True,exist_ok=True)
records=[]
def clean(v):
    return re.sub(r'\s+', ' ', str(v or '')).strip()
def heb(v):
    lines=str(v or '').splitlines()
    out=[]
    for line in lines:
        s=clean(line)
        if re.search('[א-ת]',s):
            s=s[::-1]
            s=re.sub(r'[A-Za-z0-9@._+/-]{2,}',lambda m:m.group()[::-1],s)
        out.append(s)
    return clean(' '.join(out))
def add(name,field,registry,url,page=None,email='',phone='',note=''):
    if not name:return
    records.append(dict(name=clean(name),field=clean(field),registry=registry,source_url=url,page=page,email=clean(email),phone=clean(phone),note=note,status='טעון אימות'))
def read_pdf(filename):
    return pdfplumber.open(SRC/filename)
url='https://www.jerusalem.muni.il/media/he0nee24/רשימת-יועצים-לפרסום-באינטרנט.pdf'
with read_pdf('רשימת-יועצים-מחשוב ומערכות מידע.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)==6 and clean(r[5]).isdigit(): add(heb(r[4]),heb(r[2]),'יועצי מחשוב ומערכות מידע',url,i,clean(r[1]).replace(' ',''),clean(r[0]),'קוד תחום: '+clean(r[3]))
url='https://www.jerusalem.muni.il/media/lbajvgl4/רשימת-הנכללים-במאגר-לפי-קטגוריות.pdf'
with read_pdf('מאגר שירותי ראיית חשבון למינהל הכספי.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   if len(table)<3: continue
   headers=[heb(x) for x in table[1][:5]]
   for r in table[2:]:
    if len(r)==10 and clean(r[9]).isdigit():
     fields=[headers[j] for j in range(5) if clean(r[j]).upper()=='V']
     add(heb(r[8]),' / '.join(fields),'שירותי ראיית חשבון למינהל הכספי',url,i,clean(r[6]),clean(r[5]))
url='https://www.jerusalem.muni.il/media/w2megjnt/רשימת-מאגר-משרדי-יחצ-בתוקף-עד-3182027.pdf'
with read_pdf('רשימת-מאגר-משרדי-יחצ-בתוקף-עד-3182027.pdf') as pdf:
 for i,page in enumerate(pdf.pages,1):
  for table in page.extract_tables():
   for r in table:
    if len(r)==7 and clean(r[6]).isdigit(): add(heb(r[5]),'יחסי ציבור','משרדי יחסי ציבור',url,i,clean(r[3]).replace(' ',''),clean(r[1]),'על פי המסמך: תוקף המאגר עד 31.08.2027')
url='https://www.jerusalem.muni.il/media/1yrhrhfi/מאגר-יועצים-2024.xlsx'
w=openpyxl.load_workbook(SRC/'מאגר יועצים- פיתוח המשאב האנושי.xlsx',read_only=True,data_only=True)
for row in list(w.active.values)[1:]:
 if row[0]: add(clean(row[0]),'פיתוח המשאב האנושי','פיתוח המשאב האנושי',url,None,clean(row[1]),('0'+str(row[2]) if isinstance(row[2],int) and len(str(row[2]))==9 else clean(row[2])),'תוקף חוזה כפי שצוין במקור: '+clean(row[5]))
OUT.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
from collections import Counter
print(len(records),dict(Counter(r['registry'] for r in records)))
