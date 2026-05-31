# M5 — Cross-Repo Sync Governance (shard S5 — CROSS-REPO DEPENDENCY, not in-repo)

Implements: `specs/sync-ownership.md` §Landing path (G1–G4). Value-anchor: brief — "the
base image is repo-template-owned (regenerated on /sync), but the user's overlay is
project-owned and survives /sync" + spec G1 (overlay survives sync). Forest ledger F2.

## T16 — Draft a `/codify` proposal for loom to ship + preserve the dev-container

**SCOPE GUARD (MUST READ):** This todo MUST NOT edit the loom repo directly. loom is a
SEPARATE repo (`repo-scope-discipline.md`); kailash-coc-py is template-owned and rebuilt by
`/sync` (`artifact-flow.md` — "loom splits, never originates"; templates are not hand-edited
to persist). The dev-container files are a NEW COC-distributed artifact set; they land via:

```
kailash-coc-py /codify → proposal → loom Gate-1 (human classify: global)
  → loom adds the files to template source + declares preserve-globs in sync-manifest
  → /sync regenerates this template (+ downstream consumers)
```

This todo's deliverable is the PROPOSAL (drafted in-repo via `/codify`), recording:

- Template-owned (regenerated): `Dockerfile`, `docker-compose.yml`,
  `.devcontainer/devcontainer.json`, `.devcontainer/postCreate.sh`, `requirements-coc.txt`,
  `requirements-coc-ml.txt`, `.dockerignore`, `bin/dev`.
- Project-owned preserve-globs (never overwritten): `*-user.*`, `*.user.*`,
  `compose.override.yml`, `Dockerfile.user`, root `package.json`/lockfiles.
- The actual sync-manifest edit + the template-source placement happen IN LOOM, by a loom
  session acting on this proposal — NOT here.

**Acceptance:** a `/codify` proposal exists referencing these ownership classes + the
preserve-glob set; a note that G1 (overlay survives a regeneration sync) is verified by a
loom-side dry-run at distribution time. Do NOT mark complete by editing loom.

## Sequencing note

M5 is BLOCKED on M1–M4 landing (there must be files to ship) AND is gated by the cross-repo
proposal pipeline — it is the last milestone and cannot complete within a kailash-coc-py
session. `/implement` files it as a cross-repo follow-up, not an in-repo code todo.
