# Dependency-Extensibility Patterns — Project-Owned Overlay on a Template-Owned Base

Research for the dev-container workspace. The base image is **template-owned**
(regenerated when the project pulls a new `kailash-coc-py` via `/sync`); the downstream
project's extra dependencies must be **project-owned** and survive that sync. This file
surveys how to split those two surfaces cleanly for Python, Node, and OS packages, and
recommends a concrete overlay pattern.

## The core tension

```
template-owned (sync overwrites)        project-owned (sync preserves)
─────────────────────────────────       ──────────────────────────────────
Dockerfile (base runtimes + CLIs)        requirements-user.txt / pyproject extras
requirements-coc.txt (Kailash frameworks) package.user.json (extra Node deps)
docker-compose.yml (dev service)         compose.override.yml (extra services)
.devcontainer/devcontainer.json          .devcontainer/postCreate.user.sh
                                          apt-packages.user.txt (extra OS pkgs)
```

The `/sync` contract: any file the template emits is fair game to overwrite; any file
with a `*.user.*` / `-user.*` convention (or living in a project-only dir) is never
touched. This mirrors how `CLAUDE.md` is template-owned-but-preserved while `AGENTS.md`
is regenerated — the dev-container needs the same split, inverted (most files
regenerated; a small allowlist of overlay files preserved).

## 1. Python dependency overlay

### Options surveyed

- **`requirements.txt` overlay (recommended baseline)** — `requirements-coc.txt`
  (template-owned, pins the seven Kailash frameworks) + `requirements-user.txt`
  (project-owned, empty by default). Dockerfile/postCreate installs both:
  `pip install -r requirements-coc.txt -r requirements-user.txt`. Dead simple, works
  everywhere, trivial to reason about, zero new toolchain. Cache-friendly when the two
  files are COPYed and installed before app source.

- **PEP 735 dependency-groups (`[dependency-groups]` in `pyproject.toml`)** — the 2025+
  standard for named, non-published dep groups (e.g. `dev`, `test`). `pip install
--group dev` / `uv sync --group`. Cleaner than extras for dev-only deps, but requires
  the project to own a `pyproject.toml` (many template-consumer projects do). The
  template can seed a `[dependency-groups] coc = [...]` group and let the user add their
  own groups in the same file — but then `pyproject.toml` is shared-ownership, which
  re-introduces the sync-overwrite problem. **Avoid making `pyproject.toml`
  template-owned.**

- **uv (astral-sh/uv)** — 10–100× faster installs/resolution than pip; lockfile
  (`uv.lock`) gives reproducible, hash-pinned builds; `--mount=type=cache` against
  `/root/.cache/uv` makes adding one dep a sub-second rebuild. uv beats pip/poetry for a
  dev container specifically because the layer-cache + uv-cache combination means "user
  adds one dep" → only that dep resolves, not the world. Trade-off: another tool to
  install in the base (one binary, trivial).

- **poetry / pdm / pip-tools** — all viable; poetry is heavier and slower than uv, owns
  `pyproject.toml` exclusively (shared-ownership problem), and its lockfile churn is
  worse. pip-tools (`pip-compile`) is fine but uv subsumes its use case faster.

### Recommendation

**Two-tier, uv-accelerated, requirements-file-based:**

- `requirements-coc.txt` — template-owned; pins `kailash`, `kailash-dataflow`,
  `kailash-nexus`, `kailash-kaizen`, `kailash-pact`, `kailash-ml`, `kailash-align` to
  known-good versions. Regenerated on `/sync`.
- `requirements-user.txt` — project-owned; empty stub shipped once, never overwritten.
  The user adds `pandas`, `httpx`, whatever.
- Install via `uv pip install -r requirements-coc.txt -r requirements-user.txt` (uv's
  pip-compatible interface — no pyproject ownership change, full speed, cache mount).

This keeps the simple mental model of requirements files, gets uv's speed, and the
`-coc` / `-user` split makes the ownership boundary obvious at `ls`-time.

## 2. Node dependency overlay

The COC tooling itself needs no project `package.json` (hooks are dependency-free Node,
CLIs are global installs). So a project `package.json` exists ONLY if the user's project
needs Node deps (a React frontend, etc.).

**Recommendation: a project-owned root `package.json` (NOT template-owned).** If present,
`postCreateCommand` runs `npm ci` (lockfile-reproducible) when `package-lock.json`
exists, else `npm install`. The template never ships a root `package.json`, so there is
nothing to overwrite — the user owns it entirely. Cache: `--mount=type=cache,target=/home/dev/.npm`.
pnpm/yarn are fine if the user prefers; detect via lockfile presence
(`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn). The existing
`.claude/hooks/detect-package-manager.js` already encodes this detection — reuse it.

## 3. Layer-cache discipline (Dockerfile)

The canonical cache-maximizing order:

```dockerfile
# 1. OS packages (changes rarely) — its own layer
RUN apt-get update && apt-get install -y --no-install-recommends \
      git gh jq ripgrep curl openssh-client build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 2. CLIs (change occasionally) — pinned versions for reproducibility
RUN npm i -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli

# 3. Dependency manifests FIRST (before app source) — cache holds if deps unchanged
COPY requirements-coc.txt requirements-user.txt ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements-coc.txt -r requirements-user.txt

# 4. App source LAST — changes most often, invalidates only the final layer
COPY . .
```

Key rules:

- **Copy lockfiles/manifests before source** so editing a `.py` file does not bust the
  dep-install layer.
- **BuildKit `--mount=type=cache`** for uv/npm/apt caches — survives across builds, makes
  "add one dep" fast without baking the cache into the image.
- **`--no-install-recommends` + `rm -rf /var/lib/apt/lists/*`** keeps the apt layer lean.
- Pin CLI versions in production-grade images; float (latest) is acceptable for a dev
  image that is rebuilt frequently, but pinning avoids "Friday broke because Gemini
  shipped 0.33".

## 4. postCreateCommand vs Dockerfile install — the ownership-driven split

This is the crux of the extensibility design:

| Install location      | What goes here                                                                                                          | Why                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dockerfile**        | OS packages, Node, Python, the three CLIs, the seven Kailash frameworks (`requirements-coc.txt`)                        | Template-owned, slow-changing, reproducible. Baked = fast container start, no per-start network.                                                                          |
| **postCreateCommand** | The user's `requirements-user.txt`, the user's `package.json`, the user's `apt-packages.user.txt`, `pre-commit install` | Project-owned, fast-changing. Runs AFTER container start against the bind-mounted workspace, so it picks up the user's files as they edit them — no image rebuild needed. |

**Why postCreate for user deps:** the workspace is bind-mounted, so the user's
`requirements-user.txt` is visible to the running container. Installing user deps in
`postCreateCommand` means **the user adds a dep, re-runs the post-create (or
`docker compose exec dev <install>`), and it's live — no `docker build`.** This directly
satisfies the brief's "install additional dependencies as their projects require"
without a rebuild. The Dockerfile bakes the slow, stable base; postCreate layers the
volatile, project-specific top.

**Recommendation: a single idempotent `.devcontainer/postCreate.sh` (template-owned)
that (a) installs `requirements-user.txt` if present and non-empty, (b) installs
`apt-packages.user.txt` via `sudo apt-get install` if present, (c) runs the Node package
manager if a root `package.json` exists, (d) runs `pre-commit install` if
`.pre-commit-config.yaml` exists, (e) sources `postCreate.user.sh` if present
(project-owned escape hatch for anything else).** The template owns the _orchestration_;
the user owns the _content_ (the `*-user.*` files).

## 5. The "user file survives sync" pattern — concrete conventions

| Template-owned (regenerated)  | Project-owned (preserved)          | Mechanism                                                              |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `Dockerfile`                  | —                                  | Sync overwrites; user never edits                                      |
| `requirements-coc.txt`        | `requirements-user.txt`            | Two files; install reads both                                          |
| `docker-compose.yml`          | `compose.override.yml`             | Compose auto-merges `compose.override.yml` if present (native feature) |
| `.devcontainer/postCreate.sh` | `.devcontainer/postCreate.user.sh` | Orchestrator sources the `.user.sh` last                               |
| —                             | `apt-packages.user.txt`            | postCreate installs if present                                         |
| —                             | root `package.json`                | postCreate installs if present                                         |

`docker-compose.yml` + `compose.override.yml` is a **native Docker feature** — `docker
compose` auto-merges an `override` file with no flags. This is the cleanest extension
point for "user wants to add a service" (their own Redis, a vector DB, etc.) without
touching the template's compose file.

The `/sync` manifest must declare the `*-user.*` / `*.override.*` files as
**project-owned / never-overwrite** (the same way `CLAUDE.md` is preserved today). This
is a one-line addition to the dev-container's sync rules: anything matching
`*-user.*`, `*.user.*`, `compose.override.yml`, `apt-packages.user.txt`, root
`package.json` is preserved.

## 6. OS-package overlay

- **Baked (Dockerfile):** the COC-required set — git, gh, jq, yq, ripgrep, curl,
  openssh-client, build-essential, ca-certificates. Slow-changing, template-owned.
- **postCreate (`apt-packages.user.txt`):** the user's extras (e.g. `libpq-dev`,
  `graphviz`). Cost: `apt-get install` at each container create (cached apt lists help).
  Acceptable for a handful of packages; if the list grows large, the user can author
  their own `Dockerfile.user` and `FROM` the base image (documented escape hatch).
- Nix/distrobox/apk(alpine) are out of scope — Debian apt is the lowest-friction path
  and matches the `python:slim-bookworm` base.

## 7. Pre-commit / linter dep overlay

`.pre-commit-config.yaml` pins hook versions and lives in the repo (project-owned for
the user's hooks; the COC artifact set ships its own hooks separately under
`.claude/hooks/`, which are NOT pre-commit hooks). postCreate runs `pre-commit install`
if the config exists. pre-commit manages its own isolated hook environments
(`~/.cache/pre-commit`) — cache-mount it. No node_modules pollution.

## 8. Pinning vs floating — the template-owned base

- **`requirements-coc.txt` (Kailash frameworks): PIN.** A dev environment that silently
  pulls a new `kailash-dataflow` major on rebuild breaks reproducibility and surfaces SDK
  bugs the user didn't ask for. Pin to a known-good set; bump deliberately on `/sync`.
- **CLIs: PIN in the committed image, document the unpinned upgrade path.** `npm i -g
@anthropic-ai/claude-code@X.Y.Z`. A dev image rebuilt weekly can float, but pinning
  prevents the "CLI shipped a breaking change Friday afternoon" failure.
- **`requirements-user.txt`: the USER's call.** Template ships it empty; the user pins or
  floats as they like.

## 9. Recommended pattern (1-page summary)

**Base image (Dockerfile, template-owned, pinned):**
`python:3.12-slim-bookworm` → apt OS tooling → Node 22 (multi-stage copy) → uv →
three CLIs (`npm i -g`, pinned) → `requirements-coc.txt` (seven Kailash frameworks,
pinned) → non-root `dev` user → `tini` entrypoint.

**Project overlay (project-owned, sync-preserved):**

- `requirements-user.txt` — extra pip deps (empty stub shipped once).
- root `package.json` — extra Node deps (only if the project needs them).
- `apt-packages.user.txt` — extra OS packages.
- `compose.override.yml` — extra services.
- `.devcontainer/postCreate.user.sh` — arbitrary project setup escape hatch.
- `Dockerfile.user` `FROM base` — documented escape hatch for heavy customization.

**Install orchestration (`.devcontainer/postCreate.sh`, template-owned):**
idempotent script run after container create — installs each `*-user.*` overlay if
present, runs `pre-commit install`, sources `postCreate.user.sh` last. Re-runnable via
`docker compose exec dev .devcontainer/postCreate.sh` so **adding a dep needs no
rebuild**.

**Sync contract:** the `*-user.*`, `*.override.*`, `apt-packages.user.txt`, and root
`package.json` files are declared project-owned / never-overwrite in the dev-container's
sync rules — exactly as `CLAUDE.md` is preserved today.

Sources:

- [PEP 735 — Dependency Groups in pyproject.toml](https://peps.python.org/pep-0735/)
- [uv documentation — astral.sh](https://docs.astral.sh/uv/)
- [Docker build cache & BuildKit cache mounts](https://docs.docker.com/build/cache/)
- [Compose merge / override files](https://docs.docker.com/compose/multiple-compose-files/merge/)
- [devcontainer.json reference — postCreateCommand](https://containers.dev/implementors/json_reference/)
