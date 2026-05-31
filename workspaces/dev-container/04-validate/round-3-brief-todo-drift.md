# Round 3 — Brief, Plan, Todo Drift Audit (Post-Pivot)

**Date:** 2026-05-29
**Mission:** Three drift sweeps against the 2026-05-28 Architecture B pivot (image LIVE on Docker Hub as `terrenefoundation/kailash-coc-py:0.1.0+:latest`). Round-2 verdict was READY-for-/todos but predates the pivot.

**Verdict:** **0 CRIT, 12 HIGH, 4 MED.** All HIGH findings are stale Architecture-A artifacts that the pivot made obsolete but never propagated to disk.

## Sweep 1 — Brief drift (`briefs/00-user-brief.md`)

### HIGH-B1 — Success-signal sentence lines 59-60 is the load-bearing stale text

- Current: "The base image is repo-template-owned (regenerated on `/sync`), but the user's overlay is project-owned and survives `/sync`."
- Under Architecture B this is FALSE — the base is registry-pulled, not sync-regenerated.
- Fix: rewrite to "The base image is publisher-built and pulled from a registry (`terrenefoundation/kailash-coc-py:<version>`); template-distributed compose/devcontainer/bin/dev/README pin the registry tag and survive `/sync`; project-owned overlays survive `/sync`."

### HIGH-B2 — § Known constraints silent on new Docker-Hub publication surface

- Add: the publish workflow lives in `.github/workflows/publish-dev-image.yml`; Docker Hub repo `terrenefoundation/kailash-coc-py` is the canonical distribution channel; consumer-side `docker pull` is the install path.

### HIGH-B3a — `docker-compose.yml:10-19` still has `build: { context: ., dockerfile: Dockerfile }` + `image: kailash-coc-dev:local`

- Contradicts Architecture B. Under B, compose pulls the registry tag.
- Fix: `image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}`; preserve `build:` only as opt-in for template developers (commented out or behind a profile).

### HIGH-B3b — `.devcontainer/devcontainer.json:12-22` still has `"build": { "dockerfile": "../Dockerfile" }`

- Same drift; consumer forced to local-build.
- Fix: switch to `"image": "docker.io/terrenefoundation/kailash-coc-py:0.1.0"`.

## Sweep 2 — Plan drift (`02-plans/01-architecture.md`)

| ID       | §                          | Finding                                                                                                                   | Sev  |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---- |
| HIGH-P1  | §0 Architecture overview   | Assumes sync-distributed Dockerfile                                                                                       | HIGH |
| HIGH-P2  | §2 Ownership table         | Lists Dockerfile as "template-owned (overwritten by sync)" — false under B                                                | HIGH |
| HIGH-P3  | §3 Image construction body | Describes local-build invariants as consumer-visible; under B these are publisher-internal                                | HIGH |
| HIGH-P4  | §5 Entry surfaces          | `bin/dev` flow assumes build-on-first-run                                                                                 | HIGH |
| HIGH-P5  | §8 Shard map               | Shard S5 (loom proposal pipeline) structurally superseded — Dockerfile no longer sync-distributed                         | HIGH |
| HIGH-P6  | §9 Corrections             | Cadence claim "R4: rides loom `/sync`" — false; image bumps now ride git-tag cadence                                      | HIGH |
| HIGH-P7  | §10 Risks                  | Missing post-pivot risks: tag-trust drift, publisher-vs-consumer build-context divergence, registry availability          | HIGH |
| HIGH-P8  | §3 + §5 user-flow refs     | User flow Flow A step 3 + Flow D inherit Architecture-A framing                                                           | HIGH |
| HIGH-P9  | All §§                     | Plan body never references the Docker Hub publish workflow / multi-arch manifest / digest-of-record                       | HIGH |
| HIGH-P10 | NEW-GAP                    | Plan never discusses image-signing / SBOM provenance under Arch B (registry-distributed images warrant a signing surface) | HIGH |

## Sweep 3 — Todo M5 drift (`todos/active/05-cross-repo-followup.md`)

### HIGH-T1 — M5 entirely structurally superseded by the pivot

- Current M5 scope: cross-repo /codify proposal for loom to ship the Dockerfile via /sync + declare preserve-globs.
- Under Architecture B: the Dockerfile no longer ships via loom; only the overlay-glob proposal (preserve project-owned `*-user.*`, `compose.override.yml`, `Dockerfile.user`) remains potentially needed — and only if compose+devcontainer+bin/dev+README+`.dockerignore` are to flow through `/sync` at all.

### M5 disposition recommendation (per `value-prioritization.md` MUST-1)

**Recommend: REWRITE M5 IN PLACE as M5-registry.** Do NOT split into M5a/M5b.

**Anchor (closed-allowlist source d — user verbatim quote):** `workspaces/dev-container/journal/0003-DECISION-cross-repo-authorized-close-loom-384.md:42`: "By coupling to loom, it kills productivity."

**Rationale:** splitting into M5a (in-repo brief/spec/config rewrite) and M5b (cross-repo loom proposal) preserves a loom coupling the user explicitly rejected. The cross-repo loom proposal becomes OPTIONAL — only needed if operator wants compose/devcontainer/postCreate/bin/dev/.dockerignore to flow through `/sync` with overlay-only preserve-globs. The pivot's stated value is decoupling.

**Honest con:** splitting would give parallel-lane flexibility. Recommendation accepts that loss for cleaner alignment with the pivot's stated value.

**New M5-registry scope:**

1. In-repo F4 work (15 edits, one shard): brief + plan + sync-ownership.md + dev-container-image.md + secrets-and-auth.md + \_index.md + compose + devcontainer.json + README + Dockerfile.user.example + .dockerignore + active todo rewrite
2. NEW sub-shard B: `.github/workflows/publish-dev-image.yml` (multi-arch buildx + Docker Hub push on git tag)
3. OPTIONAL cross-repo: a SHRUNK loom proposal for the remaining sync-distributed surface (compose, devcontainer, bin/dev, README, `.dockerignore`) IF operator wants those to flow through `/sync` with overlay-only preserve-globs. Else: project-by-project hand-managed.

## F4 in-repo deliverable enumeration (lands NOW uncommitted)

15 file edits, ≤5 invariants, ≤2 call-graph hops — WITHIN one-shard budget per `autonomous-execution.md` MUST Rule 1:

1. `briefs/00-user-brief.md` — success-signal rewrite + § Known constraints append (B1+B2)
2. `02-plans/01-architecture.md` — §0/§2/§3/§5/§8/§9/§10 amendments (P1–P10)
3. `03-user-flows/01-developer-onboarding.md` — Flow A step 3 + Flow D rewrite (P8)
4. `specs/sync-ownership.md` — ownership classes + G1–G4 rewrite (specs-authority Rule 5b sister-spec re-derivation)
5. `specs/dev-container-image.md` — reframe §§1–7 as "Publisher build recipe (provenance)" + NEW § Image acquisition (consumer-side invariants)
6. `specs/secrets-and-auth.md` — add invariant S5 (full `.dockerignore` gate)
7. `specs/_index.md` — brief traceability matrix row for "Image acquisition"
8. `docker-compose.yml` — switch to `image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}` (B3a)
9. `.devcontainer/devcontainer.json` — switch to `"image":` (B3b)
10. `.devcontainer/postCreate.sh` — add `~/.gitconfig` OPT-IN stage (security MED-2)
11. `.dockerignore` — append overlay-exclusion block (security HIGH-1, HIGH-2, MED-1, LOW-1)
12. `README.md` — §"Launch" + §"Dev Environment" rewrite for registry-pull narrative (spec-compliance H3-5)
13. `Dockerfile.user.example` — FROM line update to registry tag
14. `todos/active/05-cross-repo-followup.md` — rewrite as M5-registry
15. `bin/dev` — add `docker pull` pre-flight + image-presence check (spec-compliance M3-4)

**Sub-shard B (optional, can land same session):** `.github/workflows/publish-dev-image.yml` (~80 LOC, multi-arch buildx + Docker Hub push on git tag).

## What stays cross-repo blocked

- loom#379 (commit-guard / missing roster schema) — orthogonal to F4 deliverable; blocks commit of these edits, NOT the edits themselves
- loom#385 (Codex emitter — F5 in session-notes) — orthogonal to F4 Docker pivot
- loom#384 — already CLOSED 2026-05-28 as superseded (receipt journal/0003)

## Verdict

**NOT-BLOCKING for in-repo F4 progression.** The 15 edits collapse into one shard; the GHA workflow is an independent second sub-shard. Recommend landing both uncommitted on `feat/dev-container` today; when loom#379 unblocks commit-guard, commit + PR as `feat(dev-container): pivot to registry-distributed image`.
