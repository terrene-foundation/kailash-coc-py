#!/usr/bin/env node
/**
 * job-budget-audit — census PR-reachable CI jobs and check them against the
 * declaration at scripts/ci/job-budget.d/_meta.json.
 *
 * The problem it exists for: CI jobs accrete one unremarkable job at a time, and
 * nothing says anything at the moment each is added. This makes adding a job a
 * DECLARED ACT. It is a METER, not a cure — it names the footprint, it does not
 * shrink it. The spend axis (re-push waste, PR consolidation) belongs to
 * rules/ci-cost-discipline.md and is deliberately NOT duplicated here.
 *
 * Adapted from the artifact set proposed at loom#1877 (originating repo
 * kailash-rs). The pool/capacity half of that design is deliberately NOT adopted
 * — see job-budget.d/_meta.json $comment for why a capacity ceiling would be a
 * number with no referent on GitHub-hosted runners.
 *
 * Modes:
 *   (default)      audit this repo; exit 1 on any finding
 *   --selftest     drive the resolver over fixture cases; exit 1 if any case
 *                  reaches the wrong verdict. Prints its own case count so no
 *                  prose anywhere has to restate a number that would go stale.
 *   --json         machine-readable audit result
 *
 * YAML is parsed through a python3 + PyYAML probe rather than a hand-rolled
 * reader, matching the strict-YAML probe precedent in .claude/bin/emit.mjs. A
 * missing interpreter is reported as an ENV GAP and exits non-zero — never as a
 * pass, because "the parser was absent" and "no findings" must not look alike.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const REPO = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const WF_DIR = path.join(REPO, ".github", "workflows");
const DECL = path.join(REPO, "scripts", "ci", "job-budget.d", "_meta.json");

const VALID_DISPOSITIONS = new Set(["required", "relevance_gated", "budgeted"]);

// ---------------------------------------------------------------- YAML probe

const PROBE_PY = [
  "import sys, json, yaml",
  "try:",
  "    fh = open(sys.argv[1])",
  "except OSError as e:",
  "    sys.stderr.write('UNREADABLE: ' + str(e)); sys.exit(3)",
  "try:",
  "    sys.stdout.write(json.dumps(yaml.safe_load(fh)))",
  "except yaml.YAMLError as e:",
  "    sys.stderr.write('YAMLERROR: ' + str(e)); sys.exit(1)",
  "finally:",
  "    fh.close()",
].join("\n");

function parseYaml(file) {
  const r = spawnSync("python3", ["-c", PROBE_PY, file], { encoding: "utf8" });
  if (r.error && r.error.code === "ENOENT") {
    return { envGap: "python3 not found" };
  }
  if (r.status === 3) return { unreadable: r.stderr };
  if (r.status !== 0) {
    if (/ModuleNotFoundError/.test(r.stderr || "")) {
      return { envGap: "PyYAML not installed" };
    }
    return { parseError: r.stderr };
  }
  try {
    return { doc: JSON.parse(r.stdout) };
  } catch (e) {
    return { parseError: String(e) };
  }
}

// ---------------------------------------------------------------- the census

/**
 * A job is PR-reachable when its workflow's trigger set includes pull_request.
 * `on:` is the YAML 1.1 boolean-ish key: safe_load turns a bare `on:` into
 * True, so both spellings are checked. Reading only the string key would make
 * every workflow look un-triggered — a silent all-clear.
 */
export function triggersOf(doc) {
  if (!doc || typeof doc !== "object") return [];
  const on = Object.prototype.hasOwnProperty.call(doc, "on")
    ? doc.on
    : doc[true];
  if (!on) return [];
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (typeof on === "object") return Object.keys(on);
  return [];
}

/** Trigger-level paths / paths-ignore filter on the pull_request arm. */
export function hasTriggerPathFilter(doc) {
  const on = Object.prototype.hasOwnProperty.call(doc, "on")
    ? doc.on
    : doc[true];
  if (!on || typeof on !== "object" || Array.isArray(on)) return false;
  const pr = on.pull_request;
  if (!pr || typeof pr !== "object") return false;
  return Boolean(pr.paths || pr["paths-ignore"]);
}

/**
 * Matrix fan-out: the product of every list-valued matrix dimension.
 *
 * Returns 0 for an UNKNOWABLE fan-out, which the caller turns into a finding.
 * The case that matters is `matrix: ${{ fromJSON(...) }}` — a string, not a
 * mapping. Counting that as 1 would silently under-report demand for exactly
 * the jobs most likely to fan out widely, which is the quiet-under-count this
 * census exists to prevent. It is marked non-finite and fails closed through
 * the guard at the bottom rather than being special-cased, so the guard is on
 * a live path: delete it and the unknown-fan-out case stops being detected.
 */
export function fanoutOf(job) {
  const mtx = job && job.strategy && job.strategy.matrix;
  if (mtx === undefined || mtx === null) return 1;
  let n = 1;
  if (typeof mtx !== "object" || Array.isArray(mtx)) {
    n = NaN; // expression string, or any shape whose dimensions cannot be read
  } else {
    for (const [k, v] of Object.entries(mtx)) {
      if (k === "include" || k === "exclude") continue;
      if (Array.isArray(v)) n *= v.length || 1;
    }
  }
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function censusFromDocs(docs) {
  const jobs = [];
  for (const { name, doc } of docs) {
    const trig = triggersOf(doc);
    if (!trig.includes("pull_request")) continue;
    const pathFiltered = hasTriggerPathFilter(doc);
    const jobMap = (doc && doc.jobs) || {};
    for (const [jobName, job] of Object.entries(jobMap)) {
      if (!job || typeof job !== "object") continue;
      jobs.push({
        workflow: name,
        job: jobName,
        has_if: Boolean(job.if),
        path_filtered: pathFiltered,
        fanout: fanoutOf(job),
        runs_on: job["runs-on"] ?? null,
      });
    }
  }
  return jobs;
}

// ------------------------------------------------------------ the resolution

/**
 * The single decision function. Both the live audit and --selftest drive THIS,
 * so a selftest green is evidence about the code the audit actually runs rather
 * than about a parallel copy of the logic.
 */
export function resolveJob(observed, decl) {
  const key = `${observed.workflow}::${observed.job}`;
  const declared = (decl.jobs || []).find(
    (d) => d.workflow === observed.workflow && d.job === observed.job,
  );

  if (observed.fanout === 0) {
    return { key, ok: false, code: "BAD_FANOUT",
      msg: `${key}: matrix fan-out did not resolve to a finite positive number` };
  }
  if (!declared) {
    return { key, ok: false, code: "UNDECLARED",
      msg: `${key}: PR-reachable job is not declared in job-budget.d/_meta.json` };
  }
  if (!VALID_DISPOSITIONS.has(declared.disposition)) {
    return { key, ok: false, code: "BAD_DISPOSITION",
      msg: `${key}: unknown disposition "${declared.disposition}"` };
  }

  if (declared.disposition === "required") {
    const req = decl.required_contexts || [];
    if (!req.includes(observed.job)) {
      return { key, ok: false, code: "NOT_REQUIRED",
        msg: `${key}: declared "required" but is not in required_contexts` };
    }
  }
  if (declared.disposition === "relevance_gated") {
    if (!observed.has_if && !observed.path_filtered) {
      return { key, ok: false, code: "NOT_GATED",
        msg: `${key}: declared "relevance_gated" but carries no job-level if: and no trigger paths filter` };
    }
  }
  if (declared.disposition === "budgeted") {
    const ex = (decl.budgeted_exemptions || []).find(
      (e) => e.workflow === observed.workflow && e.job === observed.job,
    );
    // A budgeted entry without a DATED rationale is how "budgeted" degrades
    // into a silent catch-all, so it is rejected rather than accepted.
    if (!ex || !ex.rationale || !/^\d{4}-\d{2}-\d{2}$/.test(String(ex.dated || ""))) {
      return { key, ok: false, code: "UNJUSTIFIED_BUDGET",
        msg: `${key}: declared "budgeted" without a dated rationale in budgeted_exemptions` };
    }
  }
  return { key, ok: true, code: declared.disposition, msg: `${key}: ${declared.disposition}` };
}

/** Declared jobs that no longer exist — the declaration rotting the other way. */
export function findStale(observed, decl) {
  const live = new Set(observed.map((o) => `${o.workflow}::${o.job}`));
  return (decl.jobs || [])
    .filter((d) => !live.has(`${d.workflow}::${d.job}`))
    .map((d) => ({ key: `${d.workflow}::${d.job}`, ok: false, code: "STALE",
      msg: `${d.workflow}::${d.job}: declared but no such PR-reachable job exists` }));
}

// ------------------------------------------------------------------ selftest

const CASES = [
  // --- accepting: each MUST resolve ok -----------------------------------
  { name: "required job present in required_contexts", accept: true,
    obs: { workflow: "v.yml", job: "validate", has_if: false, path_filtered: false, fanout: 1 },
    decl: { required_contexts: ["validate"], jobs: [{ workflow: "v.yml", job: "validate", disposition: "required" }] } },
  { name: "relevance_gated via job-level if", accept: true,
    obs: { workflow: "d.yml", job: "build", has_if: true, path_filtered: false, fanout: 1 },
    decl: { jobs: [{ workflow: "d.yml", job: "build", disposition: "relevance_gated" }] } },
  { name: "relevance_gated via trigger paths filter", accept: true,
    obs: { workflow: "d.yml", job: "build", has_if: false, path_filtered: true, fanout: 1 },
    decl: { jobs: [{ workflow: "d.yml", job: "build", disposition: "relevance_gated" }] } },
  { name: "budgeted with a dated rationale", accept: true,
    obs: { workflow: "x.yml", job: "extra", has_if: false, path_filtered: false, fanout: 4 },
    decl: { jobs: [{ workflow: "x.yml", job: "extra", disposition: "budgeted" }],
            budgeted_exemptions: [{ workflow: "x.yml", job: "extra", dated: "2026-08-21", rationale: "why" }] } },

  // --- negative controls: each MUST be caught ----------------------------
  { name: "undeclared PR-reachable job", accept: false, code: "UNDECLARED",
    obs: { workflow: "new.yml", job: "freeloader", has_if: false, path_filtered: false, fanout: 1 },
    decl: { jobs: [] } },
  { name: "relevance_gated claim with no gate at all", accept: false, code: "NOT_GATED",
    obs: { workflow: "d.yml", job: "build", has_if: false, path_filtered: false, fanout: 1 },
    decl: { jobs: [{ workflow: "d.yml", job: "build", disposition: "relevance_gated" }] } },
  { name: "required claim absent from required_contexts", accept: false, code: "NOT_REQUIRED",
    obs: { workflow: "v.yml", job: "validate", has_if: false, path_filtered: false, fanout: 1 },
    decl: { required_contexts: [], jobs: [{ workflow: "v.yml", job: "validate", disposition: "required" }] } },
  { name: "budgeted with no exemption row", accept: false, code: "UNJUSTIFIED_BUDGET",
    obs: { workflow: "x.yml", job: "extra", has_if: false, path_filtered: false, fanout: 1 },
    decl: { jobs: [{ workflow: "x.yml", job: "extra", disposition: "budgeted" }], budgeted_exemptions: [] } },
  { name: "budgeted with an undated rationale", accept: false, code: "UNJUSTIFIED_BUDGET",
    obs: { workflow: "x.yml", job: "extra", has_if: false, path_filtered: false, fanout: 1 },
    decl: { jobs: [{ workflow: "x.yml", job: "extra", disposition: "budgeted" }],
            budgeted_exemptions: [{ workflow: "x.yml", job: "extra", rationale: "someday" }] } },
  { name: "unknown disposition string", accept: false, code: "BAD_DISPOSITION",
    obs: { workflow: "x.yml", job: "extra", has_if: true, path_filtered: false, fanout: 1 },
    decl: { jobs: [{ workflow: "x.yml", job: "extra", disposition: "probably-fine" }] } },
  { name: "non-finite matrix fan-out fails closed", accept: false, code: "BAD_FANOUT",
    obs: { workflow: "x.yml", job: "extra", has_if: true, path_filtered: false, fanout: 0 },
    decl: { jobs: [{ workflow: "x.yml", job: "extra", disposition: "relevance_gated" }] } },
];

// Parser-level cases: the `on:`-is-boolean-true trap and fan-out arithmetic.
const PARSE_CASES = [
  { name: "on: as a plain string", fn: () => triggersOf({ on: "pull_request" }).includes("pull_request") },
  { name: "on: as a list", fn: () => triggersOf({ on: ["push", "pull_request"] }).includes("pull_request") },
  { name: "on: as a mapping", fn: () => triggersOf({ on: { pull_request: null } }).includes("pull_request") },
  { name: "on: parsed as YAML-1.1 boolean true", fn: () => triggersOf({ true: { pull_request: null } }).includes("pull_request") },
  { name: "push-only workflow is not PR-reachable", fn: () => !triggersOf({ on: { push: null } }).includes("pull_request") },
  { name: "fan-out multiplies list dimensions", fn: () => fanoutOf({ strategy: { matrix: { os: [1, 2, 3], v: [1, 2] } } }) === 6 },
  { name: "fan-out ignores include/exclude keys", fn: () => fanoutOf({ strategy: { matrix: { os: [1, 2], include: [{}, {}, {}] } } }) === 2 },
  { name: "no matrix means fan-out of one", fn: () => fanoutOf({}) === 1 },
  // Reaches the fail-closed guard. Without this case the guard is unreachable
  // and deleting it survives the sweep — which is how it was found.
  { name: "expression matrix is UNKNOWN, not one", fn: () => fanoutOf({ strategy: { matrix: "${{ fromJSON(needs.x.outputs.m) }}" } }) === 0 },
  { name: "list-shaped matrix is UNKNOWN, not one", fn: () => fanoutOf({ strategy: { matrix: [1, 2] } }) === 0 },
  { name: "census skips a push-only workflow", fn: () => censusFromDocs([{ name: "p.yml", doc: { on: { push: null }, jobs: { a: {} } } }]).length === 0 },
  { name: "census finds a PR job", fn: () => censusFromDocs([{ name: "p.yml", doc: { on: { pull_request: null }, jobs: { a: {} } } }]).length === 1 },
];

function selftest() {
  let pass = 0, fail = 0;
  for (const c of CASES) {
    const r = resolveJob(c.obs, c.decl);
    const ok = c.accept ? r.ok : !r.ok && (!c.code || r.code === c.code);
    if (ok) pass++;
    else { fail++; console.error(`  FAIL [resolve] ${c.name} -> ok=${r.ok} code=${r.code}`); }
  }
  for (const c of PARSE_CASES) {
    let ok = false;
    try { ok = c.fn() === true; } catch (e) { ok = false; }
    if (ok) pass++;
    else { fail++; console.error(`  FAIL [parse] ${c.name}`); }
  }
  const neg = CASES.filter((c) => !c.accept).length;
  const acc = CASES.filter((c) => c.accept).length + PARSE_CASES.length;
  // The count is PRINTED, never restated in prose — every prior revision of this
  // kind of artifact that pinned a number in a rule went stale within a commit.
  console.log(`job-budget-audit --selftest: ${fail === 0 ? "OK" : "FAILED"} — ${pass + fail} cases (${neg} negative controls + ${acc} accepting)`);
  return fail === 0 ? 0 : 1;
}

// --------------------------------------------------------------------- audit

function audit(asJson) {
  if (!existsSync(DECL)) {
    // Loud, never silent. A consumer that copied this workflow without the
    // declaration must be TOLD the gate is inert here rather than handed a
    // green that reads as "no findings" (security.md secure-default contract).
    const msg =
      "job-budget-audit: NO DECLARATION at scripts/ci/job-budget.d/_meta.json — " +
      "this gate is INERT in this repo and has checked NOTHING. That is not a pass. " +
      "Add the declaration to arm it.";
    if (asJson) console.log(JSON.stringify({ ok: true, inert: true, reason: "no-declaration" }));
    else console.log(msg);
    return 0;
  }
  if (!existsSync(WF_DIR)) {
    console.error("job-budget-audit: no .github/workflows directory — failing rather than reporting a vacuous pass.");
    return 1;
  }

  let decl;
  try { decl = JSON.parse(readFileSync(DECL, "utf8")); }
  catch (e) { console.error(`job-budget-audit: declaration is unparseable: ${e}`); return 1; }

  const docs = [];
  for (const f of readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const res = parseYaml(path.join(WF_DIR, f));
    if (res.envGap) {
      console.error(`job-budget-audit: ENV GAP — ${res.envGap}. The census did not run; ` +
        `this is UNMEASURED, not clean.`);
      return 1;
    }
    if (res.unreadable || res.parseError) {
      console.error(`job-budget-audit: ${f} could not be parsed: ${res.unreadable || res.parseError}`);
      return 1;
    }
    docs.push({ name: f, doc: res.doc });
  }

  const observed = censusFromDocs(docs);
  const results = observed.map((o) => resolveJob(o, decl)).concat(findStale(observed, decl));
  const findings = results.filter((r) => !r.ok);
  const demand = observed.reduce((a, o) => a + (o.fanout || 0), 0);

  if (asJson) {
    console.log(JSON.stringify({
      ok: findings.length === 0, inert: false,
      pr_reachable_jobs: observed.length, pr_demand_with_fanout: demand,
      by_disposition: results.filter((r) => r.ok).reduce((m, r) => ((m[r.code] = (m[r.code] || 0) + 1), m), {}),
      findings,
    }, null, 1));
    return findings.length === 0 ? 0 : 1;
  }

  console.log(`PR-reachable jobs: ${observed.length} (demand incl. matrix fan-out: ${demand})`);
  for (const r of results.filter((x) => x.ok)) console.log(`  ok       ${r.msg}`);
  for (const r of findings) console.log(`  FINDING  ${r.msg}`);
  if (findings.length) {
    console.log("");
    console.log(`${findings.length} finding(s). Every PR-reachable job must be declared in`);
    console.log("scripts/ci/job-budget.d/_meta.json with a disposition. Adding a CI job is");
    console.log("legitimate — the contract is that it becomes a DECLARED act, not a silent one.");
    return 1;
  }
  console.log("VALID — every PR-reachable job is declared and its disposition holds.");
  return 0;
}

// ---------------------------------------------------------------------- main

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) process.exit(selftest());
  else process.exit(audit(args.includes("--json")));
}
