# M4 — Project-Owned Overlay Stubs + Docs (shard S4)

Implements: `specs/dependency-overlay.md` (the two surfaces, O1), `specs/sync-ownership.md`
(ownership classes, G1). Value-anchor: brief — "make it possible for users to install
additional dependencies as their projects require" (the headline extensibility ask).

## T13 — Build project-owned overlay stubs

Ship once, never overwritten by sync (the `*-user.*` / `*.example` preserve set):

- `requirements-user.txt` — empty stub; comment explains the convention AND the ml-profile
  discoverability path (enable `ml` profile OR add `kailash-ml`/`kailash-align` here) so
  `import kailash_ml` doesn't fail confusingly (N-M3).
- `compose.override.yml.example` — extra services pattern (Docker auto-merge).
- `.devcontainer/postCreate.user.sh.example` — arbitrary project setup escape hatch.
- `Dockerfile.user.example` (`FROM <base-image>`) — the OS-package + heavy-customization
  path (H3 — OS packages rebuild here, not an apt overlay).

## T14 — Build `README` (dev-container quickstart)

Documents Flows A–D from `03-user-flows/01-developer-onboarding.md`: one-command Compose
launch (A), devcontainer reopen (B), add-a-dep-no-rebuild (C), survives-sync (D). Plus:
enabling the `ml` profile, the signing-key read-only mount, `GH_TOKEN` vs host `~/.config/gh`,
and the OS-package-needs-rebuild caveat. Repo-root placement (plan §0 decision 3).

## T15 — Verify the user-flow walks A–D end-to-end (the literal-walk gate)

Per `user-flow-validation.md` MUST-1/2/5 — receipts (verbatim cmd + output) to the PR:

- **Flow A:** `./bin/dev` → version-check block → `claude` session starts, hooks fire.
- **Flow C (headline):** `echo "httpx>=0.27" >> requirements-user.txt` →
  `docker compose exec dev .devcontainer/postCreate.sh` → `python -c "import httpx"`
  succeeds with NO rebuild (O1 — proves the shared-venv contract).
- **Flow D:** simulate a template sync; confirm `requirements-user.txt` / `package.json` /
  `Dockerfile.user` / `compose.override.yml` / `postCreate.user.sh` survive (G1).
- Failure walks: missing `.env` clear error; host-owned files after session; ml-profile
  discoverable. Capacity: stubs + README + the walk; feedback loop = the walks themselves.

---

## Verification record (2026-05-27) — IMPLEMENTED + VERIFIED (gate review in flight)

**Built (T13 stubs):** `requirements-user.txt` (real empty stub; comment documents the
convention + ML-profile discoverability path, N-M3), `compose.override.yml.example`,
`Dockerfile.user.example` (`FROM kailash-coc-dev:local` + root apt layer, H3),
`.devcontainer/postCreate.user.sh.example` (escape hatch). **(T14):** added a
`## Development Environment (Docker)` section to the existing root `README.md` (did NOT
clobber the template's main readme) — Flows A–D, no-rebuild overlay table, ML opt-in,
signing + GitHub-auth, survives-`/sync`.

**User-flow walks (T15) — verbatim Docker receipts (scrubbed; image `kailash-coc-dev:local`):**

- **Flow A** (`./bin/dev bash -c '<version+import block>'`): claude 2.1.152 / codex 0.134.0 /
  gemini 0.43.0; python 3.12.13 / node v22.22.3 / uv 0.11.16; git / gh 2.92.0 / gpg 2.2.40
  (gnupg present) / jq / yq 4.53.2 / rg 13; `import kailash, dataflow, nexus, kaizen, pact` →
  `FRAMEWORKS_OK`; user `dev`, `VIRTUAL_ENV=/opt/venv`. Disposition: workbench complete.
- **Flow C — headline, O1** (`docker compose up -d dev` cached → append `httpx>=0.27` to
  requirements-user.txt → `docker compose exec dev .devcontainer/postCreate.sh` → import):
  `httpx 0.28.1 imported`; image id `c67220cddda7` **identical before/after** →
  **NO-REBUILD CONFIRMED**. Shared-venv overlay contract proven. Stub restored, compose down.
- **Flow D — survives `/sync`:** preserve-glob naming verified against ownership classes;
  **FINDING:** the `*.user.*` preserve glob wrongly matches `Dockerfile.user.example` +
  `.devcontainer/postCreate.user.sh.example` (template-owned stubs that must regenerate).
  Corrected the contract in `specs/sync-ownership.md` + the M5 todo: preserve rule MUST be
  `(globs) AND NOT *.example`. The live sync-preserve dry-run is M5/loom (cross-repo).
- **Failure walk — missing `.env`:** `./bin/dev` (with `.env` moved aside) printed the
  clear `cp .env.example .env` guidance and exited 1; `.env` restored. (S4.)
- **Host-owned files (I8):** verified in M3 (dev-written bind-mount file is host-owned/editable).
- **ML discoverability (N-M3):** `requirements-user.txt` comment + `postCreate.sh --ml` path
  (installs `requirements-coc-ml.txt`) wired + read-verified; full torch install not walked
  (multi-GB, disproportionate — identical install path to the verified requirements-user.txt).

**Gate review (complete):**

- **reviewer** → CLEAN. 7 mechanical sweeps + all cross-references pass (no secrets, shellcheck
  clean, JSONC valid, O5 hook reuse, no `--system`, all steps presence-guarded, README links OK).
  2 LOW advisories, both explicitly no-action (`==` pins correct for an image lockfile; walk
  receipts correctly in provenance not the README).
- **security-reviewer** → no CRIT/HIGH. 3 MEDIUM (all in `postCreate.sh` signing staging) FIXED
  same-shard per `autonomous-execution.md` MUST-4 + re-verified:
  - **M1** (chmod only tightened `id_*`; other key names left loose) → tighten every non-`.pub`
    file to 600. Re-walked with a `signing_ed25519` key → confirmed 600.
  - **M2** (`cp … || true` hid copy failure behind a "staged" success) → surface a WARNING; only
    print "staged" on `cp` success.
  - **M3** (`gpg.conf`/`gpg-agent.conf` created post-chmod at umask 644) → chmod 600 after appends.
  - 3 LOW (host `~/.ssh/config` copy edge; `<pm> install` runs lifecycle scripts; README could
    mirror the spec's `gh auth login` anti-pattern) → skipped per reviewer no-action / doc-nit.
    Post-fix re-verify: `bash -n` + shellcheck clean; signed commit re-verified ("Good git signature").

**Not committed** (F2/F3): files-on-disk on `feat/dev-container`; landing rides loom adoption (M5).
