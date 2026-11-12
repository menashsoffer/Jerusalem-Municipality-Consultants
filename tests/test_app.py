"""בדיקות לשרת המקומי: חיפוש מאגרים ונקודת הקצה של מנוע המסלול."""
import json
import os
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from urllib.parse import quote

_tmp = tempfile.TemporaryDirectory()
os.environ['CONSULTANTS_DB'] = os.path.join(_tmp.name, 'test.sqlite3')

import app  # noqa: E402  (נטען אחרי הגדרת מיקום בסיס הנתונים)


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.init()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.server.RequestHandlerClass.log_message = lambda *a: None
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{self.port}{path}') as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, None

    def test_registry_search(self):
        status, rows = self.get('/api/registries?q=')
        self.assertEqual(status, 200)
        self.assertEqual(len(rows), 10)
        self.assertEqual(len(self.get('/api/registries?q=' + quote('תחבורה'))[1]), 1)

    def test_like_wildcards_are_literal(self):
        self.assertEqual(self.get('/api/registries?q=' + quote('%'))[1], [])
        self.assertEqual(self.get('/api/registries?q=' + quote('_'))[1], [])

    def test_route_check(self):
        status, d = self.get('/api/route-check?value=200000&vat=1&date=2026-11-12')
        self.assertEqual(status, 200)
        self.assertEqual(d['route'], 'zuta_4')
        self.assertFalse(d['splitting_checked'])

    def test_vat_flag(self):
        _, incl = self.get('/api/route-check?value=150000&vat=true&date=2026-11-12')
        _, excl = self.get('/api/route-check?value=150000&vat=0&date=2026-11-12')
        self.assertEqual(incl['compared_value'], 150000)
        self.assertAlmostEqual(excl['compared_value'], 177000)
        self.assertEqual(self.get('/api/route-check?value=1000&vat=maybe&date=2026-11-12')[0], 400)

    def test_invalid_values_are_rejected(self):
        for value in ('nan', 'inf', '-5', 'abc', ''):
            with self.subTest(value=value):
                self.assertEqual(self.get(f'/api/route-check?value={value}&date=2026-11-12')[0], 400)
        self.assertEqual(self.get('/api/route-check?date=2026-11-12')[0], 400)

    def test_foreign_keys_enforced(self):
        db = app.connect()
        try:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO engagement_requests(requested_on, subject, estimated_value, value_includes_vat,"
                           " supplier_id) VALUES ('2026-11-12', 'x', 1, 1, 999999)")
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
