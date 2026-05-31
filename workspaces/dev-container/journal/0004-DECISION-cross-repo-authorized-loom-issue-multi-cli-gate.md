---
type: DECISION
date: 2026-05-31
requester: user (display: jack-hong)
target: esperie-enterprise/loom
action: gh issue create against esperie-enterprise/loom — title "feat(emit): multi-CLI completeness + translation + efficacy gate — rules + hooks emit drift"
verbatim_instruction: "approved" (in response to "One last y/n: file as drafted above against esperie-enterprise/loom?")
cross-repo-authorized: esperie-enterprise/loom
---

# Pre-Action Receipt — Authorized Filing of Multi-CLI Emission Gate Issue

Per `rules/repo-scope-discipline.md` User-Authorized Exception, all five
conditions hold:

1. **User-initiated.** Genuine user turn 2026-05-31. User reframed F5 from
   "Codex emitter broken" to the broader structural defect: "the multi-CLI
   broken state ... Developers creating new artifacts in loom does not seem
   to trigger loom from creating multi-cli artifacts and testing their
   efficacy and completeness." Verbatim approval "approved" lands AFTER a
   restated y/n on the exact title + body + target repo.
2. **Explicit + specific.** Target named: `esperie-enterprise/loom`
   (verified by `gh api repos/esperie-enterprise/loom` as existing and
   accepting issues; `terrene-foundation/loom` confirmed 404). Bounded
   action: a single `gh issue create`. No other repo touched; no other
   issue affected.
3. **Confirmed.** Agent restated the final adjusted body + exact `gh`
   command + single y/n question before this receipt landed.
4. **Journaled before acting.** This file. Lands BEFORE the `gh issue
create` command runs.
5. **Scoped exactly.** Single `gh issue create` against
   `esperie-enterprise/loom` only. No incidental reads outside the
   pre-filing verification reads (cross-repo issue existence checks on
   #28, #385, #392, #407, #379 — all justified per
   `verify-resource-existence.md` MUST-1 as existence checks BEFORE
   recommending an action that targets those endpoints).

## Filing scope (sanitized)

The body uses neutral framing ("recently-synced consumer repo"); no
consumer-app name, workspace path, or finding tag is embedded per
`upstream-issue-hygiene.md` MUST-2. Slug-map values (`kailash-coc-py`/
`kailash-coc-rs`/`kailash-coc-rb`) appearing in the related `#407` cross-
reference are loom-owned template names, not third-party consumer
identifiers.

## Three-agent audit corpus (this filing's evidence base)

Parallel deep-dive verification per `agents.md` § MUST: Parallel
Brief-Claim Verification When Issue Count ≥ 3 (the brief carried four
distinct claim clusters: commands emission, rules emission, skills/
agents/hooks emission, plus the structural-gate proposal). All three
agents returned independent grep-citable findings; conclusions are
cross-verified.

- Agent A (commands lane): 35 source / 56 Codex emits (22 specialist
  orphans) / 34 Gemini emits; `cc-audit` silently dropped on both lanes.
- Agent B (rules baseline): 63 source / 9 in AGENTS.md / 9 in GEMINI.md;
  54 path-scoped rules silently dropped on both lanes; CLAUDE.md Rules
  Index drift (4 entries).
- Agent C (skills/agents/hooks): hook-registration frozen at 3 of 31
  source hooks on both non-CC lanes; skills lane byte-copy with no CC-
  syntax scrub; agents lane structurally healthy except 1 missing on
  Gemini (`infrastructure-specialist`).

## Filing decisions explicit

- **NOT filing the F6 VERSION-drift issue** — already filed by the user
  himself as loom#407 (OPEN), title: "version-utils.js: multi-CLI USE
  templates mis-corrected coc-use-template → coc-project every session".
  Duplicate filing BLOCKED per `upstream-issue-hygiene.md` MUST-1
  rationalization corpus. The user retains the option to bump #407 with
  a comment (held for separate gate next turn).
- **Cited loom#385 as related-and-superseded-in-scope** — closed
  `COMPLETED` 2026-05-28 via merged PR #394; consumer-side symptoms
  still reproduce 3+ days post-merge, which is itself surfaced in the
  new issue as the strongest evidence for the post-merge consumer-side
  efficacy gate (the new acceptance criterion that was NOT present in
  #385's scope).
- **Cited loom#392 as related-adjacent** — unified `.coc/` derivative
  emission proposal, OPEN. May interact with the gate-class structure
  this issue proposes; maintainer judgment.

## Filing result

(populated post-filing)
