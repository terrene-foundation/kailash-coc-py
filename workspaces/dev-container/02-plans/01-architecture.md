# Architecture Plan — Dockerized Dev Environment for kailash-coc-py

Synthesizes the three research files in `01-analysis/01-research/`. Executes under the
autonomous-execution model — effort is in shards/sessions, not human-days. The plan is
the gate before `/todos`.

## 0. User-gated decisions (2026-05-27, this session — source: literal user direction)

These resolve the open user-gate questions and bind `/todos`:

1. **ML/Align frameworks: OPT-IN.** Baked base = lighter five (`kailash`, `dataflow`,
   `nexus`, `kaizen`, `pact`); `kailash-ml` + `kailash-align` live in
   `requirements-coc-ml.txt` / compose `ml` profile (R2 / N-M3).
2. **Usage model: dev-host + local-app-launch — NOT CI.** Verbatim: "we will take the
   template, create project and launch it as project." The container is where a
   template-derived project is developed AND run locally (the Compose `dev` service runs
   the app; `forwardPorts` exposes Nexus/API dev servers; DB via compose services). The
   production runtime image for the user's app stays out of scope (user owns it via
   `Dockerfile.user FROM base`). A dedicated CI image is out of scope.
3. **Placement: repo root.** `Dockerfile` / `docker-compose.yml` / `.devcontainer/` at the
   repo root (editor-auto-detected), per `specs/sync-ownership.md` § Placement.

## 1. What we are building (plain language)

A downloadable, reproducible "workbench" for anyone working in a Kailash Python project
that has the `kailash-coc-py` template dropped in. Run one command and you land inside a
shell that already has all three AI coding assistants (Claude Code, Codex, Gemini),
Python, Node, the Kailash framework packages, and every supporting tool the institutional
knowledge layer (hooks, commands, agents) needs. Your own project's extra packages layer
on top without rebuilding from scratch, and your API keys are read from your existing
`.env` — never copied into the image.

## 2. Ownership model (the load-bearing design decision)

This template is regenerated when a project pulls a newer `kailash-coc-py` (the `/sync`
flow). So every file splits into exactly one of two ownership classes:

| Class              | Behavior on sync    | Files                                                                                                                                                                                            |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Template-owned** | Overwritten by sync | `Dockerfile`, `docker-compose.yml`, `.devcontainer/devcontainer.json`, `.devcontainer/postCreate.sh`, `requirements-coc.txt`, `.dockerignore`, `bin/dev`                                         |
| **Project-owned**  | Never overwritten   | `requirements-user.txt`, root `package.json`, `compose.override.yml`, `.devcontainer/postCreate.user.sh`, `Dockerfile.user` (OS packages via `Dockerfile.user` — no `apt-packages.user.txt`, H3) |

The naming convention (`*-user.*` / `*.override.*`) makes the boundary visible at
`ls`-time and is the same preserve-on-sync mechanism that keeps `CLAUDE.md` intact today.
This is the structural answer to the brief's two requirements — "ship everything" (the
template-owned base) and "let users add their own deps" (the project-owned overlay) — at
the same time.

## 3. The image (template-owned base)

`FROM python:3.12-slim-bookworm`, built in cache-ordered layers:

1. **OS tooling** (slow-changing): `git`, `gnupg`, `openssh-client`, `gh`, `curl`, `jq`,
   `yq`, `ripgrep`, `ca-certificates`, `build-essential`. `gnupg` is non-negotiable —
   it backs the multi-operator commit-signing substrate (see DISCOVERY correction in
   `01-research/01-runtime-inventory.md`).
2. **Node 22 LTS** via multi-stage copy — digest-pinned. Copy ONLY the node-specific
   subtrees, NOT all of `/usr/local` (the `python:3.12-slim` base ships python at
   `/usr/local/bin` — a blanket `COPY --from=node /usr/local /usr/local` clobbers it).
   Scope the copy to node/npm/npx binaries + `lib/node_modules`. See `specs/dev-container-image.md` §2.
3. **uv** (astral-sh) — fast, cache-mountable Python installer; version + digest pinned.
4. **The three CLIs**, pinned: `npm i -g @anthropic-ai/claude-code@X.Y.Z
@openai/codex@X.Y.Z @google/gemini-cli@X.Y.Z` (install as root → global bins).
5. **Kailash frameworks** into ONE shared venv (`/opt/venv`, `VIRTUAL_ENV`+PATH set),
   from `requirements-coc.txt` (hash-locked): baked set `kailash`, `kailash-dataflow`,
   `kailash-nexus`, `kailash-kaizen`, `kailash-pact` + `ruff` + `black`. `kailash-ml` +
   `kailash-align` (torch-class) are the OPT-IN `requirements-coc-ml.txt` set (ml profile).
   `uv pip install -r requirements-coc.txt` into the venv (NO `--system`) + BuildKit cache
   mount. The base AND the postCreate overlay use this SAME venv (the no-rebuild contract
   depends on it). See `specs/dev-container-image.md` §5.
6. **Non-root `dev` user**, build-arg `USER_UID`/`USER_GID` (Linux: passed `$(id -u)`),
   so hook-written files (`.claude/learning/*.jsonl`, the clone-init witness) stay
   host-user-owned. `chown -R dev /opt/venv` AFTER the root framework install and BEFORE
   `USER dev`, so the overlay install (run as `dev`) can write the venv. Set
   `git config --global --add safe.directory /workspace`. NO passwordless `sudo` grant.
7. **`tini` entrypoint** (or `--init`) so the CLI's MCP-guard child processes are reaped
   (no PID-1 zombie leak).

## 4. Secrets + auth (never a layer)

`.env` remains the single source of truth (`CLAUDE.md` directive 2). The container reads
it at runtime: Compose via `env_file: [.env]`; devcontainer via `remoteEnv` /
`runArgs: ["--env-file", ".env"]`. `.env` is added to `.dockerignore` so it can never
enter the build context. GitHub auth: `GH_TOKEN` in `.env` (default, reproducible) or a
read-only bind of host `~/.config/gh` (opt-in). No `COPY .env`, no `ENV <key>=`.

## 5. Entry surfaces (one image, three doors)

- **Compose (recommended):** `docker-compose.yml` with a `dev` service + profile-gated
  `postgres`/`redis` services that ARE the in-container DB path (`DATABASE_URL` resolves
  to the service name). `scripts/development/setup-databases.sh` runs `docker run` on the
  HOST and is superseded inside the container (C1); any DB names/extensions/seed it
  provisions must be replicated as compose service config or an init script — verify at
  `/implement` what it sets up beyond a bare postgres. `bin/dev` wrapper =
  `docker compose run --rm --service-ports dev "$@"` for the one-command launch.
- **Devcontainer:** `.devcontainer/devcontainer.json` → `build.dockerfile: ../Dockerfile`,
  `remoteUser: dev`, `updateRemoteUserUID: true`, `postCreateCommand`, `forwardPorts` for
  Nexus dev servers. For VS Code / Cursor / Codespaces / JetBrains users.
- **Plain `docker run`:** documented fallback for terminal-only users.

All three reference the ONE Dockerfile — exactly one place pins runtimes and CLIs.

## 6. The dependency overlay (project-owned, no-rebuild)

`.devcontainer/postCreate.sh` (template-owned, idempotent, re-runnable) runs after
container create against the bind-mounted workspace:

1. `uv pip install -r requirements-user.txt` if present + non-empty — into the SAME
   shared `/opt/venv` the base used (no `--system`).
2. _(OS packages are NOT installed here — the `sudo apt` step was dropped because
   `NOPASSWD: apt-get` is root-equivalent; extra OS packages go through `Dockerfile.user
FROM base`. See `specs/dependency-overlay.md` postCreate step 2.)_
3. Node package-manager install if a root `package.json` exists (reuse
   `.claude/hooks/detect-package-manager.js` for pnpm/yarn/npm detection).
4. `pre-commit install` if `.pre-commit-config.yaml` exists.
5. `source .devcontainer/postCreate.user.sh` if present (project escape hatch).

Because postCreate runs against the mounted workspace, **adding a Python or Node dep =
edit `requirements-user.txt` (or `package.json`) + re-run
`docker compose exec dev .devcontainer/postCreate.sh` — no image rebuild.** OS packages
and base-layer customization need a `Dockerfile.user FROM base` rebuild (the one
documented case where the brief's "no rebuild" does not hold — pip/Node stay no-rebuild).

## 7. Persistent state (volumes)

Bind-mount the workspace (so edits are live + files stay host-owned). Named volumes for
caches to keep rebuilds fast and avoid host pollution: `uv` cache, `npm` cache,
`pre-commit` cache. `.claude/learning/` is part of the bind-mounted workspace (it is
git-tracked coordination state), so it persists naturally — no separate volume needed.

## 8. Shard map (for /todos — each within capacity budget)

| Shard                          | Scope                                                                                                                                                                                                       | Invariants                                                              | Feedback loop                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| **S1**                         | `Dockerfile` + `.dockerignore` (base: runtimes, OS tooling incl. gnupg, CLIs, frameworks, non-root user, tini)                                                                                              | runtimes present, non-root ownership, no-secret-in-layer, gnupg present | `docker build` + `docker run claude/codex/gemini --version` |
| **S2**                         | `docker-compose.yml` + `bin/dev` wrapper + compose↔db-stack wiring                                                                                                                                          | `.env` env_file (no layer), service-ports, db network                   | `docker compose config` + `bin/dev` shell launch            |
| **S3**                         | `.devcontainer/devcontainer.json` + `.devcontainer/postCreate.sh` (orchestrator)                                                                                                                            | UID alignment, remoteEnv secrets, idempotent postCreate                 | devcontainer build + postCreate re-run                      |
| **S4**                         | Project-owned overlay stubs (`requirements-user.txt`, `compose.override.yml.example`, `postCreate.user.sh.example`, `Dockerfile.user.example`) + README (OS pkgs via Dockerfile.user, not apt-overlay — H3) | overlay install path works (shared venv), stubs are no-ops when empty   | add-a-dep walk (no rebuild)                                 |
| **S5** (cross-repo dependency) | loom sync-manifest: declare `Dockerfile`/compose/devcontainer template-owned + `*-user.*`/`*.override.*` never-overwrite                                                                                    | sync preserves overlays, ships base                                     | dry-run sync                                                |

S1–S4 are in-repo (kailash-coc-py). **S5 touches loom** (the parent splitter repo, a
SEPARATE repo per `repo-scope-discipline.md`) — it is a DEPENDENCY, not in-scope work for
a kailash-coc-py session. It must flow as a `/codify` proposal → loom Gate-1 → `/sync`
per `artifact-flow.md`. Flagged here so `/todos` files it as a cross-repo follow-up, not
an in-repo todo.

## 9. Brief corrections (the gate before /todos)

Re-verification against the actual artifact set surfaced corrections to the inputs:

1. **Inventory under-count** — `gnupg`, `gh`, `curl`, `ruff`, `black`, `npx` were missed
   by the first audit; `gnupg` is load-bearing for the signing substrate. Corrected in
   `01-research/01-runtime-inventory.md` § CORRECTION.
2. **"No wrappers" claim was wrong** — 28 `.claude/wrappers/*.sh.template` files exist;
   they are bash and may shell out to `jq`/`yq`, reinforcing inclusion of those tools.
3. **This repo ships no Python app code** (no root `pyproject.toml`) — it is the pure COC
   template. The Dockerfile therefore serves the DOWNSTREAM consumer project context
   (which has app code), shipped via the template. This is why `requirements-coc.txt`
   (frameworks) is template-owned but the app's own deps live in `requirements-user.txt`.

## 10. Risks / decisions — resolved by Round-1 red-team

Round 1 (`04-validate/round-1-analysis-redteam.md`) surfaced 2 CRITICAL + 4 HIGH + 4
MEDIUM findings, all dispositioned and folded into the specs. Status:

- **C1 (Docker-in-Docker DB collision) — RESOLVED:** compose `postgres`/`redis` services
  are the in-container DB path; `setup-databases.sh` superseded inside; docker.sock is an
  opt-in caveat. See `specs/dev-container-image.md` § Database transport + I9.
- **C2 (gpg signing fake-pass) — RESOLVED:** signing key passed via read-only `~/.ssh`
  (default SSH signing) or `~/.gnupg` + `GPG_TTY`/loopback; I3 now asserts a real signed
  append. See `specs/secrets-and-auth.md` § Signing-key passthrough.
- **H1 (nothing pinned) — RESOLVED:** digest-pin bases + CLIs + hash-locked
  `requirements-coc.txt`. See `specs/dev-container-image.md` § Reproducibility.
- **H2 (overlay no-rebuild fails on split venv) — RESOLVED:** ONE shared `/opt/venv` used
  by base AND overlay. See `specs/dependency-overlay.md` O1 + postCreate step 1.
- **H3 (sudo-apt root escalation) — RESOLVED:** sudo grant DROPPED; OS-package overlay
  moves to `Dockerfile.user FROM base`. See `specs/dev-container-image.md` §6.
- **H4 (ownership invariant missing) — RESOLVED:** added I8. **M1 (UID per-platform),
  M3 (git safe.directory), M4 (arch envelope) — RESOLVED** in `dev-container-image.md`.

Remaining open decisions for the user gate:

- **R1 — Placement:** ship template-owned dev-container files at repo root (recommended,
  editor-auto-detected) vs under `docker/`. See `specs/sync-ownership.md` § Placement.
- **R2 — Image size (M2 decision made):** baked base = lighter five frameworks; ML/Align
  (torch-class) move to an opt-in `requirements-coc-ml.txt` / compose `ml` profile.
  Measure the baked image once at `/implement`; if the lighter set still exceeds ~3 GB,
  revisit. See `specs/dev-container-image.md` §5.
- **R3 — CLI auth model:** Codex/Gemini support both API-key and interactive sign-in;
  the API-key path is the reproducible one for a container. Document that interactive
  ChatGPT/Google sign-in inside a container is a degraded path.
- **R4 — Version pinning cadence:** pinned CLIs + frameworks need a bump owner. Recommend
  the bump rides the existing `/sync` cadence (template regeneration is the natural place).
