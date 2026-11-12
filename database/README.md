# Directory access schema — draft

The SQL in `drafts/` is a proposal, not a production migration. It must not be applied to the existing project until it has been reviewed and tested in an isolated Supabase/PostgreSQL instance, including the rollback fixture in `tests/`, RLS negative cases, bootstrap, data migration, backup and recovery.

Run the browser-client tests with `node --test tests/*.test.cjs`. Generate (but do not apply) the database rollback test with `python3 database/tests/build_rollback_test.py`. A generated SQL file is only a test fixture; generating it is not evidence that the SQL or policies passed PostgreSQL execution.

No existing `suppliers` table or live authorization policy is changed by the draft. The draft is incomplete until the application, verified municipal units and the administrator approval flow are integrated and tested.
