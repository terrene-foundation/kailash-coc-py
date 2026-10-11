---
id: "EATP"
paths: ["**/trust/**", "**/eatp/**"]
---

# EATP SDK Rules

## Scope

These rules apply when working with EATP trust code.

## SDK Conventions

### Dataclasses

- Use `@dataclass` (NOT Pydantic) for all data types
- Every `@dataclass` MUST have `to_dict()` → `Dict[str, Any]` and `@classmethod from_dict()` → Self
- Enums serialize as `.value`, datetimes as `.isoformat()`

**Why:** Missing `to_dict()`/`from_dict()` makes trust records non-serializable, breaking audit logging, wire transfer, and persistence.

### Module Structure

- `from __future__ import annotations` in every module
- `# Copyright <YEAR> <COPYRIGHT_HOLDER>` + `# SPDX-License-Identifier: <SPDX_ID>` header
- `logger = logging.getLogger(__name__)` in every module
- Explicit `__all__` in every module
- `str`-backed `Enum` classes for JSON-friendly serialization

**Why:** Missing `__all__` exposes internal symbols on `import *`, and non-str Enums produce integer values in JSON that downstream consumers cannot interpret.

### Error Handling

- All errors MUST inherit from `TrustError` (in `eatp.exceptions`)
- All errors MUST include `.details: Dict[str, Any]` parameter

**Why:** Non-`TrustError` exceptions bypass trust-layer catch blocks, causing unhandled crashes instead of structured denial.

- Fail-closed: unknown/error states → deny, NEVER silently permit

**Why:** A fail-open default means any bug in trust evaluation silently grants access, turning errors into security bypasses.

### Cryptography

- Ed25519 is the mandatory signing algorithm
- HMAC is optional overlay (HMAC alone is NEVER sufficient for external verification)
- Constant-time comparison via `hmac.compare_digest()` — NEVER use `==` for signature comparison
- AWS KMS uses ECDSA P-256 (Ed25519 not available in KMS) — document the algorithm mismatch

**Why:** Using `==` for signature comparison leaks timing information, enabling attackers to forge valid signatures byte by byte.

### Trust Model

- Monotonic escalation only: AUTO_APPROVED → FLAGGED → HELD → BLOCKED (never downgrade)

**Why:** Allowing trust level downgrades means a compromised component can reset its own restriction, defeating the entire escalation model.

- Bounded collections: `maxlen=10000`, trim oldest 10% at capacity

**Why:** Unbounded collections cause memory exhaustion in long-running trust services, crashing the entire trust plane.

- `None` role = all-access (backward-compatible, no RBAC enforcement)

## MUST: Signed Audit Event Emits BEFORE State Advance; FAILED Path Uses A No-Recurse Helper

Any state-machine transition that emits a signed audit event MUST sign-and-emit the audit row BEFORE advancing the state slot. If signing/emit raises, the transition aborts at the pre-advance position so the next call observes the pre-transition state — never a half-advanced state with no audit row. The FAILED path itself emits an audit event, and that emit MUST go through a dedicated `_advance_to_failed_no_audit`-style helper that bypasses the audit-emit step the parent advance used, preventing infinite recursion when the FAILED path's own audit emit raises.

```python
# DO — emit first, advance second; fail closed at the pre-advance position
self._audit_engine.append(event)   # raises → state slot unchanged
self._phase = Phase.ACTING

# DO NOT — advance first; emit failure leaves (phase=ACTING, no audit row)
self._phase = Phase.ACTING
self._audit_engine.append(event)   # next dispatch observes half-state
```

**BLOCKED rationalizations:** "wrap both in try/except and roll the state back" / "the audit row can be emitted lazily after the transition" / "recursion on the FAILED path is theoretical" / "catch-all handling covers it".

**Why:** Advance-before-emit leaves the runtime half-advanced with a hole in the audit chain — the silent-fallback failure mode (`zero-tolerance.md` Rule 3) at the state-machine surface; the structural defense is ordering + a no-recurse FAILED helper, not catch-all exception handling. Generalizes to every state-machine + audit-chain pairing: trust executor, agent lifecycle loops, governance envelope cascades, transaction phases.

**Trust Posture Wiring:**

- **Severity:** `halt-and-report` at the /implement gate (reviewer + security-reviewer mechanical sweep on every state-advance + audit-emit call-site pair; structural-signal class per `hook-output-discipline.md` MUST-2).
- **Grace period:** 7 days from rule landing.
- **Cumulative posture impact:** 3× same-rule in 30d → drop 1 posture per `trust-posture.md` MUST-4.
- **Regression-within-grace:** GENERIC `regression_within_grace` per `trust-posture.md` MUST-4 (1× = drop 1 posture) — no dedicated key (retired, loom#2102); Rule-8 deviation: this block's own Detection-mechanism and Violation-scope fields below already carry a structural AST sweep that flags the violating ordering as a HIGH finding at gate-review (`/implement` + `/redteam`), so no instant-drop key is claimed on top of it.
- **Receipt requirement:** SessionStart hard-gate `[ack: audit-before-state-advance]` IFF `posture.json::pending_verification` includes this rule_id AND the most recent journal entry references trust-executor / agent-lifecycle / envelope-cascade work.
- **Detection mechanism:** gate-level reviewer + security-reviewer mechanical sweep at /implement + /redteam — AST walk for a state-slot write followed by `<audit>.append(` in the SAME function; advance-before-emit ordering = HIGH finding. **Probes: REGISTERED** — `.claude/test-harness/probes/eatp.probes.json` (8 rows, 4 bipolar pairs; fixtures `.claude/audit-fixtures/eatp/`; probe-only, pinned in `probe-suite-integrity.test.mjs`). Registration buys DISPATCHABILITY, never execution — a green CI run is NEVER evidence these probes passed. **Structural detector: ARMED AT LOOM, FENCED FROM CONSUMERS — a co-owner-approved STAGED rollout (2026-09-13).** `.claude/hooks/audit-emit-ordering-guard.js` (predicate in `.claude/hooks/lib/audit-emit-ordering.js`) IS registered in `.claude/settings.json` at **PostToolUse**, matcher `Edit|Write|NotebookEdit` — the write-tool set its own `@hook-event` header declares, MEASURED on this tree against a known-absent control — so AT LOOM it loads. **ARMED is not PROVEN EFFECTIVE:** no armed guard has been OBSERVED firing in a live session; registration and distribution state are all that is measured. **It reaches NO consumer:** the hook file is deliberately fenced `loom_only` in `sync-manifest.yaml` with its required twin in `validate-emit.mjs::LOOM_ONLY_TIER_CARVEOUTS`, so it does not ship — a consumer receives this RULE and not this DETECTOR, enforcement at those targets is the gate-level reviewer + security-reviewer GATE-REVIEW sweep named above, and the gap is DECLARED in the detector-distribution baseline registry (`detector-distribution-baseline.json`, under the test-harness tree) rather than left silent. **Staged because firing volume is measured on loom's corpus and nowhere else, and a consumer's corpus is a different population** — here an EMPTY one, re-derived rather than inherited: no tracked `.py` file sits under a `trust`/`eatp` segment, against 20 tracked `.py` overall, so a loom-side zero cannot license shipping it. PROMOTION is deleting this guard's `loom_only:` entry TOGETHER WITH its `LOOM_ONLY_TIER_CARVEOUTS` twin — removing either alone is a defect. Where it does not run, its SILENCE is the absence of an instrument, never an all-clear (`instrument-discipline.md` MUST-3(a)). It scans the written file when its path carries a `trust`/`eatp` segment and a `.py` extension. It walks Python block structure — comments and strings blanked, then `def` bodies delimited by indentation — and reports a state-slot write preceding an `<audit>.append(` **in the same function**. PostToolUse rather than PreToolUse because this predicate needs whole `def` bodies and an Edit's `new_string` is a fragment whose enclosing header may be absent; the cost is that it reports rather than prevents. **Severity `halt-and-report`, and the SIGNAL is what caps it:** the ordering half is structural (statement positions in a parsed function body), but the ANCHOR half is lexical — an audit sink is recognised by its NAME containing `audit`, a state slot by the `self.<attr> = <Enum>.<MEMBER>` shape plus a state-ish name — so `hook-output-discipline.md` MUST-2 bars `block`. Fails open on every error per `cc-artifacts.md` Rule 7. Fixtures: `.claude/audit-fixtures/audit-emit-ordering/` (28 cases — seven bipolar ordering pairs over the SAME function body separating only on statement order, path-scope cases, and four end-to-end guard drives), executed by CI through its `ci-audit-fixtures.json` runner registration; registration is what RUNS it, and the `min_cases` floor is what keeps a runner that stopped asserting from passing as coverage. **Name deviation, recorded rather than silent:** this rule previously booked the detector as `violation-patterns.js::detectStateAdvanceBeforeAuditEmit`. It ships under a different module and name because the predicate needs ~120 lines of Python block-structure machinery no other pattern in that shared file consumes. The PREDICATE is the one specified here; only the address changed. Residuals the detector cannot see — an audit sink not named `audit`, a `setattr`/property-setter advance, and an advance and emit split ACROSS functions — are enumerated in the module header and remain gate-review's.
- **Violation scope:** MUST 1 (emit-before-advance ordering) — structural AST sweep; MUST 2 (no-recurse FAILED helper) — structural AST sweep asserting any `*_to_failed*` function has zero calls to the module's parent audit-emit helper.
- **Origin:** PR #1139 commit e9626a223 (2026-05-22) — pre-fix code advanced the lifecycle `phase` slot before `_audit_engine.append`; an emit failure left (phase=ACTING, no audit row) and the next dispatch raised an opaque error. Post-fix: emit-first, advance-second, plus `_advance_to_failed_no_audit` for the FAILED-path recursion guard.
