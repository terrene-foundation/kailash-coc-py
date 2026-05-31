# Spec — Sync Ownership and Governance (Architecture B — registry distribution)

Authority on which dev-container files are publisher-internal vs consumer-shipped vs
project-owned, and how the artifact distributes via the published Docker Hub image +
template-distributed pointer configs. Source-of-truth for the `/sync` preserve contract
and the post-pivot ownership split.

## §1 Change log

- 2026-05-29: SUPERSEDES Architecture A (sync-distributed Dockerfile). Ownership classes
  split from 2-way (template / project) to 3-way (publisher-internal / consumer-shipped /
  project-owned). G2 reframed (publisher-internal recipe + consumer-shipped pointer
  configs both update on /sync; image bytes update at git-tag publish, not at /sync).
  G4 narrowed (loom proposal scope SHRUNK to overlay-glob preservation + consumer-shipped
  pointer-config emission; Dockerfile no longer sync-distributed as a consumer artifact).
  Anchor: `workspaces/dev-container/journal/0003-DECISION-cross-repo-authorized-close-loom-384.md`
  verbatim user directive "By coupling to loom, it kills productivity."
- 2026-05-27: Initial spec under Architecture A.

## Ownership classes (3-way under Architecture B)

**Publisher-internal** (built by the publisher; shipped in this template AS reference
artifacts only — consumers do NOT execute them on first run):

`Dockerfile`, `requirements-coc.txt`, `requirements-coc-ml.txt`, `.dockerignore`,
`.github/workflows/publish-dev-image.yml`.

Consumer behavior: these files arrive via `/sync` as build-recipe provenance + as input
to template-developer rebuild workflows. They are NOT executed on `./bin/dev` first run
(the consumer pulls the published image instead). A template developer iterating on the
recipe locally can flip `DEV_IMAGE=kailash-coc-dev:local` + uncomment the compose
`build:` block to rebuild from this recipe.

**Consumer-shipped** (regenerated / overwritten on `/sync`; consumers EXECUTE these to
pull-and-launch):

`docker-compose.yml`, `.devcontainer/devcontainer.json`, `.devcontainer/postCreate.sh`,
`bin/dev`, `.env.example`, `Dockerfile.user.example`, `compose.override.yml.example`,
`requirements-user.txt` (empty stub), `README.md` (the Dev Environment section).

These point AT the published image (`terrenefoundation/kailash-coc-py:<version>`) and
tell the consumer how to pull, configure, and extend. When the template version bumps,
the registry tag they reference bumps too.

**Project-owned overlay** (never overwritten — preserve globs):

`requirements-user.txt` (when non-empty), root `package.json` + lockfile,
`compose.override.yml`, `.devcontainer/postCreate.user.sh`, `Dockerfile.user`. (OS
packages go through `Dockerfile.user FROM <registry-tag>` — there is NO
`apt-packages.user.txt` overlay; H3 dropped it with the sudo grant.)

Preserve glob set: `*-user.*`, `*.user.*`, `compose.override.yml`, `Dockerfile.user`,
root `package.json`/`package-lock.json`/`pnpm-lock.yaml`/`yarn.lock` — **EXCLUDING
`*.example`**. The `.example` stubs (`compose.override.yml.example`,
`Dockerfile.user.example`, `.devcontainer/postCreate.user.sh.example`) are CONSUMER-SHIPPED
and MUST regenerate on `/sync`; without the exclusion the `*.user.*` glob wrongly
preserves `Dockerfile.user.example` and `.devcontainer/postCreate.user.sh.example` (both
contain the `.user.` substring), freezing them at first adoption so contributors never
receive template updates to the example stubs. The manifest preserve rule MUST therefore
be `(*-user.* | *.user.* | compose.override.yml | Dockerfile.user | root pkg-manifests)
AND NOT *.example`. (Surfaced by the M4 Flow-D walk, 2026-05-27.)

## Placement

Per `cross-repo.md` MUST-3, COC artifacts live under `.claude/`; the Dockerfile/compose
are **project-ops infrastructure**, NOT COC artifacts, so they live at the **repo root**
(conventional, editor-auto-detected) — explicitly NOT under `scripts/` (that dir is
project-ops scripts, and `cross-repo.md` MUST-3 fences COC sync away from it; the
dev-container files are a third category placed at root).

## Publish path (publisher-internal — Architecture B)

The dev image is produced by `.github/workflows/publish-dev-image.yml`:

```
git tag v<X.Y.Z> + git push origin v<X.Y.Z>
  → publish-dev-image.yml fires
  → docker buildx build --platform linux/amd64,linux/arm64 -t terrenefoundation/kailash-coc-py:<X.Y.Z>
  → docker push terrenefoundation/kailash-coc-py:<X.Y.Z> (+ :latest)
  → captured manifest digest sha256:… recorded as a release artifact
```

Image bytes update at git-tag cadence (not at template `/sync` cadence). When the
template `/sync` ships a new `<X.Y.Z>` in `docker-compose.yml` and
`.devcontainer/devcontainer.json`, consumers re-pull on next `./bin/dev` invocation.

## /sync landing path (consumer-shipped + publisher-internal — narrowed scope)

The dev-container files distribute via the standard loom `/sync` pipeline, but the
post-pivot scope is SHRUNK vs the Architecture A draft:

```
kailash-coc-py /codify  → proposal → loom Gate-1 classify (global)
  → loom adds files to template source + declares preserve-globs in sync-manifest
  → /sync regenerates this template (+ 30 downstream consumers)
```

S6 (the cross-repo loom proposal) is OPTIONAL under Architecture B per the user directive
recorded at `journal/0003`. Projects MAY hand-manage the consumer-shipped configs if they
prefer to decouple from loom. When S6 is used, the loom-side preserve-globs proposal
covers the overlay surface (`*-user.*`, `*.override.*`); the publisher-internal recipe
files (`Dockerfile`, `requirements-coc*.txt`) flow through /sync as reference artifacts
but consumers do not execute them.

Per `repo-scope-discipline.md`, S6 is NOT in-scope for a kailash-coc-py session to edit
loom directly; it is a cross-repo dependency filed as a `/codify` proposal. `/todos` MUST
file S6 as a cross-repo follow-up, not an in-repo todo.

## Invariants (MUST hold)

- **G1 — Overlay survives sync:** after a `/sync` regeneration, every project-owned file
  in the preserve glob set is byte-identical to its pre-sync content.
- **G2 — Consumer-shipped + publisher-internal update on sync; image bytes update at
  git-tag publish:** consumer-shipped files (compose, devcontainer.json, bin/dev,
  README, .env.example, *.example stubs, requirements-user.txt stub) reflect the new
  template version + reference the corresponding registry tag; publisher-internal recipe
  files (Dockerfile, requirements-coc*.txt) reflect the new build recipe. The IMAGE
  ITSELF only changes when the publish workflow fires on a git tag; consumers pull the
  updated tag on next `./bin/dev` invocation.
- **G3 — No COC-under-scripts:** the dev-container files are NOT written under `scripts/`
  (respects `cross-repo.md` MUST-3) and NOT under `.claude/` (they are project-ops, not
  COC artifacts).
- **G4 — Distribution provenance:** the consumer-facing dev image lands via the published
  registry manifest (`terrenefoundation/kailash-coc-py:<version>`) with a `sha256:…`
  digest. The template files that POINT AT the manifest land via the `/codify` → loom
  Gate-1 → `/sync` pipeline (`artifact-flow.md` "loom splits, never originates") when the
  optional cross-repo follow-up is exercised; otherwise projects hand-manage their pointer
  configs.

## Brief Traceability

| Brief requirement                                         | Spec coverage                                               |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Ship all three CLIs                                       | `dev-container-image.md` §4, I1                             |
| Carry every runtime the COC set needs                     | `dev-container-image.md` §1–§5, I2/I3/I7                    |
| Baseline Kailash deps                                     | `dev-container-image.md` §5, I2                             |
| Extensible per-project                                    | `dependency-overlay.md` O1–O5                               |
| Pass host secrets safely                                  | `secrets-and-auth.md` S1–S5                                 |
| Honor the COC hook surface                                | `dev-container-image.md` I3/I6/I7 (gnupg, tini, formatters) |
| **Image acquisition (Arch B)**                            | `dev-container-image.md` § Image acquisition, I10           |
| Base publisher-built; overlay project-owned; survives sync | `sync-ownership.md` G1–G4                                   |
