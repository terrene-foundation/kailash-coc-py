# Round 4 — Security + Secrets Re-Audit

**Date:** 2026-05-29
**Verdict:** **PASS — 0 CRIT, 0 HIGH, 0 MED, 0 LOW.** All 7 R3 findings closed or accepted.

## R3 closure table

| ID     | R3 SEV | R4 status    | Closure evidence                                                                                                                                                                    |
| ------ | ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH-1 | HIGH   | **CLOSED**   | `.dockerignore:35` adds `.devcontainer/`; `.dockerignore:37` adds `Dockerfile.user`; `postCreate.user.sh` is inside `.devcontainer/` so it falls under the dir-exclusion.           |
| HIGH-2 | HIGH   | **CLOSED**   | `.dockerignore:35` `.devcontainer/` excludes the editor-attach config from any derivative `COPY . .`.                                                                               |
| MED-1  | MED    | **CLOSED**   | Same block (`.dockerignore:35-38`) excludes the project-owned overlay file set.                                                                                                     |
| MED-2  | MED    | **CLOSED**   | `postCreate.sh:96-107` implements opt-in gitconfig staging from `$HOME/.host-gitconfig`; symmetric to ssh/gnupg pattern; warns when signing-key mount present but gitconfig absent. |
| LOW-1  | LOW    | **CLOSED**   | `.dockerignore:36` `compose.override.yml` excluded.                                                                                                                                 |
| LOW-2  | LOW    | **ACCEPTED** | Documented constraint; low blast radius unchanged.                                                                                                                                  |
| LOW-3  | LOW    | **ACCEPTED** | Publisher `terrenefoundation/` per `terrene-naming.md`; informational only.                                                                                                         |

## Sweep S1 (re-run) — `.dockerignore` overlay-exclusion landed

```
$ grep -nE "(\.env|\.claude/learning|\.git$|\.gnupg|\.ssh|\.devcontainer|compose\.override|Dockerfile\.user|requirements-user)" .dockerignore
3:.env
4:.env.*
5:!.env.example
6:.git
7:.claude/learning/
35:.devcontainer/
36:compose.override.yml
37:Dockerfile.user
38:requirements-user.txt
```

PASS — overlay-exclusion block lines 35-38.

## Sweep S2 (re-run) — secret-in-layer + publish-workflow indirection

PASS. Dockerfile + requirements-coc\*.txt contain zero hardcoded `ANTHROPIC_/OPENAI_/GOOGLE_/GH_TOKEN/JWT_/API_KEY/PASSWORD/SECRET` ENV vars. Multi-stage build copies binaries only. `.github/workflows/publish-dev-image.yml:77-78` references `${{ secrets.DOCKERHUB_USERNAME }}` / `${{ secrets.DOCKERHUB_TOKEN }}` via GHA secrets — never inline.

## Sweep S3 (re-run) — opt-in mount discipline + Step 0b semantics

`devcontainer.json` mounts block: SSH (line 46), GPG (line 49), gh login (line 52), gitconfig (line 58) all commented-out by default — container creation cannot abort on absent host paths.

`postCreate.sh` Step 0b (lines 88-107): guards on `[ -f "$HOME/.host-gitconfig" ]` for silent no-op when absent; chmod 644 on staged file; WARNING surfaces on failure (zero-tolerance Rule 3); WARNING when signing-key mount present but gitconfig absent (symmetric closure with MED-2).

## Sweep S4 (re-run) — `.env` sourcing ordering in `bin/dev`

Ordering verified:

- Line 12-22: missing-`.env` guard exits
- Line 35: `.env` sourcing via `set -a; . ./.env; set +a`
- Line 36: `DEV_IMAGE` resolution
- Line 42: `docker pull "$DEV_IMAGE"`

PASS — source AFTER guard, BEFORE DEV_IMAGE resolution + pull.

## Sweep S5 (re-run) — public-image attack surface + NEW publish workflow

Identity scrub: PASS (no `LABEL maintainer=`, no email/fingerprint; generic `dev` user + `/workspace`).

Publish workflow labels: PASS. OCI labels (`org.opencontainers.image.source/revision/version/licenses=Apache-2.0`) are public artifact provenance; no PII / internal paths.

Supply-chain hygiene: PASS. `provenance: true` + `sbom: true` enabled on buildx push.

Concurrency: `cancel-in-progress: false` with audit comment naming the non-idempotent multi-arch buildx push (deploy-hygiene Rule 11 exception path satisfied).

## NEW security findings (publish-workflow attack-surface sweep)

**Action pinning audit:** all `uses:` entries pin to major version:

- `actions/checkout@v6`, `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6`, `actions/upload-artifact@v4`

PASS — no `@main` / floating refs. Major-version pinning is the documented baseline.

**Secret-leakage in log output:** PASS. Every `echo` / `tee` prints public values only. Zero echo of `${{ secrets.* }}`.

**Permissions minimization:** workflow-scope `contents: read` only. No implicit elevation (no `packages: write`, no `id-token: write`).

**Tag-trigger filter:** `"v[0-9]+.[0-9]+.[0-9]+*"` matches semver only; arbitrary tags rejected. Trailing `*` permits pre-release suffixes (`v0.1.0-rc1`).

## Acceptance verdict

**PASS** — 0 CRIT, 0 HIGH, 0 MED, 0 LOW. R3 findings all closed (5) or accepted-as-documented (2). NEW publish workflow introduces no security regressions.
