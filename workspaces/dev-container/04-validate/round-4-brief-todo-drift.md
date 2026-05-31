# Round 4 — Brief, Plan, Todo Drift Re-Audit (Post Fix-Shard)

**Date:** 2026-05-29
**Mission:** Re-validate the 15-file fix-shard that landed on `feat/dev-container` against the 12 HIGH findings from Round 3.

**Verdict:** **0 CRIT, 0 HIGH, 0 MED.** All 12 Round-3 HIGH findings CLOSED. Zero new regressions introduced by the rewrite. Round 4 PASSES.

## Sweep 1 — Brief closure (`briefs/00-user-brief.md`)

| Round-3 finding | Status | Evidence |
| --- | --- | --- |
| HIGH-B1 — Success-signal sentence asserted "base image is repo-template-owned (regenerated on /sync)" — false under Architecture B | **CLOSED** | Lines 60-67 rewritten: "The base image is publisher-built and pulled from a public registry"; consumer-shipped pointers regenerate on `/sync`; project-owned overlay survives. Matches Architecture B verbatim. |
| HIGH-B2 — § Known constraints silent on Docker-Hub publication surface | **CLOSED** | Lines 96-107 added § Publish pipeline (workflow path, repo name, first manifest 0.1.0 multi-arch + sha256, PUBLIC visibility) + § Tag-pin discipline (digest-pin pattern). |
| HIGH-B3a — `docker-compose.yml` still had `build:` + local-build pattern | **CLOSED** | Line 17 now: `image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}`; `build:` block commented as opt-in template-developer escape hatch. |
| HIGH-B3b — `.devcontainer/devcontainer.json` still had `build:` directive | **CLOSED** | Line 17 now: `"image": "docker.io/terrenefoundation/kailash-coc-py:0.1.0"`; `remoteUser: dev`, `updateRemoteUserUID: true` retained. |

NEW § "Architecture decision: registry distribution" (lines 69-78) explicitly cites the journal/0003 verbatim quote "By coupling to loom, it kills productivity." — closes the value-anchor surface required by `value-prioritization.md` MUST-1 + MUST-6. No new STALE / NEW-GAP introduced.

## Sweep 2 — Plan closure (`02-plans/01-architecture.md`)

| ID | § | Status | Spot-check evidence |
| --- | --- | --- | --- |
| HIGH-P1 | §0 overview | **CLOSED** | §0 decision 4 added (lines 22-30): names "Architecture B (2026-05-28 pivot)" + verbatim quote from journal/0003 + "SUPERSEDES the prior Architecture-A framing throughout this plan". |
| HIGH-P2 | §2 ownership | **CLOSED** | Table now has 3 ownership classes (publisher-internal / consumer-shipped / project-owned). Dockerfile correctly listed as publisher-internal. |
| HIGH-P3 | §3 image | **CLOSED** | Header now reads "publisher build recipe — provenance only for consumers" (line 64). Body explicitly states consumers do NOT execute; they `docker pull`. |
| HIGH-P4 | §5 entry surfaces | **CLOSED** | Heading rewritten to "one registry image, three doors" (line 108). All three doors reference `terrenefoundation/kailash-coc-py:<version>`; `build:` retained as opt-in escape hatch only. |
| HIGH-P5 | §8 shard map | **CLOSED** | Shard map now has S1..S6. S5 = `.github/workflows/publish-dev-image.yml` (multi-arch buildx + Docker Hub push on git tag). S6 = OPTIONAL cross-repo follow-up, narrowed. |
| HIGH-P6 | §9 corrections cadence | **CLOSED** | R4 (line 226-232) rewritten: "image bump rides the git-tag cadence of the publish workflow, not the /sync regeneration cadence". |
| HIGH-P7 | §10 risks | **CLOSED** | NEW §11 added (lines 234-255) with R-B1..R-B5 (tag-trust, publisher-vs-consumer build-context, registry availability, public-image scrub, image-signing/SBOM provenance). |
| HIGH-P8 | user-flow refs | **CLOSED** | Verified inline at Sweep 4 below: Flow A step 3, Flow B step 2, Flow D rewritten to registry-pull narrative. |
| HIGH-P9 | publish workflow refs | **CLOSED** | §0 decision 4, §3 header, §8 S5, §9 R4, §11 R-B4 all cite `.github/workflows/publish-dev-image.yml`. |
| HIGH-P10 | image-signing/SBOM | **CLOSED** | §11 R-B5 names sigstore/cosign + syft as the future-tracker surface (tracked outside spec per `spec-accuracy.md` Rule 4 — work tracker, not spec gap). |

## Sweep 3 — Todo closure (`todos/active/05-cross-repo-followup.md`)

- (a) Value-anchor cites journal/0003 verbatim: **YES** — lines 5-11 quote "By coupling to loom, it kills productivity" as value-anchor per `value-prioritization.md` MUST-2 + MUST-6.
- (b) Sub-path A and Sub-path B presented as recommendations: **YES** — both labeled "RECOMMENDED if loom-coupling is acceptable" / "RECOMMENDED if loom-coupling is the productivity tax the user rejected". Each surfaces implications + pros/cons per `recommendation-quality.md` MUST-1+2+3.
- (c) M5-registry SHRUNK scope: **YES** — title renamed `M5-registry`; § "What changed at the 2026-05-28 pivot" (lines 16-26) explicitly names the scope reduction (Dockerfile no longer ships via /sync as consumer artifact). No Dockerfile-as-consumer-artifact framing remains.

## Sweep 4 — User-flow closure (`03-user-flows/01-developer-onboarding.md`)

Flow A step 3 (line 12) rewritten: "first run pulls the published image from Docker Hub". Flow B step 2 (line 34) cites devcontainer registry-pull. Flow D (lines 56-70) rewritten as "registry tag bumps via /sync". NEW failure-mode walks added: "Registry unreachable (post-pivot NEW)" + "Tag-pin drift in derivative Dockerfile.user (post-pivot NEW)" (lines 82-89).

## Cross-CLI hygiene sweep (`cross-cli-artifact-hygiene.md` MUST-1..5)

Mechanical grep against rewritten fix-shard files (brief / plan / user-flows / todo):

- `Agent(subagent_type=` / `Agent({subagent_type` — **0 hits** in rewritten files.
- `run_in_background=true/True` — **0 hits**.
- `Read tool` / `Edit tool` / `Bash tool` / `Write tool` — **0 hits**.
- `per CLAUDE.md` / `per AGENTS.md` / `per GEMINI.md` / `MUST run under Claude Code` — **0 hits**.
- `SessionStart` / `PreToolUse` / `PostToolUse` / `UserPromptSubmit` / `PreCompact` — **0 hits** in rewritten files. Two pre-existing `PostToolUse` mentions in `01-analysis/01-research/01-runtime-inventory.md:121` + `04-validate/round-2-closure-and-gaps.md:75` are NOT in fix-shard scope and are descriptive historical citations of a hook lifecycle moment.

**Zero leakage introduced by the rewrite.** Cross-CLI hygiene PASSES.

## Recommendation-quality sweep (`recommendation-quality.md` MUST-1..5)

Todo `05-cross-repo-followup.md` § "Two sub-paths under Arch B" presents Sub-path A vs Sub-path B as **recommendations** (each labeled RECOMMENDED with named applicability clause), with implications, and honest tradeoffs (Sub-path A preserves `/sync` preserve-glob guarantees; Sub-path B decouples from loom at the cost of no `/sync` preserve guarantees). NOT a bare menu. PASSES MUST-1+3.

## Spec-accuracy sweep (`spec-accuracy.md`)

Mechanical regex scan against brief / plan / user-flows / todo for Phase-1/Phase-2, Promised/Current, TBD, scaffold-later, accessor-pending, FE/BE follow-up markers: **0 hits in fix-shard scope**.

No Architecture A residue. No split-state framings. Plan §0 explicitly names "SUPERSEDES the prior Architecture-A framing throughout this plan" so prior references are framed as historical, not split-state.

## Verdict

**Round 4 PASSES — zero HIGH, zero MED, zero CRIT.** All 12 Round-3 HIGH findings (HIGH-B1..B4, HIGH-P1..P10, HIGH-T1) CLOSED. Zero new regressions introduced by the 15-file fix-shard. Ready to proceed to commit when loom#379 commit-guard unblocks.
