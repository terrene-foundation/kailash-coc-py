---
type: cross-repo-authorization-receipt
date: 2026-08-04
timestamp: 2026-08-04T14:00:31.091Z
requester: jack-hong
target: esperie-enterprise/loom
action: gh issue view 407 and gh issue view 408 (read-only) to determine whether the VERSION-drift slug-map fix and the multi-CLI emission gate have landed, so forest item F7's value-anchor can be re-based on confirmed upstream state instead of the now-absent local M .claude/VERSION symptom
mode: read
---

# Cross-Repo Authorization Receipt

cross-repo-authorized: esperie-enterprise/loom read

## Bounded action

- **Target repo:** esperie-enterprise/loom
- **Action (read):** gh issue view 407 and gh issue view 408 (read-only) to determine whether the VERSION-drift slug-map fix and the multi-CLI emission gate have landed, so forest item F7's value-anchor can be re-based on confirmed upstream state instead of the now-absent local M .claude/VERSION symptom
- **Requester (display_id):** jack-hong
- **Authorized at:** 2026-08-04T14:00:31.091Z

## Verbatim user instruction

> i auth your read

## Five-condition attestation (repo-scope-discipline.md § User-Authorized Exception)

- condition_1_user_initiated: REQUIRED — a genuine user turn
- condition_2_explicit_specific: REQUIRED — names the target repo AND the exact bounded READ
- condition_3_confirmed: REQUIRED — the ceremony restated action+target and the user confirmed yes/no BEFORE this write
- condition_4_receipt_before_acting: DOWNGRADED (READ tier) — one-line affordance receipt; a read leaves no durable trace in the target
- condition_5_scoped_exactly: REQUIRED — only the named read against only the named repo

<!--
  This receipt is the ONLY distinguisher between an authorized and an
  unauthorized cross-repo action. It is written by
  .claude/bin/cross-repo-authorize.mjs AFTER the user confirmed the restated
  action+target in chat, and BEFORE the action runs. The hook
  (violation-patterns.js::hasCrossRepoAuthorizationReceipt) greps this file's
  marker line within its mtime window; commit it for durable team audit.
-->
