# Round 3 — Spec Compliance Audit (Post-Pivot)

**Date:** 2026-05-29
**Mission:** AST/grep-verify every spec promise against on-disk artifacts per `skills/spec-compliance/SKILL.md`. Workspace pivoted 2026-05-28 from Architecture A (sync-distributed Dockerfile) to Architecture B (registry-published `terrenefoundation/kailash-coc-py:0.1.0+:latest`, multi-arch, manifest `sha256:c62467b3…`). Re-derived from scratch — no prior `.spec-coverage` trusted.

**Verdict:** **BLOCK. 7 HIGH findings.** The Architecture B pivot exists only in the user-brief; zero load-bearing code/config implements it. Compose + bin/dev still build local image (`kailash-coc-dev:local`); no GHA publish workflow; specs still describe Architecture A invariants; README still teaches build-on-first-run.

## Critical sweep results (verbatim)

| Sweep                                | Cmd                                                                                                                                                            | Output                                                                                                                                                         | Verdict                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Digest-pinning (I1/H1)               | `grep -E "@sha256:" Dockerfile`                                                                                                                                | 3 hits (lines 11/14/17 — node, uv, python)                                                                                                                     | PASS (local build)                                                                                            |
| CLI pin (I1)                         | `grep -E "@anthropic-ai/claude-code\|@openai/codex\|@google/gemini-cli" Dockerfile`                                                                            | lines 81-83: `@2.1.152`, `@0.134.0`, `@0.43.0` (all exact-pinned)                                                                                              | PASS                                                                                                          |
| Baked frameworks                     | `grep -E "^(kailash\|kailash-)" requirements-coc.txt`                                                                                                          | kailash==2.26.2, kailash-dataflow==2.10.0, kailash-nexus==2.6.3, kailash-kaizen==2.24.1, kailash-pact==0.12.0                                                  | PASS-with-caveat (no hash-lock)                                                                               |
| Non-root + venv ordering (N-M1)      | `grep -E "USER dev\|chown.*dev\|/opt/venv" Dockerfile`                                                                                                         | line 33: `VIRTUAL_ENV=/opt/venv`; line 74: `uv venv /opt/venv`; line 89: `chown -R dev:dev /opt/venv`; line 91: `USER dev` (chown BEFORE USER)                 | PASS                                                                                                          |
| Tini ENTRYPOINT (I6)                 | `grep -E "tini\|ENTRYPOINT" Dockerfile`                                                                                                                        | line 38 apt install tini; line 94: `ENTRYPOINT ["/usr/bin/tini","--"]`                                                                                         | PASS                                                                                                          |
| Compose DB (C1/I9)                   | `grep -E "DATABASE_URL\|postgres" docker-compose.yml`                                                                                                          | line 29: `DATABASE_URL: postgresql://...@postgres:5432/test`; lines 44-60: postgres service profile-gated `db`                                                 | PASS                                                                                                          |
| Secrets passthrough (S2)             | `grep -E "(SSH_AUTH_SOCK\|GPG\|gnupg\|ANTHROPIC\|OPENAI\|GOOGLE)" devcontainer.json docker-compose.yml bin/dev`                                                | devcontainer.json:35 `runArgs ["--env-file", ".env"]`; :52-55 opt-in SSH/GPG mounts (commented); compose.yml:26 `env_file: [.env]`; bin/dev:18 prompt env vars | PASS                                                                                                          |
| Dockerignore secret-exclusion (N-H1) | `grep -rE "(\.claude/learning\|\.git)" .dockerignore`                                                                                                          | lines 6-7: `.claude/learning/`, `.git`; lines 8-10: operator-id, fetch-cache, session-notes, witness                                                           | PASS (artifact) / **FAIL (spec)** — spec S1 doesn't enumerate; reviewer-recommended invariant S5 never landed |
| **Architecture-B registry pattern**  | `grep -E "terrenefoundation/kailash-coc-py\|sha256:c62467b3\|DEV_IMAGE_REGISTRY\|docker pull" Dockerfile docker-compose.yml bin/dev .devcontainer/* README.md` | **0 matches**                                                                                                                                                  | **FAIL — Architecture B unwired**                                                                             |
| Sync-ownership re-check              | read `sync-ownership.md` under Arch B                                                                                                                          | G1 (preserve overlay across sync) load-bearing; G2 (Base updates on sync) STALE — there is no sync-distributed Dockerfile under Arch B; G3/G4 load-bearing     | **STALE x1 (G2)**                                                                                             |

## HIGH findings

### H3-1 — Architecture-B publication surface is structurally absent (POST-PIVOT NET-NEW)

- **Citation:** `grep -rE "terrenefoundation/kailash-coc-py|sha256:c62467b3|DEV_IMAGE_REGISTRY|docker pull"` against all artifacts = 0 matches.
- **What's missing:**
  - No `.github/workflows/publish-dev-image.yml` (only `auto-merge.yml` + `validate.yml`)
  - `docker-compose.yml:21` pins `image: kailash-coc-dev:local` (local-build tag, not registry pull)
  - `bin/dev:30` runs `docker compose run --rm` (forces local build via `build:` context)
  - README §"Launch" still teaches `./bin/dev` builds-on-first-run
- **Fix:** wire registry-pull pattern into compose + bin/dev + README; add GHA workflow.

### H3-2 — Every spec section assumes Architecture A (POST-PIVOT DRIFT)

- **Citation:** `specs/dev-container-image.md` §1–§7 + I1–I9 + § Reproducibility describe local-build invariants.
- **Stale §s:** §1 OS tooling, §2 Node 22 LTS, §3 uv, §4 Three CLIs, §5 Single shared venv, §6 Non-root user, §7 Entrypoint, all I1–I9 (these are publisher-internal under Arch B), § Reproducibility (`--platform` opt-in irrelevant to consumer pulling a manifest).
- **Fix:** add § "Image acquisition" describing the published-image contract; reframe §§1–7 as "Publisher build recipe (provenance)"; add consumer-side invariants (registry available, manifest pull works, digest verifies).

### H3-3 — sync-ownership.md G2 is STALE (POST-PIVOT DRIFT)

- **Citation:** `specs/sync-ownership.md` § G2 "Base updates on sync" — under Arch B the Dockerfile is publisher-internal, not sync-distributed.
- **Also stale:** § Ownership classes lists `Dockerfile`, `requirements-coc.txt`, `bin/dev` as "template-owned (regenerated on /sync)" — under Arch B these become publisher-build-recipe artifacts. ONLY `compose.yml`/`bin/dev`/README + `.devcontainer/devcontainer.json` are sync-distributed (because they tell the consumer how to PULL); the Dockerfile itself is no longer a consumer-shipped file.
- **Fix:** rewrite § Ownership classes to split "publisher-internal" vs "consumer-shipped" vs "consumer-overlay". G3/G4 preserve-globs unchanged.

### H3-4 — Brief Traceability matrix is structurally inconsistent (POST-PIVOT DRIFT)

- **Citation:** `_index.md` Brief traceability matrix rows brief→spec under Arch A.
- **Fix:** add "Image acquisition" row pointing at the new publish-surface spec § (per H3-2).

### H3-5 — README Quick Start violates user-flow-validation.md MUST-1

- **Citation:** README §"Launch (one command)" still teaches build-on-first-run; the user-facing walk under Arch B is `docker pull terrenefoundation/kailash-coc-py:0.1.0 && ./bin/dev`.
- **Fix:** rewrite README §Launch + §Dev Environment for registry-pull; preserve build-from-source as the "developing-the-template" path.

### H3-6 — Multi-arch manifest claim is unverifiable absent publisher workflow

- **Citation:** session-notes claims `sha256:c62467b3…` is multi-arch amd64+arm64, PUBLIC. Without a reproducible GHA publish workflow, the manifest cannot be regenerated or audited.
- **Fix:** GHA workflow with `docker buildx build --platform linux/amd64,linux/arm64 --push` captures the digest as a release artifact.

### H3-7 — secrets-and-auth.md S1 spec invariant lags `.dockerignore` artifact

- **Citation:** Round-2 N-H1 recommended adding invariant S5 ("docker history/scan shows no `.claude/learning/`/`.git`/etc content") but `secrets-and-auth.md` S1 still mentions only `.env ∈ .dockerignore`. Artifact landed (`.dockerignore:6-11`); spec didn't follow.
- **Fix:** add invariant S5 enumerating the full `.dockerignore` content gate.

## MEDIUM findings (5)

- M3-1: `requirements-coc.txt` lacks hash-lock per spec § Reproducibility "shipped as hash-locked `uv pip compile` output"
- M3-2: I2 import-name verification not exercised at build time (postCreate.sh should `python -c "import kailash, dataflow, nexus, kaizen, pact"`)
- M3-3: Compose+devcontainer.json have NO `pact` import in any healthcheck/postCreate verification
- M3-4: `bin/dev:30` has no `docker pull` fallback when offline
- M3-5: Active todo M5 still references the cross-repo /codify proposal pipeline; that pipeline is partly STALE under Arch B (overlay-glob proposal still needed, Dockerfile-sync proposal not)

## LOW findings (3)

- L3-1: No `tests/regression/test_dev_container_quickstart.*` exercising documented Quick Start pipeline
- L3-2: `requirements-user.txt` stub has no comment pointing to ml-profile discoverability per N-M3
- L3-3: `Dockerfile.user.example` `FROM` line references local `kailash-coc-dev:local`, not the registry tag

## POST-PIVOT NET-NEW GAPS (deliverable enumeration)

1. `.github/workflows/publish-dev-image.yml` — multi-arch buildx + push + digest capture
2. `docker-compose.yml` registry-pull pattern: `image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}`
3. `bin/dev` pull-first path: `docker pull` + image-presence check + fall-back-to-build
4. `README.md` §"Launch" addendum: registry-pull as default consumer path
5. `specs/dev-container-image.md` § Image acquisition + reframed §§1–7
6. `specs/sync-ownership.md` § Ownership classes split (publisher-internal / consumer-shipped / consumer-overlay)
7. `specs/secrets-and-auth.md` invariant S5 (full `.dockerignore` gate)
8. `_index.md` Brief traceability row for "Image acquisition"
9. Docker Hub repository description (currently empty per session-notes)
10. Quick-Start regression test per `rules/testing.md`

## Acceptance gate

**NOT MET.** 7 HIGH findings; zero tracked STALE→rewrite dispositions. Round-3 verdict: BLOCK on Architecture-B realization (publisher workflow + compose registry-pull + README + spec rewrite + secret-gate spec) before /todos cycle proceeds.

Next round (R4) must verify: every HIGH closed via in-repo edit, registry-pull pattern grep returns ≥1 hit in compose/bin/README, every STALE spec § rewritten with explicit "supersedes Arch A" deviation log per `specs-authority.md` MUST Rule 6.
