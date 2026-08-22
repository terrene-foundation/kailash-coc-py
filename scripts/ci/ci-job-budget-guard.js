#!/usr/bin/env node
/**
 * Hook: ci-job-budget-guard (PostToolUse, Edit|Write|NotebookEdit)
 *
 * Advisory. Fires when a `.github/workflows/*.yml` edit leaves a PR-reachable
 * job that the job-budget declaration does not account for, and names it at the
 * moment it is added rather than at review time.
 *
 * ALWAYS `continue: true`, NEVER `block`. Its trigger is a structural read of
 * workflow YAML, and `hook-output-discipline.md` MUST-2 caps a lexical/structural
 * signal below `block`. Adding a CI job is legitimate — the contract is that it
 * becomes a DECLARED act, not that it is refused.
 *
 * Fails OPEN on every internal error. A hook that crashes must not wedge an edit,
 * and a guard that cannot read is silent rather than wrong. The CI gate
 * (scripts/ci/job-budget-audit.mjs) is the authority; this is only the early warning.
 *
 * Lives in scripts/ci/ rather than .claude/hooks/ deliberately: `.claude/**` is a
 * loom-synced surface, so an artifact authored there is rebuilt by the next sync,
 * while scripts/ is repo-native and durable.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const TIMEOUT = setTimeout(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}, 5000);

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  clearTimeout(TIMEOUT);
  let msg = null;
  try {
    msg = evaluate(JSON.parse(input || "{}"));
  } catch {
    msg = null; // fail open, silently
  }
  const out = { continue: true };
  if (msg) {
    out.hookSpecificOutput = {
      hookEventName: "PostToolUse",
      additionalContext: msg,
    };
  }
  console.log(JSON.stringify(out));
  process.exit(0);
});

function evaluate(data) {
  const filePath =
    data?.tool_input?.file_path || data?.tool_input?.notebook_path || "";
  if (!/\.github\/workflows\/[^/]+\.ya?ml$/.test(String(filePath))) return null;

  const repo = data?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const audit = path.join(repo, "scripts", "ci", "job-budget-audit.mjs");

  const r = spawnSync("node", [audit, "--json"], {
    encoding: "utf8",
    cwd: repo,
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    timeout: 4000,
  });
  if (!r.stdout) return null;

  let res;
  try {
    res = JSON.parse(r.stdout);
  } catch {
    return null;
  }
  if (
    res.inert ||
    res.ok ||
    !Array.isArray(res.findings) ||
    !res.findings.length
  ) {
    return null;
  }

  const lines = res.findings.slice(0, 6).map((f) => `  - ${f.msg}`);
  return [
    "ADVISORY — CI job budget (this is not a block; the edit stands).",
    "",
    `A workflow edit leaves ${res.findings.length} PR-reachable job(s) unaccounted for:`,
    ...lines,
    "",
    `Current PR footprint: ${res.pr_reachable_jobs} job(s), demand ${res.pr_demand_with_fanout} including matrix fan-out.`,
    "",
    "Declare each in scripts/ci/job-budget.d/_meta.json with a disposition",
    "(required | relevance_gated | budgeted+dated rationale). Adding a job is fine;",
    "adding one silently is what this catches. scripts/ci/job-budget-audit.mjs is the",
    "authority and runs in CI — this hook only surfaces it at edit time.",
  ].join("\n");
}
