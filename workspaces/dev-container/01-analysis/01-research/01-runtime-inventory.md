# Multi-CLI COC Runtime Inventory

## 1. CLI Binaries Needed

**Claude Code**: Installed via `npm install -g @anthropic-ai/claude-code` or `claude-code` package manager (see CLAUDE.md § Regeneration). The template is dropped into projects via template instantiation. No special build required.

**OpenAI Codex**: Installed via `npm install -g codex` or platform-specific installer. Template references at `.codex/config.toml:18-19` specify the MCP server via `node ./.codex-mcp-guard/server.js`.

**Gemini CLI**: Installed via platform package manager (e.g., `brew install gemini-cli`) or binary download. Template references at `.gemini/settings.json:6-10` specify the MCP server via `node ./.codex-mcp-guard/server.js` (shared with Codex).

## 2. Language Runtimes

**Node.js major version**: 18+ required (based on `#!/usr/bin/env node` shebangs at `.claude/bin/*.mjs` files like `emit.mjs`, `compose.mjs`, `loom-links-init.mjs`, etc. using ES modules syntax). The `.codex-mcp-guard/package.json:4` declares `"type": "commonjs"` for the MCP guard server, but requires Node 18+ for `node:child_process` imports in `.mjs` files (e.g., `import { execFileSync, spawnSync } from "node:child_process"` at `.claude/bin/emit-cli-artifacts.mjs`).

**Python major version**: Template does not ship Python code at root. Consumer repos using kailash frameworks will declare via `pyproject.toml` or `setup.py`. The CLAUDE.md documents frameworks as `pip install kailash*` packages (Core SDK, DataFlow, Nexus, Kaizen, PACT, ML, Align), implying Python 3.8+.

## 3. Hook Script Shell-Out Inventory

**Git commands**: `git rev-parse --abbrev-ref HEAD` (get current branch), `git ls-files --error-unmatch` (check tracked files), `git check-ignore -q` (test .gitignore), `git diff --cached --name-only` (list staged files), `git` with variable args (fetch, push, status, etc.). Invoked via `spawnSync("git", [...])` in hooks like `pre-commit-branch-scope.js`, `auto-format.js`, `session-start.js`.

**SSH keygen**: `ssh-keygen -lf <candidate>` (validate key fingerprints) at `posture-gate.js`.

**Node sub-invocations**: `spawnSync("node", [scriptRel, ...args])` throughout hooks for validators (e.g., `scan-synced-disclosure.mjs`, `validate-emit.mjs`).

**External tools**: No `jq`, `yq`, `curl`, `wget`, `sed`, `awk`, or `ripgrep` invocations found in hook source. All parsing is in-JS via regex and native APIs.

## 4. Command-Wrapper Shell-Out

No `.claude/wrappers/*.sh.template` files exist in this template. Wrapper patterns are not used.

## 5. Python Package Surface

CLAUDE.md § Kailash Platform (lines 144–152) documents:

- `kailash` (Core SDK; includes standard extras: trust, server, HTTP, database, monitoring)
- `kailash-dataflow` (DataFlow; zero-config DB operations)
- `kailash-nexus` (Nexus; multi-channel deployment API+CLI+MCP)
- `kailash-kaizen` (Kaizen; AI agent framework)
- `kailash-pact` (PACT; organizational governance D/T/R)
- `kailash-ml` (ML; classical + deep learning lifecycle)
- `kailash-align` (Align; LLM fine-tuning/serving)

No extras beyond the base sets are documented in this template.

## 6. Env Vars + Secrets

**.env.example** (lines 1–18) lists:

- `OPENAI_API_KEY`, `OPENAI_PROD_MODEL`, `OPENAI_DEV_MODEL`, `DEFAULT_LLM_MODEL` (OpenAI)
- `ANTHROPIC_API_KEY` (Anthropic)
- `GOOGLE_API_KEY` (Google)
- `DATABASE_URL` (PostgreSQL connection)
- `JWT_SECRET_KEY` (authentication)

Hook source reads via `process.env.*` in Node; Python code reads via `os.environ` after `load_dotenv()`.

## 7. File-System Side Channels

**Persistent state (local per clone)**:

- `.claude/learning/observations.jsonl` — multi-operator coordination log (APPEND-only)
- `.claude/learning/violations.jsonl` — trust-posture violation records
- `.claude/learning/posture.json` — folded per-operator + repo-floor posture cache
- `.claude/learning/codify-lease.json` — claim records (not .gitignored; participates in coordination)
- `.claude/learning/.heartbeat-cache` — session liveness tracking

**Bind-mount strategy**: Operator `.claude/learning/` and `.codex-mcp-guard/` (MCP guard state if any) should be volume-mounted to persist across container restarts. NO `.gitignore` entry prevents `.learning/` from being tracked; operator coordination log IS version-controlled.

**Team memory** (if any): `.claude/team-memory/` (not present in this template; referenced in rules as optional downstream consumer extension).

**.codex-mcp-guard/** (MCP server working dir): No persistent state by design; read-only `policies.json` extraction + real-time enforcement.

## 8. Permission/Ownership Pitfalls

**.gitignore entries** (checked at `.gitignore` line 1–2):

- `.claude/learning/` — coordination log IS tracked
- `.claude/learning/codify-lease.json` — no special .gitignore entry

**File write scope**: Hooks write to `.claude/learning/` via `coc-append.js` helper (signed append-only semantics). Files must be readable by the developer user (not root). The container entrypoint should run as the developer user, not root, to avoid permission issues when writing to mounted `.claude/learning/` volume.

## 9. External Tools Assumed

**Git** (`git` binary): Every session invokes git for branch checks, staged-file listing, and status queries. REQUIRED.

**Node.js** (`node` binary): Hooks and bin scripts execute Node.js directly. REQUIRED.

**SSH-keygen** (`ssh-keygen` binary): Used by posture-gate.js to validate signing key fingerprints. REQUIRED.

**jq, yq, curl, wget, sed, awk, ripgrep**: NOT referenced; JSON parsing done in JS, no shell text processing.

---

**Summary**: Dockerfile must contain Node 18+, Python 3.8+, git, and ssh-keygen. MCP servers (Codex, Gemini guards) run as Node subprocesses within the container. Volume-mount `.claude/learning/` for persistent operator coordination state.

---

## CORRECTION (2026-05-27, orchestrator re-verification)

The tool list above (§3, §9) UNDER-COUNTED. An independent re-grep of literal
`spawn(`/`exec(`/`execFileSync(` first-argument string-literals across `.claude/hooks/`

- `.claude/bin/` returns:

```
26 git    3 node    2 npx    2 gpg    1 gpgconf
 1 ssh-keygen    1 gh    1 curl    1 ruff    1 black
```

Corrections to the image tooling set:

- **`gnupg` (`gpg` + `gpgconf`) — REQUIRED, load-bearing.** Commit-signing keys are the
  `verified_id` primitive of the multi-operator coordination substrate
  (`rules/multi-operator-coordination.md` §1). Omitting `gnupg` silently breaks every
  signed coordination-log record the instant a second operator enrolls. This was the
  most important miss.
- **`gh` (GitHub CLI) — REQUIRED.** Confirmed shell-out (issue closure, PR workflows,
  `gh api` ruleset checks), not merely an allowlist entry.
- **`curl` — REQUIRED.** Confirmed shell-out.
- **`ruff` + `black` — REQUIRED (Python toolchain).** Shelled out by `auto-format.js`
  (the PostToolUse formatter). Install via pip/uv alongside the frameworks. The "template
  is Node-based, Python optional" framing in the body above obscured this.
- **`npx` — present** (bundled with npm/Node; no separate install).
- **`jq` / `yq` / `ripgrep`** — appear in `posture-gate.js` / `violation-patterns.js`
  as string-pattern references, not confirmed shell-outs; include anyway (low cost, the
  settings allowlist references them, wrapper templates `.claude/wrappers/*.sh.template`
  may invoke them — note the body's "no wrappers exist" claim was also wrong; 28 wrapper
  templates exist).

Authoritative image tooling layer: **git, gnupg, openssh-client, gh, curl, jq, yq,
ripgrep, ca-certificates, build-essential** (OS) + **ruff, black** (Python, via uv/pip).
See `02-plans/01-architecture.md` §3.
