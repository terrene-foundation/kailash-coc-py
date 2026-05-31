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
