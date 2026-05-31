---
type: DECISION
date: 2026-05-28
requester: user (display: jack-hong)
target: esperie-enterprise/loom
action: gh issue create (×2) — Issue A (dev-container adoption) + Issue B (Codex emission gaps)
verbatim_instruction: "please file all required issues by loom to loom gh issues"
cross-repo-authorized: esperie-enterprise/loom
---

# Pre-Action Receipt — Authorized Cross-Repo Filings (Issues A + B)

Per `rules/repo-scope-discipline.md` User-Authorized Exception, all five conditions
hold for this cross-repo action:

1. **User-initiated.** Genuine user turn 2026-05-28 (verbatim above).
2. **Explicit + specific.** User named the target ("loom gh issues") and the action
   class ("file all required issues"). Required set was enumerated by the session
   from the active dev-container forest + the open in-repo issue #28 backlog
   (cross-checked against `gh issue list --repo esperie-enterprise/loom --search ...`
   — neither counterpart exists at loom yet).
3. **Confirmed.** Both issue bodies presented inline to the user with full scrub
   per `upstream-issue-hygiene.md` MUST-2; user approved each via per-issue gate
   ("Approve as-is" × 2) before this receipt landed.
4. **Journaled before acting.** This file. Lands BEFORE the `gh issue create`
   commands run.
5. **Scoped exactly.** Two `gh issue create` calls against
   `esperie-enterprise/loom` ONLY. No reads of other loom paths, no additional
   sibling repos touched.

## Required-set derivation

- **Issue A — dev-container adoption + preserve-globs.** Counterpart of the
  in-repo cross-repo follow-up at `todos/active/05-cross-repo-followup.md`
  (workstream value-anchor: brief — "base repo-template-owned, overlay survives
  /sync"; spec `sync-ownership.md` G1–G4). Not actionable from this repo per
  `repo-scope-discipline.md` (loom-side template edit). Not yet filed at loom.
- **Issue B — Codex emission gaps.** Counterpart of in-repo issue #28
  (Codex CLI 0.128+ breakage: `/prompts:<name>` deprecated upstream by OpenAI,
  `.codex/developer-instructions/` referenced by wrappers but never emitted,
  `bin/coc` dispatcher not shipped). Fix lives in loom's emitter
  (`emit-cli-artifacts.mjs` / wrappers / synced docs). Not actionable from this
  repo. Not yet filed at loom.

## Scrub posture (per `upstream-issue-hygiene.md` MUST-2)

Both bodies scrubbed for:

- ✅ No downstream project name — "downstream USE-template consumer" framing matches
  the existing loom#379 shape.
- ✅ No internal file paths outside loom's own surface — loom-internal references
  (`sync-manifest.yaml`, `.claude/bin/emit.mjs`, `.claude/wrappers/*.sh.template`)
  are loom's own artifact surface and ARE the relevant API.
- ✅ No workspace identifiers (`workspaces/dev-container/...`, `.session-notes`,
  `.proposals/...` excluded).
- ✅ No finding tags (F2 / F3 / S5 / M1–M5 redacted).
- ✅ No session timestamps tied to consumer work.
- ✅ No "Origin: <consumer-app>" footer.

## Acceptance plan

After both `gh issue create` calls succeed, this entry is updated with the
resulting issue URLs (one-time, on this same codify branch) to close the
receipt loop. If either filing fails, this entry records the failure mode
and the issue is not retried this session without a fresh user gate.

## Filed URLs

(populated post-filing)

- Issue A: PENDING
- Issue B: PENDING
