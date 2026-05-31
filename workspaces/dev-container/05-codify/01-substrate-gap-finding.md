# Finding (F3) — Multi-Operator Substrate Sync Gap: missing `operators.roster.schema.json`

> **ARCHIVED 2026-05-31 — superseded by loom F72 (loom#400) landed in this repo as `b2aec80 chore(coc): /sync re-baseline — F72 genesis-guard fix (#400) + v2.36.0 wave`.**
>
> The fix did NOT ship the schema this finding requested. Instead, `genesis-anchor-guard.js:380-409` gained a **fresh-substrate-adopter branch**: when both `operators.roster.json` AND `coordination-log.jsonl` are absent (= never enrolled), the commit hook returns `continue:true ADVISORY` instead of fail-closing. F72's walk receipt confirms: `PreToolUse git-commit returns "continue":true ADVISORY (was "continue":false STOP)`.
>
> Once an enrollment record lands in the coordination log, the hook falls back to fail-CLOSED behavior — the schema-validator gap re-opens at that point. For now (no enrollment), the gap is closed by the hook-level pass-through, not by the schema-add this finding proposed.
>
> **Disposition:** retained as institutional knowledge for the historical record. NOT filed via `/codify`. If a future session enrolls an operator and re-hits the schema-missing failure mode, this finding is the head start.
>
> ---
>
> Original finding follows.

**Status:** drafted finding, ready to file via USE-template `/codify` → loom Gate-1.
**Routing (per `artifact-flow.md`):** this is a COC-artifact / substrate defect (the synced
`.claude/` multi-operator substrate), so it originates here (kailash-coc-py, a USE template)
as a `/codify` proposal → loom Gate-1 (human classify: **global** — affects every consumer
that received the substrate) → `/sync`. NOT an SDK-code bug (does not route to a BUILD repo).
**Severity:** HIGH — blocks `git commit` entirely in any consumer repo that received the
multi-operator substrate hooks without the schema.
**Scrub (per `upstream-issue-hygiene.md` proposal-intake lane):** body references only the
template's own `.claude/` substrate paths; no consumer/client/operator identifiers. Clean.

## Summary

The multi-operator coordination substrate (hooks + validator + `/whoami` command) was synced
into this template, but its required JSON-Schema file — `.claude/operators.roster.schema.json`
— was **not** included. The validator that every roster operation depends on therefore fails
closed on every input, so an operator can never enroll a trust root, and the
`genesis-anchor-guard` fail-closes every `git`-mutation in the repo.

## Affected surface (template substrate — all present EXCEPT the schema)

| File                                          | State (verified 2026-05-27, live filesystem)   |
| --------------------------------------------- | ---------------------------------------------- |
| `.claude/hooks/lib/roster-schema-validate.js` | PRESENT                                        |
| `.claude/hooks/genesis-anchor-guard.js`       | PRESENT                                        |
| `.claude/commands/whoami.md`                  | PRESENT                                        |
| `.claude/operators.roster.schema.json`        | **ABSENT** ← the gap                           |
| `.claude/operators.roster.json`               | ABSENT (expected — no roster until enrollment) |

## Root cause (citations resolve against the live tree)

1. `roster-schema-validate.js:56-61` — `SCHEMA_PATH = path.join(__dirname, "..", "..",
"operators.roster.schema.json")`, i.e. `.claude/operators.roster.schema.json`.
2. `roster-schema-validate.js:64-70` — `loadSchema()` does
   `if (!fs.existsSync(SCHEMA_PATH)) throw new Error("schema not found at …")`.
3. `roster-schema-validate.js:228-235` — `validate(roster)` wraps `loadSchema()` in
   try/catch and on throw returns `{ valid: false, errors: ["…schema not found…"] }` for
   **ANY** input. With the schema absent, `validate()` is unconditionally invalid.
4. `/whoami --register` round-trips a proposed roster edit through `validate()` before push
   (per the validator's own header, invariant 2) → it can never produce a valid roster →
   `--enroll-genesis` cannot complete → no trust root is ever established.
5. `genesis-anchor-guard.js` is fail-closed by design ("no roster, no verifiable trust
   root") → it blocks every `git`-mutation.

## Evidence (this session)

- `ls .claude/operators.roster.schema.json` → No such file or directory (the gap).
- `genesis-anchor-guard` fired and blocked a Bash command this session because the command
  string contained the substring `git commit` — `[BLOCK] genesis-anchor-guard — operators
roster missing; trust root not established`. (Lexical match: the commit it guarded was a
  throwaway container-internal verification, not a repo commit — a separate over-broad-match
  observation, see "Secondary observation" below; the BLOCK itself is the correct fail-closed
  behavior given the absent trust root.)
- The dev-container workstream's M1–M4 deliverables consequently could not be committed and
  ride loom adoption (F2/M5) for landing instead.

## Acceptance criteria (testable, scoped to the substrate surface)

- [ ] `.claude/operators.roster.schema.json` ships with the multi-operator substrate in every
      consumer repo that receives `roster-schema-validate.js` / `genesis-anchor-guard.js`.
- [ ] `require(".claude/hooks/lib/roster-schema-validate.js").validate(<a valid roster>)`
      returns `{ valid: true, errors: [] }` (schema loads + a conformant roster passes).
- [ ] `/whoami --register --enroll-genesis` completes and produces a roster that validates.
- [ ] After enrollment, a `git commit` succeeds (guard passes with a trust root present).
- [ ] The schema is declared in loom's `sync-manifest.yaml` substrate set so it cannot drift
      out of the synced file list again (regression lock — this gap's structural fix).

## Fix (loom-side — NOT this repo)

The schema is a loom-owned substrate file. Loom must (a) add/restore
`.claude/operators.roster.schema.json` to the multi-operator substrate source, and (b) ensure
it is in the synced file set in `sync-manifest.yaml` (the F14 M9.3 sync shipped the consumers
of the schema but not the schema itself — likely a manifest membership omission). Per
`repo-scope-discipline.md` this template repo MUST NOT author the schema ad-hoc — an
unvalidated trust-root schema would corrupt the substrate; it must come from loom.

## Secondary observation (lower severity — for loom triage, not blocking)

`genesis-anchor-guard` matches the `git commit` substring in the raw Bash command string, so
it fail-closes even on a container-internal throwaway commit (e.g. a verification walk running
`git commit -S` inside a `docker run … bash -c '…'` against a `/tmp` repo). Per
`hook-output-discipline.md` MUST-2 (lexical regex → not `block`), loom may want to scope the
guard to repo-targeting git mutations rather than any `git commit` substring. Recorded for
loom; the primary finding above stands on its own.
