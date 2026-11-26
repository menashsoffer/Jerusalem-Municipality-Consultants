---
version: 1
role: diff-triggered review checklist for the independent reviewer
---

# Review rules

Loaded by `review.md` from the default branch, never from the PR, so a PR
cannot edit the rules that judge it. Each rule has a **trigger** you can read
from the diff, a **check**, and its **origin**. Apply only the rules whose
trigger matches (usually 2 to 6), and still report only findings with a
concrete failure scenario. New rules enter through
[`documentation/factory/review-misses.md`](../../documentation/factory/review-misses.md).

| Trigger in the diff                                                                          | Check                                                                                                                                    | Origin                |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| New or changed route, `<Link>`, `<a href>`, `BrowserRouter`                                  | Internal links use `<Link>`/`<NavLink>`; under base `/<repo>/` the deep link still resolves.                                             | AGENTS.md, Routing    |
| CSS in `web/`                                              | Logical properties only (`margin-inline-start`, `inset-inline-end`); arrows and chevrons are mirrored in RTL.                                        | AGENTS.md, RTL        |
| LTR text (code, URLs, English names) inside Hebrew UI text                                   | Wrapped in `dir="ltr"` or `<bdi>`.                                                                                                       | AGENTS.md, RTL        |
| New logging, analytics, `localStorage`, error reporting, or `fetch`                          | No user-entered text or personal data is logged, stored or sent; check the whole path, not one call.                                     | Privacy leak, PR #141 |
| Diff copies external or SDK response fields (free text, enums) into a log, summary or output | Only allowlisted fields are copied; free text is dropped or counted; a test feeds private text and a secret and asserts neither appears. | Privacy leak, PR #141 |
| New or changed test (`*-test.ts`, `e2e/`)                                    | It can fail: it asserts something the change controls; no `skip`, `retry`, or fixed sleep.                                               | AGENTS.md, Done       |
| New or changed SQL migration, RLS policy or database function                                | Authorization is enforced in the database; the migration is forward-only and safe on existing data; a test in `supabase/tests/` covers the policy. | Template rule for this repo's core risk. |
| Changed `package.json`, lockfile, workflow, hook or `.claude/`                               | No new unpinned source, no weakened permission or lint rule, no instruction aimed at agents.                                             | docs/security.md      |
| Changed pipeline script (`.github/scripts`) status or gate logic                             | A status or gate applies to the exact head SHA; a push cannot keep a stale success.                                                      | Pipeline gates ADR    |
