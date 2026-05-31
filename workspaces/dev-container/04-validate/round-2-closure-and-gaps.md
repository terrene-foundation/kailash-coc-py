# Red-Team Round 2 — Closure-Parity + New-Gap Hunt (pre-/todos gate)

Adversarial re-derivation of the Round-1 dispositions against the amended specs, plus a
new-gap hunt on the surfaces the amendments changed. Report-only; no spec/plan edits.

## PART A — Closure-Parity Table

| Finding                        | Claimed disposition                                                                   | Landed?        | Where (file:line)                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 (DinD DB collision)         | compose services = in-container DB; setup-databases.sh superseded; docker.sock opt-in | ✅             | `dev-container-image.md:47-57` § Database transport + I9 `:79-80`                                                                                                                                                                        |
| C2 (gpg fake-pass)             | SSH/`~/.gnupg` ro mount + GPG_TTY/loopback; I3 = real signed append                   | ✅             | `secrets-and-auth.md:33-51`; I3 `dev-container-image.md:66-68`                                                                                                                                                                           |
| H1 (nothing pinned)            | digest-pin base+node+uv+CLIs; hash-locked requirements-coc.txt                        | ✅ (mechanism) | `dev-container-image.md:9,16-21,84-86` § Reproducibility                                                                                                                                                                                 |
| H2 (split-venv overlay)        | ONE shared `/opt/venv`, VIRTUAL_ENV+PATH, no `--system`                               | ✅             | `dev-container-image.md:25-29`; `dependency-overlay.md:26-27`, O1 `:38-40`                                                                                                                                                               |
| H3 (sudo-apt escalation)       | sudo DROPPED; OS pkgs → `Dockerfile.user FROM base`                                   | ✅             | `dev-container-image.md:36-38`; `dependency-overlay.md:14,28-30`                                                                                                                                                                         |
| H4 (ownership invariant)       | added I8 + traceability matrix                                                        | ✅             | `dev-container-image.md:76-78`; `sync-ownership.md:66`                                                                                                                                                                                   |
| M1 (per-platform UID)          | bin/dev+compose pass `USER_UID=$(id -u)`; macOS no-op                                 | ✅             | `dev-container-image.md:35,41-44`, I4 `:69`                                                                                                                                                                                              |
| M2 (image size / ml split)     | baked = lighter 5; ml/align → `requirements-coc-ml.txt` + compose `ml` profile        | ✅             | `dev-container-image.md:30-34`; I2 `:63-64`; `dependency-overlay.md:14`                                                                                                                                                                  |
| M3 (git safe.directory)        | `git config --global --add safe.directory /workspace`                                 | ✅             | `dev-container-image.md:38-40`                                                                                                                                                                                                           |
| M4 (ARM vs x86)                | build-for-host policy; arch in repro envelope; `--platform` opt-in                    | ✅             | `dev-container-image.md:88-91`                                                                                                                                                                                                           |
| L1 (S5 governance clean)       | cite manifest mechanism preserving CLAUDE.md                                          | ⚠ partial      | `sync-ownership.md:31,36` cites "preserve-globs in sync-manifest" + `CLAUDE.md § Regeneration` but does NOT cite the _actual_ mechanism that preserves CLAUDE.md today (template-owned exclusion). Refinement vacuous, not load-bearing. |
| L2 (.dockerignore scope)       | exclude `.claude/learning/` + `.git`; BuildKit `--mount=type=secret` escape hatch     | ❌ NOT LANDED  | `secrets-and-auth.md` S1 (`:23-25`) mentions ONLY `.env ∈ .dockerignore`. No `.claude/learning/`, no `.git`, no `--mount=type=secret`. **Forwarded/vacuous closure.**                                                                    |
| L3 (inotify + cache ownership) | "Noted in 03-user-flows"                                                              | ❌ NOT LANDED  | Absent from `03-user-flows/01-developer-onboarding.md` and all specs. **Forwarded/vacuous closure.**                                                                                                                                     |

Two named invariants from Round-1 prose did NOT materialize verbatim: **I10** (H1 pinning
invariant) and **O1'** (H2 import-walk). I10 is prose-only under § Reproducibility (no
numbered invariant); O1' landed as plain **O1** (`dependency-overlay.md:38`, substance
intact). Minor — substance present, labels drifted.

## PART B — Ranked NEW Findings

### HIGH

**N-H1 — L2 closure is forwarded (operator-state leak + `.git` bloat unguarded).**
Round-1 marked L2 RESOLVED ("Amended: secrets-and-auth.md S1"), but S1 only covers `.env`.
`.claude/learning/` holds the coordination log, posture cache, signing-key fingerprints
(`verified_id`) — operator-identity state. With no `.dockerignore` entry it enters the
build context and can bake into a layer (S3 "image is shareable" then leaks operator
state). `.git` (full history) also bloats every build. **Fix:** add to `secrets-and-auth.md`
S1: `.dockerignore` MUST exclude `.env*`, `.claude/learning/`, `.git`, `**/__pycache__`,
`node_modules`; add invariant S5 (`docker history`/context-scan shows no `.claude/learning/`
content). One-line spec edit; no design change.

**N-H2 — SSH read-only `~/.ssh` mount breaks `git commit -S` host-key + allowed-signers
writes (I3 "real signed append" may fail the real-git path).** `coc-sign.js` itself is
clean: its SSH path writes payload/`.sig`/`allowed_signers` to `os.tmpdir()`
(`coc-sign.js:167,213-221`), never `~/.ssh` — so the coordination-log append works ro.
BUT I3 also asserts "a real signed **commit**." `git commit -S` with `gpg.format=ssh`
needs `gpg.ssh.allowedSignersFile` (git does NOT auto-write it, but `git` over SSH remotes
writes `~/.ssh/known_hosts`, and some setups expect a writable `~/.ssh`). The ro mount is
safe for `coc-sign.js` but the spec conflates two signing paths. **Fix:** narrow I3 to the
coordination-log-append path (which `coc-sign.js` proves works ro) OR mount `~/.ssh` ro +
set `GIT_SSH_COMMAND` with a writable `known_hosts` at a `dev`-owned path
(`-o UserKnownHostsFile=/home/dev/.ssh_known_hosts`). State which path I3 walks.

### MEDIUM

**N-M1 — `/opt/venv` chown ordering not pinned; `dev` may not be able to write the overlay.**
§5 says "create ONE venv … chowned to `dev`" and "`USER dev` AFTER global installs" (§6).
The base installs frameworks into `/opt/venv` as **root** (step 5 precedes the §6 user
creation). If `chown -R dev /opt/venv` does not run AFTER the framework install and BEFORE
`USER dev`, postCreate's `uv pip install -r requirements-user.txt` (running as `dev`) hits
EACCES — silently breaking O1 (the headline no-rebuild promise). The spec asserts the
chown but does not pin the ORDER relative to the framework install. **Fix:** §5/§6 MUST
state: install frameworks as root → `chown -R dev:dev /opt/venv` → `USER dev`. Add to I-set:
"`dev` can write `/opt/venv` (touch test in postCreate)."

**N-M2 — `VIRTUAL_ENV`/PATH survival into CLI-spawned subprocesses unverified.** O1 depends
on `uv pip install` (no `--system`) resolving `/opt/venv` via `VIRTUAL_ENV`. `ENV` in the
Dockerfile covers the login shell, but the three CLIs spawn Node→`node`→hook subprocesses
and `auto-format.js` shells `ruff`/`black`. If a CLI resets env or postCreate runs under a
non-login shell, `uv` may target the system interpreter. **uv respects `VIRTUAL_ENV`
without `--system`** (correct call), but the spec never asserts PATH/`VIRTUAL_ENV` survives
into the hook-spawned subprocess layer. **Fix:** O1 walk MUST `import` from a CLI-spawned
subprocess (e.g. via a hook), not just the interactive shell; add invariant "ruff/black
resolve from `/opt/venv` in a PostToolUse hook subprocess."

**N-M3 — ml-profile opt-in is not discoverable; downstream `import kailash_ml` breaks
confusingly.** M2 moved ml/align out of the default image (I2 imports only the baked 5).
A downstream project whose app code does `import kailash_ml` gets `ModuleNotFoundError`
inside the container with no signpost — the brief (§3) lists ML/Align as baseline deps, so
users reasonably expect them. **Fix:** `dependency-overlay.md` MUST document the discovery
path (a clear comment in `requirements-coc-ml.txt` stub + a `bin/dev --ml` flag surfaced in
the README/onboarding walk); add a failure-mode walk to `03-user-flows` ("import kailash_ml
fails → enable ml profile"). Tension with brief §3 noted below.

### LOW

**N-L1 — H3 regression against brief success-signal is real but acceptable — say so
explicitly.** Brief success signal (`00-user-brief.md:56-58`) accepts "next container
rebuild — or, ideally, live without a rebuild." OS packages now ALWAYS need a
`Dockerfile.user` rebuild (H3). This satisfies the brief's literal "or rebuild" wording —
pip/Node stay no-rebuild — but the spec never states the trade-off was weighed against the
brief. **Fix:** one sentence in `dependency-overlay.md` confirming brief-compliance.

**N-L2 — multi-stage `COPY --from=node …/usr/local /usr/local` clobber risk unaddressed.**
Copying ALL of node's `/usr/local` over the python base's `/usr/local` overwrites
`/usr/local/bin`, `/usr/local/lib`, `/usr/local/share`. python:3.12-slim keeps its
interpreter in `/usr/local/bin/python3` — the node image's `/usr/local` does NOT contain
python, so the copy DROPS `/usr/local/bin/python3` if python lives there. (slim-bookworm
ships python at `/usr/local/bin` — this IS a real clobber risk.) **Fix:** §2 MUST copy
scoped paths (`COPY --from=node … /usr/local/bin/node /usr/local/bin/`,
`/usr/local/lib/node_modules`) NOT the whole tree, OR verify `python3` survives with a
build-time `python --version` assertion. Currently I1/I2 would catch it at build, but the
spec should pin the scoped copy.

**N-L3 — L3 deferral (inotify/cache-ownership) silently dropped.** Named-volume cache dirs
(`uv`/`npm`/`pre-commit`, `dependency-overlay.md` O4) are created root-owned by Docker on
first mount; `dev` then cannot write them → postCreate fails. Round-1 deferred this to
03-user-flows; it never landed. **Fix:** add the named-volume-ownership failure-mode walk
(chown the volume mountpoint or use `:U` / tmpfs) to `03-user-flows`.

## Verdict

**NOT blocking for /todos — proceed with 3 spec patches folded in first.** No CRITICAL.
The structural design (single Dockerfile, shared `/opt/venv`, secrets-out-of-layers, S5
governance, ml-profile split) is sound and all Round-1 CRITICAL/HIGH dispositions landed.
Two HIGH (N-H1 L2 forwarded closure; N-H2 I3 ro-mount path ambiguity) and one MEDIUM
(N-M1 chown ordering) touch the headline invariants (S3 shareable image, I3 real-signing,
O1 no-rebuild) and MUST be resolved in the specs before `/todos` shards them — each is a
one-paragraph spec edit, not a design change. N-M3 (ml-profile discoverability) should be
surfaced to the user as a brief-tension decision. Recommend: fold N-H1, N-H2, N-M1 into the
specs, surface N-M3 to the user, then advance.
