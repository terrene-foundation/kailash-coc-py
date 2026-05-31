# Red-Team Round 1 — Analysis + Specs (pre-/todos gate)

Adversarial review of the architecture plan + specs by the analyst agent. Findings ranked
with dispositions. Spec amendments applied this round are noted inline; the specs are the
source of truth and have been updated to match.

## CRITICAL

### C1 — Docker-in-Docker DB collision (ACCEPTED → specs amended)

`scripts/development/setup-databases.sh:9-70` runs `docker run` on the host; it CANNOT
run inside a non-privileged dev container. The plan ambiguously said both "Compose
service names" and "via the existing script". **Disposition:** inside the container, the
Compose `postgres`/`redis` services ARE the DB path (`DATABASE_URL` resolves to the
service name on the compose network); `setup-databases.sh` is a HOST tool, superseded
inside the container. Mounting `/var/run/docker.sock` is an opt-in escape hatch with a
documented host-root-equivalent caveat — NOT default. Amended: `dev-container-image.md`
§ Database transport + invariant I9; `03-user-flows` failure walk added.

### C2 — gpg signing is hand-waved; `gpg --version` passes while real signing fails (ACCEPTED → specs amended)

`coc-sign.js:261-344` spawns `gpg --homedir … --sign`, manages a per-call `gpg-agent`, and
`gpgconf --kill all`. Container gaps the plan omitted: (1) the developer's **private
signing key is on the host**, never in the image — secrets-and-auth.md covered API keys
but was SILENT on the signing key; (2) `gpg-agent`/`pinentry` need `GPG_TTY` +
`pinentry-mode loopback` for non-interactive use; (3) `coc-sign.js` default `keyType` is
**ssh**, so SSH-key signing is the lower-friction container path. **Disposition:** add
signing-key passthrough (bind-mount host `~/.ssh` ro for the default SSH path, or
`~/.gnupg` ro for gpg) + `GPG_TTY`/loopback handling. **I3 changed** from "`gpg --version`
exits 0" to "a real signed coordination-log append succeeds" (no fake-pass). Amended:
`secrets-and-auth.md` § Signing-key passthrough; `dev-container-image.md` I3.

## HIGH

### H1 — Nothing actually pinned; two steps network-nondeterministic (ACCEPTED → specs amended)

Every version is a `<v>`/`latest` placeholder; `uv:latest` floats; `apt-get install gh`
pulls newest; no lockfile for frameworks. **Disposition:** spec now MANDATES digest pins
(`@sha256:`) for base + node + uv images, pinned CLI versions, and `requirements-coc.txt`
shipped as a hash-locked `uv pip compile` output. Literal version values are filled at
`/implement` (current versions queried then), but the pinning MECHANISM is now a spec
requirement + invariant I10. Amended: `dev-container-image.md` § Reproducibility.

### H2 — "No-rebuild overlay" silently fails under split uv targets (ACCEPTED → specs amended)

Base used `uv pip install --system`; postCreate used `uv pip install` (no `--system`) →
different/ambiguous target → `import` may not see the new package. **Disposition:** ONE
named venv at a `dev`-owned path (`/opt/venv`, `VIRTUAL_ENV`+PATH set), used by BOTH the
Dockerfile framework install AND postCreate. Drop `--system`. Added invariant O1' (the
Flow-C walk MUST actually `import` the new package). Amended: `dev-container-image.md` §5,
`dependency-overlay.md` postCreate step 1 + O1.

### H3 — sudo-for-apt is root-equivalent privilege escalation (ACCEPTED → design changed)

`NOPASSWD: apt-get` is root-equivalent (`-o APT::Update::Pre-Invoke=…`, local `.deb`).
Contradicts the non-root model + `security.md` (exceptions need written justification +
security-reviewer). **Disposition:** DROP the sudo grant. OS-package overlay
(`apt-packages.user.txt`) moves from postCreate-sudo to a `Dockerfile.user FROM base`
rebuild path. Trade-off: OS packages need a rebuild; pip/Node deps stay no-rebuild. This
is the correct security call. Amended: `dev-container-image.md` §6 (no sudo),
`dependency-overlay.md` (apt overlay → Dockerfile.user, not postCreate).

### H4 — File-ownership requirement had no invariant (ACCEPTED → specs amended)

Brief lines 69-70/80 require hook-written files stay developer-owned; only `whoami==dev`
(I4) was asserted. **Disposition:** added invariant I8 — files written to the bind mount
are host-user-editable after a session. Amended: `dev-container-image.md` I8;
`sync-ownership.md` traceability matrix.

## MEDIUM

### M1 — UID-alignment per-platform (ACCEPTED → specs amended)

macOS Docker Desktop remaps ownership transparently (UID model is a no-op but harmless);
Linux needs build-arg `USER_UID=$(id -u)` actually passed, and host UID≠1000 breaks
silently otherwise. **Disposition:** spec states per-platform behavior; `bin/dev` +
compose pass `USER_UID`/`USER_GID` from `$(id -u)`/`$(id -g)`. Amended:
`dev-container-image.md` §6 + I4.

### M2 — Image size; I2 import list contradicts R2 (ACCEPTED → decision made)

ML/Align pull torch-class (multi-GB), undermining "one command, fast". I2 already only
imported 4 of 7 frameworks. **Decision (not a menu):** measure once at `/implement`; the
default base bakes the lighter five (`kailash`, `dataflow`, `nexus`, `kaizen`, `pact`);
`kailash-ml` + `kailash-align` move to an opt-in `requirements-coc-ml.txt` installed via a
compose `ml` profile / postCreate flag. I2 import check aligned to the baked set. Amended:
`dev-container-image.md` §5 + I2; `dependency-overlay.md` ml-profile note.

### M3 — git safe.directory omitted (ACCEPTED → specs amended)

Bind-mount UID mismatch → git "dubious ownership" → all 35 hooks (which `git rev-parse`)
break. **Disposition:** Dockerfile/postCreate sets `git config --global --add
safe.directory /workspace`. Added to onboarding walk. Amended: `dev-container-image.md` §6.

### M4 — ARM vs x86 not addressed (ACCEPTED → specs amended)

Host is darwin/arm64; multi-arch bases resolve per-host → arch is part of the
reproducibility envelope; torch wheels differ by arch. **Disposition:** target-platform
policy = build-for-host (a dev image), stated explicitly; arch noted in the reproducibility
envelope; `--platform` pin documented if cross-arch repro is ever needed. Amended:
`dev-container-image.md` § Reproducibility.

## LOW

- **L1 — Governance S5 scoping is CLEAN** (no change needed). Refinement: cite the actual
  manifest mechanism that preserves `CLAUDE.md` today so loom Gate-1 can verify the
  precedent. Noted in `sync-ownership.md`.
- **L2 — `.dockerignore`** must exclude `.claude/learning/` (operator keys/state) and
  `.git` from the build context, not just `.env`; BuildKit `--mount=type=secret` is the
  documented escape hatch if a private package index is ever introduced. Amended:
  `secrets-and-auth.md` S1.
- **L3 — inotify limits + named-volume cache ownership** belong in failure-mode walks.
  Noted in `03-user-flows`.

## Verdict

Round 1: NOT-ready → specs amended to address C1, C2, H1–H4, M1–M4, L2. The big structural
decisions (one Dockerfile, user-overlay split, secrets-out-of-layers, S5 governance) held.
A Round 2 re-derivation should confirm the amendments are internally consistent
(esp. the single-venv model across image + overlay, and I3's real-signing invariant).
