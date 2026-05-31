---
type: DECISION
date: 2026-05-28
requester: user (display: jack-hong)
target: esperie-enterprise/loom
action: gh issue close 384 --reason "not planned" (with strategic-pivot comment)
verbatim_instruction: "approved" (in response to "Confirm: close loom #384 now?")
cross-repo-authorized: esperie-enterprise/loom
---

# Pre-Action Receipt — Authorized Close of loom#384 (Architecture Pivot)

Per `rules/repo-scope-discipline.md` User-Authorized Exception, all five
conditions hold:

1. **User-initiated.** Genuine user turn 2026-05-28 ("approved" — verbatim).
2. **Explicit + specific.** Target named (esperie-enterprise/loom). Bounded
   action: close issue 384. No other issue affected; no other repo touched.
3. **Confirmed.** Agent restated "close loom #384 now?" — user replied
   "approved" before this receipt landed.
4. **Journaled before acting.** This file. Lands BEFORE the `gh issue close`
   command runs.
5. **Scoped exactly.** Single `gh issue close 384` against loom only.

## Value-decay rationale (per `value-prioritization.md` MUST-4)

Closure type: **superseded** (strategic-pivot value-decay), NOT stale-triage
auto-close. User-gated explicitly.

The original loom#384 ask was to adopt dev-container Dockerfile/compose text
into loom's template source so `/sync` could distribute it with preserve-glob
rules. The user pivoted the distribution architecture in this session:

- **From:** sync-based text distribution (Dockerfile flows through loom /sync
  to every consumer; each consumer builds the image locally).
- **To:** registry-based image distribution (Dockerfile lives in the producing
  repo; a build pipeline publishes a built OCI image to a configurable
  registry; consumers pull the image).

The user's stated reason (verbatim): "By coupling to loom, it kills productivity."

Under the registry-based architecture, loom no longer needs to learn about
Docker at all; the preserve-glob complexity (`(...) AND NOT *.example`)
becomes irrelevant; every Dockerfile change ships on its own clock rather
than waiting on a loom-side sync cycle.

The brief's success signal that originally motivated loom adoption
("the base image is repo-template-owned, regenerated on /sync") is being
explicitly superseded in this session by user direction. A follow-up brief +
spec update in this repo will record the new architecture (queued behind
loom#379's commit-guard fix).

## Close-comment scrub posture (per `upstream-issue-hygiene.md` MUST-2)

The close comment is a new public-readable artifact and is scrubbed:

- ✅ No downstream project name (uses "producing repo" / "consumer" framing).
- ✅ No internal workspace paths.
- ✅ No finding tags (F2 / M5 redacted).
- ✅ No session timestamps tied to consumer work.

## Remaining open loom issues for this repo

- **#379** — schema-ship (commit-guard blocker). STILL REAL — unrelated to
  Docker; affects every commit attempt in this repo regardless of
  architecture choice.
- **#385** — Codex emission gaps (per the same session's filing). STILL
  REAL — unrelated to Docker.

## Close result

(populated post-close)
