# Red-Team Round 2 — Verdict + Disposition

Two parallel agents re-reviewed the Round-1-amended plan + specs. Full findings:
`round-2-closure-and-gaps.md` (closure-parity + new-gap hunt) and
`round-2-consistency-citations.md` (cross-spec drift + citation resolution).

## Outcome

**No CRITICAL. Core structural design confirmed sound. All Round-1 CRITICAL/HIGH
dispositions verified present in the specs.** The C2 fix's load-bearing claim — that
`coc-sign.js` defaults to SSH signing — was VERIFIED (`coc-sign.js:373,415`). Root cause
of the Round-2 findings: the Round-1 amendments updated the SPECS but the plan body +
user-flow + sync-ownership were not re-swept (the `specs-authority.md` §5b full-sibling
re-derivation gap). All mechanical to close — done this round.

## Findings + dispositions (all folded)

| ID   | Sev  | Finding                                                                                                      | Disposition                                                           |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| A-1  | HIGH | Plan §3 step 5 still said `uv pip install --system` (contradicts H2 shared-venv)                             | FIXED — plan §3 now shared `/opt/venv`, no `--system`                 |
| A-2  | HIGH | `sudo apt-get`/`apt-packages.user.txt` still in plan §6, user-flow, sync-ownership (H3 dropped it)           | FIXED — swept all 5 surfaces → `Dockerfile.user`                      |
| N-H1 | HIGH | `.dockerignore` exclusion of `.claude/learning/` + `.git` + BuildKit hatch never landed (L2 vacuous closure) | FIXED — secrets-and-auth.md S1                                        |
| N-H2 | HIGH | I3 conflated two signing paths; `git commit -S` over read-only `~/.ssh` wants writable known_hosts           | FIXED — secrets-and-auth.md split both paths; I3 walks both           |
| N-M1 | MED  | `/opt/venv` chown ordering unpinned → overlay install EACCES                                                 | FIXED — image §6 + plan §6 pin `chown` before `USER dev`              |
| N-M2 | MED  | venv PATH/`VIRTUAL_ENV` survival into CLI-spawned hook subprocess unverified                                 | FIXED — image §5 note + /implement check                              |
| N-L  | MED  | blanket `COPY /usr/local` from node clobbers base python at `/usr/local/bin`                                 | FIXED — image §2 + plan §3 scoped node copy + post-copy python check  |
| A-3  | MED  | I2 import list mismatch (image 5, user-flow 4)                                                               | FIXED — user-flow references the SAME baked set as I2                 |
| B-5  | MED  | I2 Python import NAMES unverified (pip-name→import-name)                                                     | FIXED — I2 + user-flow hedge to `pip show`/import-probe at /implement |
| N-M3 | MED  | ml-profile opt-in not discoverable (downstream `import kailash_ml` fails confusingly)                        | FIXED — image §5 discoverability note; also a user gate question      |
| L1   | LOW  | governance scoping clean                                                                                     | no change (refinement noted in sync-ownership)                        |
| L3   | LOW  | inotify / cache-volume ownership deferral                                                                    | carried to /implement failure-walks (low)                             |

## Mechanical re-sweep (this session)

Confirmed across `specs/ 02-plans/ 03-user-flows/`: zero remaining `apt-packages.user.txt`
references, zero `uv pip install --system`, zero blanket `COPY /usr/local /usr/local`.

## Verdict

**READY for `/todos`.** No blocking gaps remain. Two items are explicit `/implement`-time
obligations (not gaps): (1) derive the exact framework import names from the installed
packages (B-5), (2) replicate whatever `setup-databases.sh` provisions beyond a bare
postgres into the compose service config (C1). One item is a user gate: the ml-profile
baseline-vs-opt-in decision (N-M3 / R2).
