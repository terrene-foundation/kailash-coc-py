---
id: "DEPLOYMENT"
paths: ["deploy/**", ".github/**", "pyproject.toml", "CHANGELOG.md"]
---

# SDK Release Rules

## Before Any Release

1. Full test suite passes across all supported Python versions
2. Security review by **security-reviewer** (mandatory)
3. CHANGELOG.md updated (version, date, Added/Changed/Fixed/Removed, breaking changes marked)
4. Version bumped consistently across all packages (`pyproject.toml` + `__init__.py`)
5. No uncommitted changes

**Why:** Skipping any pre-release step risks publishing a broken, insecure, or version-mismatched package to PyPI where it becomes immediately available to every downstream user.

## TestPyPI Validation

Major/minor releases MUST validate on TestPyPI before production PyPI:

```bash
twine upload --repository testpypi dist/*.whl
python -m venv /tmp/verify --clear
/tmp/verify/bin/pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ kailash==X.Y.Z
/tmp/verify/bin/python -c "import kailash; print(kailash.__version__)"
```

**Why:** PyPI uploads are immutable -- a broken release cannot be overwritten, only yanked, leaving a permanent gap in the version sequence.

**Exception**: Patch releases may skip TestPyPI with explicit human approval.

## Publishing Rules

- Proprietary packages: wheels only (`twine upload dist/*.whl`), never sdist
- No publishing when CI is failing
- No PyPI tokens in source — use `~/.pypirc`, CI secrets, or trusted publisher (OIDC)
- Research current syntax (`--help` or web search) before running release commands

**Why:** Publishing sdist for proprietary packages exposes source code, publishing on failing CI ships known-broken artifacts, and committed tokens grant anyone with repo access full PyPI publishing rights.

## Release Config

Every SDK MUST have `deploy/deployment-config.md`. Run `/deploy` to create it.

**Why:** Without a deployment config, release agents guess at package names, registries, and credentials, leading to failed or misdirected publishes.

## MUST: Optional Dependencies Pin to PyPI-Resolvable Versions

`[project.optional-dependencies]` extras MUST pin to versions already on PyPI at the time of the commit. Bumping an extras pin to the version being released in the same commit is BLOCKED — CI installs from PyPI before the release is published, so the pin fails to resolve.

```toml
# DO — extras pin to currently-published minimum compatible version
[project.optional-dependencies]
dataflow = ["kailash-dataflow>=2.0.3"]   # 2.0.3 is on PyPI; 2.0.8 is being released
nexus    = ["kailash-nexus>=2.0.0"]
kaizen   = ["kailash-kaizen>=2.7.1"]

# DO NOT — extras pin to the version being released
[project.optional-dependencies]
dataflow = ["kailash-dataflow>=2.0.8"]   # 2.0.8 is not on PyPI yet → pip resolution fails
```

**BLOCKED rationalizations:**

- "The version will exist by the time CI runs"
- "We can fix CI after the release lands"
- "The lockfile pins the right version anyway"

**Why:** CI for the release PR runs `pip install -e ".[dev]"` against PyPI, which has the OLD versions. Pinning to the unreleased version produces `ERROR: No matching distribution found for kailash-mcp>=0.2.4` and the release CI fails. The framework SDK pins inside each package's own pyproject.toml (`kailash>=2.8.6` in the dataflow package (`pyproject.toml`)) ARE allowed to bump because they resolve against the local editable install of kailash, not PyPI. Source: PR #467 fix (commit a50d3119).

## MUST: All Files Imported By package `__init__.py` Tracked In Git

Before tagging a release, every `from .X import Y` and `from .pkg import Z` in any package's `__init__.py` MUST resolve to a file tracked in git. Imports that resolve to local-only files (untracked, .gitignored, generated) are BLOCKED — the published wheel will `ImportError` from a clean checkout.

```bash
# DO — verify all package imports are tracked
for init in packages/*/src/*/__init__.py; do
  pkg_dir="$(dirname "$init")"
  python -c "import ast, pathlib
init = pathlib.Path('$init')
tree = ast.parse(init.read_text())
for node in ast.walk(tree):
    if isinstance(node, ast.ImportFrom) and node.level > 0 and node.module:
        candidate = init.parent / node.module.replace('.', '/')
        for path in (candidate.with_suffix('.py'), candidate / '__init__.py'):
            if path.exists():
                rel = path.relative_to(pathlib.Path.cwd())
                import subprocess
                tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', str(rel)],
                                         capture_output=True).returncode == 0
                if not tracked:
                    print(f'UNTRACKED: {rel} imported by {init}')
                break
"
done

# DO NOT — release with untracked files imported by __init__.py
# the nexus package directory src/nexus/__init__.py:
#   from .auth.guards import AuthGuard          # auth/guards.py UNTRACKED
#   from .errors import NexusError              # errors.py UNTRACKED
# Result: pip install kailash-nexus → ImportError on first import
```

**BLOCKED rationalizations:**

- "The file exists on my machine, the test passed"
- "It was supposed to be in the previous PR"
- "We'll add it in the next release"
- "The CI passed because it uses editable install"

**Why:** Editable installs see the local working tree, including untracked files. PyPI users get only what's in the wheel, which is built from `git ls-files`. PR #459/#460 merged with `nexus/__init__.py` importing `.auth.guards` and `.errors` — both untracked. Tests passed because the local files existed. The wheel published to PyPI would have failed with `ImportError` on every fresh install. Caught by `/release` audit and fixed in PR #467.

Origin: PR #467 (2026-04-14) — bundled the missing nexus/auth/guards.py and nexus/errors.py files that PR #459/#460 left untracked.

## MUST: Multi-Package Release Tags Pushed Individually

Coordinated multi-package releases MUST push each release tag in a separate `git push` command, with a brief pause between pushes. Batch-pushing 3+ tags in a single command is BLOCKED — GitHub's `push.tags` webhook drops workflow triggers silently.

```bash
# DO — one tag per push, trigger fires reliably
for tag in v2.8.6 dataflow-v2.0.8 kaizen-v2.7.4 nexus-v2.0.2 mcp-v0.2.4; do
  git push origin "$tag"
  sleep 1
done

# DO NOT — batch push, workflows silently skipped
git push origin v2.8.6 dataflow-v2.0.8 kaizen-v2.7.4 nexus-v2.0.2 mcp-v0.2.4
# Observed 2026-04-14: ZERO of 5 tags triggered publish-pypi.yml.
# Required manual workflow_dispatch for each package.
```

**BLOCKED rationalizations:**

- "Batch push is faster"
- "The workflow should handle multiple tag events"
- "We can check for missing runs after"
- "It worked last time with 2 tags"

**Why:** GitHub Actions' `push.tags` webhook delivery has undocumented rate-limiting when multiple tags arrive in a single push event. Batch pushes of 3+ tags fail to trigger the workflow for most (or all) of the tags. The failure is silent — the tags are created successfully, but `publish-pypi.yml` runs never appear in the Actions tab. Recovery requires manual `workflow_dispatch` per package, which is error-prone (must remember every package) and leaves a paper-trail asymmetry. Source: 2026-04-14 release where `git push origin v2.8.6 dataflow-v2.0.8 kaizen-v2.7.4 nexus-v2.0.2 mcp-v0.2.4` triggered zero workflow runs.

Origin: PR #469 (2026-04-14) — validated empirically when the single-tag push of nexus-v2.0.3 auto-triggered correctly while the prior 5-tag batch push triggered zero runs.

## MUST: TestPyPI Trusted-Publisher Registration Is Per-Package

Every package published via PyPI OIDC trusted-publishing MUST be registered as a pending publisher on BOTH `pypi.org` AND `test.pypi.org` separately. TestPyPI registration does NOT carry over from PyPI — they are independent indexes with independent publisher configs.

```yaml
# DO — register the package on test.pypi.org BEFORE the first
# workflow_dispatch run with publish_to=testpypi:
# https://test.pypi.org/manage/account/publishing/
#
# Required field values MUST match exactly:
#   PyPI Project Name:  kailash-ml
#   Owner:              terrene-foundation
#   Repository:         kailash-py
#   Workflow filename:  publish-pypi.yml
#   Environment name:   testpypi

# DO NOT — assume PyPI registration carries over
# pypi.org publisher config exists for kailash-ml ✓
# test.pypi.org publisher config does NOT exist ✗
# → workflow_dispatch publish_to=testpypi fails:
#   400 "Non-user identities cannot create new projects"
```

**BLOCKED rationalizations:**

- "We registered on PyPI, TestPyPI should work"
- "TestPyPI is just a mirror"
- "We can register after the first failed run"
- "The CI error message will explain it"

**Why:** Tag-triggered publishes (`push` of `v*` / `<pkg>-v*`) flow direct to PyPI only and never touch TestPyPI. The TestPyPI path requires `workflow_dispatch` with `publish_to=testpypi`, which requires the project to be pre-registered on test.pypi.org as a pending publisher. Without that one-time UI step, the upload returns `400 "Non-user identities cannot create new projects"` — a confusing error message that costs a release-cycle round-trip. Registration is a one-time UI step per package; document it in the repo's release runbook so the next package release does not re-discover it.

Origin: kailash-py 2026-04-19 release — kailash-ml PyPI publish succeeded via tag push, TestPyPI workflow_dispatch failed with 400 because `kailash_ml` was not pre-registered on test.pypi.org.

## MUST: Sibling-Package CI Installs Root SDK Editable For Unreleased Core Modules

When a new public module lands in `src/kailash/` (or any core SDK module tree) and is not yet published to PyPI, every sibling-package CI workflow that imports from it MUST prepend `uv pip install -e "."` to its install block BEFORE installing the sub-package's own `[dev]` extras. Sub-package CI workflows that install only `packages/<pkg>[dev]` silently resolve `kailash>=X.Y.Z` from PyPI — where the new module does NOT yet exist — and every test importing the new module fails at collection with `ModuleNotFoundError`.

```yaml
# DO — root kailash editable installed FIRST, then sub-package
- name: Install kailash-<subpkg>[dev]
  run: |
    uv venv .venv
    # Install root kailash first so kailash.<new_module> resolves
    # (not yet on PyPI; depends on PR #<N> of issue #<M>).
    uv pip install -e "." --python .venv/bin/python
    uv pip install -e "packages/kailash-<subpkg>[dev]" --python .venv/bin/python

# DO NOT — only sub-package; transitively pulls kailash from PyPI
- name: Install kailash-<subpkg>[dev]
  run: |
    uv venv .venv
    uv pip install -e "packages/kailash-<subpkg>[dev]" --python .venv/bin/python
    # → ModuleNotFoundError: No module named 'kailash.<new_module>'
```

**BLOCKED rationalizations:**

- "The sub-package's `kailash>=X.Y.Z` dep should pull it in"
- "We'll publish kailash first, then the sub-package CI will resolve"
- "This workflow happened to pass last time; must be fine"
- "The leading `uv pip install -e \".\"` is redundant with the sub-package dep"
- "We'll add the root install when we see the first failure"

**Why:** The sub-package's declared `kailash>=X.Y.Z` dependency resolves against PyPI, where the NEW module is not yet published. The build step succeeds (installs stable kailash from PyPI) but test collection fails because tests import the new module that exists only in the local editable source tree. Every `uv pip install -e "packages/..."` block in every sibling-package CI workflow MUST be preceded by `uv pip install -e "."`. No exceptions — even workflows that happen to pass today silently "work" because they do not import the new module yet. The comment in the CI step explaining the ordering is mandatory institutional knowledge: future contributors must understand that the leading root install is NOT redundant with the sub-package's declared kailash dep.

Origin: kailash-py Session 2026-04-20 (issue #567 Session 3b) — PR #570 landed `kailash.diagnostics.protocols` in `src/kailash/` (not yet on PyPI). PR #577 extended the editable-root prepend to Base/DL/RL/Unit/Inter-Package CI jobs across `test-kailash-ml.yml` + `test-kailash-align.yml`, unblocking PRs #574/#575/#576 which all failed at collection with `ModuleNotFoundError: No module named 'kailash.diagnostics'`.

### Bi-Directional At Bridge Boundaries (MUST)

The rule above covers the one-way case (sub-package imports from root core). At cross-package BRIDGE boundaries — where two sub-packages import each other's modules (e.g. `kailash-ml` ↔ `kailash-align` RL bridge; `kailash-dataflow` ↔ `kailash-ml` fabric bridge) — BOTH sibling CI jobs MUST install BOTH packages editable. The uni-directional form is insufficient at bridges.

```yaml
# DO — BOTH directions install BOTH packages at bridge boundaries
# .github/workflows/test-kailash-ml.yml (bridge: ml tests import kailash_align)
- run: |
    uv venv .venv
    uv pip install -e "." --python .venv/bin/python
    uv pip install -e "packages/kailash-align[dev]" --python .venv/bin/python   # reciprocal
    uv pip install -e "packages/kailash-ml[dev]" --python .venv/bin/python
# .github/workflows/test-kailash-align.yml (bridge: align tests import kailash_ml.rl.align_adapter)
- run: |
    uv venv .venv
    uv pip install -e "." --python .venv/bin/python
    uv pip install -e "packages/kailash-ml[dev]" --python .venv/bin/python      # reciprocal
    uv pip install -e "packages/kailash-align[dev]" --python .venv/bin/python

# DO NOT — install only one direction; the other fails on the next test run that imports across
- run: |
    uv pip install -e "packages/kailash-ml[dev]"   # ml tests import kailash_align
    # → ModuleNotFoundError: No module named 'kailash_align'
```

**BLOCKED rationalizations:**

- "The bridge module is in one direction only" (false — bridges are dual by nature)
- "We'll add the reverse install when tests fail on it" (cascades: one direction surfaces, the other waits until next PR)
- "Editable installs are dev-only, CI can rely on PyPI for the sibling"
- "The sibling's declared version is enough"
- "We can lazy-import across the bridge to avoid the editable"

**Why:** Bridge modules are by definition dual-import — each side's tests exercise paths that import the other package's modules. A one-way editable install surfaces only one direction's `ModuleNotFoundError`; the other direction surfaces in the NEXT PR that runs the opposite test suite, cascading fixes across two release cycles. Pre-declaring BOTH reciprocal installs in BOTH CI workflows catches it at the FIRST collection pass. Evidence: PR #611 release cycle — align→ml reciprocal install landed at commit `e7c5a33b`; the ml→align direction surfaced as the next collection failure at commit `c59c30da`. Both directions needed identical discipline.

Origin: kailash-py PR #611 release cycle (2026-04-23) — ML↔Align bridge CI cascade.

## MUST: Two Trunks, Asymmetric By Design — `dev` Carries Throughput, `main` Carries Quality

A repo running the two-trunk model MUST keep the two trunks ASYMMETRIC. The asymmetry is the point; collapsing them into "two branches with the same rules" forfeits the whole benefit. Four obligations, all four binding:

1. **`dev` is the THROUGHPUT trunk.** Lane work merges into `dev` CONTINUOUSLY and UN-GATED — no PR-gate matrix, no review wait, no cost. A push to `dev` MUST fire ZERO gate workflow runs; verify against the runs API for that SHA, where a non-empty run set is the falsifying result and means the workflow triggers are misconfigured, not that the model is in force.
2. **The DEV-SERVER deploy runs off a PINNED `dev` commit — never `main`, never a moving ref.** The deploy names an immutable SHA. Deploying the `dev` branch tip by name, or promoting `main` onto the dev server, is BLOCKED.
3. **`main` is the QUALITY trunk and the ONLY source of PRODUCTION.** `dev` → `main` is ONE PR carrying the accumulated lane work, ONE full gate run, on a deliberate cadence. A production deploy's ref MUST be reachable from `main`; deploying to production from `dev`, from a lane branch, or from an un-promoted SHA is BLOCKED.
4. **A standing PROMOTION CADENCE MUST be declared and honored.** Declare it in `deploy/deployment-config.md` (§ Release Config). Letting `dev` → `main` drift with no cadence is BLOCKED.

**Scope note — "never deploy from `main`" is the DEV-SERVER rule, not a production rule.** Obligations 2 and 3 name different TARGETS and do not conflict: the DEV server is never fed from `main`, and PRODUCTION is fed from `main` and nowhere else. Reading obligation 2 as "production must never come from `main`" inverts the model.

**A deploy to a namespace serving real client traffic still requires an explicit human yes** — unchanged by this clause, and not softened by `main` being the pre-agreed production source. The topology decides WHERE production may come from; it never decides WHETHER this promotion happens.

```bash
# DO — free landing on dev; pinned dev-server ref; one deliberate promotion; production off main
git switch dev && git merge --no-ff lane/x && git push        # fires no gate run
deploy --env dev  --ref 9f3c1a2                               # PINNED immutable SHA
gh pr create --base main --head dev --title "promote: dev → main (weekly cadence)"
git merge-base --is-ancestor "$REF" main && deploy --env prod --ref "$REF"   # + human yes

# DO NOT — flatten the asymmetry, float the ref, or let the cadence lapse
gh pr create --base dev --head lane/x   # gating dev re-imposes the bottleneck dev removes
deploy --env dev  --ref dev             # moving ref: what shipped is unknowable after the next push
deploy --env prod --ref dev             # production off the un-gated trunk
# ...six weeks with no promotion PR → the next one is an unreviewable megamerge
```

**BLOCKED rationalizations:**

- "Both trunks should have the same checks — consistency is good hygiene"
- "Gating `dev` too is safer, and it costs nothing"
- "Deploying the `dev` branch tip is close enough to a pinned commit"
- "The directive says never deploy from `main`, so production can't come from `main` either"
- "`main` is already gated, so the production deploy needs no human yes"
- "We'll promote to `main` when there's something worth promoting"
- "A promotion cadence is process overhead — we promote when we're ready"
- "One big promotion PR is more efficient than several small ones"
- "`dev` and `main` have the same content right now, so it doesn't matter which we deploy"
- "The lane branch is green, ship it to prod from there"

**Why:** The asymmetry IS the mechanism — `dev` buys throughput precisely by being un-gated and `main` buys quality precisely by being gated once — so anything that makes the two alike (gating `dev`, or shipping production from `dev`) relocates the bottleneck instead of removing it. Without a standing promotion cadence `main` rots and the first promotion after a long gap is a large, hard-to-review merge: the same bottleneck arriving late and all at once.

**Trust Posture Wiring:**

- **Severity:** `halt-and-report` at the `/deploy` + `/release` gate (release-specialist confirms the production ref is reachable from `main`, the dev-server ref is an immutable SHA, and the declared promotion cadence has been honored); `advisory` at any hook layer per `hook-output-discipline.md` MUST-2 — which environment a deploy invocation targets is read from its arguments, and a mis-read would block work the operator was instructed to perform.
- **Grace period:** 7 days from clause landing (2026-09-10 → 2026-09-17).
- **Cumulative posture impact:** same-class violations (a production deploy from a ref not reachable from `main`; a dev-server deploy naming a moving ref; a gate matrix fired on a `dev` push; a promotion cadence undeclared or lapsed) contribute to `trust-posture.md` MUST-4 cumulative-window math (3× same-rule in 30d → drop 1 posture; 5× total in 30d → drop 1 posture).
- **Regression-within-grace:** GENERIC `regression_within_grace` per `trust-posture.md` MUST-4 (1× = drop 1 posture) — NO dedicated per-clause trigger key. Named deviation from the canonical key-per-clause shape, recorded here per `trust-posture.md` Rule 8: the `/deploy` + `/release` gate already holds the stop for this class, so an instant-drop key would double-count it. Same disposition this file's § Pre-Pledge clause took.
- **Receipt requirement:** SessionStart soft-gate `[ack: deployment-two-trunks]` IFF `posture.json::pending_verification` includes this rule_id.
- **Detection mechanism:** Phase 1 (manual, gate-review) — release-specialist at `/release` + reviewer at `/implement` confirm (a) `git merge-base --is-ancestor <prod-ref> main` succeeds, (b) the dev-server deploy names a SHA rather than a branch name, (c) the most recent `dev` push carries no gate workflow run, and (d) `deploy/deployment-config.md` declares a promotion cadence whose last honored promotion falls inside it. Those four signals are STRUCTURAL — a git-object fact, an argv token, a runs-API read, a parsed-document field — so a mechanical gate is BUILDABLE here and this clause does not pretend otherwise; none ships with it, and gate-review is the enforcement layer until one is separately accepted. **Probes: REGISTERED — `.claude/test-harness/probes/deployment.probes.json`** is AUTHORED and manifest-registered (`eval-manifest.json:1089`). An earlier revision of this line read "NOT YET AUTHORED, declared in `phase2-deferrals.json::probe_authorship_deferrals`"; that was FALSE on three counts and is withdrawn rather than quietly overwritten — the suite file EXISTS, it IS registered in the manifest, and `probe_authorship_deferrals` carries NO row for it (measured: that section holds exactly one key, `_README`, and zero live rows). The claim survived because canon `.claude/rules/deployment.md` was corrected to "Probes: REGISTERED" in a graduation wave and this overlay was not swept with it — a Wiring block claiming an ABSENT tier is the absence-reads-as-clean shape this corpus governs everywhere else, and it is strictly worse than silence because it reads as a declared gap. Registration buys DISPATCHABILITY, never automatic execution: no workflow invokes `coc-probe-dispatch.mjs`, so a green CI run is NEVER evidence these probes passed — they execute only when an orchestrator dispatches `/test-harness-probe --artifacts` at gate-review.
- **Violation scope:** this clause (two-trunk asymmetry) ONLY — its four obligations plus the dev-server-vs-production scoping; every other clause in this file keeps its own wiring.
- **Origin:** 2026-09-10 — co-owner directive, verbatim: _"main -> production server, dev -> dev server."_ and _"The latter is always speed and throughput, the former is stellar quality."_ Extends the same day's parent directive that lane work merges into `dev` continuously and for free (a `dev` push fires zero workflow runs, verified through the runs API against a `main` control) while `dev` → `main` is one PR, one gate run, on a deliberate cadence, with the dev-server deploy off a pinned `dev` commit. The parent's "never from `main`" is scoped to the DEV-SERVER deploy by the scope note above.
