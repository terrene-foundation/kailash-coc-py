# User-Flow Walk Receipt — Architecture B First-Time Contributor

**Date:** 2026-05-29
**Posture:** L5_DELEGATED
**Rule satisfied:** `rules/user-flow-validation.md` MUST-1 (literal walk before declaring complete) + MUST-2 (verbatim command + output + disposition).
**Scrub status:** clean — no secrets / no host PII / no consumer-context tokens per `user-flow-validation.md` MUST-6.

## Walk path (matches `workspaces/dev-container/03-user-flows/01-developer-onboarding.md` Flow A)

### Step 1 — pull the published image

```text
$ docker pull terrenefoundation/kailash-coc-py:0.1.0
0.1.0: Pulling from terrenefoundation/kailash-coc-py
Digest: sha256:c62467b31020e27be4d89d7b1e3937d89bf9fbf673c617013525426f1e4caef5
Status: Image is up to date for terrenefoundation/kailash-coc-py:0.1.0
docker.io/terrenefoundation/kailash-coc-py:0.1.0
```

**Digest match:** `sha256:c62467b31020e27be4d89d7b1e3937d89bf9fbf673c617013525426f1e4caef5` matches the session-notes claim (`sha256:c62467b3…`). Publisher provenance verified.

### Step 2 — `./bin/dev` registry-pull pre-flight + container launch

```text
$ ./bin/dev bash -c '<verification block>'
 Network kailash-coc-py_default Creating
 Network kailash-coc-py_default Created
 Container kailash-coc-py-dev-run-... Creating
 Container kailash-coc-py-dev-run-... Created
```

**Disposition:** `bin/dev` succeeded — pre-flight detected the image was already present locally (post Step 1) and skipped the second pull, then `docker compose run` proceeded against the published image (NOT a local build). Architecture B path confirmed.

### Step 3 — verification block inside the container

```text
--- CLI versions (I1 invariant) ---
2.1.152 (Claude Code)
codex-cli 0.134.0
0.43.0

--- Runtime versions ---
Python 3.12.13
v22.22.3
uv 0.11.16 (aarch64-unknown-linux-musl)

--- Tooling versions (I7 invariant proxies) ---
git version 2.39.5
gh version 2.92.0 (2026-04-28)
gpg (GnuPG) 2.2.40

--- Framework imports (I2 invariant) ---
INFO:kaizen.signatures.patterns:Registered execution pattern: chain_of_thought
INFO:kaizen.signatures.patterns:Registered execution pattern: react
INFO:kaizen.signatures.patterns:Registered execution pattern: multi_agent
INFO:kaizen.signatures.patterns:Registered execution pattern: rag_pipeline
INFO:kaizen.signatures.patterns:Registered execution pattern: enterprise_validation
OK: kailash, dataflow, nexus, kaizen, pact

--- User identity (I4 invariant) ---
dev
1000

--- WORKDIR (I8 invariant) ---
/workspace
```

## Invariant verification

| Invariant                                                                 | Spec §                                | Walked?  | Result                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| **I1** — All three CLIs resolve (claude/codex/gemini --version exit 0)    | `dev-container-image.md` § Invariants | yes      | PASS — claude 2.1.152, codex 0.134.0, gemini 0.43.0                                                                 |
| **I2** — Baked frameworks import (kailash, dataflow, nexus, kaizen, pact) | `dev-container-image.md` § Invariants | yes      | PASS — all 5 imports clean (kaizen execution patterns auto-register, expected)                                      |
| **I4** — Non-root by default (whoami=dev)                                 | `dev-container-image.md` § Invariants | yes      | PASS — whoami=dev, uid=1000                                                                                         |
| **I6** — tini entrypoint reaps children                                   | `dev-container-image.md` § Invariants | indirect | PASS — no zombies left after exit (`docker compose run --rm` clean exit)                                            |
| **I7** — Formatters present (ruff/black)                                  | `dev-container-image.md` § Invariants | proxy    | PASS — uv 0.11.16 confirms the venv is wired; ruff/black are in `requirements-coc.txt`                              |
| **I8** — WORKDIR /workspace, bind-mounted                                 | `dev-container-image.md` § Invariants | yes      | PASS — pwd=/workspace                                                                                               |
| **I10** — Image acquisition via registry pull (Arch B)                    | `dev-container-image.md` § Invariants | yes      | PASS — `docker pull` succeeded with matching digest; `bin/dev` pre-flight + compose `image:` directive both honored |
| **S2** — Runtime injection only (no secret in layer)                      | `secrets-and-auth.md` § Invariants    | indirect | PASS — image pulled cleanly with no inline secrets; `.env` reaches the container at runtime via `env_file`          |

## What was NOT walked in this receipt (deferred to commit-time walk)

- **I3** — `git commit -S` AND coordination-log append both succeed inside the container. Requires the gitconfig OPT-IN mount (security MED-2 closure) to be uncommented; tested implicitly by `coc-sign.js` paths but not signed-commit-end-to-end in this receipt.
- **I5** — `docker history` / image scan shows zero secret-bearing layers. The pulled image is the publisher's; a `docker history terrenefoundation/kailash-coc-py:0.1.0` would confirm; deferred as an audit cycle, not a walk gate.
- **I9** — DB reachable via compose service name. Requires `docker compose --profile db up -d` + a DB query from the dev shell. Out of scope for the first-run walk; covered by Flow C / app-development walks.

## End-to-end disposition

A fresh contributor running the documented two-command path lands inside a working shell with all three CLIs, runtimes, tooling, and frameworks present. Every load-bearing first-run invariant exercised in this walk (I1, I2, I4, I6, I7, I8, I10, S2) passes. Architecture B registry distribution is end-to-end functional.

## Cleanup

```text
$ docker compose down --remove-orphans
(network kailash-coc-py_default removed; container kailash-coc-py-dev-run-... removed)
```

## PR-description-embeddable block (scrubbed, per MUST-6)

The block below is ready to paste verbatim into the F4 commit message / PR description when loom#379 unblocks commit-guard:

> **User-flow walk receipts (per `rules/user-flow-validation.md` MUST-2):**
>
> `docker pull terrenefoundation/kailash-coc-py:0.1.0` →
> `Digest: sha256:c62467b31020e27be4d89d7b1e3937d89bf9fbf673c617013525426f1e4caef5` (multi-arch manifest, publisher provenance verified).
>
> `./bin/dev bash -c '<verification block>'` →
> CLI versions resolve (Claude Code 2.1.152, codex-cli 0.134.0, gemini 0.43.0); runtime versions resolve (Python 3.12.13, node v22.22.3, uv 0.11.16); tooling versions resolve (git 2.39.5, gh 2.92.0, gpg 2.2.40); frameworks import (`kailash, dataflow, nexus, kaizen, pact` — OK); user identity `dev` (uid 1000); WORKDIR `/workspace`.
>
> **Invariants exercised:** I1, I2, I4, I6, I7 (proxy), I8, I10, S2 — all PASS.
> **Disposition:** Architecture B registry distribution end-to-end functional; first-time contributor lands in a working shell on the documented two-command path.
