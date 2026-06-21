#!/usr/bin/env node
// validate.mjs — the design-gate selftest. Run bare (`node validate.mjs`) by the
// framework harness (`validate.mjs --all`). Two proofs:
//   1. COVERAGE + DISCRIMINATION — every registered rule has a RED snippet it must flag
//      and a GREEN snippet it must stay silent on. A rule with no fixture FAILS the
//      selftest, so the registry can't grow uncovered.
//   2. INTEGRATION — the on-disk red fixtures FAIL (blocking findings) and the green
//      fixtures PASS (zero findings), exercising gate.mjs end-to-end.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scanText } from "./gate.mjs";
import { RULES } from "./rules/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ext = { css: "snippet.css", html: "snippet.html", jsx: "snippet.jsx" };

// Per-rule fixtures. red MUST produce ≥1 finding for the rule; green MUST produce none.
// register is threaded through for register-specific rules.
const FIXTURES = {
  "gradient-text": {
    red: { type: "css", css: ".h{background-clip:text;-webkit-text-fill-color:transparent;background:linear-gradient(90deg,#f00,#00f)}" },
    green: { type: "css", css: ".h{color:var(--fg)}" },
  },
  "gradient-domination": {
    red: { type: "css", css: ".x{background:linear-gradient(90deg,#6d28d9,#2563eb)}" },
    green: { type: "css", css: ".x{background:linear-gradient(90deg,#16a34a,#f59e0b)}" },
  },
  "one-hue-palette": {
    red: { type: "css", css: ":root{--a:#1e3a8a;--b:#2563eb;--c:#3b82f6;--d:#60a5fa}" },
    green: { type: "css", css: ":root{--a:#2563eb;--b:#16a34a;--c:#dc2626;--d:#f59e0b}" },
  },
  "beige-brown-monotone": {
    red: { type: "css", css: ":root{--a:#d2b48c;--b:#c19a6b;--c:#a0826d}" },
    green: { type: "css", css: ":root{--a:#2563eb;--b:#16a34a;--c:#dc2626;--d:#f59e0b}" },
  },
  "untokenized-color": {
    red: { type: "css", css: ".btn{color:#bada55}" },
    green: { type: "css", css: ".btn{color:var(--fg)}" },
  },
  "contrast-aa": {
    red: { type: "css", css: ".x{color:#999;background:#888}" },
    green: { type: "css", css: ".x{color:#000;background:#fff}" },
  },
  "color-only-status": {
    red: { type: "html", css: '<span class="status success"></span>' },
    green: { type: "html", css: '<span class="status success">Active</span>' },
  },
  "body-text-min-size": {
    red: { type: "css", css: "body{font-size:14px}" },
    green: { type: "css", css: "body{font-size:16px}" },
  },
  "viewport-font-scaling": {
    red: { type: "css", css: "h1{font-size:5vw}" },
    green: { type: "css", css: "h1{font-size:2rem}" },
  },
  "motion-properties": {
    red: { type: "css", css: ".x{transition:width 0.3s ease}" },
    green: { type: "css", css: ".x{transition:opacity 0.3s ease,transform 0.3s ease}" },
  },
  "reduced-motion-required": {
    red: { type: "css", css: ".x{transition:opacity 0.3s}" },
    green: { type: "css", css: ".x{transition:opacity 0.3s}@media (prefers-reduced-motion:reduce){.x{transition:none}}" },
  },
  "radius-marketing-zero": {
    red: { type: "css", css: ".card{border-radius:12px}", register: "marketing" },
    green: { type: "css", css: ".card{border-radius:0}", register: "marketing" },
  },
  "radius-operational-max": {
    red: { type: "css", css: ".card{border-radius:16px}", register: "operational" },
    green: { type: "css", css: ".card{border-radius:8px}", register: "operational" },
  },
  "pill-everything": {
    red: { type: "css", css: ".btn{border-radius:9999px}.button{border-radius:9999px}" },
    green: { type: "css", css: ".btn{border-radius:6px}" },
  },
  "nested-card": {
    red: { type: "html", css: '<div class="card"><div class="card">x</div></div>' },
    green: { type: "html", css: '<div class="card">x</div><div class="card">y</div>' },
  },
  "side-stripe-card": {
    red: { type: "css", css: ".card{border-left:4px solid #f00}" },
    green: { type: "css", css: ".card{border:1px solid var(--line)}" },
  },
  "off-8px-grid": {
    red: { type: "css", css: ".x{padding:5px}" },
    green: { type: "css", css: ".x{padding:8px}" },
  },
  "glassmorphism-default": {
    red: { type: "css", css: ".x{backdrop-filter:blur(10px)}" },
    green: { type: "css", css: ".x{background:var(--bg)}" },
  },
  "decorative-orbs": {
    red: { type: "css", css: ".orb{border-radius:50%;filter:blur(40px);position:absolute}" },
    green: { type: "css", css: ".panel{border-radius:8px}" },
  },
  "gradient-hero": {
    red: { type: "css", css: ".hero{background:linear-gradient(90deg,#16a34a,#f59e0b)}" },
    green: { type: "css", css: ".hero{background:var(--img)}" },
  },
  "untokenized-shadow": {
    red: { type: "css", css: ".x{box-shadow:0 2px 4px #0003}" },
    green: { type: "css", css: ".x{box-shadow:var(--shadow)}" },
  },
  "focus-removed": {
    red: { type: "css", css: "button:focus{outline:none}" },
    green: { type: "css", css: "button:focus{outline:none}button:focus-visible{outline:2px solid var(--ring)}" },
  },
  "touch-target-min": {
    red: { type: "css", css: ".btn{height:18px}" },
    green: { type: "css", css: ".btn{height:40px}" },
  },
  "icon-only-needs-label": {
    red: { type: "html", css: "<button><svg></svg></button>" },
    green: { type: "html", css: '<button aria-label="Close"><svg></svg></button>' },
  },
};

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

function idsFor(snippet) {
  const { findings } = scanText(ext[snippet.type], snippet.css, { register: snippet.register || null });
  return new Set(findings.map((f) => f.rule));
}

// 1. Coverage + discrimination, rule by rule.
for (const rule of RULES) {
  const fx = FIXTURES[rule.id];
  if (!ok(`${rule.id}: has a fixture`, !!fx)) continue;
  const redIds = idsFor(fx.red);
  const greenIds = idsFor(fx.green);
  ok(`${rule.id}: RED fires`, redIds.has(rule.id), `red flagged [${[...redIds].join(",")}]`);
  ok(`${rule.id}: GREEN silent`, !greenIds.has(rule.id), `green flagged [${[...greenIds].join(",")}]`);
}

// Guard against orphan fixtures (a fixture for a rule that no longer exists).
const ruleIds = new Set(RULES.map((r) => r.id));
for (const id of Object.keys(FIXTURES)) ok(`fixture '${id}' maps to a real rule`, ruleIds.has(id));

// 2. Integration against the on-disk fixtures.
const read = (rel) => readFileSync(join(__dirname, rel), "utf8");
const blockingCount = (file, content, register) =>
  scanText(file, content, { register }).findings.filter((f) => f.severity === "blocking").length;

ok("integration: green/clean.css has 0 findings",
  scanText("fixtures/green/clean.css", read("fixtures/green/clean.css")).findings.length === 0,
  `${scanText("fixtures/green/clean.css", read("fixtures/green/clean.css")).findings.map((f) => f.rule).join(",")}`);
ok("integration: green/clean.html has 0 findings",
  scanText("fixtures/green/clean.html", read("fixtures/green/clean.html")).findings.length === 0,
  `${scanText("fixtures/green/clean.html", read("fixtures/green/clean.html")).findings.map((f) => f.rule).join(",")}`);
ok("integration: red/kitchen-sink.css FAILS (blocking)", blockingCount("fixtures/red/kitchen-sink.css", read("fixtures/red/kitchen-sink.css"), null) > 0);
ok("integration: red/kitchen-sink.html FAILS (blocking)", blockingCount("fixtures/red/kitchen-sink.html", read("fixtures/red/kitchen-sink.html"), null) > 0);

// Report (mirrors the other primitive selftests).
const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
}
console.log(`design-gate: ${checks.length - failed.length}/${checks.length} selftest checks passed (${RULES.length} rules)`);
process.exit(failed.length ? 1 : 0);
