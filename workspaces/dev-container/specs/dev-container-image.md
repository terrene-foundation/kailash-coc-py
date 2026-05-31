# Spec — Dev Container Image (Architecture B — registry-distributed)

Authority on the dev container image. Two surfaces under Architecture B (registry
distribution, pivoted 2026-05-28):

1. **Image acquisition** (consumer-facing) — how consumers obtain and verify the image.
2. **Publisher build recipe** (provenance) — what bytes the publisher ships.

Source-of-truth for `/implement` shards S1 (publisher recipe), S2 (consumer-shipped
compose+bin/dev), S3 (consumer-shipped devcontainer), and the publish workflow (S5).
Amended by `04-validate/round-1-analysis-redteam.md` (C1, C2, H1–H4, M1–M4) and by the
2026-05-28 Architecture B pivot (see §Change log).

## Change log

- 2026-05-29: Architecture B reframing. §§1–7 (build recipe) re-scoped as
  publisher-internal. New § Image acquisition added with consumer-side invariants.
  Invariant I10 added for the registry-pull contract. Anchor:
  `workspaces/dev-container/journal/0003-DECISION-cross-repo-authorized-close-loom-384.md`
  (user verbatim: "By coupling to loom, it kills productivity").
- 2026-05-27: Initial spec under Architecture A (sync-distributed Dockerfile).

## Image acquisition (Architecture B — consumer-facing)

The dev image is published on Docker Hub as `terrenefoundation/kailash-coc-py:<version>`
(multi-arch amd64+arm64). The first publish (2026-05-28) is tag `0.1.0` at manifest
digest `sha256:c62467b3…` (visible via `docker manifest inspect`).

Consumers acquire the image via `docker pull` — they do NOT build the Dockerfile on
first run. The consumer-shipped configs that reference the registry tag:

- `docker-compose.yml`: `image: ${DEV_IMAGE:-docker.io/terrenefoundation/kailash-coc-py:1.10.1}`
- `.devcontainer/devcontainer.json`: `"image": "docker.io/terrenefoundation/kailash-coc-py:1.10.1"`
- `bin/dev`: pre-flights `docker pull` with a clear registry-unreachable error when the
  pull fails (network down / Docker Hub outage / image-tag typo).

Template developers iterating on the publisher recipe (§§1–7 below) flip
`DEV_IMAGE=kailash-coc-dev:local` in `.env` and uncomment the `build:` block in
`docker-compose.yml` to rebuild from this repo's Dockerfile instead of pulling.

## Publisher build recipe (§§1–7 below — provenance only for consumers)

The sections below describe what the publisher BUILDS to produce the image consumers
pull. Consumers do NOT execute this recipe on first run. It lives in this repo as:
(a) build provenance (auditors can trace every byte of the manifest back to a recipe
line), (b) the input to `.github/workflows/publish-dev-image.yml`, (c) the rebuild path
for template developers iterating on the recipe.

## Base + build order

`FROM python:3.12-slim-bookworm`. Layers ordered for maximum cache reuse (slow-changing
first, app source last). **All base images digest-pinned (`@sha256:`)** — see § Reproducibility.

1. **OS tooling** — single apt layer, `--no-install-recommends`, `rm -rf
   /var/lib/apt/lists/*` at end:
   `git gnupg openssh-client gh jq ripgrep curl ca-certificates build-essential tini`
   - `gh` (GitHub CLI): install the PINNED-version `.deb` from the cli/cli release, verified
     by per-arch `sha256sum -c` BEFORE `dpkg -i` (H1 — TLS authenticates transport, not the
     artifact). (Chosen over the apt keyring so the checksum gate is explicit + per-arch.)
   - `yq` (mikefarah/yq Go binary): install the PINNED-version binary from the release URL,
     verified by per-arch `sha256sum -c` BEFORE `chmod +x`, NOT apt (H1).
2. **Node 22 LTS** — multi-stage copy from `node:22-bookworm-slim@sha256:<digest>`, scoped
   to the node subtrees ONLY (N-L): `COPY --from=node .../bin/node /usr/local/bin/node`,
   `lib/node_modules`, and symlink `npm`/`npx` — NOT a blanket `COPY /usr/local /usr/local`
   (the `python:3.12-slim` base ships python at `/usr/local/bin`; a whole-tree copy
   clobbers the base python). Digest-pinned; ≥ every CLI minimum (Node 18; Gemini v0.3x
   wants 20+; Claude Code rec 22). `/implement` MUST verify `python --version` still works
   AFTER the node copy.
3. **uv** — `COPY --from=ghcr.io/astral-sh/uv:<pinned-version>@sha256:<digest> /uv /uvx /usr/local/bin/`.
   Version + digest pinned (H1 — never `:latest`).
4. **Three CLIs** (installed as root → global bins in `/usr/local/bin`), versions PINNED:
   `npm i -g @anthropic-ai/claude-code@<v> @openai/codex@<v> @google/gemini-cli@<v>`.
   Literal versions filled at `/implement` (queried then); the PIN is the spec requirement.
5. **Single shared venv + frameworks** — create ONE venv at a `dev`-owned path
   (`/opt/venv`, chowned to `dev`), `ENV VIRTUAL_ENV=/opt/venv PATH=/opt/venv/bin:$PATH`.
   Install the BAKED framework set into THAT venv (H2 — base and overlay MUST share the
   same venv target; no `--system`):
   `uv pip install --mount=type=cache,target=/home/dev/.cache/uv -r requirements-coc.txt`
   - **Baked set (default, lighter):** `kailash`, `kailash-dataflow`, `kailash-nexus`,
     `kailash-kaizen`, `kailash-pact`, `ruff`, `black`.
   - **Opt-in heavy set (M2):** `kailash-ml`, `kailash-align` pull torch-class
     multi-GB deps. They live in `requirements-coc-ml.txt`, installed only via the
     compose `ml` profile / a postCreate `--ml` flag. Keeps first-run image lean.
   - **Discoverability (N-M3):** because ML/Align are NOT baked by default, a downstream
     project whose code `import`s them fails confusingly. The `requirements-user.txt`
     stub comment AND the README MUST tell users to enable the `ml` profile (or add the
     packages to `requirements-user.txt`) — so the opt-in is discoverable, not a trap.
   - **Venv reaches every subprocess (N-M2):** `ENV VIRTUAL_ENV` + `PATH` are set at the
     image layer so they're inherited by the CLI process AND every hook subprocess the CLI
     spawns (where `ruff`/`black` resolve). `/implement` MUST verify `ruff`/`black` resolve
     from inside a CLI-spawned hook, not just an interactive shell.
6. **Non-root `dev` user** — `ARG USER_UID=1000`, `ARG USER_GID=1000`; create group+user
   `dev`, `-m -s /bin/bash`. `USER dev` AFTER global installs. **NO passwordless sudo
   grant** (H3 — `NOPASSWD: apt-get` is root-equivalent via `Pre-Invoke`; the OS-package
   overlay moves to the `Dockerfile.user FROM base` rebuild path instead). Also set
   `git config --system --add safe.directory /workspace` (M3 — bind-mount UID mismatch
   else trips git "dubious ownership", breaking every hook that shells `git rev-parse`).
   `--system` (not `--global`): `/etc/gitconfig` applies to ANY uid a bind-mount remaps
   to, where `--global` would only cover `dev`'s `~/.gitconfig` (reviewer HIGH, 2026-05-27).
   - **Per-platform UID note (M1):** on Linux, `bin/dev` + compose MUST pass
     `USER_UID=$(id -u)` / `USER_GID=$(id -g)` at build so bind-mounted files stay
     host-editable (host UID is often ≠ 1000). On macOS Docker Desktop the VirtioFS layer
     remaps ownership transparently — the build-arg is harmless but not load-bearing.
7. **Entrypoint** — `ENTRYPOINT ["/usr/bin/tini","--"]`, default `CMD ["bash"]`.

## Database transport (C1)

`scripts/development/setup-databases.sh` runs `docker run` on the HOST — it CANNOT run
inside a non-privileged dev container. Inside the container:

- **Default:** the Compose `postgres`/`redis` services ARE the DB path. `DATABASE_URL`
  resolves to the service name on the compose network (`postgresql://...@postgres:5432/...`).
  Tier-2/Tier-3 tests (real-infra, per `testing.md`) connect to these services.
- `setup-databases.sh` is superseded inside the container; it remains a HOST-side tool.
- **Opt-in escape hatch:** mounting `/var/run/docker.sock` enables docker-in-container
  but grants host-root-equivalent access — documented with that caveat, NOT the default.

## Invariants (MUST hold)

- **I10 — Image acquisition via registry pull (Arch B):** `docker pull
docker.io/terrenefoundation/kailash-coc-py:<version>` exits 0 and produces a multi-arch
  manifest covering `linux/amd64` + `linux/arm64`. `bin/dev` performs this pull as a
  pre-flight when the image is absent locally AND surfaces a clear actionable error
  (network / registry / tag-typo / fallback to local-build) when the pull fails.
  Consumer-shipped configs (`docker-compose.yml`, `.devcontainer/devcontainer.json`)
  reference the registry tag, not a local-build tag, by default.
- **I1 — All three CLIs resolve:** `claude --version`, `codex --version`,
  `gemini --version` each exit 0.
- **I2 — Baked frameworks import:** every baked framework imports cleanly. Import names
  DERIVED from the installed packages in the built image (B-5 closed empirically,
  2026-05-27 — `top_level.txt` / RECORD probe, NOT a guess): `kailash`→`kailash`,
  `kailash-dataflow`→`dataflow`, `kailash-nexus`→`nexus`, `kailash-kaizen`→`kaizen`,
  `kailash-pact`→`pact`. Acceptance: `python -c "import kailash, dataflow, nexus, kaizen, pact"`
  exits 0 (the user-flow walk uses this exact list — A-3). `kailash-ml`/`kailash-align`
  import names only checked when the ml profile is on.
- **I3 — Signing works for real (not just present):** `gpg --version` exits 0 AND BOTH (a)
  a real coordination-log append AND (b) a real `git commit -S` succeed with the signing
  key passed through per `secrets-and-auth.md` § Signing-key passthrough (C2/N-H2 —
  version-present is NOT sufficient; the read-only-key path must actually sign on both
  surfaces, which have different writable-file needs).
- **I4 — Non-root by default:** `whoami` returns `dev`; `id -u` == build-arg UID (the host
  UID on Linux per M1).
- **I5 — No secret in any layer:** `docker history` + image scan show no `ANTHROPIC_*` /
  `OPENAI_*` / `GOOGLE_*` / `GH_TOKEN` / `JWT_*` values. `.env` ∈ `.dockerignore`.
- **I6 — Child-process reaping:** `tini`/`--init` is PID 1; the MCP-guard Node child
  exits cleanly without zombies.
- **I7 — Formatters present:** `ruff --version` + `black --version` exit 0 (auto-format hook).
- **I8 — Bind-mounted files stay host-owned (H4):** files the hooks write to the mounted
  workspace (`.claude/learning/*.jsonl`) are editable by the HOST user after a session —
  not root-owned. (Linux: UID-alignment; macOS: VirtioFS remap.)
- **I9 — DB reachable via compose service name (C1):** from inside the container,
  `DATABASE_URL` connects to the compose `postgres` service; no host docker daemon needed.

## Reproducibility (H1, M4)

- **Pin everything:** base + node + uv images by `@sha256:` digest; all three CLI
  versions; `requirements-coc.txt` shipped as a **hash-locked `uv pip compile` output**
  (transitive deps hash-pinned). Floating `:latest` / unpinned `apt-get install gh` is a
  red-team finding, not a feature.
- **Target-platform policy (M4):** this is a build-for-host dev image; arch (arm64 on
  Apple Silicon vs amd64) IS part of the reproducibility envelope — the image is identical
  per-arch, not cross-arch. Document `--platform` pinning as the opt-in if cross-arch
  reproducibility is ever required. torch-class wheels (ml profile) differ by arch.
- Version bumps ride the `/sync` regeneration cadence (R4).

## Out of scope

- Production runtime image for the user's app (`Dockerfile.user FROM base` is the hatch).
- CI runner image (separate concern; this is a developer-driving-a-session host).
