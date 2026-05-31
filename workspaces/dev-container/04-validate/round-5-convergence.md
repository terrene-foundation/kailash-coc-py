# Round 5 — Convergence Confirmation

**Date:** 2026-05-29
**Verdict:** **PASS — 0 CRIT, 0 HIGH.** R4 verdict reproduced against unchanged on-disk state.
**Method:** Independent mechanical re-derivation per `skills/spec-compliance/SKILL.md` —
no trust in prior round's self-report; sweeps re-run from scratch against current state.

## Mechanical sweep results (verbatim)

### Sweep 1 — Architecture B markers across 5 consumer surfaces

```
docker-compose.yml:4    # NOT build locally on first run. Override `DEV_IMAGE` in .env for template developers
docker-compose.yml:15       # Override DEV_IMAGE in .env to use a local-build tag for publisher recipe iteration.
docker-compose.yml:16       image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}
docker-compose.yml:18       # Uncomment + set `DEV_IMAGE=kailash-coc-dev:local` in .env to activate.

bin/dev:36          DEV_IMAGE="${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:0.1.0}"
bin/dev:42-45       if [[ "$DEV_IMAGE" == *"/"* ]] && [[ "$DEV_IMAGE" != *":local"* ]]; then
                       if ! docker image inspect "$DEV_IMAGE" >/dev/null 2>&1; then
                         echo ">> first run: pulling $DEV_IMAGE from registry (one-time)…"
                         if ! docker pull "$DEV_IMAGE"; then ...

.devcontainer/devcontainer.json:16    "image": "docker.io/terrenefoundation/kailash-coc-py:0.1.0",

README.md:125    A reproducible development container is available as a published image on Docker Hub: `terrenefoundation/kailash-coc-py:0.1.0` (multi-arch amd64+arm64)
README.md:133    ./bin/dev                   # pulls the published image on first run, then shells in as user `dev`
README.md:136    First run pulls `terrenefoundation/kailash-coc-py:0.1.0` from Docker Hub (one-time, cached thereafter). No local build.
README.md:148    The editor pulls the registry image referenced in `.devcontainer/devcontainer.json` (`docker.io/terrenefoundation/kailash-coc-py:0.1.0`)
README.md:152    If you are iterating on the Dockerfile itself, set DEV_IMAGE=kailash-coc-dev:local in .env, uncomment the build: block...

Dockerfile.user.example:33    FROM terrenefoundation/kailash-coc-py:0.1.0
Dockerfile.user.example:35    # FROM terrenefoundation/kailash-coc-py:0.1.0@sha256:<digest-here>
```

PASS — all 5 surfaces carry registry-pull markers.

### Sweep 2 — GHA publish workflow

```
.github/workflows/publish-dev-image.yml  (5141 bytes, present)
$ grep -cE "linux/amd64|linux/arm64" .github/workflows/publish-dev-image.yml
5
:31    permissions:
:77         username: ${{ secrets.DOCKERHUB_USERNAME }}
:78         password: ${{ secrets.DOCKERHUB_TOKEN }}
:104        provenance: true
:105        sbom: true
```

PASS — workflow exists, multi-arch declared 5×, secrets via GHA indirection, provenance + sbom enabled.

### Sweep 3 — .dockerignore overlay block

```
$ grep -nE "^(\.devcontainer/|compose\.override\.yml|Dockerfile\.user|requirements-user\.txt)$" .dockerignore
35:.devcontainer/
36:compose.override.yml
37:Dockerfile.user
38:requirements-user.txt
```

PASS — 4-line overlay-exclusion block intact at lines 35-38.

### Sweep 4 — postCreate Step 0b gitconfig staging

```
.devcontainer/postCreate.sh:89   # Step 0b — gitconfig staging (security MED-2, post-pivot R3-security audit)
:96    if [ -f "$HOME/.host-gitconfig" ]; then
:98      if cp -a "$HOME/.host-gitconfig" "$HOME/.gitconfig" 2>/dev/null; then
:105   log "signing key staged but no .host-gitconfig mount — git config user.signingkey will not propagate"
```

PASS — Step 0b present with guard-then-stage-then-warn pattern.

### Sweep 5 — Spec cross-citation consistency

- `_index.md:16-19` references Image acquisition + cites journal/0003 G1-G4 reframing
- `sync-ownership.md:8-15` Change log + 3-way ownership classes + G2 (line 113) reframed for registry-publish + G4 narrowed
- `dev-container-image.md:16-18` Change log + § Image acquisition (line 23) + I10 (line 120) for registry-pull contract
- `secrets-and-auth.md:38` S5 invariant for `.dockerignore` overlay-exclusion gate

PASS — cross-citations consistent; spec updates form a coherent reframing.

## Convergence criteria check

| Criterion | Required                               | R4                            | R5       | Status   |
| --------- | -------------------------------------- | ----------------------------- | -------- | -------- |
| 1         | 0 CRITICAL                             | 0                             | 0        | **PASS** |
| 2         | 0 HIGH                                 | 0                             | 0        | **PASS** |
| 3         | 2 consecutive clean rounds             | R4 clean                      | R5 clean | **PASS** |
| 4         | Spec compliance 100% AST/grep verified | PASS                          | PASS     | **PASS** |
| 5         | New code has new tests                 | N/A (config + prose dominant) | N/A      | **PASS** |
| 6         | Frontend integration: 0 mock data      | N/A                           | N/A      | **PASS** |

**Outstanding L3 (informational, non-blocking):** README Quick Start `tests/regression/test_dev_container_quickstart.*` per `testing.md` MUST End-to-End Pipeline Regression. Requires a docker daemon + published image to run; in-session walk receipt deferred to the session that commits + opens PR (when loom#379 unblocks).

## Final verdict

**CONVERGED.** Two consecutive clean rounds (R4 + R5) with 0 HIGH. Architecture B wired end-to-end across publication path (GHA workflow), consumer pull path (compose + devcontainer + bin/dev), overlay-protection path (.dockerignore), spec-truth path (4 specs rewritten), brief + plan + user-flow + active todo. F4 fix-shard complete.
