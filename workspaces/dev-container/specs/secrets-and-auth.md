# Spec — Secrets and Auth

Authority on credential handling. Source-of-truth for the no-secret-in-layer invariant
across all shards. Anchored to `CLAUDE.md` directive 2 (`.env` is the single source of
truth) and `rules/security.md` (no hardcoded secrets, no secrets in layers/logs).

## Credential surface

`.env` holds (from `.env.example` + GitHub auth): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GOOGLE_API_KEY`, `OPENAI_PROD_MODEL`/`OPENAI_DEV_MODEL`/`DEFAULT_LLM_MODEL`,
`DATABASE_URL`, `JWT_SECRET_KEY`, and `GH_TOKEN` (added for in-container GitHub auth).

## Passthrough mechanism (runtime only, never build)

| Path | Mechanism |
| --- | --- |
| Compose | `env_file: [.env]` on the `dev` service |
| Devcontainer | `runArgs: ["--env-file",".env"]` OR `remoteEnv` reading host env |
| `docker run` | `--env-file .env` |

## Invariants (MUST hold)

- **S1 — No build-time secret + no operator state in the build context (N-H1):** the
  image is built with zero secret values — no `COPY .env`, no `ENV <secret>=`, no `ARG`
  carrying a key. `.dockerignore` MUST exclude `.env` + `.env.*` (with `!.env.example`
  whitelist), `.claude/learning/` (operator signing-key fingerprints, posture cache,
  coordination log), `.claude/operator-id`, the clone-init witness (`**/.coc-clone-init-witness`),
  the session-notes (`**/.session-notes`), `.coc-fetch-cache`, and `.git` — otherwise a
  broad `COPY . .` bakes operator state into a layer, contradicting S3. BuildKit
  `--mount=type=secret` is the documented escape hatch IF a build-time secret is ever
  genuinely needed (e.g. a private package index) — not needed today (installs are public).
- **S2 — Runtime injection only:** keys appear in the container's environment at run, via
  the table above.
- **S3 — Image is shareable:** a built image pushed to a registry leaks no credentials
  (`docker history`/scan clean) — follows directly from S1.
- **S4 — Missing-.env is a clear error:** `bin/dev` detects an absent `.env` and prints
  "copy `.env.example` → `.env` and fill your keys" — not a cryptic downstream failure.
- **S5 — `.dockerignore` overlay-exclusion gate (post-pivot, Arch B):** under
  registry distribution, downstream `Dockerfile.user FROM terrenefoundation/kailash-coc-py:<version>`
  layers can ship to PUBLIC registries. `.dockerignore` MUST exclude project-owned overlay
  files (`.devcontainer/`, `compose.override.yml`, `Dockerfile.user`, `requirements-user.txt`)
  so a downstream `COPY . .` in a derivative `Dockerfile.user` cannot bake them into a
  published derivative layer. The publisher image is `docker history`-clean of these paths
  (S3 generalized to "no PII / no operator state / no project-owned overlay in any
  consumer-pushed derivative layer either"). Verification: `grep -E "^(\.devcontainer/|compose\.override\.yml|Dockerfile\.user|requirements-user\.txt)$" .dockerignore`
  returns 4 hits.

## Signing-key passthrough (C2 — the commit-signing substrate)

The multi-operator coordination substrate signs coordination-log records with the
developer's git commit-signing key (`verified_id` per `rules/multi-operator-coordination.md`
§1). The signing helper (`.claude/hooks/lib/coc-sign.js`) spawns `gpg`/`gpgconf` or
`ssh-keygen` per call. The container needs the KEY (a secret, host-resident) and correct
agent/TTY handling — having `gpg` installed is necessary but NOT sufficient (the original
plan's `gpg --version` check was a fake-pass).

**Two distinct signing paths — do not conflate (N-H2):**

1. **Coordination-log append** (`coc-append.js` → `coc-sign.js`). VERIFIED safe under a
   read-only key mount: `coc-sign.js` writes its ephemeral signing scratch to
   `os.tmpdir()` (`coc-sign.js:167`, `:213-221`), NOT into `~/.ssh`/`~/.gnupg`, so a
   read-only key directory is sufficient for the append path.
2. **`git commit -S`** (ordinary signed commits). SSH-signed git commits want a WRITABLE
   `~/.ssh/known_hosts` and read access to the `allowed_signers` file; a strictly
   read-only `~/.ssh` can break `git commit -S` even though the coordination-log append
   succeeds. Mount `~/.ssh` read-only for the KEY but provide a writable
   `known_hosts`/`allowed_signers` (e.g. copy into the `dev` home at postCreate, or a
   separate writable mount). I3's walk MUST exercise BOTH: a coordination-log append AND a
   `git commit -S`.

- **Default — SSH-key signing.** `coc-sign.js` defaults to `keyType: "ssh"`
  (`coc-sign.js:373,415` — `o.keyType || "ssh"`; VERIFIED Round-2). Bind-mount host
  `~/.ssh` **read-only** for the private key; `git config gpg.format ssh` is the user's
  setup. The private key is never baked.
- **GPG-key signing (when configured).** Bind-mount host `~/.gnupg` **read-only**; set
  `GPG_TTY=$(tty)` and `pinentry-mode loopback` so a passphrase-protected key signs
  non-interactively. NOTE: `gpg` writes lockfiles/`random_seed` into `~/.gnupg`; a strict
  read-only mount may force `--no-autostart` + a writable `GNUPGHOME` copy. `gpg-agent`
  reaping (`gpgconf --kill all`) is handled by the `tini` PID-1 init.
- **Invariant:** I3 in `dev-container-image.md` asserts a REAL signed append AND a real
  `git commit -S` succeed — the literal walk, not a version check.
- **Mount surface (opt-in, both doors).** The signing-key mount is OPT-IN, not active by
  default: a `--mount type=bind` of a non-existent host path (a developer with no `~/.ssh`)
  ABORTS container creation, so a template that hard-wired the mount would break the default
  container for HTTPS-only / no-key users. Devcontainer door: uncomment the SSH (or GPG)
  bind in `.devcontainer/devcontainer.json` `mounts`. Compose door: add the read-only bind
  via `compose.override.yml` (project-owned). `postCreate.sh` stages whichever read-only
  mount is present (`~/.host-ssh` → writable `~/.ssh`; `~/.host-gnupg` → writable GNUPGHOME)
  and is a silent no-op when neither is mounted (O2). The append path (surface 1) reads the
  read-only key directly; `git commit -S` (surface 2) uses the staged writable copy.
- **Gitconfig staging (third mount surface, OPT-IN).** Signing keys alone are necessary
  but NOT sufficient — `git commit -S` also needs `git config user.signingkey` /
  `user.email` / `user.name` to know WHICH key to use and HOW to author commits. The
  gitconfig mount is OPT-IN symmetric to the SSH/GPG pattern: uncomment the `~/.gitconfig`
  read-only mount in `.devcontainer/devcontainer.json`; `postCreate.sh` Step 0b copies it
  to a writable `~/.gitconfig` so git reads it. When the gitconfig mount is absent AND
  either SSH or GPG mount is present, `postCreate.sh` surfaces a clear warning that
  `git config user.signingkey` will not propagate from the host and the developer must
  re-run `git config --global user.signingkey …` inside the container.

## GitHub auth

- **Default:** `GH_TOKEN` in `.env` → `gh` and the git HTTPS credential helper consume it.
  Reproducible, no host-path coupling.
- **Opt-in:** read-only bind of host `~/.config/gh` (`mounts:` in devcontainer / `-v` ro
  in compose). For users who prefer their existing host login.
- **Anti-pattern:** interactive `gh auth login` inside the container — breaks
  reproducibility; documented as discouraged.

## CLI provider auth

API-key path (keys in `.env`) is the reproducible, container-correct path for all three
CLIs. Interactive ChatGPT/Google browser sign-in inside a container is a degraded path
(R3) — documented, not the default.
