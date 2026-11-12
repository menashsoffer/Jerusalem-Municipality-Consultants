import sqlite3
import unittest
from datetime import date
from pathlib import Path

from procurement.engine import (Thresholds, check_continuation_3_20, check_increase, check_new_contract,
                                check_splitting, comparable_value, indexed_amount, thresholds_for,
                                thresholds_from_index)
from procurement.store import load_thresholds, related_request_values

ROOT = Path(__file__).resolve().parent.parent
OCT_2021 = Thresholds(date(2021, 10, 16), 145_500, 355_300, 710_600, "תקנות", True)
NOV_2026 = Thresholds(date(2026, 10, 16), 170_700, 416_800, 833_600, "חישוב", False)
TABLE = [OCT_2021, NOV_2026]
DAY = date(2026, 11, 12)


class ThresholdTests(unittest.TestCase):
    def test_rounding_to_100(self):
        self.assertEqual(indexed_amount(26_000, 1.0), 26_000)
        self.assertEqual(indexed_amount(26_000, 5.596), 145_500)

    def test_oct_2021_values_reproduce_from_index(self):
        # יחס המדד שגלום בסכומי אוקטובר 2021 בנוסח התקנות. נגזר מהסכום הגדול, שהעיגול בו הכי זניח
        t = thresholds_from_index(175.3 * 710_600 / 127_000, date(2021, 10, 16), "test")
        self.assertEqual((t.no_tender_max, t.zuta_4_max, t.zuta_6_max), (145_500, 355_300, 710_600))

    def test_latest_table_in_force(self):
        self.assertIs(thresholds_for(DAY, TABLE), NOV_2026)
        self.assertIs(thresholds_for(date(2026, 10, 15), TABLE), OCT_2021)
        with self.assertRaises(ValueError):
            thresholds_for(date(2020, 1, 1), TABLE)

    def test_vat_conversion(self):
        self.assertAlmostEqual(comparable_value(100, False), 118)
        self.assertEqual(comparable_value(100, True), 100)
        self.assertAlmostEqual(comparable_value(118, True, compare_incl_vat=False), 100)


class NewContractTests(unittest.TestCase):
    def route(self, value, **kw):
        return check_new_contract(value, DAY, TABLE, value_includes_vat=True, **kw)

    def test_routes_by_value(self):
        self.assertEqual(self.route(170_700).route, "no_tender_low_value")
        self.assertEqual(self.route(170_800).route, "zuta_4")
        self.assertEqual(self.route(416_800).route, "zuta_4")
        self.assertEqual(self.route(500_000).route, "zuta_6")
        self.assertEqual(self.route(900_000).route, "public_tender")

    def test_vat_can_move_route(self):
        # 150,000 לפני מע"מ הם 177,000 כולל מע"מ, ולכן מכרז זוטא בברירת המחדל השמרנית
        d = check_new_contract(150_000, DAY, TABLE, value_includes_vat=False)
        self.assertEqual(d.route, "zuta_4")
        d = check_new_contract(150_000, DAY, TABLE, value_includes_vat=False, compare_incl_vat=False)
        self.assertEqual(d.route, "no_tender_low_value")

    def test_unofficial_thresholds_warn(self):
        self.assertTrue(any("אינם פרסום רשמי" in w for w in self.route(1000).warnings))
        d = check_new_contract(1000, date(2022, 1, 1), TABLE, value_includes_vat=True)
        self.assertFalse(any("אינם פרסום רשמי" in w for w in d.warnings))

    def test_exemption_3_8_applies_with_facts(self):
        d = self.route(900_000, exemption="3(8)", facts={"professional_work": True})
        self.assertEqual(d.route, "exemption_3_8")
        self.assertIn("ועדת הפטור", d.approver)
        self.assertTrue(any("8/2016" in r for r in d.requirements))

    def test_exemption_without_facts_falls_back(self):
        d = self.route(900_000, exemption="3(8)")
        self.assertEqual(d.route, "public_tender")
        self.assertEqual(len(d.missing), 1)

    def test_3_14_needs_all_conditions(self):
        d = self.route(900_000, exemption="3(14)", facts={"counterparty_is_npo": True, "city_holding_40": True})
        self.assertEqual(d.route, "public_tender")
        self.assertEqual(len(d.missing), 1)

    def test_unknown_exemption_is_flagged(self):
        d = self.route(900_000, exemption="3(99)")
        self.assertEqual(d.route, "public_tender")
        self.assertTrue(d.warnings)


class IncreaseTests(unittest.TestCase):
    def test_existing_item_cap_is_cumulative(self):
        self.assertTrue(check_increase(kind="existing_item", base_amount=100, previous_increases=0, new_increase=50).allowed)
        d = check_increase(kind="existing_item", base_amount=100, previous_increases=30, new_increase=30)
        self.assertFalse(d.allowed)

    def test_added_items_cap_and_council(self):
        self.assertFalse(check_increase(kind="added_items", base_amount=100, previous_increases=0, new_increase=30).allowed)
        d = check_increase(kind="added_items", base_amount=100, previous_increases=0, new_increase=30,
                           council_decided_tender_useless=True)
        self.assertTrue(d.allowed)
        self.assertTrue(any("מועצה" in r for r in d.requirements))

    def test_near_cap_warns(self):
        d = check_increase(kind="added_items", base_amount=100, previous_increases=0, new_increase=22)
        self.assertTrue(d.allowed)
        self.assertTrue(d.warnings)


class ContinuationTests(unittest.TestCase):
    def base(self, on=DAY, **kw):
        args = dict(first_value=100_000, first_months=12, previous_continuations=[], new_value=50_000,
                    new_months=3, committee_convinced=True, special_state_end=None)
        args.update(kw)
        return check_continuation_3_20(on, **args)

    def test_ok(self):
        self.assertTrue(self.base().allowed)

    def test_before_start(self):
        self.assertFalse(self.base(on=date(2026, 4, 20)).allowed)

    def test_cumulative_months_and_value(self):
        self.assertFalse(self.base(previous_continuations=[(10_000, 4)]).allowed)
        self.assertFalse(self.base(previous_continuations=[(60_000, 1)]).allowed)

    def test_expired(self):
        self.assertFalse(self.base(special_state_end=date(2026, 10, 1)).allowed)


class SplittingTests(unittest.TestCase):
    def test_split_detected(self):
        self.assertIsNotNone(check_splitting(100_000, [100_000], NOV_2026))

    def test_no_split_when_same_route(self):
        self.assertIsNone(check_splitting(10_000, [10_000], NOV_2026))
        self.assertIsNone(check_splitting(10_000, [], NOV_2026))


class StoreTests(unittest.TestCase):
    def test_schema_seed_and_queries(self):
        db = sqlite3.connect(":memory:")
        for f in ("schema.sql", "seed.sql", "procurement_schema.sql", "procurement_seed.sql"):
            db.executescript((ROOT / f).read_text(encoding="utf-8"))
        table = load_thresholds(db)
        self.assertEqual(thresholds_for(DAY, table).no_tender_max, 170_700)
        self.assertTrue(thresholds_for(date(2022, 1, 1), table).is_official)
        db.executemany("INSERT INTO engagement_requests(requested_on, subject, subject_key, estimated_value, value_includes_vat)"
                       " VALUES (?, 'ניקיון', 'cleaning', ?, 1)",
                       [("2026-11-01", 100_000), ("2026-11-10", 90_000), ("2026-01-01", 50_000)])
        self.assertEqual(sorted(related_request_values(db, "cleaning", DAY, exclude_id=2)), [100_000])


if __name__ == "__main__":
    unittest.main()
