import sqlite3
import unittest
from datetime import date
from pathlib import Path

from procurement.engine import (Thresholds, check_continuation_3_20, check_increase, check_new_contract,
                                check_splitting, comparable_value, indexed_amount, next_update_day,
                                threshold_valid_until, thresholds_for, thresholds_from_index)
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

    def test_stale_thresholds_need_review(self):
        # סף אוקטובר 2026 תקף עד 15.11.2026 בלבד
        self.assertTrue(self.route(1000).allowed)
        d = check_new_contract(1000, date(2026, 11, 16), TABLE, value_includes_vat=True, related_values=[])
        self.assertEqual(d.status, "needs_review")
        # גם סף רשמי ישן אינו תקף לנצח
        d = check_new_contract(1000, date(2022, 1, 1), TABLE, value_includes_vat=True, related_values=[])
        self.assertEqual(d.status, "needs_review")
        self.assertIs(thresholds_for(date(2022, 1, 1), TABLE), OCT_2021)

    def test_explicit_valid_until(self):
        t = Thresholds(date(2026, 10, 16), 1, 2, 3, "x", True, valid_until=date(2027, 1, 1))
        self.assertEqual(threshold_valid_until(t), date(2027, 1, 1))
        self.assertEqual(threshold_valid_until(NOV_2026), date(2026, 11, 15))
        self.assertEqual(next_update_day(date(2026, 12, 20)), date(2027, 1, 16))

    def test_splitting_wired_into_result(self):
        d = self.route(100_000, related_values=[100_000])
        self.assertTrue(d.splitting_checked)
        self.assertEqual(d.route, "no_tender_low_value")
        self.assertEqual(d.status, "needs_review")
        self.assertTrue(any("פיצול" in w for w in d.warnings))
        d = self.route(100_000)
        self.assertFalse(d.splitting_checked)
        self.assertTrue(any("לא בוצעה" in w for w in d.warnings))
        self.assertTrue(self.route(10_000, related_values=[10_000]).allowed)

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

    def test_3_14_with_all_modeled_facts_still_needs_review(self):
        d = self.route(900_000, exemption="3(14)", facts={"counterparty_is_npo": True, "city_holding_40": True,
                                                         "purpose_education_culture_welfare_sport": True})
        self.assertEqual(d.route, "exemption_3_14")
        self.assertEqual(d.status, "needs_review")
        self.assertFalse(d.allowed)
        self.assertTrue(d.missing)

    def test_fully_modeled_exemption_is_ok(self):
        self.assertTrue(self.route(900_000, exemption="3(8)", facts={"professional_work": True}).allowed)

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
                    new_months=3, committee_convinced=True, special_state_active_confirmed=True)
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
        d = self.base(special_state_end=date(2026, 10, 1))
        self.assertFalse(d.allowed)
        self.assertEqual(d.status, "blocked")

    def test_unknown_validity_is_undecided(self):
        d = self.base(special_state_active_confirmed=False)
        self.assertFalse(d.allowed)
        self.assertEqual(d.status, "needs_review")
        self.assertTrue(d.missing)
        self.assertFalse(d.as_dict()["allowed"])

    def test_blocked_is_not_downgraded(self):
        d = self.base(special_state_active_confirmed=False, previous_continuations=[(10_000, 4)])
        self.assertEqual(d.status, "blocked")


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
        db.execute("INSERT INTO engagement_requests(requested_on, subject, subject_key, estimated_value, value_includes_vat)"
                   " VALUES ('2026-11-05', 'גינון', 'garden', 100000, 0)")
        self.assertAlmostEqual(related_request_values(db, "garden", DAY)[0], 118_000)


if __name__ == "__main__":
    unittest.main()
