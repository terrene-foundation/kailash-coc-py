# Brief — Dockerized Development Environment for kailash-coc-py USE Template

## Requester

User: jack.hong@esperie.com — date 2026-05-27.

## Verbatim request

> please work with a team of agents and /analyze how can we create a full
> development environment in docker for this USE template, including all CLIs,
> dependencies etc. Also make it possible for users to install additional
> dependencies as their projects require.

## Scope

A reproducible Docker-based development environment for any project that has
`kailash-coc-py` dropped into it. The environment must:

1. **Ship all three driving CLIs** — Claude Code, OpenAI Codex, Gemini CLI —
   pre-installed and ready to drive sessions against the COC artifact set.
2. **Carry every runtime the COC artifact set needs** — Node.js for hooks +
   bin tooling + MCP guard server, Python for the Kailash SDK and its
   frameworks, plus the supporting tools the rules and commands shell out to
   (jq, yq, gh, ripgrep, git, etc.).
3. **Carry baseline Kailash dependencies** — Core SDK, DataFlow, Nexus,
   Kaizen, PACT, ML, Align — all installable from PyPI per `CLAUDE.md`.
4. **Be extensible per-project** — downstream users who consume this template
   in their own project must be able to layer their additional Python and
   Node dependencies on top without rebuilding from scratch, and without
   forking the base image.
5. **Pass host secrets safely** — the user's API keys for Anthropic, OpenAI,
   Google live in their host environment / `.env`; the container must read
   them at session start without baking them into any image layer.
6. **Honor the COC hook surface** — every hook under `.claude/hooks/*.js`
   must execute inside the container exactly as it does on a host; the
   session-start, validate-bash-command, integration-hygiene, and posture
   hooks all use Node + run shell commands.

## Out of scope

- CI image — this brief is about a developer-driving-a-session container,
  not a CI runner.
- Database containers for application infra — those are already covered by
  `scripts/development/setup-databases.sh` and can be composed alongside.
- Production runtime images for the user's own application — the user owns
  that image; this brief is the development host.

## Success signals

- A fresh contributor runs one command and lands inside a shell that has
  `claude`, `codex`, `gemini`, `python`, `pip`, `node`, `gh`, `jq`, `yq`,
  `rg`, `git`, and the Kailash framework pip packages all available.
- The contributor's host `.env` is honored without copying into a layer.
- They can `claude` or `codex` or `gemini` immediately and every hook
  fires correctly.
- They can add `requirements-dev.txt` / `package.json` / their own
  `pyproject.toml` extras and have those installed on next container
  rebuild — or, ideally, live without a rebuild.
- The base image is repo-template-owned (regenerated on `/sync`), but the
  user's overlay is project-owned and survives `/sync`.

## Known constraints from the existing template

- `CLAUDE.md` mandates `.env` as the single source of truth — no
  hardcoded model strings or API keys in any artifact.
- The Codex MCP guard server (`.codex-mcp-guard/server.js`) is a child
  process started by Codex via `command="node"`. The container must have
  Node available on `PATH`.
- Hooks emit to `.claude/learning/violations.jsonl` and other paths whose
  ownership must remain the developer user, not root.
- `scripts/development/setup-environment.sh` already checks for Docker
  on the host; the new dev-container approach should layer cleanly with
  that, not replace it.
- `cross-repo.md` MUST-3 mandates COC artifacts live under `.claude/`;
  the dev-container artifact MUST NOT be written to `scripts/` for the
  COC surface. Project-ops Docker files (Dockerfile / compose) can live
  at the repo root or under `docker/`.

## Post-pivot constraints (2026-05-28, Architecture B)

- **Publish pipeline** (post-pivot): the publisher-built image is
  produced by `.github/workflows/publish-dev-image.yml` (multi-arch
  buildx + Docker Hub push on git tag). Docker Hub repository:
  `terrenefoundation/kailash-coc-py`. First-published manifest:
  `terrenefoundation/kailash-coc-py:0.1.0` (multi-arch amd64+arm64,
  manifest digest `sha256:c62467b3…` per the 2026-05-28 publish).
  Image is PUBLIC; `docker pull` is the consumer install path.
- **Tag-pin discipline**: derivative `Dockerfile.user FROM …` references
  MUST pin the registry tag at a specific digest
  (`terrenefoundation/kailash-coc-py:<X.Y.Z>@sha256:…`) to keep
  consumer-built derivative images reproducible. `:latest` is a moving
  pointer suitable for `bin/dev` ergonomics, not for derivative builds.
- **Image tag tracks `.claude/VERSION`**: the published image tag MUST
  match `.claude/VERSION::version` (read the file — do not trust a value
  restated here). Every COC template bump cuts a corresponding image
  release; **SIX** consumer-shipped files reference the same tag and MUST
  all be bumped together (`docker-compose.yml`,
  `.devcontainer/devcontainer.json`, `bin/dev`, `README.md`,
  `Dockerfile.user.example`, `DOCKERHUB.md`). `DOCKERHUB.md` is the most
  user-facing of the six — the publish workflow's "Sync Docker Hub
  overview" step pushes it to the registry page — so a release that bumps
  only the other five silently republishes a stale page. The `0.1.0`
  first-cut (2026-05-28) remains on Docker Hub for provenance, and
  `DOCKERHUB.md`'s "Prior stable" row intentionally retains an older tag.
