# Round 2 Red-Team — Cross-Spec Consistency + Citation Resolution

Scope: Part A (cross-spec drift) + Part B (citation resolution) for the dev-container
`/analyze` plan + 4 specs. Report-only; no spec/plan files edited.

Evidence base: 4 specs, `02-plans/01-architecture.md`, `03-user-flows/01-developer-onboarding.md`,
`briefs/00-user-brief.md`, plus `grep`/`ls` against the live repo.

---

## PART A — Cross-Spec Consistency Findings

### A-1 (HIGH) — Plan §3 step 5 still says `uv pip install --system`, contradicting the H2 "no `--system`" rule

The shared-venv model is consistent **across the three specs**: image §5 (`/opt/venv`,
`VIRTUAL_ENV=/opt/venv`, "no `--system`"), overlay postCreate step 1 ("SAME shared venv
`/opt/venv`… H2 — no `--system`"), and O1 ("base and overlay share ONE venv") all agree on
the same path and the same rule.

BUT the **architecture plan body** drifted from its own resolution:

- `02-plans/01-architecture.md:49` — "Installed via `uv pip install --system` with a BuildKit cache mount."
- `02-plans/01-architecture.md:142` (§10 H2) — "RESOLVED: ONE shared `/opt/venv` used by base AND overlay."

The plan asserts H2 is RESOLVED in §10 but §3 step 5 still carries the pre-fix `--system`
text. A `/implement` agent reading §3 would bake `--system` (site-packages install), which
H2 says breaks the overlay no-rebuild contract. The redteam round-1 file (`:46-49`) and the
research file (`03-extensibility-patterns.md:103`) also still show `--system`, but those are
historical/superseded surfaces. The **plan §3** is a forward-looking source-of-truth for S1
and is internally contradictory. Recommend §3 step 5 be corrected to the `/opt/venv` no-`--system` form before `/todos`.

### A-2 (HIGH) — `apt-packages.user.txt` is inconsistently alive across plan + user-flow vs the specs (H3 drift)

H3 dropped the apt-overlay: extra OS packages go via `Dockerfile.user FROM base`, NOT an
apt overlay file. The specs honor this:

- `dependency-overlay.md` step 2 — "(OS packages are NOT installed here — H3 dropped the `sudo apt` step…)"; the two-surfaces table routes extra OS packages to `Dockerfile.user FROM base`.
- `dev-container-image.md` §6 — "NO passwordless sudo grant (H3)… moves to the `Dockerfile.user FROM base` rebuild path."

But `apt-packages.user.txt` is still treated as a live overlay file in multiple places,
inconsistent with "OS packages go via Dockerfile.user, not an apt overlay":

- `02-plans/01-architecture.md:25` — lists `apt-packages.user.txt` as a project-owned file.
- `02-plans/01-architecture.md:82` (§6 postCreate step 2) — "`sudo apt-get install $(cat apt-packages.user.txt)` if present." **This is the exact `sudo apt` step H3 dropped — still present in the plan, AND re-introduces the sudo grant H3 removed for the root-escalation reason.**
- `03-user-flows/01-developer-onboarding.md:47` — "For an OS package: `echo "libpq-dev" >> apt-packages.user.txt` then re-run postCreate."
- `03-user-flows/01-developer-onboarding.md:56` (Flow D) — lists `apt-packages.user.txt` among preserved files.
- `sync-ownership.md:14,17` — lists `apt-packages.user.txt` as project-owned AND in the preserve glob set.

Net: `sync-ownership.md` Part-A prompt note ("dropped/changed after H3") is only _partially_
true — the file is still listed there as project-owned/preserved. The contradiction is that
the overlay spec + image spec route OS packages through `Dockerfile.user` and explicitly drop
the apt step, while the plan §6, the user-flow, and sync-ownership still present
`apt-packages.user.txt` + `sudo apt-get` as the mechanism. **The plan §6 step 2 is the most
severe instance** — it ships the dropped sudo-apt path as a `/implement` instruction.
Recommend: purge `apt-packages.user.txt` + the `sudo apt-get` postCreate step from plan §6,
user-flow `:47`, and the project-owned/preserve lists, OR (if the file is intentionally kept
as a _manifest read by Dockerfile.user_) state that role explicitly everywhere it appears.
As written, the four surfaces disagree.

### A-3 (MEDIUM) — I2 import list differs between image spec (5 imports) and user-flow (4 imports)

- `dev-container-image.md:63` (I2) — `python -c "import kailash, dataflow, nexus, kaizen, pact"` (5 modules).
- `03-user-flows/01-developer-onboarding.md:18` — `python -c "import kailash, dataflow, nexus, kaizen"` (4 modules; `pact` dropped).

The user-flow is the literal acceptance walk (per `user-flow-validation.md`); it MUST match
the invariant it verifies. As written, the walk under-checks I2 (skips `pact`). Recommend the
user-flow import line be reconciled to the I2 set. (See also B-5 — the import names themselves
are UNVERIFIED.)

### A-4 (LOW) — Invariant/`_index` numbering is otherwise consistent

- I1–I9 (image), O1–O5 (overlay), S1–S4 (secrets), G1–G4 (sync), S1–S5 (shards) all resolve;
  no spec cites a non-existent or renumbered invariant. `sync-ownership.md` Brief-Traceability
  cites I1/I2/I3/I6/I7 + O1/O5 + S1/S4 + G1/G4 — every cited invariant exists in its source spec.
- Note a benign **namespace overload**: `S1–S5` are _shards_ in the plan but `S1–S4` are
  _secrets invariants_ in `secrets-and-auth.md`. Both are internally scoped and unambiguous in
  context, but a careless reader could conflate "S4" (shard: overlay stubs) with "S4" (invariant:
  missing-.env error). LOW; optional disambiguation.
- `_index.md` manifest lists exactly the 4 spec files that exist (`dev-container-image.md`,
  `dependency-overlay.md`, `secrets-and-auth.md`, `sync-ownership.md`); every listed file
  exists and no extra spec file is unlisted. CLEAN.

### A-5 (LOW) — Brief traceability matrix re-verified

Each row of `sync-ownership.md` § Brief Traceability maps to a real, existing spec section.
"Honor the COC hook surface → I3/I6/I7 (gnupg, tini, formatters)" is the one to watch: brief
requirement #6 is about _Node hooks executing_, and the matrix maps it to gnupg/tini/formatters
(necessary but not obviously the same thing as "hooks fire"). The image spec does cover Node
(§2) + tini reaping (I6), so the requirement is met — but the matrix cell under-cites (omits §2
Node / I1). MEDIUM-leaning-LOW; the coverage exists, the citation is thin.

---

## PART B — Citation Resolution Table

| #    | Claim (spec/plan)                                                                                                                                               | Resolves?         | Evidence                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| B-1  | `.claude/hooks/lib/coc-sign.js` exists                                                                                                                          | ✅ YES            | `ls` → 15415-byte file present                                                                                                                                                                                                                                                                                                                                                      |
| B-1  | `coc-sign.js` default `keyType` is `"ssh"` (C2 fix depends on it)                                                                                               | ✅ YES            | `coc-sign.js:373` `const keyType = o.keyType \|\| "ssh"`; `:415` same; JSDoc `:362,406` `[opts.keyType="ssh"]`. Default IS ssh — `secrets-and-auth.md` § Signing-key passthrough claim is CORRECT, NOT a citation error                                                                                                                                                             |
| B-2  | `.claude/hooks/detect-package-manager.js` exists (O5/plan §6.3 reuse)                                                                                           | ✅ YES            | `ls` → 5886-byte file present                                                                                                                                                                                                                                                                                                                                                       |
| B-3  | `scripts/development/setup-databases.sh` exists AND runs `docker run` (C1)                                                                                      | ✅ YES            | `ls` → present; `grep` → `:48 docker run --name test-postgres`, `:70 docker run --name test-mysql`. C1 premise CONFIRMED                                                                                                                                                                                                                                                            |
| B-3b | `scripts/development/setup-environment.sh` exists (brief constraint)                                                                                            | ✅ YES            | `ls` → 9601-byte file present                                                                                                                                                                                                                                                                                                                                                       |
| B-3c | `.codex-mcp-guard/server.js` exists (brief constraint)                                                                                                          | ✅ YES            | present at both `.codex-mcp-guard/server.js` and `.claude/codex-mcp-guard/server.js`                                                                                                                                                                                                                                                                                                |
| B-4  | 7 framework pip names match CLAUDE.md                                                                                                                           | ✅ YES            | CLAUDE.md `:146-152` documents `kailash`, `kailash-dataflow`, `kailash-nexus`, `kailash-kaizen`, `kailash-pact`, `kailash-ml`, `kailash-align` — exact match to plan §3 step 5 + image §5                                                                                                                                                                                           |
| B-5  | I2 Python IMPORT names (`import kailash, dataflow, nexus, kaizen, pact`)                                                                                        | ⚠️ **UNVERIFIED** | No installed packages (import probe failed — packages absent), no `pyproject.toml`, no Python source in this template repo. The pip-name→import-name mapping cannot be confirmed from the repo. `dataflow`/`nexus`/`kaizen`/`pact` as top-level import names are PLAUSIBLE but unproven; `kailash-pact` could import as `pact` OR `kailash_pact` — indeterminate here. See B-5 note |
| B-6  | `.dockerignore`, `bin/dev`, `requirements-coc.txt`, `Dockerfile`, `docker-compose.yml`, `.devcontainer/`, `requirements-user.txt` described as NOT-yet-existing | ✅ YES            | `ls` → all absent. Specs correctly treat them as to-be-created at `/implement`; none cited as already-existing                                                                                                                                                                                                                                                                      |
| B-7  | Round-1 redteam file (cited by every spec header + plan §10)                                                                                                    | ✅ YES            | `04-validate/round-1-analysis-redteam.md` present (7163 bytes)                                                                                                                                                                                                                                                                                                                      |
| B-8  | Plan §9 "28 `.claude/wrappers/*.sh.template` files exist"                                                                                                       | ✅ YES            | `ls …                                                                                                                                                                                                                                                                                                                                                                               | wc -l` → 28. Exact |

### B-5 note (recommendation) — UNVERIFIED import names

I2 (`dev-container-image.md:63`) and the user-flow (`:18`) both assert specific Python
**import** names derived from **pip** names. The import-name guesses cannot be confirmed in
this repo (no installed packages, no app source). The risk is concrete: a `pip`→`import` name
mismatch (e.g. `kailash-pact` importing as `kailash_pact` not `pact`, or sub-packages being
namespaced under `kailash.*` rather than top-level) would make I2's literal `python -c` command
fail at `/implement` even on a correctly-built image — a false-negative invariant.

**Recommend:** hedge I2 to an import-probe-at-implement-time rather than a hardcoded module
list — e.g. derive the import name per package via `pip show -f <pkg>` / `importlib.metadata`,
or assert "each baked framework imports under its documented module name (resolved at build)".
Flag for `/redteam` Round 3 or `/implement` to pin the actual names against the installed wheels.

---

## Severity Roll-Up

- **CRITICAL:** none. (The C2 ssh-default citation, the highest-stakes Part-B claim, RESOLVED correctly — no critical citation error found.)
- **HIGH:** A-1 (`--system` drift in plan §3 vs H2 rule), A-2 (`apt-packages.user.txt` / sudo-apt H3 drift across plan §6 + user-flow + sync-ownership).
- **MEDIUM:** A-3 (I2 import-list mismatch image-spec-vs-user-flow), B-5 (UNVERIFIED import names), A-5 (thin brief-traceability cite for hook-surface row).
- **LOW:** A-4 (S-namespace overload shards vs secrets-invariants; otherwise numbering clean).

## Cross-spec verdict

Specs (the 4 files) are largely internally consistent on the shared-venv model, ownership
classes, and invariant numbering. The two HIGH findings are **plan/user-flow lagging the
specs' own resolved dispositions** (H2 and H3): the specs were updated, but the plan body §3/§6
and the user-flow were not fully re-derived to match — the `specs-authority.md` §5b full-sibling
re-derivation gap. Both are mechanical to close before `/todos`.
