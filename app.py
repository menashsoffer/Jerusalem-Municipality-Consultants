"""Local prototype for browsing municipal consultant registries."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sqlite3, json, os
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from datetime import date
from procurement.engine import check_new_contract
from procurement.store import load_thresholds

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('CONSULTANTS_DB', ROOT / 'consultants.sqlite3'))

def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db

def init():
    with connect() as db:
        db.executescript((ROOT / 'schema.sql').read_text(encoding='utf-8'))
        db.executescript((ROOT / 'seed.sql').read_text(encoding='utf-8'))
        db.executescript((ROOT / 'procurement_schema.sql').read_text(encoding='utf-8'))
        db.executescript((ROOT / 'procurement_seed.sql').read_text(encoding='utf-8'))

def route_check(params):
    """/api/route-check?value=200000&vat=1&date=2026-11-12&exemption=3(8)&fact=professional_work"""
    one = lambda k, d=None: params.get(k, [d])[0]
    with connect() as db:
        table = load_thresholds(db)
    d = check_new_contract(float(one('value')), date.fromisoformat(one('date') or date.today().isoformat()), table,
                           value_includes_vat=one('vat', '1') == '1', exemption=one('exemption') or None,
                           facts={f: True for f in params.get('fact', [])})
    return d.as_dict()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/':
            data = (ROOT / 'index.html').read_bytes(); kind = 'text/html; charset=utf-8'
        elif u.path == '/api/registries':
            q = parse_qs(u.query).get('q', [''])[0].strip()
            with connect() as db:
                rows = db.execute('SELECT name, administration, department, published_on, source_url FROM registries WHERE name LIKE ? OR administration LIKE ? OR department LIKE ? ORDER BY published_on DESC', (f'%{q}%',)*3).fetchall()
            data = json.dumps([dict(r) for r in rows], ensure_ascii=False).encode(); kind = 'application/json; charset=utf-8'
        elif u.path == '/api/route-check':
            try:
                result = route_check(parse_qs(u.query))
            except (TypeError, ValueError) as e:
                self.send_error(400, 'Bad request', str(e)); return
            data = json.dumps(result, ensure_ascii=False).encode(); kind = 'application/json; charset=utf-8'
        else:
            self.send_error(404); return
        self.send_response(200); self.send_header('Content-Type', kind); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

if __name__ == '__main__':
    init(); print('http://127.0.0.1:8000', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
