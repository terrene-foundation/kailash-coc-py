
# agents.md

---
priority: 0
scope: baseline
---

# Agent Orchestration Rules


## Specialist Delegation (MUST)

When working with Kailash frameworks, MUST consult the relevant specialist:

- **dataflow-specialist**: Database or DataFlow work
- **nexus-specialist**: API or deployment work
- **kaizen-specialist**: AI agent work
- **mcp-specialist**: MCP integration work
- **mcp-platform-specialist**: FastMCP platform server, contributor plugins, security tiers
- **pact-specialist**: Organizational governance work
- **ml-specialist**: ML lifecycle, feature stores, training, drift monitoring, AutoML
- **align-specialist**: LLM fine-tuning, LoRA adapters, alignment methods, model serving

**Applies when**: Creating workflows, modifying DB models, setting up endpoints, building agents, implementing governance, training ML models, fine-tuning LLMs, configuring MCP platform server.

**Why:** Framework specialists encode hard-won patterns and constraints that generalist agents miss, leading to subtle misuse of DataFlow, Nexus, or Kaizen APIs.

## Specs Context in Delegation (MUST)

Every specialist delegation prompt MUST include relevant spec file content from `specs/`. Read `specs/_index.md`, select relevant files, include them inline. See `rules/specs-authority.md` MUST Rule 7 for the full protocol and examples.

**Why:** Specialists without domain context produce technically correct but intent-misaligned output (e.g., schemas without tenant_id because multi-tenancy wasn't communicated).

## Analysis Chain (Complex Features)

1. **analyst** → Identify failure points
2. **analyst** → Break down requirements
3. **`decide-framework` skill** → Choose approach
4. Then appropriate specialist

**Applies when**: Feature spans multiple files, unclear requirements, multiple valid approaches.

## Parallel Execution

When multiple independent operations are needed, launch agents in parallel using Task tool, wait for all, aggregate results. MUST NOT run sequentially when parallel is possible.

**Why:** Sequential execution of independent operations wastes the autonomous execution multiplier, turning a 1-session task into a multi-session bottleneck.

## Quality Gates (MUST — Gate-Level Review)

Reviews happen at COC phase boundaries, not per-edit. Skip only when explicitly told to.

**Why:** Skipping lets gaps propagate to downstream repos where they are far more expensive to fix. Evidence: 0052-DISCOVERY §3.3 — six commits shipped without review because gates were "recommended." Background agents make MUST gates nearly free.

| Gate                             | After Phase          | Enforcement | Review                                                                         |
| -------------------------------- | -------------------- | ----------- | ------------------------------------------------------------------------------ |
| Analysis complete                | `/analyze`           | RECOMMENDED | **reviewer**: Are findings complete? Gaps?                                     |
| Plan approved                    | `/todos`             | RECOMMENDED | **reviewer**: Does plan cover requirements?                                    |
| Implementation done              | `/implement`         | **MUST**    | **reviewer** + **security-reviewer**: Run as parallel background agents.       |
| ... | ... |

**BLOCKED responses when skipping MUST gates:**

- "Skipping review to save time"
- "Reviews will happen in a follow-up session"
- "The changes are straightforward, no review needed"
- "Already reviewed informally during implementation"

**Background agent pattern for MUST gates** — the review costs nearly zero parent context. See **Examples § Quality Gates — Background Agent Pattern** below for the CLI-specific syntax.

### MUST: Reviewer Prompts Include Mechanical AST/Grep Sweep, Not Only Diff Review

Every gate-level reviewer prompt MUST include explicit mechanical sweeps that verify ABSOLUTE state (not only the diff). LLM-judgment review of the diff catches what's wrong with the new code; mechanical sweeps catch what's missing from the OLD code that the spec also touched.

See **Examples § Reviewer Mechanical Sweeps** below for the DO / DO NOT delegation block — the surrounding syntax differs per CLI runtime, so it lives in the overlay-replaceable `examples` slot.

**Why:** Gate reviewers are constrained by the diff they're shown. The orphan failure mode of `rules/orphan-detection.md` §1 is invisible at diff-level. A 4-second `grep -c` sweep catches what 5 minutes of LLM judgment misses. See `skills/30-claude-code-patterns/worktree-orchestration.md § Reviewer Prompts` for the kailash-ml 0.12.0 post-mortem.

## Zero-Tolerance

Pre-existing failures MUST be fixed (see `rules/zero-tolerance.md` Rule 1). No workarounds for SDK bugs — deep dive and fix directly (Rule 4).

**Why:** Workarounds create parallel implementations that diverge from the SDK, doubling maintenance cost and masking the root bug from being fixed.

## MUST: Worktree Isolation for Compiling Agents

When launching agents that compile (Rust `cargo`, Python `.venv` installs, JS `node_modules`), MUST use the CLI's worktree-isolation primitive to avoid build directory lock contention. See **Examples § Worktree Isolation for Compiling Agents** below for the CLI-specific delegation syntax.

**Why:** Cargo holds an exclusive filesystem lock on `target/`. Two cargo processes in the same directory serialize completely. See `rules/worktree-isolation.md` + `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 1`.

## MUST: Worktree Prompts Use Relative Paths Only

Any absolute path in a worktree-isolation delegation prompt MUST be anchored to the pinned worktree path — absolute paths pointing to the parent checkout are BLOCKED.

See **Examples § Worktree Prompts Use Relative Paths Only** below for the DO / DO NOT delegation syntax.

**Why:** Worktree-isolation primitives set cwd inside the worktree but file-write tools accept any absolute path — parent-rooted paths resolve there regardless of cwd. See `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 2` for the 2026-04-19 three-shard ml-specialist post-mortem (Shard A lost 300+ LOC).

## MUST: Recover Orphan Writes From Zero-Commit Worktree Agents

When an `isolation: "worktree"` agent reports completion but the branch has zero commits AND the worktree has been auto-cleaned, the parent orchestrator MUST inspect the MAIN checkout for orphaned untracked files via `git status --short` BEFORE concluding the work was lost. Absolute-path writes from the agent resolve to the MAIN checkout cwd — the files are NOT lost; they are orphaned, uncommitted, and reachable. Abandoning orphans and re-launching the agent is BLOCKED.

**Why:** `git status` surfaces orphans the moment you look. The first four rationalizations discard 1000+ LOC per occurrence; the fifth conflates branch-name aesthetics with provenance — `recovery/` grep surfaces this rescue class across history; `feat/` does not. See `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 2a` for the 4-step protocol + 2026-04-20 PR #574 post-mortem (1129 LOC of `alignment.py` recovered from MAIN).

## MUST: Worktree Agents Commit Incremental Progress

Every agent launched with `isolation: "worktree"` MUST receive an explicit instruction to `git commit` after each major milestone, not only at completion. The orchestrator MUST verify the branch has ≥1 commit before declaring the agent's work landed. **This applies to every worktree agent regardless of task type** — compile work, prose drafting, one-line config edits, markdown briefs, and one-off spikes all exhibit the same failure mode.

**Why:** Worktree auto-cleanup deletes worktrees with zero commits. Truncation mid-message before commit loses 100% of output. See `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 3` for the 2026-04-19 three-shard compile post-mortem (3 of 3 truncated, 2 lost work) AND `rules/worktree-isolation.md` § Rule 5 for the 2026-04-21 non-compile post-mortem (11 drafted briefs + pytest.ini diagnosis lost).

## MUST: Verify Agent Deliverables Exist After Exit

When an agent reports completion of a file-writing task, the parent orchestrator MUST `ls` or read the claimed file before trusting the completion claim. Agent "done" messages are NOT evidence of file creation.

See **Examples § Verify Agent Deliverables Exist After Exit** below for the CLI-specific file-read verification syntax.

**Why:** Budget exhaustion truncates the final write; agent emits "Now let me write X..." with no tool call. `ls` is O(1) — silent no-op into loud retry. See `rules/worktree-isolation.md` Rule 3 + `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 4` (kaizen round 6, ml-specialist round 7).

## MUST: Parallel-Worktree Package Ownership Coordination

When two or more parallel agents' worktrees touch the SAME sub-package, the orchestrator MUST designate ONE agent as the **version owner** AND tell every other agent: "do NOT edit `packages/<pkg>/pyproject.toml` (or `Cargo.toml`), the package's `__version__` / crate version, or `packages/<pkg>/CHANGELOG.md`".

**Why:** Parallel agents see the same base SHA and independently bump version + write top-level CHANGELOG entries. Git picks one; the other's prose is discarded. Pre-declared ownership is O(one-line-in-prompt). See `skills/30-claude-code-patterns/worktree-orchestration.md § Rule 5`.

## MUST NOT

- Framework work without specialist — **Why:** Misuse produces code that looks correct but violates invariants (pool sharing, session lifecycle, trust boundaries).
- Sequential when parallel is possible — **Why:** See Parallel Execution above.
- Raw SQL when DataFlow exists — **Why:** Bypasses DataFlow's access controls, audit logging, and dialect portability.
- Custom API when Nexus exists — **Why:** Misses Nexus's session management, rate limiting, multi-channel deployment.
- Custom agents when Kaizen exists — **Why:** Bypasses Kaizen's signature validation, tool safety, structured reasoning.
- Custom governance when PACT exists — **Why:** Lacks PACT's D/T/R accountability grammar and verification gradient.



## Examples

### Quality Gates — Background Agent Pattern

### Reviewer Mechanical Sweeps

### Worktree Isolation for Compiling Agents

```
# DO
@ml-specialist
isolation: worktree
prompt: "implement feature X..."

# DO NOT: two agents sharing target/ serialize on cargo's exclusive lock
```

### Worktree Prompts Use Relative Paths Only

### Verify Agent Deliverables Exist After Exit

```python
# DO — verify after @agent returns
read_file("/abs/path/src/feature.py")  # raises if missing → retry

# DO NOT — trust completion message
```


---

# autonomous-execution.md

---
priority: 0
scope: baseline
---

# Autonomous Execution Model


COC executes through **autonomous AI agent systems**, not human teams. All deliberation, analysis, recommendations, and effort estimates MUST assume autonomous execution unless the user explicitly states otherwise.

Human defines the operating envelope. AI executes within it. Human-on-the-Loop, not in-the-loop.

## MUST NOT (Deliberation)

- Estimate effort in "human-days" or "developer-weeks"
- Recommend approaches constrained by "team size" or "resource availability"
- Suggest phased rollouts motivated by "team bandwidth" or "hiring"
- Assume sequential execution where parallel autonomous execution is possible
- Frame trade-offs in terms of "developer experience" or "cognitive load on the team"

**Why:** Human-team framing causes the agent to recommend suboptimal approaches (phasing, sequencing, simplifying) that waste autonomous execution capacity.

## MUST (Deliberation)

- Estimate effort in **autonomous execution cycles** (sessions, not days)
- Recommend the **technically optimal approach** unconstrained by human resource limits
- Default to **maximum parallelization** across agent specializations
- Frame trade-offs in terms of **system complexity**, **validation rigor**, and **institutional knowledge capture**

**Why:** Without autonomous framing, effort estimates inflate 10x and plans are artificially sequenced to fit human-team constraints that don't exist.

## 10x Throughput Multiplier

Autonomous AI execution with mature COC institutional knowledge produces ~10x sustained throughput vs equivalent human team.

| Factor                                               | Multiplier |
| ---------------------------------------------------- | ---------- |
| Parallel agent execution                             | 3-5x       |
| Continuous operation (no fatigue, no context-switch) | 2-3x       |
| Knowledge compounding (zero onboarding)              | 1.5-2x     |
| Validation quality overhead                          | 0.7-0.8x   |
| **Net sustained**                                    | **~10x**   |

**Conversion**: "3-5 human-days" → 1 session. "2-3 weeks with 2 devs" → 2-3 sessions. "33-50 human-days" → 3-5 days parallel.

**Does NOT apply to**: Greenfield domains (first session ~2-3x), novel architecture decisions, external dependencies (API access, approvals), human-authority gates (calendar-bound).

## Structural vs Execution Gates

**Structural (human required):** Plan approval (/todos), release authorization (/release), envelope changes.

**Execution (autonomous convergence):** Analysis quality (/analyze), implementation correctness (/implement), validation rigor (/redteam), knowledge capture (/codify). Human observes but does NOT block.

## Per-Session Capacity Budget

Autonomous capacity is high but not infinite. It degrades along multiple axes simultaneously — LOC is only the proxy. Work that exceeds the budget below MUST be sharded at `/todos` time, before implementation begins.

### 1. Shard When Any Threshold Is Exceeded (MUST)

A single shard (one session, one worktree, one implementation pass) MUST stay within ALL of:

- **≤500 LOC of load-bearing logic** — state machines, schedulers, invariant-holding code. Does NOT count CRUD, DTOs, route registration, or generated boilerplate.
- **≤5–10 simultaneous invariants** the implementation must hold (tenant isolation + audit + redaction + cache key shape + error taxonomy = 5).
- **≤3–4 call-graph hops** of cross-file reasoning.
- **≤15k LOC of relevant surface area** in working context for correctness.
- Describable in **3 sentences or fewer**. If it takes more, the shard is too big.

**Why:** Beyond the budget the model stops tracking cross-file invariants and pattern-matches instead. Errors on line 400 poison everything after and surface only at `/redteam`. Evidence: the Phase 5.11 orphan (2,407 LOC of trust integration code with zero production call sites) was one conceptual change that exceeded the invariant budget — nothing caught it until the audit.

### 2. Size By Complexity, Not LOC Alone (MUST)

Todo sizing MUST distinguish boilerplate from load-bearing logic. Boilerplate scales ~5× further than logic before sharding triggers, because the model holds a single pattern and stamps it out.

**Why:** Uniform LOC caps fail on both ends. Sizing reflects what's held in attention (invariants, call-graph depth), not what's typed (line count).

### 3. Feedback Loops Multiply Capacity (MUST)

Shards with an executable feedback loop (unit tests, `cargo check`, type checker, integration harness that runs during the session) MAY use up to 3–5× the base budget. Shards without a live loop (spec drafting, config editing, refactors in untested modules) MUST use the base budget.

**Why:** Feedback loops convert "write 2000 LOC then discover it's wrong" into "write 200 LOC, test, continue." The multiplier is real but requires the loop to actually fire during the session — "redteam will catch it later" is not a feedback loop.

### 4. Fix-Immediately When Review Surfaces A Same-Class Gap Within Shard Budget (MUST)

When a code review or self-verification surfaces a latent gap in the SAME BUG CLASS as the in-flight PR AND the gap fits within one remaining shard budget (≤500 LOC load-bearing logic / ≤5–10 invariants / ≤3–4 call-graph hops), the session MUST spawn the fix immediately rather than filing a follow-up issue. Filing the follow-up issue instead of fixing is BLOCKED.

**Why:** Same-bug-class gaps surfaced during review cost the least to fix while the context is loaded — the invariants, call graph, and domain model are all warm in attention. Filing a follow-up issue requires the next session to reload the entire context from scratch, typically 2–5× the marginal cost of continuing. Evidence: kailash-rs 2026-04-20 — PR #435 reviewer flagged 40+ model-aware `bind_value` sites with the same `None::<String>` hardcode. The agent filed #436 instead of fixing; the user pushed back ("why aren't you resolving it"); the fix shipped as #437 in the same session. Filing #436 wasted one user-turn of friction and one session-handoff context-reload that was unnecessary.

**Bounded by the shard budget.** This rule does NOT override MUST Rule 1 (shard threshold). If the surfaced gap exceeds ≤500 LOC load-bearing / ≤5–10 invariants / ≤3–4 call-graph hops, filing the follow-up issue IS the correct disposition — the gap is a new shard, not a continuation of the current one.

## MUST NOT (Sharding)

- Size shards by LOC alone, ignoring invariant count and call-graph depth

**Why:** LOC is a proxy that fragments trivial work and overflows complex work.

- Defer sharding decisions to `/implement`

**Why:** Sharding at `/todos` costs a plan rewrite; sharding mid-`/implement` abandons work in progress and leaves partial state the next session must untangle.

**Why:** Context window is not attention. Model capability claims are not evidence for a specific task. "One conceptual change" is exactly how Phase 5.11 shipped 2,407 LOC of orphaned code.


---

# communication.md

---
priority: 0
scope: baseline
---

# Communication Style


Many COC users are non-technical. Default to plain language; match the user's level if they speak technically.

## Report in Outcomes, Not Implementation

## Explain Choices in Business Terms

When presenting decisions, explain implications in terms the user can act on — not implementation details.

## Frame Decisions as Impact

Present: what each option does (plain language), what it means for users/business, the trade-off, your recommendation.

**Example**: "Two options for notifications. Option A: email only — simple, but users might miss messages. Option B: email plus in-app — takes longer but ensures users see important updates. I'd recommend B since your brief emphasizes real-time awareness."

## Approval Gates

At gates (end of `/todos`, before `/deploy`), ask:

- "Does this cover everything you described in your brief?"
- "Is anything here that you didn't ask for or don't want?"
- "Is anything missing that you expected to see?"

## MUST NOT

- Ask non-coders to read code — describe in plain language

**Why:** Non-technical users cannot act on code snippets, so they either ignore the information or make wrong assumptions.

- Use unexplained jargon — immediately explain technical terms

**Why:** Unexplained jargon forces the user to ask clarifying questions, doubling the turns needed to reach a decision.

- Present raw error messages — translate to impact

**Why:** Raw error messages are unintelligible to most users and create anxiety without enabling action.

- Repeat the same jargon if user says "I don't understand" — find new analogy

**Why:** Repeating failed explanations signals that the agent cannot adapt, eroding user trust in the entire session.


---

# cross-cli-parity.md

---
priority: 0
scope: baseline
---

# Cross-CLI Parity Meta-Rule


Loom emits the same underlying artifact (rule / agent / skill / command) to three CLI targets (CC, Codex, Gemini). Parity means: the semantic content users depend on is identical across all three; only the delegation syntax and surface format differ. This rule defines what MUST match and what MAY diverge so the cross-CLI drift audit has a deterministic contract.

Parity violations don't fail at emit time — they fail at user time, when a rule shipped to Codex is quietly weaker than the same rule shipped to CC.

## MUST Rules

### 1. Neutral-Body Slot Content Is Invariant Across CLI Emissions

The `neutral-body` slot MUST be byte-identical (modulo whitespace normalization) across every CLI emission of the same rule. Drift in this slot HARD BLOCKS sync.

**Why:** Asymmetric rule strength across CLIs means a user who tests compliance on CC sees a green check, ships to Codex, and finds the rule silently relaxed. Users cannot audit across CLIs; the emitter is the audit. Drift in neutral-body is the failure mode this rule exists to prevent.

### 2. Examples Slot May Diverge; Drift Emits SOFT WARN

The `examples` slot is explicitly divergent across CLIs (CC uses `Agent(...)`, Codex uses native delegation, Gemini uses `@specialist`). Drift here produces a warning, not a block. Drift in ANY other slot is a hard block.

**Why:** Examples diverge by design; the drift audit must distinguish expected divergence from regression. Without the slot allowlist, every `/sync` produces noise that operators learn to ignore — and the real drift hides in the noise.

### 3. Frontmatter Priority + Scope Are Identical Across CLIs

A rule's `priority:` and `scope:` frontmatter values MUST match on every CLI emission. A rule cannot be CRIT baseline on CC and path-scoped on Codex for the same underlying file. Drift here is a hard block.

**Why:** Different scopes across CLIs produce different always-on surfaces; a rule the user relies on everywhere becomes present-sometimes on Codex. Scope is a compositional invariant; variants MUST NOT override it.

### 4. Scrub Tokens Cover Delegation Syntax, Not Semantic Content

The `scrub_tokens` list in `parity_enforcement.cross_cli_drift_audit` exists to eliminate false-positive drift from delegation syntax (CC: `Agent(`, Codex: `codex_agent(`, Gemini: `@specialist`). It MUST NOT be extended to semantic phrases.

**Why:** Scrubbing semantic tokens turns the drift audit into a null check. The finding it silences is exactly the finding it exists to produce. Extend `warn_on_drift_in_slots` if a whole slot is expected to diverge — never the token list.

## MUST NOT

- Ship a CLI-specific weakening of a rule under the guise of "equivalent"

**Why:** "Equivalent" is the excuse that turns parity into drift; the audit treats byte-identity + scrub as the contract.

- Disable the drift audit to unblock a sync

**Why:** A disabled audit produces no findings; the drift ships silently and is unrecoverable once downstream repos pull it.


---

# git.md

---
priority: 0
scope: baseline
---

# Git Workflow Rules


## Conventional Commits

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Why:** Non-conventional commits break automated changelog generation and make `git log --oneline` useless for release notes.

## Branch Naming

Format: `type/description` (e.g., `feat/add-auth`, `fix/api-timeout`)

**Why:** Inconsistent branch names prevent CI pattern-matching rules and make `git branch --list` unreadable across contributors.

## Branch Protection

All protected repos require PRs to main. Direct push is rejected by GitHub.

**Why:** Direct pushes bypass CI checks and code review, allowing broken or unreviewed code to reach the release branch.

| Repository                                    | Branch | Protection          |
| --------------------------------------------- | ------ | ------------------- |
| `terrene-foundation/kailash-py`               | `main` | Full (admin bypass) |
| `terrene-foundation/kailash-coc-claude-py`    | `main` | Full (admin bypass) |
| `terrene-foundation/kailash-coc-claude-rs`    | `main` | Full (admin bypass) |
| `esperie/kailash-rs`                          | `main` | Full (admin bypass) |
| `terrene-foundation/kailash-prism`            | `main` | Full (admin bypass) |
| `terrene-foundation/kailash-coc-claude-prism` | `main` | Full (admin bypass) |

**Owner workflow**: Branch → commit → push → PR → `gh pr merge <N> --admin --merge --delete-branch`

**Contributor workflow**: Fork → branch → PR → 1 approving review → CI passes → merge

## PR Description

CC system prompt provides the template. Additionally, always include a `## Related issues` section (e.g., `Fixes #123`).

**Why:** Without issue links, PRs become disconnected from their motivation, breaking traceability and preventing automatic issue closure on merge.

## Rules

- Atomic commits: one logical change per commit, tests + implementation together
- No direct push to main, no force push to main
- No secrets in commits (API keys, passwords, tokens, .env files)
- No large binaries (>10MB single file)
- Commit bodies MUST answer **why**, not **what** (the diff shows what)

**Why:** Mixed commits are impossible to revert cleanly, leaked secrets require immediate key rotation across all environments, and large binaries permanently bloat the repo since git never forgets them. Commit bodies that explain "why" are the cheapest form of institutional documentation — co-located with the code, versioned, searchable via `git log --grep`, and never stale (they describe a point in time). See 0052-DISCOVERY §2.10.

## Issue Closure Discipline

Closing a GitHub issue as "completed" MUST include a commit SHA, PR number, or merged-PR link in the close comment. Closing with no code reference is BLOCKED.

**Why:** Issues closed with zero delivered code references break traceability; the next session cannot verify whether the fix actually shipped.

## Pre-Commit Hook Workarounds

When pre-commit auto-stash causes commits to fail despite hooks passing in direct invocation, the workaround `git -c core.hooksPath=/dev/null commit ...` MUST be documented in the commit body, AND a follow-up todo MUST be filed against the pre-commit configuration. Silent re-tries with `--no-verify` are BLOCKED.

**Why:** Recurring across sessions; without documentation each session re-discovers the workaround at high cost. With documentation the next agent finds it via `git log --grep`.

## Commit-Message Claim Accuracy

Commit bodies MUST describe ONLY changes actually present in the diff. Claiming a refactor, deletion, or side-effect that the diff does NOT contain is BLOCKED. If the claim was made in error, push a FOLLOW-UP commit that actually does what the prior message said — do NOT amend, do NOT ignore.

**Why:** `git log --grep` is the cheapest institutional-knowledge search across a repo — a body that claims something the diff doesn't contain poisons every future search that lands on it. The next session reads "dropped the warning-suppression" in the log, assumes it happened, and bases later decisions on a diff that never existed. Amending is BLOCKED because it loses the audit trail of the over-claim; a follow-up commit preserves both the original claim AND the correction so anyone tracing the history sees the full sequence.


---

# independence.md

---
priority: 0
scope: baseline
---

# Foundation Independence Rules


Kailash Python SDK is owned by the Terrene Foundation (Singapore CLG). It is an independent open-source product with NO structural relationship to any commercial entity.

## No Commercial References

MUST NOT reference, compare with, or design against any commercial or proprietary product:

- No proprietary product names, SDKs, runtimes, or frameworks
- No commercial entities, partnerships, or market positioning
- No "unlike X", "the open-source version of Y", or "differentiates from Z"
- No "Python port of", "community edition of", or derivative language

**Why:** Commercial references position Kailash as derivative, undermining its independent identity and potentially creating trademark or legal entanglement.

**Describe Kailash on its own terms.** The existence of any other product is irrelevant.

**Correct**: "Kailash Python SDK is the Terrene Foundation's open-source workflow orchestration platform."
**Incorrect**: "Kailash Python SDK is the Python version of [product name]."

## No Proprietary Awareness

- No proprietary file paths, module names, or architecture references
- No "compatibility" or "interop" with proprietary systems
- No APIs designed for a specific proprietary product
- No revenue models, pricing, enterprise vs community splits

**Why:** Proprietary awareness in code or docs creates implicit coupling that constrains future architecture decisions and signals that the SDK serves a specific commercial product.

## Foundation-Only Dependencies

- Standard open-source libraries (PyPI, OSI-approved licenses)
- Open standards (CARE, EATP, CO — CC BY 4.0) where applicable
- MUST NOT depend on, import from, or interface with any proprietary SDK

**Why:** A proprietary dependency makes every downstream user subject to that vendor's licensing, pricing, and availability decisions, violating the Foundation's independence charter.

## Design for SDK Users

All decisions driven by: what SDK users need, what Python developers expect, what the community contributes. Never by what any other product does or plans to do.

**Why:** Designing for a specific commercial consumer rather than SDK users at large biases the API surface, making it awkward for the broader community while optimizing for one party.

Third parties may build commercial products on Kailash. The SDK has zero knowledge of, zero dependency on, and zero design consideration for any such product.


---

# security.md

---
priority: 0
scope: baseline
---

# Security Rules


ALL code changes in the repository.

## No Hardcoded Secrets

All sensitive data MUST use environment variables.

**Why:** Hardcoded secrets end up in git history, CI logs, and error traces, making them permanently extractable even after deletion.

## Parameterized Queries

All database queries MUST use parameterized queries or ORM.

**Why:** Without parameterized queries, user input becomes executable SQL, enabling data theft, deletion, or privilege escalation.

## Credential Decode Helpers

Connection strings carry credentials in URL-encoded form. Decoding them at a call site with `unquote(parsed.password)` is BLOCKED — every decode site MUST route through a shared helper module so the validation logic lives in exactly one place and drift between sites is impossible.

### 1. Null-Byte Rejection At Every Credential Decode Site (MUST)

Every URL parsing site that extracts `user`/`password` from `urlparse(connection_string)` MUST route through a single shared helper that rejects null bytes after percent-decoding. Hand-rolled `unquote(parsed.password)` at a call site is BLOCKED.

**Why:** A crafted `mysql://user:%00bypass@host/db` decodes to `\x00bypass`; the MySQL C client truncates credentials at the first null byte and the driver sends an empty password, succeeding against any row in `mysql.user` with an empty `authentication_string`. Drift between sites that have the check and sites that don't is unauditable without a single helper.

### 2. Pre-Encoder Consolidation (MUST)

Password pre-encoding helpers (`quote_plus` of `#$@?` etc.) MUST live in the same shared helper module as the decode path. Per-adapter copies are BLOCKED.

**Why:** Encode and decode are dual halves of one contract; splitting them across modules guarantees one half drifts. Round-trip tests are only meaningful when both ends share the helper.

## Input Validation

All user input MUST be validated before use: type checking, length limits, format validation, whitelist when possible. Applies to API endpoints, CLI inputs, file uploads, form submissions.

**Why:** Unvalidated input is the entry point for injection attacks, buffer overflows, and type confusion across every attack surface.

## Output Encoding

All user-generated content MUST be encoded before display in HTML templates, JSON responses, and log output.

**Why:** Unencoded user content enables cross-site scripting (XSS), allowing attackers to execute arbitrary JavaScript in other users' browsers.

## MUST NOT

- **No eval() on user input**: `eval()`, `exec()`, `subprocess.call(cmd, shell=True)` — BLOCKED

**Why:** `eval()` on user input is arbitrary code execution — the attacker runs whatever they want on the server.

- **No secrets in logs**: MUST NOT log passwords, tokens, or PII

**Why:** Log files are widely accessible (CI, monitoring, support staff) and rarely encrypted, turning every logged secret into a breach.

- **No .env in Git**: .env in .gitignore, use .env.example for templates

**Why:** Once committed, secrets persist in git history even after removal, and are exposed to anyone with repo access.

## Sanitizer Contract — DataFlow Display Hygiene

DataFlow's input sanitizer (`packages/kailash-dataflow/src/dataflow/core/nodes.py::sanitize_sql_input`) is a defense-in-depth display-path safety net, NOT the primary SQLi defense. Parameter binding (`$N` / `%s` / `?`) is the primary defense — see § Parameterized Queries above.

The sanitizer's contract is fixed:

### 1. String Inputs MUST Be Token-Replaced, Not Quote-Escaped

For declared-string fields, the sanitizer MUST replace dangerous SQL keyword sequences with grep-able sentinel tokens (`STATEMENT_BLOCKED`, `DROP_TABLE`, `UNION_SELECT`, etc.). Quote-escaping (`'` → `''`) is BLOCKED.

**Why:** Token-replace makes attacker intent grep-able post-incident (`grep STATEMENT_BLOCKED audit.log`). Quote-escape preserves the payload as data, masking that an attack was attempted. The actual injection defense is parameter binding; the sanitizer is the audit trail.

### 2. Type-Confusion MUST Raise, Not Silently Coerce

For declared-string fields receiving `dict` / `list` / `set` / `tuple` values, the sanitizer MUST raise `ValueError("parameter type mismatch: …")`. Silent coercion via `str(value)` is BLOCKED — it lets a nested structure bypass the string-only sanitizer.

**Why:** A malicious upstream node that passes `{"injection": "'; DROP TABLE …"}` for a field declared as `str` bypasses every string-only check. Raising at the type-confusion boundary closes the bypass; coercion-to-string converts a structural attack into an unaudited storage event.

### 3. Safe Types Are Returned As-Is

Values of declared-safe types (`int`, `float`, `bool`, `Decimal`, `datetime`, `date`, `time`) MUST pass through unchanged. `dict` and `list` MUST also pass through unchanged when the field's declared type is `dict` or `list` (JSON / array columns). Bug #515 documents this: premature `json.dumps()` on dict/list breaks parameter binding in `AsyncSQLDatabaseNode`.

## Multi-Site Kwarg Plumbing

When a security-relevant kwarg (classification policy, tenant scope, clearance context, audit correlation ID) is plumbed through a helper, EVERY call site of that helper MUST be updated in the SAME PR. Updating the "primary" call site and deferring siblings is BLOCKED.

**Why:** A helper that takes a security-relevant kwarg has the kwarg precisely because the unqualified call leaks or misbehaves. Leaving any sibling call site on the unqualified signature ships the exact failure mode the kwarg was introduced to fix; the "safe default" is by definition the insecure default (otherwise the kwarg would not exist). The fix is mechanical — `grep -rn 'helper_name(' .` and patch every hit in the same PR.

## Kailash-Specific Security

- **DataFlow**: Access controls on models, validate at model level, never expose internal IDs
- **Nexus**: Authentication on protected routes, rate limiting, CORS configured
- **Kaizen**: Prompt injection protection, sensitive data filtering, output validation

## Exceptions

Security exceptions require: written justification, security-reviewer approval, documentation, and time-limited remediation plan.


---

# worktree-isolation.md

---
priority: 0
scope: baseline
---

# Worktree Isolation Rules


This rule targets **orchestrator behavior** — the parent session that spawns agents with `isolation: "worktree"`. It governs session-spawn-time decisions (what to pass in the delegation prompt, how to verify deliverables), NOT file-edit-time behavior. It loads universally because orchestration happens in sessions that rarely edit the `agents/`, `commands/`, or rule files it used to be path-scoped to — exactly the sessions where its absence caused the failure mode to recur.

Agents launched with `isolation: "worktree"` run in their own git worktree so parallel jobs do not fight over the same resources. The original motivation was compile-heavy contention (Rust `target/`, Python `.venv/`, JS `node_modules/`) but **the rule applies to every worktree agent regardless of whether it compiles** — prose-drafting, config edits, markdown briefs, one-line pytest.ini fixes all exhibit the same failure mode. When an agent drifts back to the main checkout — because the system prompt didn't pin cwd, because absolute paths were copied from the orchestrator, because the tool defaulted to `process.cwd()` — the isolation silently breaks: two workers overwrite each other's changes, one commits the other's half-done code, and the "parallel" session produces garbage that only surfaces at `/redteam` or (more often) post-hoc when the lost work is noticed missing.

This rule mandates a self-verification step at agent start AND a pre-flight check in the orchestrator's delegation prompt. The verification is cheap (one `git status`) and the failure mode is expensive (a whole session's worth of parallel work corrupted).

## MUST Rules

### 1. Orchestrator Prompts MUST Pin The Worktree Path

Any delegation that uses worktree isolation MUST include the absolute worktree path in the prompt AND MUST instruct the agent to verify `git -C <worktree> status` at the start of its run. Passing the isolation flag without the explicit path is BLOCKED.

See **Examples § Rule 1 — Orchestrator Prompts Pin The Worktree Path** below for the DO / DO NOT delegation syntax.

**Why:** The `isolation: "worktree"` flag creates the worktree but does not pin every tool call inside it — file-writing tools that accept absolute paths will happily write to the main checkout if the orchestrator's prompt uses a main-checkout path. Multiple specialist agents (ml, dataflow, kaizen) drifted back to the main tree during parallel sessions; the corruption was only caught by `git status` after the fact. One-line verification at agent start converts a silent corruption into a loud refusal.

### 2. Specialist Agents MUST Self-Verify Cwd At Start

Every specialist agent file (`.claude/agents/**/*.md`) that may be launched with `isolation: "worktree"` MUST include a "Working Directory Self-Check" step at the top of its process section. The check prints the resolved cwd and the git branch, and refuses to proceed if either is unexpected.

**Why:** The orchestrator's pinned-path instruction can be lost to context compression across long delegation chains; a self-check inside the specialist file is a belt-and-suspenders guarantee that survives prompt truncation. Verified cost: one git call (~30 ms). Verified benefit: prevents the parallel-specialist drift seen in long sessions across compile-heavy languages (Rust cargo locks, Python `.venv` install races, JS `node_modules` writes).

### 3. Parent MUST Verify Deliverables Exist After Agent Exit

When an agent reports completion of a file-writing task, the parent orchestrator MUST verify the claimed files exist at the worktree path via the CLI's filesystem-read primitive before trusting the completion claim. Agent completion messages are NOT evidence of file creation.

See **Examples § Rule 3 — Parent Verifies Deliverables After Agent Exit** below for the DO / DO NOT delegation syntax.

**Why:** Agents hit their budget mid-message and emit "Now let me write X..." without having written X. Multi-agent sessions have logged repeated occurrences (kaizen-specialist round 6, ml-specialist round 7) where an agent reported success with zero files on disk. An `ls` check is O(1) and converts "silent no-op" into "loud retry".

### 4. Worktree Prompts MUST NOT Reference The Parent-Checkout Path

Any absolute path in a worktree-isolation delegation prompt MUST be anchored to the pinned worktree path (see Rule 1). Absolute paths pointing to the parent checkout (`/Users/<you>/repos/<project>/<subpath>` with no worktree prefix) are BLOCKED — agents resolve them against the filesystem root, silently bypassing the worktree and writing into the parent. Relative paths are the safer default because they always resolve to the agent's cwd (the worktree).

See **Examples § Rule 4 — Worktree Prompts Do Not Reference Parent-Checkout Path** below for the DO / DO NOT delegation syntax.

**Why:** `isolation: "worktree"` runs the agent with cwd set to the worktree, but file-write tools accept any absolute path — an absolute path that points to the parent resolves there regardless of cwd. Session 2026-04-19 logged 2 of 3 parallel ml-specialist shards writing to main before self-correcting (Shard B) or losing work entirely (Shard A's 300+ LOC of sklearn array-API impl was lost when its empty worktree auto-cleaned). Only one self-corrected; the failure mode is not agent-detectable by default.

### 5. Worktree Agents MUST Commit Incremental Progress

Every agent launched with worktree isolation MUST receive an explicit instruction in its prompt to `git commit` after each major milestone (each file written, each test batch passed, each draft brief completed, each config edit made), NOT only at completion. The orchestrator MUST then verify the branch has ≥1 commit before declaring the agent's work landed. Worktrees with zero commits auto-clean on agent exit and the work is unrecoverable — **this applies equally to compile work, prose/markdown drafting, one-line config edits, and every other agent task; "my agent is just writing markdown, commit discipline is overkill" is BLOCKED.**

See **Examples § Rule 5 — Worktree Agents Commit Incremental Progress** below for the DO / DO NOT delegation syntax.

**Why:** Worktree auto-cleanup silently deletes worktrees with zero commits on their branch. An agent that writes perfect code / prose / config but truncates mid-message before committing loses 100% of its output. Post-hoc file-existence verification (Rule 3) catches orphan files in main but CANNOT recover files that were only in a cleaned-up worktree. Sessions 2026-04-19 (compile-heavy: 3 of 3 parallel ml-specialist shards truncated at 250-370k tokens; 2 lost work) AND 2026-04-21 (non-compile: 11 drafted markdown briefs + a verified pytest.ini diagnosis lost when two worktree agents reported "done" without committing) demonstrate the same failure across both task types. The only reliable defense is instructing the agent to commit as it goes regardless of whether the task compiles or not.

## MUST NOT

- Launch an agent with `isolation: "worktree"` without passing the absolute worktree path in the prompt

**Why:** The isolation flag alone does not guarantee every tool call stays inside the worktree — the prompt is the only place the agent learns where it belongs.

- Trust an agent's "completion" message when it says "Now let me write…" followed by no tool call

**Why:** Budget exhaustion truncates the write. The completion message is misleading; the filesystem is the source of truth.

- Use `process.cwd()` or relative paths inside specialist agent files that may run in a worktree

**Why:** `process.cwd()` resolves to whatever the Claude Code process was launched with (the main checkout), not the worktree; relative paths inherit the same problem.

## Relationship To Other Rules

- `rules/agents.md` § "MUST: Worktree Isolation for Compiling Agents" — companion rule; this file is the verification layer for the isolation directive there.
- `rules/zero-tolerance.md` Rule 2 — a completed-looking file that doesn't exist is a stub under a different name.
- `rules/testing.md` § "Verified Numerical Claims In Session Notes" — same principle, applied to file deliverables.



## Examples

### Rule 1 — Orchestrator Prompts Pin The Worktree Path

### Rule 3 — Parent Verifies Deliverables After Agent Exit

### Rule 4 — Worktree Prompts Do Not Reference Parent-Checkout Path

### Rule 5 — Worktree Agents Commit Incremental Progress


---

# zero-tolerance.md

---
priority: 0
scope: baseline
---

# Zero-Tolerance Rules


## Scope

ALL sessions, ALL agents, ALL code, ALL phases. ABSOLUTE and NON-NEGOTIABLE.

## Rule 1: Pre-Existing Failures, Warnings, and Notices MUST Be Resolved Immediately

If you found it, you own it. Fix it in THIS run — do not report, log, or defer.

**Applies to** — "found it" includes, with equal weight:

- Test failures, build errors, type errors
- Compiler warnings, linter warnings, deprecation notices
- WARN/ERROR entries in the workspace's logs since the previous gate
- Runtime warnings emitted during the session (`DeprecationWarning`, `ResourceWarning`, `RuntimeWarning`)
- Peer-dependency warnings, missing-module warnings, version-resolution warnings

A warning is not "less broken" than an error. It is an error that the framework chose to keep running through. Both are owed.

**Process:**

1. Diagnose root cause
2. Implement the fix
3. Write a regression test
4. Verify with `pytest` (or the project's test command)
5. Include in current or dedicated commit

**Why:** Deferring broken code creates a ratchet where every session inherits more failures, and the codebase degrades faster than any single session can fix. Warnings are the leading indicator: today's `DeprecationWarning` is next quarter's "it stopped working when we upgraded".

**Mechanism:** The log-triage protocol in `rules/observability.md` MUST Rule 5 provides the concrete commands for scanning test runner output, build tool output, and `*.log` files. If `observability.md` is not loaded (e.g., editing a config file), the agent MUST still scan the most recent test runner and build tool output for WARN+ entries before reporting any gate as complete.

**Exceptions:**

- User explicitly says "skip this issue."
- Upstream third-party deprecation that cannot be resolved by updating or configuring the dependency in this session. Required disposition: pinned version with documented reason OR upstream issue link OR todo with explicit owner. Silent dismissal is still BLOCKED.

### Rule 1a: Scanner-Surface Symmetry

Findings reported by a security scanner on a PR scan MUST be treated identically to findings reported on a main scan. The argument "this also exists on main, therefore not introduced here" is BLOCKED.

**Why:** "Same on main" is the institutional ratchet that defers fixes forever. Rule 1 already covers this in spirit; an explicit scanner-surface clause closes the rationalization gap.

**Second instance — CodeQL `py/modification-of-default-value` via lazy `__getattr__` in `__all__`:**

**Why:** A PR adding new `__all__` entries that are only resolvable via lazy `__getattr__` will be flagged by CodeQL even when grandfathered entries use the same pattern. The fix is to eager-import the NEW entries (closing the flag for this PR), not to argue "main does this too." The grandfathered entries remain a separate workstream and are NOT justification for adding more of the same.

## Rule 2: No Stubs, Placeholders, or Deferred Implementation

Production code MUST NOT contain:

- `TODO`, `FIXME`, `HACK`, `STUB`, `XXX` markers
- `raise NotImplementedError`
- `pass # placeholder`, empty function bodies
- `return None # not implemented`

**No simulated/fake data:**

- `simulated_data`, `fake_response`, `dummy_value`
- Hardcoded mock responses pretending to be real API calls
- `return {"status": "ok"}` as placeholder for real logic

**Frontend mock data is a stub:**

- `MOCK_*`, `FAKE_*`, `DUMMY_*`, `SAMPLE_*` constants
- `generate*()` / `mock*()` functions producing synthetic data
- `Math.random()` used for display data

**Why:** Frontend mock data is invisible to Python detection but has the same effect — users see fake data presented as real.

**Extended examples (DataFlow 2.0 Phase 5 audit):** these patterns passed prior audits but were caught by the Phase 5 wiring sweep. They are equally BLOCKED.

- **Fake encryption** — a class that takes an `encryption_key` parameter, stores it, and does nothing with it:

  ```python
  # BLOCKED — "encrypted" store that writes plaintext
  class EncryptedStore:
      def __init__(self, encryption_key: str):
          self._key = encryption_key
      def set(self, k, v):
          self._backend.set(k, v)  # no encryption applied
  ```

  **Why:** Operators pass a real key and assume data is encrypted at rest. The audit trail shows "encrypted store used"; the disk shows plaintext.

- **Fake transaction** — a context manager that looks like a transaction but commits after every statement:

  ```python
  # BLOCKED — misnamed context manager
  @contextmanager
  def transaction(self):
      yield  # no BEGIN, no COMMIT, no rollback on exception
  ```

  **Why:** Callers write `with db.transaction(): ...` expecting atomicity; partial failure leaves half-committed state.

- **Fake health** — a health endpoint that returns 200 without checking anything:

  ```python
  # BLOCKED — always-green health endpoint
  @router.get("/health")
  async def health():
      return {"status": "healthy"}  # no DB probe, no Redis ping, no nothing
  ```

  **Why:** Load balancers and orchestrators use the health endpoint to decide routing and restart decisions. A fake-healthy endpoint masks real outages.

- **Fake classification / redaction** — a `@classify("email", REDACT)` decorator that stores the classification but never enforces it on read:

  ```python
  # BLOCKED — classify promises redaction but read path ignores it
  @db.model
  class User:
      @classify("email", PII, REDACT)
      email: str
  # user = db.express.read("User", uid)
  # user.email  ← still returns the raw PII
  ```

  **Why:** Documented as a security control; ships as a no-op. The Phase 5.10 audit found this had been non-functional for an unknown period.

- **Fake tenant isolation** — a `multi_tenant=True` flag that silently uses a shared cache key:

  ```python
  # BLOCKED — multi_tenant flag with no tenant dimension in key
  @db.model(multi_tenant=True)
  class Document: ...
  # cache_key = f"dataflow:v1:Document:{id}"  ← tenant_id missing
  ```

  **Why:** See `rules/tenant-isolation.md`. This is the Phase 5.7 orphan pattern surfaced at the cache key layer.

- **Fake metrics** — a metrics class where every counter is a no-op because `prometheus_client` isn't installed but there's no warning:
  ```python
  # BLOCKED — silent no-op metrics
  try:
      from prometheus_client import Counter
  except ImportError:
      Counter = lambda *a, **k: _NoOp()
  # User thinks /fabric/metrics is reporting; it's empty
  ```
  **Why:** Operators rely on dashboards. A silent no-op metrics layer removes the observability contract without any signal. The Phase 5.12 fix emits a loud startup WARN AND an explanatory body from the `/fabric/metrics` endpoint.

## Rule 3: No Silent Fallbacks or Error Hiding

- `except: pass` (bare except with pass) — BLOCKED
- `catch(e) {}` (empty catch) — BLOCKED
- `except Exception: return None` without logging — BLOCKED

**Why:** Silent error swallowing hides bugs until they cascade into data corruption or production outages with no stack trace to diagnose.

**Acceptable:** `except: pass` in hooks/cleanup where failure is expected.

### Rule 3a: Typed Delegate Guards For None Backing Objects

Any delegate method that forwards to a lazily-assigned backing object MUST guard with a typed error before access. Allowing `AttributeError` to propagate from `None.method()` is BLOCKED.

**Why:** Opaque `AttributeError` blocks N tests at once with no actionable message; a typed guard turns the failure into a one-line fix instruction.

## Rule 4: No Workarounds for Core SDK Issues

When you encounter a bug in the Kailash SDK, file a GitHub issue on the SDK repository with a minimal reproduction. Use a supported alternative pattern if one exists.

**Why:** Workarounds create a parallel implementation that diverges from the SDK, doubling maintenance cost and masking the root bug from being fixed.

**BLOCKED:** Naive re-implementations, post-processing, downgrading.

## Rule 5: Version Consistency on Release

ALL version locations updated atomically:

1. `pyproject.toml` → `version = "X.Y.Z"`
2. `src/{package}/__init__.py` → `__version__ = "X.Y.Z"`

**Why:** Split version states cause `pip install kailash==X.Y.Z` to install a package whose `__version__` reports a different number, breaking version-gated logic.

## Rule 6: Implement Fully

- ALL methods, not just the happy path
- If an endpoint exists, it returns real data
- If a service is referenced, it is functional
- Never leave "will implement later" comments
- If you cannot implement: ask the user what it should do, then do it. If user says "remove it," delete the function.

**Test files excluded:** `test_*`, `*_test.*`, `*.test.*`, `*.spec.*`, `__tests__/`

**Why:** Half-implemented features present working UI with broken backend, causing users to trust outputs that are silently incomplete or wrong.

**Iterative TODOs:** Permitted when actively tracked.

