# Docker / Devcontainer Patterns for a Multi-CLI AI Dev Environment

Research for the dev-container workspace. Confirms official install methods for the
three driving CLIs (2026), then surveys the container-architecture decisions:
devcontainer vs plain Dockerfile, base-image strategy, host-secret passthrough,
non-root user, MCP child-process handling, Compose vs `docker run`, and GitHub auth.

## 1. Official CLI install methods (verified 2026-05-27)

All three CLIs are npm-distributed Node binaries. **A single Node runtime hosts all
three** — this is the key simplifying fact for the image.

| CLI          | npm package                 | Install                              | Min Node                   | Notes                                                                                                                                                                    |
| ------------ | --------------------------- | ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code  | `@anthropic-ai/claude-code` | `npm i -g @anthropic-ai/claude-code` | 18 (22 LTS recommended)    | npm path documented as "deprecated" in favor of a native installer, but npm install still works and is the reproducible-in-Dockerfile path. `claude --version` verifies. |
| OpenAI Codex | `@openai/codex`             | `npm i -g @openai/codex`             | 18                         | Also `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` and `brew install --cask codex`. `codex` to start.                                                          |
| Gemini CLI   | `@google/gemini-cli`        | `npm i -g @google/gemini-cli`        | 18 (20+ for current v0.3x) | Latest stable v0.32.1 (Mar 2026). `gemini --version` verifies.                                                                                                           |

**Decision: pin Node 22 LTS in the base image.** It is ≥ every CLI's minimum and is
the recommended runtime for Claude Code. All three `npm i -g` commands run
non-interactively in a Dockerfile `RUN` layer — no TTY, no prompt.

Sources:

- [@anthropic-ai/claude-code — npm](https://www.npmjs.com/package/@anthropic-ai/claude-code)
- [anthropics/claude-code — GitHub](https://github.com/anthropics/claude-code)
- [CLI — Codex | OpenAI Developers](https://developers.openai.com/codex/cli)
- [@openai/codex — npm](https://www.npmjs.com/package/@openai/codex)
- [Gemini CLI installation | geminicli.com](https://geminicli.com/docs/get-started/installation/)
- [@google/gemini-cli — npm](https://www.npmjs.com/package/@google/gemini-cli)

## 2. Devcontainer vs plain Dockerfile

Two consumer surfaces, not mutually exclusive — ship both off ONE Dockerfile:

- **`.devcontainer/devcontainer.json`** — for VS Code / Cursor / GitHub Codespaces /
  JetBrains Gateway users. Gives one-click "Reopen in Container", `postCreateCommand`
  for project-dep install, `containerEnv`/`remoteEnv` for secrets, `mounts` for the
  host gh/git config, `forwardPorts` for Nexus dev servers. Spec at
  [containers.dev](https://containers.dev/implementors/json_reference/).
- **`docker-compose.yml` + `docker run` helper** — for terminal-only users who don't
  use a devcontainer-aware editor. `docker compose run --rm dev` drops them in a shell
  with the same image. Compose also composes cleanly with the existing
  `scripts/development/setup-databases.sh` Postgres/Redis stack.

**Recommendation: one `Dockerfile` is the source of truth; `devcontainer.json` sets
`build.dockerfile: ../Dockerfile`, and `docker-compose.yml` sets `build.context`.**
Both reference the same image so there is exactly one place CLIs/runtimes are pinned.

`devcontainer.json` features (`ghcr.io/devcontainers/features/*`) are an alternative to
hand-rolling apt installs — e.g. `features/github-cli`, `features/node`,
`features/python`. Trade-off: features are convenient but add an opaque build step and
only run under the devcontainer CLI (not plain `docker build`). Since we need the image
to build identically under `docker build` for the Compose path, **prefer explicit
Dockerfile `RUN` layers over features** so both surfaces get the same image.

## 3. Host-secret passthrough (never bake keys into a layer)

The `.env` already holds `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
`DATABASE_URL`, `JWT_SECRET_KEY`. Container must read them at runtime, never at build.

| Mechanism                          | Surface               | When                                                                                       |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `--env-file .env`                  | `docker run`          | Terminal users; simplest.                                                                  |
| `env_file: [.env]`                 | docker-compose        | Compose path; same `.env`.                                                                 |
| `containerEnv` + `${localEnv:VAR}` | devcontainer.json     | Pulls a var from the host environment into the container at create-time.                   |
| `remoteEnv` + `${localEnv:VAR}`    | devcontainer.json     | Pulls into each _shell_ (re-evaluated per exec), better for rotating tokens.               |
| BuildKit `--mount=type=secret`     | Dockerfile build only | Only if a secret were needed AT BUILD time (it is not here — installs are public npm/pip). |

**Recommendation: `.env` stays the single source of truth (matches `CLAUDE.md`
directive 2). Compose path uses `env_file: [.env]`; devcontainer path uses
`remoteEnv` reading from the host `.env` via the `runArgs: ["--env-file", ".env"]`
shortcut OR `${localEnv:ANTHROPIC_API_KEY}`.** Never `COPY .env` into the image, never
`ENV ANTHROPIC_API_KEY=...`. `.env` is already in `.gitignore`. Add `.env` to
`.dockerignore` so it can never be swept into the build context.

## 4. Multi-runtime base image strategy

Need: Python 3.12, Node 22, OS tooling (git, gh, jq, yq, ripgrep, curl, ssh-keygen,
build-essential for any pip packages with C extensions).

| Base                                          | Pros                                                                   | Cons                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `python:3.12-slim-bookworm`                   | Small, official Python; Debian apt for the rest                        | Must install Node manually (NodeSource or `nvm` or copy from node image) |
| `node:22-bookworm`                            | Node baked                                                             | Must install Python manually; full (non-slim) is large                   |
| `mcr.microsoft.com/devcontainers/python:3.12` | Has non-root `vscode` user, common dev tooling, devcontainer-optimized | Microsoft registry; heavier; Node still added via feature/manual         |
| `mcr.microsoft.com/devcontainers/universal`   | Everything preinstalled                                                | ~ multi-GB; wasteful for a focused image                                 |

**Recommendation: start `FROM python:3.12-slim-bookworm`, add Node 22 via the
NodeSource apt repo (or `COPY --from=node:22-bookworm-slim /usr/local /usr/local`
multi-stage copy).** Rationale: Python is the SDK's primary runtime and the
heavier-to-install of the two (frameworks, C extensions); Node is a clean apt/binary
add. The `python:slim` base keeps the image lean. The multi-stage `COPY --from=node`
trick is the cleanest way to get an exact Node version without NodeSource's curl-pipe.

## 5. User-not-root pattern (UID/GID consistency)

The COC hooks write to `.claude/learning/*.jsonl`, `.coc-fetch-cache`, and (per the
multi-operator substrate) `<git-common-dir>/coc-clone-init-witness`. If the container
runs as root, those files become root-owned on the bind-mounted host workspace —
the host user then can't edit them, and the next non-container session breaks.

**Recommendation: create a non-root `dev` user (or reuse the `vscode` user from MS
base images) with a build-arg UID/GID defaulting to 1000, matching the typical host
user.** Pattern:

```dockerfile
ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd --gid $USER_GID dev \
 && useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash dev
USER dev
```

devcontainer.json: set `"remoteUser": "dev"` and
`"updateRemoteUserUID": true` (auto-aligns the container UID to the host's on Linux).
Compose: `user: "${UID:-1000}:${GID:-1000}"`. Global npm installs must target a
user-writable prefix (`npm config set prefix ~/.npm-global` then add to PATH) OR be
installed as root BEFORE `USER dev` (CLIs are install-once, so install-as-root then
drop to `dev` is cleaner and keeps `/usr/local/bin/{claude,codex,gemini}` global).

## 6. MCP server child processes inside the container

Both `.codex/config.toml` and `.gemini/settings.json` start the guard via
`command="node"`, `args=["./.codex-mcp-guard/server.js"]`. The CLI spawns it as a
child; it talks JSON-RPC over stdio. Two container concerns:

- **Node on PATH** — guaranteed by the base image (§4). The guard is plain Node, no
  extra deps to install.
- **PID 1 / zombie reaping** — a CLI spawning child processes (the MCP guard, plus any
  tool subprocesses) under a shell that is PID 1 can leak zombies if PID 1 doesn't reap.
  **Recommendation: use `tini` as the entrypoint init** (`ENTRYPOINT ["/usr/bin/tini",
"--"]` or `docker run --init` / Compose `init: true`). Cheap, standard, eliminates
  the zombie-reaping class entirely.

No port exposure needed for the guard (stdio transport, not network).

## 7. Compose vs `docker run`

Compose wins for the "drop the template in, start coding" flow because:

- One `docker compose up -d` + `docker compose exec dev bash` is more discoverable than
  a long `docker run -it --env-file .env -v $(pwd):/workspace ...` line.
- It composes the dev container alongside the existing Postgres/Redis dev infra
  (`scripts/development/setup-databases.sh`) in one network, so the SDK's `DATABASE_URL`
  resolves to a service name.
- `forwardPorts` / `ports:` for Nexus dev servers (API on 8000, MCP, etc.) is declared
  once.

**Recommendation: ship `docker-compose.yml` with a `dev` service (the CLI host) and
profile-gated `postgres`/`redis` services, plus a thin `bin/dev` wrapper script
(`docker compose run --rm --service-ports dev "$@"`) for the one-command entry.**

## 8. GitHub auth inside the container

COC hooks shell out to `git` and `gh` (issue closure, PR workflows, the multi-operator
`gh api` ruleset checks). Three options:

| Option                 | How                                                                                    | Trade-off                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Mount host gh config   | `mounts: ["source=${localEnv:HOME}/.config/gh,target=/home/dev/.config/gh,type=bind"]` | Reuses host login; read-only mount is safest.                           |
| `GH_TOKEN` env         | Put `GH_TOKEN` in `.env`; `gh` and `git` (via credential helper) pick it up            | Token in `.env` (already gitignored); rotates easily; no host coupling. |
| `gh auth login` inside | Interactive, per-container                                                             | Breaks reproducibility; not for automation.                             |

**Recommendation: support `GH_TOKEN` via `.env` as the documented default
(reproducible, no host-path coupling), and document the host-config bind-mount as the
opt-in for users who prefer their existing `gh` login.** SSH for git push: mount
`~/.ssh` read-only OR use `GH_TOKEN` + HTTPS remote.

## 9. Summary of container-architecture decisions

1. **One Dockerfile** is the source of truth; `devcontainer.json` and
   `docker-compose.yml` both reference it.
2. **`FROM python:3.12-slim-bookworm`** + Node 22 via multi-stage `COPY --from=node`.
3. **All three CLIs** via `npm i -g` in one layer (install as root, then drop user).
4. **Non-root `dev` user**, build-arg UID/GID=1000, `updateRemoteUserUID` on.
5. **`.env` is the only secret surface** — `env_file:` / `remoteEnv`, never a layer.
   `.env` added to `.dockerignore`.
6. **`tini` / `--init`** for PID-1 child-process reaping (the MCP guard).
7. **OS tooling layer**: git, gh, jq, yq, ripgrep, curl, openssh-client (ssh-keygen),
   build-essential, ca-certificates.
8. **Compose** is the recommended entry; `bin/dev` wrapper for one-command launch.
9. **GitHub auth** via `GH_TOKEN` in `.env` (default) or host `~/.config/gh` bind (opt-in).
