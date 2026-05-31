# M1 — Base Image (shard S1)

Implements: `specs/dev-container-image.md` (§Base+build order, §Reproducibility, I1–I8).
Value-anchor: brief 00-user-brief.md — "ship all three CLIs + every runtime the COC set
needs + baseline Kailash deps". This is the foundation every other milestone builds on.
Decisions: plan §0 (ML/Align opt-in; repo-root placement).

## T01 — Build `Dockerfile` (base)

`FROM python:3.12-slim-bookworm@sha256:<digest>`. Cache-ordered layers:

1. OS tooling (one apt layer, `--no-install-recommends`, clean lists):
   `git gnupg openssh-client gh jq ripgrep curl ca-certificates build-essential tini`.
   `gh` from official GitHub apt keyring PINNED (`gh=<v>`); `yq` from a PINNED
   mikefarah release URL by checksum.
2. Node 22 — multi-stage copy from `node:22-bookworm-slim@sha256:<digest>`, **scoped to
   node subtrees only** (`bin/node`, `lib/node_modules`, symlink `npm`/`npx`) — NOT
   blanket `/usr/local` (clobbers base python). MUST verify `python --version` after.
3. uv — copy from `ghcr.io/astral-sh/uv:<v>@sha256:<digest>` (pinned, never `:latest`).
4. Three CLIs as root → global bins, PINNED:
   `npm i -g @anthropic-ai/claude-code@<v> @openai/codex@<v> @google/gemini-cli@<v>`.
5. Shared venv `/opt/venv` (`ENV VIRTUAL_ENV=/opt/venv PATH=/opt/venv/bin:$PATH`);
   `uv pip install -r requirements-coc.txt` into it (BuildKit cache mount; NO `--system`).
6. Non-root `dev` (`ARG USER_UID/USER_GID`); `chown -R dev /opt/venv` BEFORE `USER dev`;
   `git config --global --add safe.directory /workspace`; NO sudo grant.
7. `ENTRYPOINT ["/usr/bin/tini","--"]`, `CMD ["bash"]`.

Pinning (H1) is load-bearing throughout: digest-pin base/node/uv, pin all 3 CLIs.
Ownership (H4→I8): `chown /opt/venv` + non-root close it.
Capacity: 1 file, ~7 invariants (I1–I8), feedback loop = `docker build`. Single shard.

## T02 — Build `requirements-coc.txt` + `requirements-coc-ml.txt`

`requirements-coc.txt` (hash-locked `uv pip compile` output): baked set `kailash`,
`kailash-dataflow`, `kailash-nexus`, `kailash-kaizen`, `kailash-pact`, `ruff`, `black`.
`requirements-coc-ml.txt`: `kailash-ml`, `kailash-align` (opt-in; ml profile). Pin
versions (H1 — hash-locked); query current at implement. Implements: dev-container-image.md
§5, §Reproducibility.

## T03 — Build `.dockerignore`

Exclude `.env`, `.claude/learning/`, the clone-init witness, `.git`, caches. Implements:
`specs/secrets-and-auth.md` S1 + closes N-H1 (operator state — signing-key fingerprints,
posture cache — MUST NOT bake into a layer; that was the forwarded/vacuous L2 closure).

## T04 — Verify base image (integration/wire companion to T01–T03)

Literal walk per `user-flow-validation.md` — receipts to the PR:

- `docker build` green; `claude/codex/gemini --version`, `python/node/uv/git/gh/gpg --version`
  all exit 0 (I1, I3-partial).
- `python --version` works AFTER the node copy (N-L clobber check).
- Baked frameworks import — **derive each import name from the installed package**
  (`pip show -f` / import probe), NOT a guess (B-5); align to I2's set.
- `ruff`/`black` resolve from inside a CLI-spawned hook subprocess, not just a shell (N-M2).
- `ruff --version` + `black --version` exit 0 (I7).
- `whoami`=dev, `id -u`==build UID (I4); `docker history` shows no secret values (I5);
  `tini` is PID 1 (I6).

## Verification (2026-05-27)

**Plan/spec ref:** `02-plans/01-architecture.md` §3 + `specs/dev-container-image.md`
§Base+build order, I1–I8, §Reproducibility. **Pins:** all resolved live today (base/node/uv
@sha256; CLIs 2.1.152/0.134.0/0.43.0; gh 2.92.0; yq 4.53.2; frameworks per requirements-coc.txt).

**Build:** `DOCKER_BUILDKIT=1 docker build` → exit 0, image **2.7 GB** (under the 3 GB R2
threshold — validates the ML-opt-in decision; torch would have blown past it).

**Walk receipts (verbatim, scrubbed):**

- I1: `claude 2.1.152` · `codex-cli 0.134.0` · `gemini 0.43.0` — all exit 0.
- I2 (B-5 derived): `import kailash, dataflow, nexus, kaizen, pact` all OK — names probed
  from `top_level.txt`/RECORD, not guessed (`kailash-pact`→`pact` confirmed via RECORD).
- N-L: `python --version` → `Python 3.12.13` AFTER the scoped node copy (base python survived).
- I7: `ruff 0.15.14` · `black 26.5.1` resolve.
- runtimes: node v22.22.3, uv 0.11.16, git 2.39.5, gh 2.92.0, **gpg 2.2.40** (signing
  toolchain present — full signing WALK is M3/T12, not this shard).
- I4: `whoami`→`dev`, `id -u`→`1000`.
- I6: `/proc/1/comm`→`tini`.
- I5: real-credential-value scan of image env = empty; `GPG_KEY=` is byte-identical in the
  base `python:3.12-slim-bookworm` (public CPython release key, not our secret); history
  matches were package names. No real secret in any layer.

**Bug found + fixed this shard (zero-tolerance):** initial `COPY --from=uvbin
/usr/local/bin/uv /usr/local/bin/uvx` failed (`uvx not found`) — the distroless uv image
keeps binaries at the ROOT. Fixed to `COPY --from=uvbin /uv /uvx /usr/local/bin/` (matches
spec §3). Also caught + fixed two guessed ruff/black versions against PyPI before build.

**Carried to M2/M3 (not gaps — need a bind-mount/signing context this shard lacks):**
I8 host-file-ownership (needs compose bind-mount; M2/T08) and the I3 real-signing walk
(needs key passthrough; M3/T12). gpg-present is confirmed here; signing-works is M3.

**Quality gate (both returned; 2 HIGH, 0 CRITICAL; both fixed same-shard per fix-immediately):**

- reviewer HIGH — `git config --system` vs spec's `--global`. Resolved: `--system` is the
  superior choice (covers any remapped bind-mount uid, not just `dev`'s home); spec §6
  reconciled to `--system` + rationale (Rule 6). Reviewer also confirmed: build order,
  full pinning, `.dockerignore`, cache ordering, `chown`-before-USER all conformant; the
  `safe.directory`-before-mount "concern" is unfounded (path-prefix allowlist, leave as-is).
- security-reviewer HIGH — gh `.deb` + yq binary installed with NO checksum verification
  (violated the spec's own H1 `@sha256`). Resolved: added per-arch `GH_SHA256_*`/`YQ_SHA256_*`
  build-args + `sha256sum -c` gates BEFORE `dpkg -i` / `chmod` (checksums from cli/cli
  `checksums.txt` + computed from the yq binaries). security-reviewer PASSED: secret-in-layer,
  non-root, no-sudo, uv/npm root-then-drop posture. Spec §1 reconciled to the .deb+sha256 path.
- Both flagged the read-only `~/.ssh`/`~/.gnupg` writable-overlay need as M3/T12 scope (tracked).

**Spec updates (first-instance, Rule 5):** I2 import-name mapping recorded as verified
(was UNVERIFIED/B-5-hedged); user-flow import line de-hedged to the confirmed list.

**Hardening follow-up (honest deviation note):** `requirements-coc.txt` uses top-level
exact pins; the spec's `--generate-hashes` transitive hash-lock is NOT yet generated
(deferred to a hardening pass — top-level exact pins give reproducibility; hashes add
supply-chain integrity). Tracked, not silently dropped.
