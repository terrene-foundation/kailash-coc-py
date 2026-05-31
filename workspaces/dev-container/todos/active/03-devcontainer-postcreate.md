# M3 — Devcontainer + postCreate Orchestrator (shard S3)

Implements: `specs/dependency-overlay.md` (postCreate contract, O1–O5), `specs/secrets-and-auth.md`
§Signing-key passthrough (C2/N-H2), `specs/dev-container-image.md` I3/I8. Value-anchor:
brief — "honor the COC hook surface; pass host secrets safely; extensible per-project".

## T09 — Build `.devcontainer/devcontainer.json`

`build.dockerfile: ../Dockerfile`, `remoteUser: dev`, `updateRemoteUserUID: true`,
secrets via `remoteEnv` / `runArgs: ["--env-file",".env"]` (never a layer),
`forwardPorts` for dev servers, `postCreateCommand: .devcontainer/postCreate.sh`,
read-only signing-key mounts (see T11). For VS Code / Cursor / Codespaces / JetBrains.

## T10 — Build `.devcontainer/postCreate.sh` (idempotent orchestrator)

Template-owned, re-runnable (`docker compose exec dev .devcontainer/postCreate.sh`).
Each step presence-guarded so absent overlays are silent no-ops (O2/O3):

1. `[ -s requirements-user.txt ] && uv pip install -r requirements-user.txt` — into the
   SAME `/opt/venv` (O1; NO `--system`).
2. _(no apt step — OS packages via `Dockerfile.user`, H3.)_
3. `[ -f package.json ] && <pm> install` — `<pm>` from `.claude/hooks/detect-package-manager.js` (O5).
4. `[ -f .pre-commit-config.yaml ] && pre-commit install`.
5. `[ -f .devcontainer/postCreate.user.sh ] && source` it (project escape hatch).
   Cache-mount uv/npm/pre-commit (O4).

## T11 — Wire signing-key passthrough (C2/N-H2)

Default SSH signing (`coc-sign.js` defaults `keyType:"ssh"`): bind host `~/.ssh`
read-only for the key; provide a WRITABLE `known_hosts`/`allowed_signers` (copy into
`dev` home at postCreate or a writable mount) so `git commit -S` works — the read-only
key alone breaks signed commits even though the coordination-log append works. GPG path:
read-only `~/.gnupg` + `GPG_TTY` + `pinentry-mode loopback` (+ writable `GNUPGHOME` copy
if gpg needs lockfiles). Implements: secrets-and-auth.md §Signing-key passthrough.

## T12 — Verify devcontainer + signing (wire companion)

Receipts to PR: devcontainer builds; postCreate runs clean on empty overlays (O2) and is
idempotent on a second run (O3); a real coordination-log append AND a real `git commit -S`
both succeed (I3 — both surfaces, per N-H2); files the hooks write to the bind mount are
host-user-editable after the session (I8). Capacity: 2 config files + wiring, ~5 invariants.
