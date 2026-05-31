# Specs Index — Dockerized Dev Environment

Domain truth for the dev-container initiative. Workspace-scoped (the repo root is
template-owned / sync-managed, so specs live here, not at repo root). Phases read this
index, then only the relevant file.

| File                   | Domain          | Description                                                                 |
| ---------------------- | --------------- | --------------------------------------------------------------------------- |
| `dev-container-image.md` | Image           | Base image, layer order, runtimes, CLIs, tooling, non-root user, init       |
| `dependency-overlay.md`  | Extensibility   | Template-owned vs project-owned files; add-a-dep-without-rebuild contract   |
| `secrets-and-auth.md`    | Secrets / Auth  | `.env` passthrough, no-secret-in-layer invariant, GitHub auth options       |
| `sync-ownership.md`      | Sync governance | Ownership classes, never-overwrite globs, loom proposal dependency (S5)     |

Brief traceability: every requirement sentence in `briefs/00-user-brief.md` maps to a
spec section — see `sync-ownership.md` § Brief Traceability for the matrix. Under
Architecture B (2026-05-28 pivot, registry distribution), brief requirement "fresh
contributor runs one command and lands inside a shell" maps to `dev-container-image.md`
§ Image acquisition (new); brief requirement "base publisher-built, overlay project-owned,
survives sync" maps to `sync-ownership.md` G1–G4 (G2/G4 rewritten under Architecture B).
