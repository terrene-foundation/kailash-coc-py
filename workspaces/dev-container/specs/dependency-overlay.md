# Spec — Dependency Overlay (Extensibility)

Authority on how a downstream project layers its own dependencies onto the template-owned
base without forking the image. Source-of-truth for shards S3 (postCreate orchestrator)
and S4 (overlay stubs).

## The two surfaces

| Surface | Owner | Install location | Rebuild needed? |
| --- | --- | --- | --- |
| `requirements-coc.txt` (frameworks) | template | Dockerfile (baked) | yes (on sync) |
| `requirements-user.txt` (extra pip) | project | postCreate (mounted) | **no** |
| root `package.json` (extra Node) | project | postCreate (mounted) | **no** |
| extra OS packages | project | `Dockerfile.user FROM base` rebuild (H3) | yes (user-driven) |
| `compose.override.yml` (extra services) | project | `docker compose up` (auto-merge) | no |
| `.devcontainer/postCreate.user.sh` (arbitrary) | project | postCreate sources it | no |
| `Dockerfile.user FROM base` (heavy) | project | manual build | yes (user-driven) |

## postCreate.sh contract (template-owned, idempotent)

Runs after container create AND re-runnable on demand
(`docker compose exec dev .devcontainer/postCreate.sh`). Steps, each guarded by a
presence/non-empty check so absent overlays are silent no-ops:

1. `[ -s requirements-user.txt ] && uv pip install -r requirements-user.txt` — installs
   into the SAME shared venv (`/opt/venv`, `$VIRTUAL_ENV` set) the base used for the
   frameworks (H2 — no `--system`, no second target; this is what makes O1 actually true).
2. _(OS packages are NOT installed here — H3 dropped the `sudo apt` step; extra OS
   packages go through a `Dockerfile.user FROM base` rebuild instead, so the non-root
   user never needs root-equivalent `sudo apt-get`.)_
3. `[ -f package.json ] && <pm> install` where `<pm>` is resolved by reusing
   `.claude/hooks/detect-package-manager.js` (npm/pnpm/yarn by lockfile).
4. `[ -f .pre-commit-config.yaml ] && pre-commit install`
5. `[ -f .devcontainer/postCreate.user.sh ] && source .devcontainer/postCreate.user.sh`

## Invariants (MUST hold)

- **O1 — No-rebuild add (walked, not asserted):** editing `requirements-user.txt` +
  re-running postCreate makes the new package importable without `docker build` — verified
  by an actual `python -c "import <pkg>"` after the re-run (H2 — the base and overlay share
  ONE venv, so the import resolves; a split-target install would silently not resolve).
- **O2 — Empty overlay is a no-op:** a fresh project with empty/absent `*-user.*` files
  produces a clean postCreate run with no errors.
- **O3 — Idempotent:** running postCreate twice yields the same end state (no duplicate
  installs failing, no half-applied state).
- **O4 — Cache-mounted:** uv/npm/pre-commit caches are named volumes so a re-run is fast
  and does not bake cache into the image.
- **O5 — Detection reuse:** Node package-manager detection reuses the existing hook, not a
  reimplementation (avoids drift).

## Pinning policy

- `requirements-coc.txt`: PIN (template-owned reproducibility).
- `requirements-user.txt`: user's choice (template ships an empty stub with a comment
  explaining the convention).
- CLIs in Dockerfile: PIN; document the unpinned upgrade path.
