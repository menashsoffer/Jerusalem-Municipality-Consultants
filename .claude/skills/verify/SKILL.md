---
name: verify
description: Run the change for real and collect evidence before committing or opening a PR. Use after any change to web/, supabase/ or scripts/, and before saying a task is done.
---

# Verify: run the change, don't just test it

`npm run check` proves the code type-checks, lints, builds and the unit tests pass. It does not prove the
feature works. Do both.

## Steps

1. **Cheap checks first.** `npm run check` (plus `ruff format --check . && ruff check .` for Python).
   Fix every failure before going on.
2. **Run the site.** `npm run dev:web`. Use the pre-installed Playwright Chromium to open the pages you
   changed. Take a screenshot and read it: Hebrew text, `dir="rtl"`, no overflow, no console errors.
3. **Database changes.** A new migration or RLS policy needs a test in `supabase/tests/`; run it.
4. **E2E.** Changed user-visible flows: `npm run e2e` when a local Supabase is available
   (`documentation/e2e-tests-he.md`).
5. **Report evidence**: which commands ran, pass or fail, and what the screenshot showed. Say plainly what
   you did not run.

## Rules

- **Three rounds, then a human.** If the same check still fails after three fix attempts, stop, report the
  failing check and what you tried.
- Never skip a test, disable a lint rule or loosen a tsconfig to get green.
