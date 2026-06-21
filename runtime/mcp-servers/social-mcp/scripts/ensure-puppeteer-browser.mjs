#!/usr/bin/env node
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_BROWSER = "chrome@stable";
const DEFAULT_OMNIBUS_BROWSER_DIR = process.env.SHARED_PUPPETEER_BROWSER_DIR || "/srv/state/puppeteer-browsers";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, "..");

const executableNamesByPlatform = {
  darwin: ["Google Chrome for Testing", "Google Chrome", "Chromium"],
  linux: ["chrome", "google-chrome", "chromium-browser", "chromium"],
  win32: ["chrome.exe"],
};

function parseArgs(argv) {
  const args = {
    browser: DEFAULT_BROWSER,
    browserDir: process.env.APEX_PUPPETEER_BROWSER_DIR || defaultBrowserDir(),
    envFile: "",
    requireExisting: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--path" || arg === "--browser-dir") && next) {
      args.browserDir = next;
      i += 1;
    } else if (arg === "--browser" && next) {
      args.browser = next;
      i += 1;
    } else if (arg === "--env-file" && next) {
      args.envFile = next;
      i += 1;
    } else if (arg === "--require-existing") {
      args.requireExisting = true;
    } else if (arg === "--print-path") {
      // Default behavior; accepted for launcher readability.
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function defaultBrowserDir() {
  if (process.platform === "linux" && fs.existsSync(DEFAULT_OMNIBUS_BROWSER_DIR)) {
    return DEFAULT_OMNIBUS_BROWSER_DIR;
  }
  return path.join(os.homedir(), ".cache", "apex-social-mcp", "puppeteer-browsers");
}

function printHelp() {
  console.log(`Usage: node scripts/ensure-puppeteer-browser.mjs [options]

Options:
  --path <dir>            Browser cache/install directory.
  --browser <specifier>   Browser specifier passed to @puppeteer/browsers.
  --env-file <file>       Upsert APEX_PUPPETEER_BROWSER_DIR and APEX_CHROME_PATH.
  --require-existing      Detect only; do not install.
  --print-path            Print the executable path to stdout. This is the default.
`);
}

function isExecutable(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform === "win32") return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutables(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const executableNames = new Set(executableNamesByPlatform[process.platform] || []);
  const matches = [];

  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (executableNames.has(entry.name) && isExecutable(fullPath)) {
        matches.push(fullPath);
      }
    }
  }

  walk(rootDir, 0);
  return matches.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function browsersBinaryPath() {
  const suffix = process.platform === "win32" ? "browsers.cmd" : "browsers";
  return path.join(PACKAGE_ROOT, "node_modules", ".bin", suffix);
}

function installBrowser(browser, browserDir) {
  fs.mkdirSync(browserDir, { recursive: true });
  const bin = browsersBinaryPath();
  if (!fs.existsSync(bin)) {
    throw new Error(`@puppeteer/browsers binary not found at ${bin}; run npm install first.`);
  }

  const result = spawnSync(bin, ["install", browser, "--path", browserDir], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
    env: { ...process.env, APEX_PUPPETEER_BROWSER_DIR: browserDir },
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Failed to install ${browser}${detail ? `:\n${detail}` : ""}`);
  }
}

function envLine(key, value) {
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`Refusing to write multiline env value for ${key}`);
  }
  return `${key}=${value}`;
}

function upsertEnvFile(filePath, values) {
  const lines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    : [];
  const seen = new Set();
  const updated = lines.map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !(match[1] in values)) return line;
    seen.add(match[1]);
    return envLine(match[1], values[match[1]]);
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) updated.push(envLine(key, value));
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${updated.filter((line, index) => index < updated.length - 1 || line).join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let executable = findExecutables(args.browserDir)[0] || "";

  if (!executable && !args.requireExisting) {
    installBrowser(args.browser, args.browserDir);
    executable = findExecutables(args.browserDir)[0] || "";
  }

  if (!executable) {
    if (args.requireExisting) return;
    throw new Error(`No Chrome executable found under ${args.browserDir}`);
  }

  if (args.envFile) {
    upsertEnvFile(args.envFile, {
      APEX_PUPPETEER_BROWSER_DIR: args.browserDir,
      APEX_CHROME_PATH: executable,
    });
  }

  process.stdout.write(`${executable}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
