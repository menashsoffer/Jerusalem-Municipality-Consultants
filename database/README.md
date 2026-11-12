# Directory access schema — draft

The SQL in `drafts/` is a proposal, not a production migration. Do not apply it to the existing project until it has been reviewed and tested in an isolated Supabase instance, including Auth integration, bootstrap, data migration, backup and recovery.

Run `npm ci --ignore-scripts`, then `npm run test:ui` and `npm run test:database`. The database tests run the draft against isolated in-memory PostgreSQL with a minimal test implementation of Supabase Auth; they check pending, active, blocked, revoked, anonymous and administrator access, category approvals and hierarchy, and transaction rollback. They do not replace an end-to-end test on isolated Supabase or a security review.

The directory draft does not alter the existing `suppliers` table or its live authorization policy. A separate draft, `202611120002_suppliers_write_guard.sql`, adds only a trigger on `suppliers`: for signed-in users it sets `created_by` from the session and `review_status` to `needs_review` on insert, and refuses changes to either on update. It assumes both columns exist and does not replace the live policies, which should also be exported into this folder. Verified municipal units, frontend approval screens, supplier policies and administrator bootstrap remain to be implemented and tested.
