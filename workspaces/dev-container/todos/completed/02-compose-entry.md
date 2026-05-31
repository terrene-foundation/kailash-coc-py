# M2 — Compose + Entry Surface (shard S2)

Implements: `specs/dev-container-image.md` §Database transport (C1, I9), `specs/secrets-and-auth.md`
S1–S4, `specs/sync-ownership.md` §Placement (repo root). Value-anchor: brief — "a fresh
contributor runs one command and lands inside a shell"; plan §0 decision 2 (the `dev`
service also RUNS the project locally — Compose `forwardPorts` + DB services are why).

## T05 — Build `docker-compose.yml` (repo root)

`dev` service: `build.context: .` (→ the one Dockerfile), `env_file: [.env]`,
`user: "${UID:-1000}:${GID:-1000}"` + build args `USER_UID`/`USER_GID` from `$(id -u)`/
`$(id -g)` (M1 Linux UID alignment), `tini` via `init: true`, named cache volumes
(uv/npm/pre-commit), workspace bind-mount. Profile-gated `postgres` + `redis` services
(default profile) and an `ml` profile gate. `forwardPorts`/`ports:` for Nexus/API dev
servers (the local-app-launch use case, plan §0 decision 2). `compose.override.yml`
auto-merge left intact for project extension.

## T06 — Build `bin/dev` wrapper

`docker compose run --rm --service-ports dev "$@"` (one-command launch). MUST detect an
absent `.env` and print "copy `.env.example` → `.env` and fill your keys" — not a cryptic
failure (S4). Pass `USER_UID`/`USER_GID` from `$(id -u)`/`$(id -g)` on Linux.

## T07 — Wire DB transport to compose services (C1)

Set the in-container `DATABASE_URL` to resolve to the `postgres` service name on the
compose network. **Replicate whatever `scripts/development/setup-databases.sh` provisions
beyond a bare postgres** (db names, extensions like pgvector, seed data) into the compose
service config / an init script — read that script at implement and port its setup.
`setup-databases.sh` stays a HOST tool; document docker.sock as the opt-in escape hatch
with the host-root-equivalent caveat. Implements: dev-container-image.md §Database transport.

## T08 — Verify compose + entry (wire companion)

Receipts to PR: `docker compose config` valid; `bin/dev` drops into a `dev` shell;
`bin/dev` with no `.env` prints the clear error (S4); from inside, `DATABASE_URL` connects
to the `postgres` service (I9 — real read-back per `testing.md` state-persistence);
`.env` keys present in `env`, absent from `docker history` (I5). Capacity: config + wrapper

- wiring, ~4 invariants, feedback loop = `docker compose config` + shell launch.

## Verification (2026-05-27)

**Plan/spec ref:** `02-plans/01-architecture.md` §5 + `specs/dev-container-image.md`
§Database transport (C1, I9) + `specs/secrets-and-auth.md` S1–S4.

**Walk receipts (scrubbed):**

- `docker compose config --quiet` → exit 0 (valid).
- S4: `mv .env` then `./bin/dev` → prints "No .env found … cp .env.example .env" + exit 1;
  `.env` restored.
- C1/I9: `docker compose --profile db up -d postgres` → healthy; `docker compose run dev`
  with `DATABASE_URL=postgresql://postgres:password@postgres:5432/test` → **asyncpg real
  read-back `'ok'`** (CREATE/INSERT/SELECT/DROP round-trip) — DB reachable BY SERVICE NAME.
- `./bin/dev claude --version` → `2.1.152 (Claude Code)` — wrapper works end-to-end.
- DB teardown clean (`--profile db down -v`).

**Findings fixed this shard (zero-tolerance):**

- `tini` WARN "not running as PID 1" under `docker compose run` — compose `init: true`
  stacked a 2nd init over the image's ENTRYPOINT tini. Removed `init: true`; warning gone.

**Discoveries:**

- DB driver: `kailash-dataflow` bundles `asyncpg` + `sqlalchemy` as CORE deps (both
  importable baked); `psycopg2-binary`/`aiomysql`/`aiosqlite` are behind extras, NOT baked.
  → async postgres works out of the box; sync/mysql/sqlite are a documented
  `requirements-user.txt` add (note for the M4 README). First test used sync psycopg
  (not baked) — wrong driver, not a real gap.

**Spec deviation (Rule 6):** existing dev infra is postgres:15 + **mysql:8.0** (NOT redis as
the plan assumed). Compose mirrors reality (db `test`, host ports 5433/3307).

**Quality gate (both returned; 1 security HIGH + MED/LOW; all fixed same-shard):**

- security HIGH — DB host ports bound to `0.0.0.0` with a known password (LAN-reachable).
  Fixed: all port mappings now `127.0.0.1:`-bound (postgres/mysql/nexus). Re-verified
  `host_ip: 127.0.0.1` in `compose config`; DB read-back via service name still works
  (loopback affects only the host port, not internal compose-network resolution).
- reviewer MED — bare `docker compose` (bypassing `bin/dev`) silently uses UID 1000 →
  added a warning comment on the build args (I8 footgun).
- reviewer MED — postgres had a healthcheck, mysql didn't (asymmetric) → added a mysql
  healthcheck for symmetry.
- reviewer LOW + security note — `.env.example` lacked `GH_TOKEN` (which `bin/dev` tells
  users to fill) and a service-name `DATABASE_URL` default → both added (template-owned).
- security MED — hardcoded local-dev DB creds: confirmed NOT a violation (profile-gated,
  loopback, throwaway, mirrors setup-databases.sh); added inline "LOCAL-DEV-ONLY" comments.
- Both PASSED: S1 (no secret in layer), S2 (runtime injection), bin/dev (no injection),
  volume mounts. reviewer verified UID-prefix override, DB-by-service-name, `command`
  override, tini-PID-1-after-init-removal all correct.
