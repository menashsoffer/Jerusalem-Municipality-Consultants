# AGENTS.md

Single source of truth for every AI coding assistant in this repo (Claude Code, Codex, Copilot, ...).
`CLAUDE.md` holds the binding coding rules and points here for the pipeline.
Humans: see `README.md` and `documentation/`.

## This project

- **What:** an internal tool for finding suppliers in the Jerusalem municipality consultant pools and
  checking the procurement route under the municipalities regulations (tenders). See `README.md`.
- **Language/direction:** Hebrew, RTL. Code, identifiers, comments and commit messages are English.
- **Stack:** Supabase (SQL migrations, RLS, Edge Functions), React + Vite site in `web/`, TypeScript,
  Python extraction scripts in `scripts/`, npm, Node 22, Playwright.

## Commands

| Task | Command |
| ---- | ------- |
| **Check (required before finishing)** | `npm run check` |
| Format | `npm run format` |
| Site dev server | `npm run dev:web` |
| Browser tests (needs local Supabase) | `npm run e2e` |
| Pipeline script tests | `npm run test:pipeline` |
| Python | `ruff format --check . && ruff check .` |

## Definition of done

1. `npm run check` passes. Python changes also pass the ruff commands above.
2. New behavior has a test next to the code. Every business rule and every RLS policy has a test; a
   fixed bug gets a failing test first.
3. Schema, RLS and database functions change only through a new SQL migration.
4. Never finish with a failing check, and never "fix" it by disabling a lint rule or skipping a test.
   After three failed fix rounds, stop and tell a human.

## Rules

Follow `CLAUDE.md` and `documentation/coding-standards-he.md` for all code.

### Protected files (the pipeline's trust boundary)

Do not change these unless the user explicitly asks: `.github/`, `.claude/`, `CODEOWNERS`, `.npmrc`,
`.gitmodules`. `package.json` and `package-lock.json` change only as a plan lists them; the owner
approves such a patch before any PR exists. See `documentation/factory/pipeline.md`.

## The pipeline

An issue goes in; a reviewed, human-approved pull request comes out. No agent can merge. Details:
`documentation/factory/pipeline.md` and `documentation/factory/agents.md`. The prompts in
`.github/prompts/` are authoritative for each pipeline step.
