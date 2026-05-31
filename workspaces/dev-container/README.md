# Workspace — Dockerized Development Environment

The COC workstream that produced the `terrenefoundation/kailash-coc-py` dev container. Started 2026-05-27 from a user brief, pivoted 2026-05-28 from a locally-built Dockerfile (Architecture A) to a registry-published image (Architecture B), reached `/redteam` convergence at R6 (0 CRIT, 0 HIGH across three consecutive rounds).

This README is the entry point for the workspace. Read the brief first, then the architecture plan, then the specs.

## Quick links

| Phase             | File                                       | What it covers                                                                     |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Brief**         | `briefs/00-user-brief.md`                  | Verbatim request, scope, success signals, post-pivot constraints (Architecture B)  |
| **Analysis**      | `01-analysis/01-research/`                 | Runtime inventory + Docker patterns + extensibility patterns                       |
| **Plans**         | `02-plans/01-architecture.md`              | Architecture B design (publisher-built image, consumer-shipped pointer configs)    |
| **User flows**    | `03-user-flows/01-developer-onboarding.md` | Three flows — Flow A (`bin/dev`), Flow B (Dev Containers editor), Flow C (app dev) |
| **Specs**         | `specs/_index.md`                          | Index of the 4 domain specs (image, overlay, secrets, sync ownership)              |
| **Todos**         | `todos/active/`, `todos/completed/`        | In-flight + closed work items; M-task numbering across the architecture plan       |
| **Validate**      | `04-validate/round-*-*.md`                 | Six rounds of `/redteam` evidence, converged at R6 (verdict file in this dir)      |
| **Codify**        | `05-codify/01-substrate-gap-finding.md`    | F3 finding (cross-repo COC-artifact proposal — ready to file via `/codify`)        |
| **Journal**       | `journal/0001…0003-DECISION-*.md`          | Cross-repo-authorized decision receipts (loom issues / loom#384 close)             |
| **Session state** | `.session-notes`                           | Latest read-on-resume context — what's in-flight, what's blocked, traps            |

## What this workspace shipped

- **Publisher recipe** — `Dockerfile` + `requirements-coc.txt` + `requirements-coc-ml.txt` at the repo root (multi-arch buildx input).
- **Publish workflow** — `.github/workflows/publish-dev-image.yml` (tag-triggered, multi-arch amd64+arm64, provenance + SBOM, Docker Hub README auto-sync).
- **PR-time hygiene** — `.github/workflows/docker-build.yml` (build + smoke-test I1/I2/I4/I7/I8 invariants + secret scan on PRs that touch Docker files).
- **Consumer-shipped configs** — `docker-compose.yml`, `.devcontainer/devcontainer.json`, `.devcontainer/postCreate.sh`, `bin/dev`, `.dockerignore` (all reference the published image; no local build on first run).
- **Overlay surface** — `Dockerfile.user.example`, `compose.override.yml.example`, `requirements-user.txt`, `.devcontainer/postCreate.user.sh.example` (project-owned escape hatches preserved across `/sync`).
- **Docker Hub overview** — `DOCKERHUB.md` at repo root (source-of-truth for the hub.docker.com Overview panel; synced by the publish workflow).
- **README narrative** — repo-root `README.md` § "Development Environment (Docker)" carries the consumer-facing quick start.

## Architecture B in one sentence

Publisher builds `terrenefoundation/kailash-coc-py:<X.Y.Z>` on Docker Hub via the publish workflow; consumers `docker pull` from the registry on first `./bin/dev` — no local build, no Dockerfile execution on the consumer side. The image tag tracks `.claude/VERSION::version` (currently `1.10.1`).

The original 2026-05-28 manifest digest is `sha256:c62467b3…` (published under tag `0.1.0`, retained for provenance). Going forward, every COC template version bump cuts a corresponding image release.

## Convergence status

| Round | Verdict    | Method                                                               |
| ----- | ---------- | -------------------------------------------------------------------- |
| R1    | findings   | Initial analysis + brief drift sweep                                 |
| R2    | findings   | Closure + consistency-citation sweeps                                |
| R3    | findings   | Brief-todo drift + security-secrets + spec-compliance (post-pivot)   |
| R4    | **0 HIGH** | Closure-table for all 21 R3 HIGH + F4 fix-shard 16-deliverable scope |
| R5    | **0 HIGH** | Independent re-derivation + live walk-receipt against registry image |
| R6    | **0 HIGH** | Parallel 3-agent re-verification + in-shard MED-1/LOW-1 fix          |

**Converged at R6.** See `04-validate/round-6-verdict.md` for the receipt.

## Outstanding cross-repo work

| ID  | Item                                                                                          | Status                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F4  | Architecture-pivot follow-ups — commit + PR + tag publish                                     | Edits ready; awaiting commit (loom#379 was replaced by loom#400 / F72 genesis-guard fix per `b2aec80`) |
| F3  | Multi-operator substrate proposal — codify finding drafted                                    | Ready to file via `/codify` → loom Gate-1 → `/sync` (route per `rules/artifact-flow.md`)               |
| F5  | Codex emitter unshipped (`.codex/developer-instructions/`, `bin/coc`, `/prompts` deprecation) | BLOCKED — loom-side emitter fix (loom#385)                                                             |

## How to read the validate rounds

Each round's findings file documents what was checked + the disposition. Verdict files (`round-N-verdict.md`) are the convergence receipts — a round is "clean" when verdict reports 0 CRIT + 0 HIGH. R4+R5+R6 are the three consecutive clean rounds that satisfy `/redteam`'s convergence criterion.

## Conventions used in this workspace

- **F-series** (F1, F2…) — workstreams / fix-shards traced through `/todos` and journal entries
- **M-series** (M1, M2…) — todos within a workstream
- **I-series** (I1–I10) — domain invariants enumerated in `specs/dev-container-image.md`
- **S-series** (S1–S5) — security invariants enumerated in `specs/secrets-and-auth.md`
- **G-series** (G1–G4) — sync-ownership guarantees in `specs/sync-ownership.md`
- **C-series** (C1, C2…) — compose/DB invariants
- **R-series** (R-B1, R-B2…) — post-pivot risks documented in `02-plans/01-architecture.md`

## Resume-from-cold checklist

A new session reading this workspace should:

1. Read `briefs/00-user-brief.md` for the user's verbatim request + post-pivot constraints.
2. Read `02-plans/01-architecture.md` for the Architecture B design.
3. Read `specs/_index.md` and follow into whichever spec is in scope.
4. Read `.session-notes` for the most recent in-flight state.
5. Check `todos/active/` for what remains; `todos/completed/` for what shipped.
6. If validating: walk the verdicts under `04-validate/` in numerical order; R6 is the latest.

For the cross-repo proposal flow (F3 / loom Gate-1), read `journal/0003-DECISION-*` for the user-verbatim "coupling to loom kills productivity" anchor that drove the Architecture-A → B pivot.
