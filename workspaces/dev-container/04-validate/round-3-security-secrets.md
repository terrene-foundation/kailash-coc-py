# Round 3 — Security + Secrets Audit (Post-Pivot)

**Date:** 2026-05-29
**Mission:** Audit secrets-and-auth.md compliance + post-pivot Docker-Hub-publication attack surface across 5 mechanical sweeps. Workspace pivoted to registry distribution mid-session 2026-05-28; image is LIVE PUBLIC on Docker Hub as `terrenefoundation/kailash-coc-py:0.1.0+:latest`.

**Verdict:** **0 CRIT, 2 HIGH, 2 MED, 3 LOW.** Both HIGH findings fixable in one shard.

## Sweep S1 — `.dockerignore` integrity

Command: `grep -rE "(\.env|\.claude/learning|\.git$|\.gnupg|\.ssh)" .dockerignore`

Verbatim content:

```
.env
.env.*
!.env.example
.git
.claude/learning/
.claude/operator-id
.coc-fetch-cache
**/.session-notes
**/.coc-clone-init-witness
```

PASS on `.env`, `.env.*` (with `!.env.example` whitelist), `.claude/learning/`, `.git`, `.claude/operator-id`, session-notes, witness. Build context does not include `~/.ssh`/`~/.gnupg` (benign absence).

**Gap:** `.devcontainer/postCreate.user.sh`, `compose.override.yml`, `Dockerfile.user`, `requirements-user.txt` (all project-owned overlay files) NOT excluded — bakeable via downstream `Dockerfile.user FROM kailash-coc-dev:local` + `COPY . .`.

## Sweep S2 — Secret-in-layer check (I5)

PASS — Dockerfile contains zero `ANTHROPIC_/OPENAI_/GOOGLE_/GH_TOKEN/JWT_/API_KEY` ENV vars, zero secret-bearing ARGs (only `USER_UID/USER_GID/GH_VERSION/YQ_VERSION/_SHA256_*`), zero `--secret` mounts needed, no credential URLs in `requirements-coc.txt`. Multi-stage build copies binaries only. Single `COPY requirements-coc.txt /tmp/requirements-coc.txt` from context; no broad `COPY . .`.

## Sweep S3 — Signing-key passthrough (I3, N-H2)

PASS on opt-in OPT-IN design: `docker-compose.yml` has no baked mount; `.devcontainer/devcontainer.json:44-58` shows SSH+GPG mounts commented out by default with explicit OPT-IN header (verified: absent host `~/.ssh` does NOT abort container creation because bind is commented). `postCreate.sh:38-86` implements read-only-mount→writable-stage pattern: copies `~/.host-ssh` → writable `~/.ssh` with chmod 600 on non-`.pub`; copies `~/.host-gnupg` → writable `~/.gnupg` with `pinentry-mode loopback` for non-interactive signing. Both halves of N-H2 (coordination-log SSH append AND `git commit -S`) addressed. `known_hosts` + `allowed_signers` created writable. Failed staging surfaces WARNING (zero-tolerance Rule 3).

**Gap (MED-2):** `~/.gitconfig` not auto-staged. `git commit -S` succeeds at SSH layer (keys staged) but `git` doesn't know WHICH key to use without manual re-config inside container. Fix: OPT-IN bind mount `~/.gitconfig` → `~/.host-gitconfig:ro` + postCreate stage to writable `~/.gitconfig`, symmetric to `.host-ssh` pattern.

## Sweep S4 — `.env` passthrough

PASS across all three invocation paths:

- `docker-compose.yml:25-26` — `env_file: - .env` (runtime injection only)
- `bin/dev:12-22` — checks for `.env` absence, then delegates to compose
- `.devcontainer/devcontainer.json:34-35` — `initializeCommand` performs same check; `runArgs ["--env-file", "${localWorkspaceFolder}/.env"]` injects at runtime via docker CLI

`.env` excluded by `.dockerignore` (build-context-excluded) AND `.gitignore` (never committed).

## Sweep S5 — Public-image-on-Docker-Hub considerations

PASS on identity scrub: no `LABEL maintainer=`, no `org.opencontainers.image.author=`, no email/fingerprint LABEL, generic `dev` user, generic `/workspace` WORKDIR, `.git` excluded with no `COPY . .` or `COPY .git` in Dockerfile.

**Post-pivot net-new attack surface (HIGH-1, HIGH-2 below):** the registry-distribution model introduces a NEW class of leakage where consumers `FROM terrenefoundation/kailash-coc-py:X` + add their own `COPY . .` layer; any project-owned escape-hatch file not in `.dockerignore` becomes bakeable into their derivative published image.

## Findings table

| ID     | SEV  | Finding                                                                                                                                  | Citation                                                                                 | Recommended fix                                                                                    |
| ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| HIGH-1 | HIGH | `.devcontainer/postCreate.user.sh` (project escape hatch) not in `.dockerignore`; bakeable via downstream `Dockerfile.user` + `COPY . .` | `.dockerignore` (no entry); `.devcontainer/postCreate.user.sh.example` ships as template | Append project-owned-overlay block to `.dockerignore` (see below)                                  |
| HIGH-2 | HIGH | `.devcontainer/` not in `.dockerignore`; bakeable into downstream layers; leaks `${localWorkspaceFolder}/.env` host-path convention      | `.dockerignore` (no `.devcontainer/` entry); `.devcontainer/devcontainer.json:35`        | Add `.devcontainer/` to `.dockerignore` (template Dockerfile does not COPY from there)             |
| MED-1  | MED  | Project-owned overlay files not excluded from build context (subset of HIGH-1)                                                           | Same as HIGH-1                                                                           | Covered by HIGH-1 fix                                                                              |
| MED-2  | MED  | `~/.gitconfig` not auto-staged; `git commit -S` won't know which key without manual re-config                                            | `.devcontainer/devcontainer.json:39-58`; `.devcontainer/postCreate.sh:38-86`             | OPT-IN `~/.gitconfig` → `~/.host-gitconfig:ro` mount + postCreate stage to writable `~/.gitconfig` |
| LOW-1  | LOW  | `compose.override.yml` not in `.dockerignore`                                                                                            | Same as HIGH-1                                                                           | Covered by HIGH-1 fix                                                                              |
| LOW-2  | LOW  | postCreate.sh `chmod 600` on staged SSH follows symlinks                                                                                 | `.devcontainer/postCreate.sh:52`                                                         | Document as known constraint; low blast radius                                                     |
| LOW-3  | LOW  | Docker Hub publisher `terrenefoundation/` appears in consumer daemon logs (informational)                                                | Brief: `terrenefoundation/kailash-coc-py:0.1.0+:latest`                                  | Accept per `rules/terrene-naming.md`                                                               |

## Post-pivot public-image attack surface (NEW)

1. **Layer-bake leakage on `FROM kailash-coc-dev:local` rebuilds** (HIGH-1 + HIGH-2): consumers `FROM` published image + thin user layer; if their layer does `COPY . .`, project-owned escape-hatch files leak into their derivative public image.
2. **Tag-trust drift**: consumers pinning `:latest` silently pull future revisions. Recommendation: `Dockerfile.user.example` should `FROM terrenefoundation/kailash-coc-py:0.1.0@sha256:c62467b3…` (immutable digest), consistent with H1 supply-chain pin discipline.
3. **Build-context divergence**: public image built ONCE by Foundation against known `.dockerignore` state; consumer doing `docker compose build dev` against same `docker-compose.yml` (with `build:` directive) builds LOCAL image with potentially-different `.dockerignore` state. Recommendation: support an alternative compose path using published image WITHOUT `build:`.

## Recommended in-shard fix (~5 LOC)

Append to `.dockerignore`:

```
# Project-owned overlay files — bind-mounted at runtime, must never bake into derivative layers
.devcontainer/postCreate.user.sh
.devcontainer/
compose.override.yml
Dockerfile.user
requirements-user.txt
```

`.devcontainer/` exclusion is safe — template Dockerfile does not COPY anything from there; devcontainer.json is an editor-attach config (read by Docker Desktop), not a build input.

## Acceptance verdict

**FAIL** — 2 HIGH findings present. Both fixable in single shard per `autonomous-execution.md` MUST Rule 4 (same-bug-class within shard budget). Round 4 must verify the `.dockerignore` block landed AND MED-2 disposition (fix-now vs defer-with-anchor).
