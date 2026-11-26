# Skills map

The one place that says which skill to use for which task. Project instructions point here.
Skills in this folder load automatically in every Claude Code session on this repo.
Other agents (Codex, the pipeline) read `CLAUDE.md`, which points here: open the `SKILL.md` named
below and follow it.

`DESIGN.md`, `CLAUDE.md` and `documentation/coding-standards-he.md` win over any skill.

## Which skill when

| Task | Skill |
| --- | --- |
| Any code change | `ponytail`: the smallest change that solves it |
| Before a commit or PR on `web/`, `supabase/` or `scripts/` | `verify` |
| Permissions, RLS, Edge Functions, secrets, supplier data | `security-audit` |
| Client-side HTML/CSS/JS/React, before writing code | `modern-web-guidance` (plugin) |
| Any UI work | Skills IL (MCP `skills`, `try_skill`): `israeli-ui-design-system`, `hebrew-rtl-best-practices`, `israeli-accessibility-compliance` (IS 5568), `wcag-accessibility-widget` |
| Review or polish an existing screen | `impeccable` (`critique`, `audit`, `polish`) |
| Stress-test a card, table or form with worst-case data (long Hebrew names, missing fields, zero rows) | `break-ui` |
| Mobile behaviour (zoom on input, 100vh, sticky hover, safe areas) | `mobile-native` |
| Review existing motion / remove motion that has no purpose | `review-animations`, `remove-animations` |
| Design a module's interface or split a file past the 300-line limit | `codebase-design` |
| Domain terms, glossary, decision records | `domain-modeling` (our decisions live in `documentation/decisions/`, in Hebrew) |
| Code review of a PR | `code-review`; `israeli-app-code-review` (Skills IL) may help |

Do not use: `hallmark`, `taste-skill` (built for marketing pages; clash with `DESIGN.md`) and
`setup-matt-pocock-skills` (its own issue labels clash with the board, including `stage:qualified`).

## Vendored copies

Copied verbatim at a fixed commit, with each source's licence in the folder.

| Skill | Source | Commit | Licence |
| --- | --- | --- | --- |
| `impeccable` | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | `2fc5e14` (v4.11.1) | Apache-2.0 |
| `codebase-design`, `domain-modeling` | github.com/mattpocock/skills (`skills/engineering`) | `6f7f783` | MIT |
| `break-ui`, `mobile-native`, `review-animations`, `remove-animations` | github.com/emilkowalski/skill | `64eb3de` | MIT |
| `security-audit` | github.com/cloudflare/security-audit-skill | `c1c8a8c` | MIT |
| `ponytail` | github.com/DietrichGebert/ponytail (`skills/ponytail`) | `ebd8654` | MIT |

Left out on purpose:

- `impeccable/scripts/` (1.8 MB of executables and browser helpers). Commands that call it
  (`context`, `shot`, `pin`, `live`, `foundations`) are not available. For the detector run
  `npx impeccable@4.11.1 detect web/src` on a machine that allows it.
- The `agents/` folders of the Matt Pocock skills (other harnesses only) and the test files of
  `security-audit`.

## Adding, updating or removing a skill

One PR per change, approved by the owner (`.claude/` is a protected path, see `AGENTS.md`).

1. Copy the skill folder from the source at a fixed commit; add the source's `LICENSE`.
2. Update both tables above (task row and source row with the new commit).
3. Leave the copied files unedited, so a later update is a clean re-copy.
