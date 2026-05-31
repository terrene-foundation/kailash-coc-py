# User Flow — Developer Onboarding Into the Dockerized Dev Environment

The literal walk a developer takes. Per `user-flow-validation.md`, this flow is the
acceptance contract — `/implement` is not "done" until this walk produces real receipts.

## Flow A — First-time contributor, Compose path (the default)

```
1. Clone the project (kailash-coc-py already dropped in).
2. cp .env.example .env  &&  edit .env  → fill ANTHROPIC_API_KEY / OPENAI_API_KEY /
   GOOGLE_API_KEY / GH_TOKEN (and DATABASE_URL/JWT_SECRET_KEY if the app needs them).
3. ./bin/dev                    # = docker compose run --rm --service-ports dev bash
   → first run builds the image (cached thereafter); lands in a shell as user `dev`.
4. Inside the shell, verify the workbench:
   claude --version  &&  codex --version  &&  gemini --version
   python --version  &&  node --version  &&  uv --version
   git --version  &&  gh --version  &&  gpg --version
   python -c "import kailash, dataflow, nexus, kaizen, pact"   # all baked frameworks
                                     # (import names verified from installed packages 2026-05-27, B-5)
5. claude              # start a Claude Code session; session-start hook fires,
                       # detects .env, surfaces workspace + posture banner.
```

**Expected end state:** every binary resolves, frameworks import, the COC hooks fire
exactly as on a host, `.env` keys are present in the environment but absent from any
image layer.

## Flow B — VS Code / Cursor / Codespaces user (devcontainer path)

```
1. Open the project folder in VS Code.
2. Command palette → "Dev Containers: Reopen in Container".
   → builds from .devcontainer/devcontainer.json → ../Dockerfile.
   → postCreateCommand runs .devcontainer/postCreate.sh (installs any user overlays).
3. Integrated terminal is already user `dev` with UID aligned to host (files stay yours).
4. Same verification block as Flow A step 4.
```

## Flow C — Add a project dependency WITHOUT a rebuild (the extensibility walk)

```
1. echo "httpx>=0.27" >> requirements-user.txt        # project-owned, survives /sync
2. docker compose exec dev .devcontainer/postCreate.sh # idempotent re-run
   → uv installs httpx into the running container; no `docker build`.
3. python -c "import httpx"                            # available immediately
```

For an OS package (e.g. `libpq-dev`): add it to a `Dockerfile.user` (`FROM <base>`) and
rebuild — OS packages need a rebuild (the sudo-apt overlay was dropped for security, H3).
For an extra service (e.g. a vector DB): add it to `compose.override.yml` (Docker
auto-merges it) then `docker compose up -d`.

## Flow D — Survives a template sync

```
1. Project pulls a newer kailash-coc-py (/sync regenerates template-owned files).
2. Dockerfile, docker-compose.yml, devcontainer.json, requirements-coc.txt → updated.
3. requirements-user.txt, package.json, Dockerfile.user, compose.override.yml,
   postCreate.user.sh → UNTOUCHED.
4. ./bin/dev rebuilds the base (new frameworks/CLIs) + re-applies the user overlay.
   → the developer keeps their additions across the upgrade.
```

## Failure-mode walks the implementation must handle (not just happy path)

- **No `.env`:** `bin/dev` MUST print a clear "copy .env.example → .env first" message,
  not a cryptic missing-var error.
- **Root-owned files:** after a session, `git status` on the HOST must show hook-written
  files as editable by the host user (UID alignment working) — NOT root-owned.
- **gnupg absent (regression guard):** with a second operator enrolled, a signed
  coordination-log append MUST succeed inside the container (proves `gpg` is present).
- **Stale image after CLI bump:** `bin/dev` rebuild picks up the new pinned CLI version.

## Receipts required at /implement (per user-flow-validation.md MUST-2)

Each of Flow A step 4, Flow C, and Flow D MUST be walked with verbatim command + output
captured into the PR description before the deliverable is declared done. Tests + a green
`docker build` are necessary but NOT sufficient — the literal `./bin/dev` → version-check
→ `claude` walk is the last mile.
