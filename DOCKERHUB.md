# kailash-coc-py

**A reproducible, multi-CLI development container for the Kailash Python SDK.**

`terrenefoundation/kailash-coc-py` ships every runtime, every CLI, and every framework a Kailash contributor needs to go from `docker pull` to a working dev shell in one command — with no host-side Python, Node, or CLI install required.

- **License:** Apache 2.0
- **Source:** [github.com/terrene-foundation/kailash-coc-py](https://github.com/terrene-foundation/kailash-coc-py)
- **Architectures:** `linux/amd64`, `linux/arm64`
- **Provenance + SBOM:** generated on every publish (BuildKit `provenance: true` + `sbom: true`)
- **Maintainer:** [Terrene Foundation](https://terrene.foundation) (Singapore CLG)

---

## What's inside

### Three AI coding CLIs, all pinned

| CLI               | Version | Package                     |
| ----------------- | ------- | --------------------------- |
| Claude Code       | 2.1.152 | `@anthropic-ai/claude-code` |
| OpenAI Codex CLI  | 0.134.0 | `@openai/codex`             |
| Google Gemini CLI | 0.43.0  | `@google/gemini-cli`        |

All three resolve on `$PATH` as `claude`, `codex`, and `gemini`. The image is CLI-neutral by design — switch between them in the same shell without rebuilds.

### Kailash framework set (baked in)

| Framework          | Version | Purpose                                    |
| ------------------ | ------- | ------------------------------------------ |
| `kailash`          | 2.26.2  | Workflow orchestration, 140+ nodes         |
| `kailash-dataflow` | 2.10.0  | Zero-config database operations            |
| `kailash-nexus`    | 2.6.3   | Multi-channel deployment (API + CLI + MCP) |
| `kailash-kaizen`   | 2.24.1  | AI agent framework                         |
| `kailash-pact`     | 0.12.0  | Organizational governance (D/T/R)          |

ML / Align frameworks are **opt-in** (`kailash-ml`, `kailash-align`) to keep the default image lean — see _Optional ML profile_ below.

### Runtimes

| Runtime | Version              | Base image                                  |
| ------- | -------------------- | ------------------------------------------- |
| Python  | 3.12 (slim-bookworm) | `python:3.12-slim-bookworm` (digest-pinned) |
| Node.js | 22 LTS               | `node:22-bookworm-slim` (digest-pinned)     |
| `uv`    | 0.11.16              | `ghcr.io/astral-sh/uv` (digest-pinned)      |

A **single shared virtualenv** lives at `/opt/venv` and is on `$PATH`. The baked framework set, project overlays, and ad-hoc installs all share it — no per-project venv juggling, no `--system` pip installs.

### OS tooling

`git`, `gnupg`, `openssh-client`, `curl`, `ca-certificates`, `build-essential`, `jq`, `ripgrep`, `tini`, `gh` (GitHub CLI 2.92.0, sha256-verified per-arch), `yq` (4.53.2, sha256-verified per-arch), `ruff` 0.15.14, `black` 26.5.1.

---

## Quick start

### Option 1 — one-line shell (`docker run`)

```bash
docker run --rm -it \
  -v "$PWD:/workspace" \
  -w /workspace \
  terrenefoundation/kailash-coc-py:1.22.0
```

You land in `/workspace` as the non-root user `dev` with every CLI, framework, and runtime ready.

### Option 2 — Compose + `bin/dev` (recommended for project work)

The companion repo ships a `docker-compose.yml`, a `bin/dev` wrapper that pre-flights the registry pull, a Dev Containers config, and a layered overlay system for project-specific extensions. Clone the template:

```bash
git clone https://github.com/terrene-foundation/kailash-coc-py
cd kailash-coc-py
cp .env.example .env          # add ANTHROPIC_API_KEY etc.
./bin/dev                     # pulls the image (one-time) then shells in
```

`bin/dev <cmd>` runs an arbitrary command inside the container; with no args you get an interactive shell. The pull only happens once — subsequent runs are cache hits.

### Option 3 — Dev Containers / editor integration

The repo's `.devcontainer/devcontainer.json` points at this published image. Open the folder in a Dev Containers-compatible editor and it pulls the image and attaches automatically — no local build.

---

## Tags & versions

Image tags follow the COC template version (`.claude/VERSION::version` in the source repo). Each COC template release cuts a corresponding image release with the same semver.

| Tag      | Meaning                                                                                 |
| -------- | --------------------------------------------------------------------------------------- |
| `1.22.0` | Current stable. Pinned semantic version — recommended for derivative builds.            |
| `latest` | Moving pointer to the most recent stable release.                                       |
| `1.21.0` | Prior stable (2026-08-04). Retained for provenance.                                     |
| `1.10.1` | Prior stable (2026-05-31). Retained for provenance.                                     |
| `0.1.0`  | First-cut release (2026-05-28). Retained for provenance; prefer `1.22.0+` for new work. |

The `:latest` tag is suitable for `bin/dev` ergonomics. **For reproducible derivative builds, pin a digest** — see _Building on top of this image_ below.

Every published tag carries:

- OCI image labels (`org.opencontainers.image.{source,revision,version,licenses}`)
- BuildKit provenance attestation
- SBOM (Software Bill of Materials)

The manifest digest for every published version is recorded as a build artifact
(`image-manifest-<tag>`) on the publish workflow run that produced it, and can be resolved
directly at any time with `docker manifest inspect` (see _Building on top of this image_ below).

---

## Building on top of this image

The image is intentionally **closed for OS package additions** during runtime — the `dev` user has no `sudo` grant (security hardening H3). If you need extra OS packages, build a thin derivative image:

```dockerfile
# Dockerfile.user — pin a digest for reproducibility
FROM terrenefoundation/kailash-coc-py:1.22.0@sha256:<digest>

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev graphviz \
 && rm -rf /var/lib/apt/lists/*
USER dev
```

Get the current digest:

```bash
docker manifest inspect terrenefoundation/kailash-coc-py:1.22.0
```

**Python and Node dependencies do NOT need a rebuild** — drop them in `requirements-user.txt` / `package.json` and let the container's `postCreate` step install them into the shared venv on next start.

---

## Optional ML profile

The default image excludes torch-class dependencies (multi-gigabyte) to keep the base lean. Two paths to enable ML / Align:

1. **Compose profile:** `docker compose --profile ml up dev` — the bundled compose service `dev` runs the same image but executes `postCreate.sh --ml`, which installs `kailash-ml` and `kailash-align` into the shared venv on first start.
2. **Ad-hoc:** `uv pip install kailash-ml==1.7.4 kailash-align==0.7.1` inside the container — the venv is writable by `dev`.

Both paths leave the base image unchanged; ML deps live in the project's overlay, not in the published image.

---

## Security posture

- **Non-root by default.** The runtime user is `dev` (uid 1000, gid 1000). No passwordless `sudo`, no setuid binaries beyond Debian baseline.
- **`tini` as PID 1.** Reaps child processes cleanly; eliminates the orphan-process / zombie failure mode common in containerized Python.
- **Supply-chain pins.** Every base image is referenced by `@sha256:` digest. `gh` and `yq` artifacts are sha256-verified per-arch _before_ `dpkg -i` / `chmod +x` — TLS authenticates transport, not the artifact.
- **No secrets in layers.** API keys, tokens, and signing keys are **never** baked into the image. Inject them at runtime via `env_file` (Compose) or `-e` flags (`docker run`). `.env` is gitignored in the template.
- **No `.git` clobber risk.** `git config --system safe.directory /workspace` is set so a bind-mounted repo from any host UID works without compromising git's safe-directory check.

---

## Architecture & workflow context

This image is the runtime substrate for **COC (Cognitive Orchestration for Codegen)**, a methodology for AI-assisted software development developed by Terrene Foundation. COC ships the same institutional knowledge surface — agents, skills, rules, commands — to three driving CLIs (Claude Code, OpenAI Codex, Google Gemini), so a project's COC artifacts work identically regardless of which CLI a contributor opens.

The image carries the runtime. The COC artifact set lives in the project repo under `.claude/` (synced from the upstream template) and is loaded by whichever CLI starts a session.

Read more:

- [COC methodology](https://github.com/terrene-foundation/loom) — central template + variant overlay system
- [Kailash Python SDK](https://github.com/terrene-foundation/kailash) — the framework set baked into this image
- [Terrene Foundation](https://terrene.foundation) — the Singapore-CLG nonprofit that maintains both

---

## What this image is NOT

- **Not a production runtime.** This is a developer-facing dev container. Production Kailash deployments use slim images derived from the published framework wheels — not this everything-included shell.
- **Not a CI builder.** GitHub Actions, GitLab CI, and similar should install the specific framework versions they need rather than pull the full multi-CLI dev image.
- **Not pinned to one CLI.** The image carries Claude Code, Codex, and Gemini CLI; the project's COC artifacts are CLI-portable by design. Pick whichever CLI you prefer, switch any time.

---

## Reporting issues

- **Image content** (a baked dependency is wrong, a CLI version is stale): [github.com/terrene-foundation/kailash-coc-py/issues](https://github.com/terrene-foundation/kailash-coc-py/issues)
- **Framework bugs** (a `kailash`, `kailash-dataflow`, etc. issue): [github.com/terrene-foundation/kailash](https://github.com/terrene-foundation/kailash) (the upstream BUILD repo)
- **COC methodology** (agent / skill / rule / command improvements): file against the [kailash-coc-py template repo](https://github.com/terrene-foundation/kailash-coc-py/issues) — it originates upstream proposals.

---

## Verification

After pulling, verify the image is intact:

```bash
docker run --rm terrenefoundation/kailash-coc-py:1.22.0 bash -c '
  claude --version
  codex --version
  gemini --version
  python -c "import kailash, dataflow, nexus, kaizen, pact; print(\"OK\")"
  uv --version
'
```

Expected output:

```
2.1.152 (Claude Code)
codex-cli 0.134.0
0.43.0
OK: kailash, dataflow, nexus, kaizen, pact
uv 0.11.16
```

---

**License:** Apache 2.0 © Terrene Foundation. Every dependency baked into this image retains its own license; see the image SBOM for the full inventory.
