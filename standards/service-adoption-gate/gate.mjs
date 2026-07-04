#!/usr/bin/env node
// gate.mjs — deterministic service-adoption scanner. It catches unsafe self-host defaults before
// a third-party service or container bundle becomes instance runtime.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const SCANNABLE_EXT = new Set([".yml", ".yaml", ".env", ".example", ".js", ".jsx", ".ts", ".tsx", ".py", ".sh"]);
const SCANNABLE_NAMES = new Set(["Dockerfile", "dockerfile", ".env", ".env.example", "compose.yaml", "compose.yml"]);

function finding(rule, message, line, evidence) {
  return { rule, message, line, evidence };
}

function stripQuote(value) {
  return String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

export function imageUsesFloatingLatest(value) {
  const raw = stripQuote(value).split(/\s+#/)[0].trim();
  if (!raw) return false;
  if (/\$\{[^}]+:-latest\}/i.test(raw)) return true;
  if (raw.includes("@sha256:")) return false;
  const image = raw.replace(/^\$\{|\}$/g, "");
  const last = image.split("/").pop() || image;
  if (/:latest$/i.test(last)) return true;
  return !last.includes(":");
}

export function weakSecretValue(value) {
  const raw = stripQuote(value).trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (/\$\{[^}]+:-[^}]+\}/.test(raw)) return true;
  return [
    "admin",
    "password",
    "pass",
    "secret",
    "changeme",
    "change-me",
    "change_me",
    "test",
    "dev",
    "123456",
    "dify-sandbox",
    "mx-session",
  ].includes(lower);
}

export function scanText(text, options = {}) {
  const src = String(text ?? "");
  const out = [];
  const lines = src.split(/\r?\n/);
  const filePath = options.filePath || "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const image = /^\s*image\s*:\s*['"]?([^'"#\n]+)['"]?/i.exec(line);
    if (image && imageUsesFloatingLatest(image[1])) {
      out.push(finding("docker-floating-latest", "Docker image is unpinned or uses latest", i + 1, line.trim()));
    }
    if (/\/(?:var\/run|run)\/docker\.sock\b/.test(line)) {
      out.push(finding("docker-socket-mount", "Host Docker socket is mounted", i + 1, line.trim()));
    }
    if (/^\s*privileged\s*:\s*true\b/i.test(line)) {
      out.push(finding("docker-privileged", "Container runs privileged", i + 1, line.trim()));
    }
    if (/\bSYS_ADMIN\b/.test(line)) {
      out.push(finding("docker-sys-admin", "Container requests SYS_ADMIN capability", i + 1, line.trim()));
    }
    if (/seccomp\s*=\s*unconfined|seccomp\s*:\s*unconfined/i.test(line)) {
      out.push(finding("docker-seccomp-unconfined", "Container disables the default seccomp profile", i + 1, line.trim()));
    }
    if (/--no-sandbox\b/.test(line)) {
      out.push(finding("browser-no-sandbox", "Browser automation disables the sandbox", i + 1, line.trim()));
    }

    const secret = /^\s*-?\s*([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*[:=]\s*['"]?([^'"#\n]*)['"]?/i.exec(line);
    if (secret && weakSecretValue(secret[2])) {
      out.push(finding("default-secret", "Secret-like setting has a weak or fixed default", i + 1, line.trim()));
    }
  }

  out.push(...scanCookieCalls(lines, filePath));
  return out;
}

function scanCookieCalls(lines, filePath) {
  const out = [];
  const cookieCall = /\b(res\.cookie|cookies\.set|set_cookie|setCookie|response\.set_cookie)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    if (!cookieCall.test(lines[i])) continue;
    const window = lines.slice(i, Math.min(lines.length, i + 7)).join("\n");
    const hasSecure = /secure\s*[:=]\s*true/i.test(window);
    const hasSameSite = /sameSite\s*[:=]\s*["']?(lax|strict|none)\b/i.test(window) ||
      /samesite\s*=\s*["']?(lax|strict|none)\b/i.test(window);
    if (!hasSecure || !hasSameSite) {
      out.push(finding(
        "unsafe-cookie-defaults",
        "Cookie-setting call is missing explicit secure and sameSite attributes",
        i + 1,
        `${basename(filePath || "source")}: ${lines[i].trim()}`,
      ));
    }
  }
  return out;
}

function shouldScan(path) {
  const name = basename(path);
  const ext = extname(path);
  return SCANNABLE_NAMES.has(name) || SCANNABLE_EXT.has(ext) || name.includes(".env.");
}

export function scanPath(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) return [{ path: abs, findings: [finding("missing-path", "Path does not exist", 0, abs)] }];
  const st = statSync(abs);
  if (st.isDirectory()) {
    return readdirSync(abs, { withFileTypes: true })
      .filter((entry) => !["node_modules", ".git", "dist", "build", "coverage", ".next"].includes(entry.name))
      .flatMap((entry) => scanPath(join(abs, entry.name)));
  }
  if (!st.isFile() || !shouldScan(abs)) return [];
  return [{ path: abs, findings: scanText(readFileSync(abs, "utf8"), { filePath: abs }) }];
}

export function summarize(results) {
  return results.flatMap((r) => r.findings.map((f) => ({ path: r.path, ...f })));
}

function main(argv) {
  const json = argv.includes("--json");
  const paths = argv.filter((arg) => arg !== "--json");
  if (!paths.length) {
    console.error("usage: gate.mjs [--json] <path...>");
    return 2;
  }
  const findings = summarize(paths.flatMap((path) => scanPath(path)));
  if (json) {
    console.log(JSON.stringify({ findings }, null, 2));
  } else {
    for (const f of findings) {
      console.log(`${f.path}:${f.line} ${f.rule} ${f.message}${f.evidence ? ` [${f.evidence}]` : ""}`);
    }
  }
  return findings.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
