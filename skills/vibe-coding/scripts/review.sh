#!/usr/bin/env bash
# Unified code review runner and git merge gate (vibe-coding skill, unified review rules).
# Repository parameters live in <repo>/.review.json (or $REVIEW_CONFIG); this script holds zero repo-specific logic.
#
# Subcommands:
#   precheck [--fix] <id> <base> [head]              freeze snapshots, run precheck, redact/scan diff, shard if >2000 lines
#   start    <id> [head] [focus]                     launch blind dual-model review (Carbon + Argon via agy, 30m timeout)
#   confirm  <id> <slot> <fix-base> [head] [focus]   post-fix single-model confirmation on fix diff + touched files only
#   wait     <id> [seconds]                          wait concurrently; use surviving peer when one side times out
#   verify   <id> [head]                             validate reports (P0=0, P1=0) and stamp verified.sha
#   check-gate <base> [head]                         merge gate check for git hooks and release scripts
#   hook-pre-commit                                  git pre-commit / pre-merge-commit hook handler
#   stop     <id>                                    terminate running review processes for <id>
set -euo pipefail

ROOT=$(cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && pwd -P)
cd "$ROOT"

CONFIG_PATH="${REVIEW_CONFIG:-$ROOT/.review.json}"
AGY="${REVIEW_AGY_BIN:-$(command -v agy 2>/dev/null || echo "$HOME/.local/bin/agy")}"

# Embedded Node helper for config validation, glob matching, redaction, credential guard, diffing, sharding, and gate checks.
run_node_helper() {
  node - "$ROOT" "$CONFIG_PATH" "$@" <<'NODE'
const { execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, join, posix } = require("node:path");

const [root, configPath, action, ...rest] = process.argv.slice(2);

const DEFAULT_TEST_PATHS = [
  "test/**", "tests/**", "**/test/**", "**/tests/**",
  "**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*.*",
];
const DEFAULT_DOC_PATHS = ["**/*.md", "docs/**", "LICENSE*", ".gitignore"];
const DEFAULT_EXCLUDE = [
  "dist/**", "**/node_modules/**", "package-lock.json", "**/package-lock.json",
  "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
];
const GATE_SELF_PATHS = [".review.json", ".githooks/**", "scripts/review.sh"];
const DEFAULT_MODELS = {
  carbon: "gemini-4-carbon-high",
  argon: "gemini-4-argon-high",
};

function fail(msg, code = 1) {
  process.stderr.write(`review.sh: ${msg}\n`);
  process.exit(code);
}

function loadConfig(allowMissing = false) {
  if (!existsSync(configPath)) {
    if (allowMissing) {
      return {
        precheck: "",
        highRisk: [],
        shards: {},
        reviewDir: ".local/reviews",
        issueFile: "docs/issues/INDEX.md",
        redactFiles: [],
        models: { ...DEFAULT_MODELS },
        testPaths: DEFAULT_TEST_PATHS,
        docPaths: DEFAULT_DOC_PATHS,
        exclude: DEFAULT_EXCLUDE,
        mainBranch: "main",
        forbidDirectMainCommit: true,
        commitCheck: "",
      };
    }
    fail(
      `missing review config '${configPath}'. Create .review.json in ${root} (see skills/vibe-coding/scripts/review.config.example.json) with at least {"precheck": "<command>"}.`,
      1,
    );
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (err) {
    fail(`invalid JSON in '${configPath}': ${err.message}`, 1);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`'${configPath}' must contain a JSON object.`, 1);
  }
  if (!allowMissing && (typeof raw.precheck !== "string" || !raw.precheck.trim())) {
    fail(`'${configPath}' must define a non-empty string "precheck" command.`, 1);
  }
  const models = (raw.models && typeof raw.models === "object" && !Array.isArray(raw.models) && Object.keys(raw.models).length > 0)
    ? { ...raw.models }
    : { ...DEFAULT_MODELS };
  if (process.env.REVIEW_CARBON_MODEL && ("carbon" in models)) models.carbon = process.env.REVIEW_CARBON_MODEL;
  if (process.env.REVIEW_ARGON_MODEL && ("argon" in models)) models.argon = process.env.REVIEW_ARGON_MODEL;

  const reviewDir = typeof raw.reviewDir === "string" && raw.reviewDir.trim()
    ? raw.reviewDir.trim().replace(/\/+$/, "")
    : ".local/reviews";

  return {
    precheck: typeof raw.precheck === "string" ? raw.precheck.trim() : "",
    highRisk: Array.isArray(raw.highRisk) ? raw.highRisk.map(String) : [],
    shards: (raw.shards && typeof raw.shards === "object" && !Array.isArray(raw.shards)) ? raw.shards : {},
    reviewDir,
    issueFile: typeof raw.issueFile === "string" && raw.issueFile.trim() ? raw.issueFile.trim() : "docs/issues/INDEX.md",
    redactFiles: Array.isArray(raw.redactFiles) ? raw.redactFiles.map(String) : [],
    models,
    testPaths: Array.isArray(raw.testPaths) ? raw.testPaths.map(String) : DEFAULT_TEST_PATHS,
    docPaths: Array.isArray(raw.docPaths) ? raw.docPaths.map(String) : DEFAULT_DOC_PATHS,
    exclude: Array.isArray(raw.exclude) ? raw.exclude.map(String) : DEFAULT_EXCLUDE,
    mainBranch: typeof raw.mainBranch === "string" && raw.mainBranch.trim() ? raw.mainBranch.trim() : "main",
    forbidDirectMainCommit: raw.forbidDirectMainCommit !== false,
    commitCheck: typeof raw.commitCheck === "string" ? raw.commitCheck.trim() : "",
  };
}

function globToRegExp(pattern) {
  let p = String(pattern).replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "^";
  for (let i = 0; i < p.length; ) {
    if (p.startsWith("/**/", i)) {
      re += "(?:/|/.+/)";
      i += 4;
    } else if (i === 0 && p.startsWith("**/")) {
      re += "(?:.+/)?";
      i += 3;
    } else if (p.startsWith("/**", i) && i + 3 === p.length) {
      re += "(?:/.*)?";
      i += 3;
    } else if (p.startsWith("**", i)) {
      re += ".*";
      i += 2;
    } else if (p[i] === "*") {
      re += "[^/]*";
      i += 1;
    } else if (p[i] === "?") {
      re += "[^/]";
      i += 1;
    } else {
      re += p[i].replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  re += "$";
  return new RegExp(re);
}

function matchesAny(file, patterns) {
  const norm = file.replace(/\\/g, "/").replace(/^\.\//, "");
  return patterns.some((pat) => globToRegExp(pat).test(norm));
}

function excludedPatterns(cfg) {
  const relReview = cfg.reviewDir.replace(/^\.\//, "");
  return [...cfg.exclude, `${relReview}/**`, relReview];
}

function highRiskPatterns(cfg) {
  return [...GATE_SELF_PATHS, ...cfg.highRisk];
}

function gitChangedFiles(base, head, cfg) {
  const out = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, head], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const excl = excludedPatterns(cfg);
  return out.split("\0").filter((f) => f && !matchesAny(f, excl));
}

function redactContent(text) {
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(#|$)/.test(line)) return line;
      const envMatch = line.match(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*)(.+)$/);
      if (envMatch) {
        const rhs = envMatch[2].trim();
        if (!rhs || rhs === "<REDACTED>" || rhs === '""' || rhs === "''") return line;
        return `${envMatch[1]}<REDACTED>`;
      }
      const kvMatch = line.match(/^(\s*["']?[A-Za-z0-9_.-]+["']?\s*:\s*)(.+)$/);
      if (kvMatch) {
        const rhs = kvMatch[2].trim();
        if (!rhs || rhs === "<REDACTED>" || rhs === "{}" || rhs === "[]") return line;
        const trailingComma = rhs.endsWith(",") ? "," : "";
        return `${kvMatch[1]}"<REDACTED>"${trailingComma}`;
      }
      return line;
    })
    .join("\n");
}

function applyRedactionsToTree(treeDir, files, redactGlobs) {
  if (!redactGlobs.length || !existsSync(treeDir)) return;
  for (const rel of files) {
    if (!matchesAny(rel, redactGlobs)) continue;
    const full = join(treeDir, rel);
    if (!existsSync(full)) continue;
    const redacted = redactContent(readFileSync(full, "utf8"));
    writeFileSync(full, redacted, "utf8");
  }
}

const CREDENTIAL_RULES = [
  { name: "sfvt-token", re: /sfvt_(?:dev|prod)_[A-Za-z0-9]{8,}/ },
  { name: "sk-token", re: /\bsk-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "gitlab-token", re: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "private-key-pem", re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  {
    name: "secret-assignment",
    addedOnly: true,
    re: /(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|secret[_-]?key|password)\s*[:=]\s*['"]?(?!<REDACTED>|REDACTED\b|YOUR_|example|placeholder|dummy|fake|\$\{)[A-Za-z0-9/_+.-]{16,}['"]?/i,
  },
];

function scanPatchForCredentials(patchPath) {
  if (!existsSync(patchPath)) return;
  const lines = readFileSync(patchPath, "utf8").split("\n");
  let currentFile = "<patch>";
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.includes("<REDACTED>")) continue;
    const isAdded = line.startsWith("+");
    for (const rule of CREDENTIAL_RULES) {
      if (rule.addedOnly && !isAdded) continue;
      if (rule.re.test(line)) {
        try { unlinkSync(patchPath); } catch {}
        fail(
          `credential guard blocked ${posix.basename(patchPath)} (${currentFile}, patch line ${idx + 1}, rule ${rule.name}); add file to redactFiles in .review.json or remove the secret.`,
          1,
        );
      }
    }
  }
}

function diffSingleFile(base, head, file, absDir, isRedacted) {
  if (isRedacted) {
    const a = existsSync(join(absDir, "before", file)) ? join(absDir, "before", file) : "/dev/null";
    const b = existsSync(join(absDir, "repo", file)) ? join(absDir, "repo", file) : "/dev/null";
    let raw = "";
    try {
      raw = execFileSync("git", ["diff", "--no-index", "--", a, b], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      raw = (e.stdout || "").toString("utf8");
    }
    return raw
      .replaceAll(`a/${ a.replace(/^\/+/, "") }`, `a/${file}`)
      .replaceAll(`b/${ b.replace(/^\/+/, "") }`, `b/${file}`)
      .replace(/^diff --git .*$/m, `diff --git a/${file} b/${file}`);
  }
  return execFileSync("git", ["diff", "--no-renames", base, head, "--", file], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function countPatchLines(patchText) {
  let n = 0;
  for (const line of patchText.split("\n")) {
    if ((line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---"))) {
      n += 1;
    }
  }
  return n;
}

function assignShard(file, shardMap) {
  const entries = Object.entries(shardMap);
  if (entries.length > 0) {
    for (const [name, globs] of entries) {
      if (Array.isArray(globs) && matchesAny(file, globs.map(String))) return name;
    }
    return "other";
  }
  const parts = file.split("/");
  if (parts[0] === "packages" && parts.length >= 3) return parts[1];
  return parts.length > 1 ? parts[0] : "root";
}

if (action === "config-shell") {
  const allowMissing = rest[0] === "--allow-missing";
  const cfg = loadConfig(allowMissing);
  const slotOverride = (process.env.REVIEW_SLOTS || "").trim();
  const slots = slotOverride ? slotOverride.split(/\s+/) : Object.keys(cfg.models);
  const q = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;
  const lines = [
    `CFG_PRECHECK=${q(cfg.precheck)}`,
    `CFG_REVIEW_DIR=${q(cfg.reviewDir)}`,
    `CFG_ISSUE_FILE=${q(cfg.issueFile)}`,
    `CFG_MAIN_BRANCH=${q(cfg.mainBranch)}`,
    `CFG_FORBID_MAIN=${cfg.forbidDirectMainCommit ? "1" : "0"}`,
    `CFG_COMMIT_CHECK=${q(cfg.commitCheck)}`,
    `CFG_SLOTS=(${slots.map(q).join(" ")})`,
  ];
  console.log(lines.join("\n"));
} else if (action === "model-for-slot") {
  const cfg = loadConfig(false);
  const slot = rest[0];
  if (!slot || !(slot in cfg.models)) {
    fail(`unknown model slot '${slot}' (configured slots: ${Object.keys(cfg.models).join(", ")}; no silent fallback).`, 1);
  }
  console.log(cfg.models[slot]);
} else if (action === "check-fix") {
  const [base, head] = rest;
  const cfg = loadConfig(false);
  const files = gitChangedFiles(base, head, cfg);
  const hr = highRiskPatterns(cfg);
  const riskFile = files.find((f) => matchesAny(f, hr));
  if (riskFile) {
    fail(`--fix cannot skip review when high-risk path '${riskFile}' is modified (unified review rule 3).`, 2);
  }
  const hasTest = files.some((f) => matchesAny(f, cfg.testPaths));
  if (!hasTest) {
    fail(`--fix requires regression test changes matching testPaths (${cfg.testPaths.slice(0, 3).join(", ")}, ...) (unified review rule 3).`, 2);
  }
} else if (action === "prepare-pack") {
  const [base, head, absDir] = rest;
  const cfg = loadConfig(false);
  const maxLines = parseInt(process.env.REVIEW_MAX_DIFF_LINES || "2000", 10) || 2000;
  const files = gitChangedFiles(base, head, cfg);
  applyRedactionsToTree(join(absDir, "repo"), files, cfg.redactFiles);
  applyRedactionsToTree(join(absDir, "before"), files, cfg.redactFiles);

  const items = files.map((file) => {
    const isRed = cfg.redactFiles.length > 0 && matchesAny(file, cfg.redactFiles);
    const patch = diffSingleFile(base, head, file, absDir, isRed);
    return { file, patch, lines: countPatchLines(patch), sub: assignShard(file, cfg.shards) };
  });

  writeFileSync(join(absDir, "changed-files.txt"), files.length ? `${files.join("\n")}\n` : "");
  const fullPatch = items.map((x) => x.patch).join("");
  const diffPath = join(absDir, "diff.patch");
  writeFileSync(diffPath, fullPatch);
  scanPatchForCredentials(diffPath);

  const totalLines = items.reduce((s, x) => s + x.lines, 0);
  console.log(`non-excluded diff: ${files.length} file(s), ${totalLines} line(s)`);
  if (totalLines > maxLines && items.length > 0) {
    console.log(`diff > ${maxLines} lines (${totalLines}): splitting into parallel subsystem shards (unified review rule 5)`);
    const shardsDir = join(absDir, "shards");
    mkdirSync(shardsDir, { recursive: true });
    const orderedSubs = [];
    for (const key of Object.keys(cfg.shards)) {
      if (items.some((x) => x.sub === key)) orderedSubs.push(key);
    }
    for (const it of items) {
      if (!orderedSubs.includes(it.sub)) orderedSubs.push(it.sub);
    }
    const shards = [];
    for (const sub of orderedSubs) {
      const group = items.filter((x) => x.sub === sub);
      const groupLines = group.reduce((s, x) => s + x.lines, 0);
      if (groupLines <= maxLines || group.length === 1) {
        shards.push({ name: sub, group, lines: groupLines });
      } else {
        let cur = [];
        let curLines = 0;
        let idx = 1;
        for (const it of group) {
          if (cur.length > 0 && curLines + it.lines > maxLines) {
            shards.push({ name: `${sub}-${idx}`, group: cur, lines: curLines });
            idx += 1;
            cur = [];
            curLines = 0;
          }
          cur.push(it);
          curLines += it.lines;
        }
        if (cur.length > 0) shards.push({ name: `${sub}-${idx}`, group: cur, lines: curLines });
      }
    }
    for (const s of shards) {
      const sPatchPath = join(shardsDir, `${s.name}.patch`);
      writeFileSync(join(shardsDir, `${s.name}.files`), `${s.group.map((x) => x.file).join("\n")}\n`);
      writeFileSync(sPatchPath, s.group.map((x) => x.patch).join(""));
      scanPatchForCredentials(sPatchPath);
      console.log(`shard ${s.name}: ${s.group.length} file(s), ${s.lines} line(s)`);
    }
    writeFileSync(join(absDir, "shards.txt"), `${shards.map((s) => s.name).join("\n")}\n`);
  }
} else if (action === "prepare-confirm") {
  const [fixBase, head, absDir] = rest;
  const cfg = loadConfig(false);
  const files = gitChangedFiles(fixBase, head, cfg);
  const beforeFixDir = join(absDir, "before-fix");
  applyRedactionsToTree(join(absDir, "repo"), files, cfg.redactFiles);
  applyRedactionsToTree(beforeFixDir, files, cfg.redactFiles);
  const patches = files.map((file) => {
    const isRed = cfg.redactFiles.length > 0 && matchesAny(file, cfg.redactFiles);
    if (!isRed) {
      return execFileSync("git", ["diff", "--no-renames", fixBase, head, "--", file], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    }
    const a = existsSync(join(beforeFixDir, file)) ? join(beforeFixDir, file) : "/dev/null";
    const b = existsSync(join(absDir, "repo", file)) ? join(absDir, "repo", file) : "/dev/null";
    let raw = "";
    try {
      raw = execFileSync("git", ["diff", "--no-index", "--", a, b], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      raw = (e.stdout || "").toString("utf8");
    }
    return raw
      .replaceAll(`a/${ a.replace(/^\/+/, "") }`, `a/${file}`)
      .replaceAll(`b/${ b.replace(/^\/+/, "") }`, `b/${file}`)
      .replace(/^diff --git .*$/m, `diff --git a/${file} b/${file}`);
  });
  rmSync(beforeFixDir, { recursive: true, force: true });
  writeFileSync(join(absDir, "touched-files.txt"), files.length ? `${files.join("\n")}\n` : "");
  const fixPatchPath = join(absDir, "fix.patch");
  writeFileSync(fixPatchPath, patches.join(""));
  scanPatchForCredentials(fixPatchPath);
} else if (action === "scan-credentials") {
  for (const p of rest) scanPatchForCredentials(p);
} else if (action === "check-gate") {
  const [base, head] = rest;
  const cfg = loadConfig(false);
  const targetSha = execFileSync("git", ["rev-parse", "--verify", head], { cwd: root, encoding: "utf8" }).trim();
  const files = gitChangedFiles(base, targetSha, cfg);
  if (files.length === 0) process.exit(0);

  const reviewRoot = join(root, cfg.reviewDir);
  const hasVerifiedSha = () => {
    if (!existsSync(reviewRoot)) return false;
    const { readdirSync } = require("node:fs");
    for (const ent of readdirSync(reviewRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const vPath = join(reviewRoot, ent.name, "verified.sha");
      if (existsSync(vPath) && readFileSync(vPath, "utf8").trim() === targetSha) return true;
    }
    return false;
  };

  if (hasVerifiedSha()) process.exit(0);

  const hr = highRiskPatterns(cfg);
  const riskFile = files.find((f) => matchesAny(f, hr));
  if (riskFile) {
    fail(
      `[merge-gate] refusing to merge ${targetSha.slice(0, 7)}: high-risk path '${riskFile}' requires review verified.sha (even for bug fixes or doc/test changes).`,
      1,
    );
  }

  const allDocOrTest = files.every((f) => matchesAny(f, cfg.docPaths) || matchesAny(f, cfg.testPaths));
  if (allDocOrTest) process.exit(0);

  const hasTestChange = files.some((f) => matchesAny(f, cfg.testPaths));
  if (hasTestChange && existsSync(reviewRoot)) {
    const { readdirSync } = require("node:fs");
    for (const ent of readdirSync(reviewRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const d = join(reviewRoot, ent.name);
      const fixPath = join(d, "fix.sha");
      const prePath = join(d, "precheck.sha");
      const logPath = join(d, "precheck.log");
      if (
        existsSync(fixPath) &&
        existsSync(prePath) &&
        existsSync(logPath) &&
        readFileSync(fixPath, "utf8").trim() === targetSha &&
        readFileSync(prePath, "utf8").trim() === targetSha &&
        readFileSync(logPath, "utf8").includes("=== precheck passed ===")
      ) {
        process.exit(0);
      }
    }
  }

  process.stderr.write(
    `[merge-gate] refusing to merge unreviewed commit ${targetSha.slice(0, 7)} into ${cfg.mainBranch}.\n` +
      `  Feature/refactor: run 'scripts/review.sh precheck/start/wait/verify <id> ${cfg.mainBranch} HEAD'.\n` +
      `  Bug fix with repro test (non-high-risk): run 'scripts/review.sh precheck --fix <id> ${cfg.mainBranch} HEAD'.\n`,
  );
  process.exit(1);
} else if (action === "check-staged-main") {
  const cfg = loadConfig(false);
  if (!cfg.forbidDirectMainCommit) process.exit(0);
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { cwd: root, encoding: "utf8" });
  const staged = out.split("\0").filter(Boolean);
  if (staged.length === 0) process.exit(0);
  const hr = highRiskPatterns(cfg);
  const blocked = staged.find((f) => matchesAny(f, hr) || !matchesAny(f, cfg.docPaths));
  if (blocked) {
    process.stderr.write(
      `[pre-commit] refusing direct commit of '${blocked}' on '${cfg.mainBranch}'.\n` +
        `  Switch to a feature or fix branch first: git switch -c feat/<topic>\n`,
    );
    process.exit(1);
  }
} else {
  fail(`unknown internal helper action '${action}'`, 1);
}
NODE
}

load_cfg() {
  local flag=${1:-}
  local shell_vars
  shell_vars=$(run_node_helper config-shell "$flag") || return $?
  eval "$shell_vars"
}

model_for_slot() {
  run_node_helper model-for-slot "$1"
}

peer_for_slot() {
  local target=$1 s
  for s in "${CFG_SLOTS[@]}"; do
    if [[ $s != "$target" ]]; then
      echo "$s"
      return 0
    fi
  done
  echo "none"
}

active_slots() {
  local dir=$1
  if [[ -s $dir/slots.txt ]]; then
    cat "$dir/slots.txt"
  else
    printf '%s\n' "${CFG_SLOTS[@]}"
  fi
}

active_units() {
  local dir=$1
  if [[ -s $dir/shards.txt ]]; then
    cat "$dir/shards.txt"
  else
    echo "default"
  fi
}

unit_key() {
  local unit=$1 slot=$2
  if [[ $unit == "default" ]]; then
    echo "$slot"
  else
    echo "${unit}-${slot}"
  fi
}

key_timed_out() {
  local dir=$1 key=$2
  [[ -f $dir/timeout-$key ]] && return 0
  [[ ! -s $dir/review-$key.md ]] && grep -Eiq 'print_timeout|timed?[[:space:]_-]*out' "$dir/run-$key.err" 2>/dev/null
}

export_copy() {
  local ref=$1 dest=$2
  rm -rf "$dest" || return 1
  mkdir -p "$dest/.git/objects/info" "$dest/.git/refs" || return 1
  git archive "$ref" | tar -x -C "$dest" || return 1
  printf 'ref: refs/heads/detached\n' >"$dest/.git/HEAD"
  printf '[core]\n\trepositoryformatversion = 0\n\tbare = false\n' >"$dest/.git/config"
  printf '%s/objects\n' "$(cd "$(git rev-parse --git-common-dir)" && pwd -P)" >"$dest/.git/objects/info/alternates"
  GIT_INDEX_FILE="$dest/.git/index" git read-tree "$ref" || return 1
  if [[ -d "$ROOT/node_modules" && ! -e "$dest/node_modules" ]]; then
    ln -s "$ROOT/node_modules" "$dest/node_modules"
  fi
}

write_pack_file() {
  local abs_dir=$1 mode=$2 focus=$3
  if [[ -f $abs_dir/pack.md ]] && ! grep -q '^<!-- generated-by: vibe-coding/review.sh -->$' "$abs_dir/pack.md" 2>/dev/null; then
    return 0
  fi
  if [[ $mode == "confirm" ]]; then
    cat >"$abs_dir/pack.md" <<EOF
<!-- generated-by: vibe-coding/review.sh -->
# Post-Fix Confirmation Pack ($(basename "$abs_dir"))

- Frozen head snapshot: \`$abs_dir/repo\` (read-only; do NOT read or modify live \`$ROOT\`).
- Fix diff: \`$abs_dir/fix.patch\`.
- Touched files ONLY: \`$abs_dir/touched-files.txt\`.
- Precheck log: \`$abs_dir/precheck.log\`.
${focus:+- Prior blocking finding(s) to confirm: $focus}

## Rules (Unified Review Rule 7)

1. Confirm ONLY two things: (a) whether the prior blocking findings are fixed, and (b) whether the fix broke adjacent code in the files listed in \`$abs_dir/touched-files.txt\`.
2. Do NOT re-review other files already reviewed in Round 1.
3. Do NOT re-run the full test suite; machine checks already passed in \`precheck.log\`. Only run a minimal reproduction probe if needed for a blocking finding.
4. Blocking (P0/P1) covers ONLY five classes: violates core rules in \`AGENTS.md\`, loses data, leaks credentials, widens permission/sandbox boundary, or causes a reproducible crash/test failure.
5. Non-blocking findings (P2/P3) are logged to \`$CFG_ISSUE_FILE\` without blocking merge.
EOF
  else
    cat >"$abs_dir/pack.md" <<EOF
<!-- generated-by: vibe-coding/review.sh -->
# Blind Review Pack ($(basename "$abs_dir"))

- Frozen head snapshot: \`$abs_dir/repo\` (read-only; do NOT read or modify live \`$ROOT\`).
- Frozen base snapshot: \`$abs_dir/before\`.
- Full diff: \`$abs_dir/diff.patch\`.
- Precheck log: \`$abs_dir/precheck.log\`.
${focus:+- Focus: $focus}

## Rules (Unified Review Rules)

1. Read \`$abs_dir/repo/AGENTS.md\` first if present; its core rules are the yardstick.
2. Machine checks (lint, typecheck, test suite) already passed in \`$abs_dir/precheck.log\`. Do NOT re-run the full test suite; only run a minimal reproduction probe when confirming a blocking finding.
3. Blocking (P0/P1) covers ONLY five classes: violates core principles, loses data, leaks credentials, widens permission/sandbox boundary, or causes a reproducible crash/test failure (attach minimal repro).
4. Everything else is non-blocking (P2/P3, one line each); the author records them in \`$CFG_ISSUE_FILE\` without fixing them in this round.
5. Line 1 of your report MUST be \`可接受\` (when P0=0 and P1=0) or \`不可接受\` (when any P0 or P1 exists). Line 2 MUST be \`COUNTS: P0=<n> P1=<n> P2=<n> P3=<n>\`.
EOF
  fi
}

require_prechecked() {
  local dir=$1 head=$2 expected_sha actual_sha
  [[ -f $dir/precheck.sha ]] || { echo "review.sh: $dir/precheck.sha not found (run precheck first)" >&2; return 1; }
  expected_sha=$(git rev-parse --verify "$head") || { echo "review.sh: unknown revision '$head'" >&2; return 1; }
  actual_sha=$(cat "$dir/precheck.sha")
  [[ $actual_sha == "$expected_sha" ]] || {
    echo "review.sh: precheck.sha ($actual_sha) does not match $head ($expected_sha); re-run precheck" >&2
    return 1
  }
  if [[ ! -f $dir/precheck.log ]] || ! grep -q "=== precheck passed ===" "$dir/precheck.log"; then
    echo "review.sh: $dir/precheck.log missing '=== precheck passed ==='" >&2
    return 1
  fi
}

cmd_precheck() {
  load_cfg || return $?
  local is_fix=0
  if [[ ${1:-} == "--fix" ]]; then
    is_fix=1
    shift
  fi
  local id=${1:?usage: precheck [--fix] <id> <base> [head]}
  local base=${2:?usage: precheck [--fix] <id> <base> [head]}
  local head=${3:-HEAD}
  local base_sha head_sha dir abs_dir log err_file

  base_sha=$(git rev-parse --verify "$base" 2>/dev/null) || { echo "review.sh: unknown base revision '$base'" >&2; return 1; }
  head_sha=$(git rev-parse --verify "$head" 2>/dev/null) || { echo "review.sh: unknown head revision '$head'" >&2; return 1; }

  if (( is_fix )); then
    run_node_helper check-fix "$base_sha" "$head_sha" || return $?
  fi

  dir="$CFG_REVIEW_DIR/$id"
  abs_dir="$ROOT/$dir"
  log="$dir/precheck.log"
  err_file="$dir/precheck.err"

  mkdir -p "$dir"
  rm -rf "$dir/precheck.sha" "$dir/verified.sha" "$dir/fix.sha" "$dir/shards" "$dir/shards.txt" "$dir/slots.txt" "$err_file"

  {
    echo "=== precheck $id ($base_sha..$head_sha, fix=$is_fix) ==="
    git diff --stat "$base_sha" "$head_sha"
  } >"$log" 2>&1

  if ! export_copy "$head_sha" "$abs_dir/repo" >>"$log" 2>&1 || ! export_copy "$base_sha" "$abs_dir/before" >>"$log" 2>&1; then
    cat "$log" >&2
    return 1
  fi

  if ! ( cd "$abs_dir/repo" && bash -eo pipefail -c "$CFG_PRECHECK" ) >>"$log" 2>&1; then
    echo "review.sh: precheck command failed ($CFG_PRECHECK); tail of $log:" >&2
    tail -n 30 "$log" >&2
    return 1
  fi

  if ! run_node_helper prepare-pack "$base_sha" "$head_sha" "$abs_dir" >>"$log" 2>"$err_file"; then
    cat "$err_file" >>"$log"
    cat "$err_file" >&2
    rm -f "$err_file"
    return 1
  fi
  rm -f "$err_file"

  printf '%s\n' "$base_sha" >"$dir/base.sha"
  printf '%s\n' "$head_sha" >"$dir/precheck.sha"
  if (( is_fix )); then
    printf '%s\n' "$head_sha" >"$dir/fix.sha"
  fi
  echo "=== precheck passed ===" >>"$log"
  echo "$log"
}

cmd_start() {
  load_cfg || return $?
  local id=${1:?usage: start <id> [head] [focus]}
  local head=${2:-HEAD}
  local focus=${3:-}
  local dir="$CFG_REVIEW_DIR/$id"
  local abs_dir="$ROOT/$dir"
  local unit slot key peer model timeout_sec diff_target prompt s_patch

  require_prechecked "$dir" "$head" || return $?
  [[ -f $abs_dir/diff.patch ]] || { echo "review.sh: $dir/diff.patch not found (run precheck first)" >&2; return 1; }

  run_node_helper scan-credentials "$abs_dir/diff.patch" || return $?
  if [[ -d $abs_dir/shards ]]; then
    for s_patch in "$abs_dir"/shards/*.patch; do
      [[ -f $s_patch ]] || continue
      run_node_helper scan-credentials "$s_patch" || return $?
    done
  fi

  for slot in "${CFG_SLOTS[@]}"; do
    model_for_slot "$slot" >/dev/null || return $?
  done

  if [[ ${REVIEW_DRY:-0} != "1" && ! -x $AGY ]]; then
    echo "review.sh: agy binary not executable at '$AGY' (set REVIEW_AGY_BIN or install agy; no fallback)" >&2
    return 1
  fi

  write_pack_file "$abs_dir" "full" "$focus"
  rm -f "$dir/verified.sha" "$dir/review.md"
  printf '%s\n' "${CFG_SLOTS[@]}" >"$dir/slots.txt"
  : >"$dir/model.txt"
  timeout_sec=${REVIEW_TIMEOUT:-1800}

  while IFS= read -r unit; do
    for slot in "${CFG_SLOTS[@]}"; do
      key=$(unit_key "$unit" "$slot")
      peer=$(peer_for_slot "$slot")
      model=$(model_for_slot "$slot") || return $?
      printf '%s=%s\n' "$key" "$model" >>"$dir/model.txt"
      rm -f "$dir/review-$key.md" "$dir/notes-$key.md" "$dir/pid-$key" "$dir/timeout-$key" "$dir/run-$key.out" "$dir/run-$key.err"
      if [[ $unit == "default" ]]; then
        diff_target="$abs_dir/diff.patch"
      else
        diff_target="$abs_dir/shards/$unit.patch (subsystem shard '$unit' listed in $abs_dir/shards/$unit.files; use $abs_dir/repo only for read-only cross-file context)"
      fi
      prompt="You are independent blind reviewer [$key] ($model). Read $abs_dir/pack.md and review $diff_target using frozen copies $abs_dir/repo and $abs_dir/before plus $abs_dir/precheck.log. Rules: (1) Do NOT modify live repository files; write only inside $abs_dir. (2) Do NOT re-run the full test suite; precheck already passed — run only minimal reproduction probes for blocking findings. (3) Do NOT read any *$peer* files in $abs_dir (blind review). (4) Write working notes to $abs_dir/notes-$key.md and final report to $abs_dir/review-$key.md. (5) Blocking (P0/P1) covers ONLY five classes: violates core principles, loses data, leaks credentials, widens permission/sandbox boundary, or causes a reproducible crash/test failure (with minimal repro). P2/P3 are non-blocking (logged to $CFG_ISSUE_FILE). Line 1 of $abs_dir/review-$key.md MUST be literally '可接受' (when P0=0 and P1=0) or '不可接受' (when any P0 or P1 exists), and Line 2 MUST be literally 'COUNTS: P0=<n> P1=<n> P2=<n> P3=<n>'."
      local cmd=("$AGY" --model "$model" --dangerously-skip-permissions --disable-slash-commands --print-timeout "${timeout_sec}s" -p "$prompt")
      if [[ ${REVIEW_DRY:-0} == "1" ]]; then
        printf '%q ' "${cmd[@]}"
        echo
        continue
      fi
      nohup "${cmd[@]}" >"$dir/run-$key.out" 2>"$dir/run-$key.err" </dev/null &
      echo $! >"$dir/pid-$key"
    done
  done < <(active_units "$dir")

  cat "$dir/model.txt"
}

cmd_confirm() {
  load_cfg || return $?
  local id=${1:?usage: confirm <id> <slot> <fix-base> [head] [focus]}
  local slot=${2:?usage: confirm <id> <slot> <fix-base> [head] [focus]}
  local fix_base=${3:?usage: confirm <id> <slot> <fix-base> [head] [focus]}
  local head=${4:-HEAD}
  local focus=${5:-}
  local dir="$CFG_REVIEW_DIR/$id"
  local abs_dir="$ROOT/$dir"
  local model fix_base_sha head_sha timeout_sec prompt err_file

  model=$(model_for_slot "$slot") || return $?
  require_prechecked "$dir" "$head" || return $?
  fix_base_sha=$(git rev-parse --verify "$fix_base" 2>/dev/null) || { echo "review.sh: unknown fix-base revision '$fix_base'" >&2; return 1; }
  head_sha=$(git rev-parse --verify "$head")

  if [[ ${REVIEW_DRY:-0} != "1" && ! -x $AGY ]]; then
    echo "review.sh: agy binary not executable at '$AGY' (set REVIEW_AGY_BIN or install agy; no fallback)" >&2
    return 1
  fi

  export_copy "$fix_base_sha" "$abs_dir/before-fix" >/dev/null 2>&1 || return 1
  err_file="$dir/confirm.err"
  if ! run_node_helper prepare-confirm "$fix_base_sha" "$head_sha" "$abs_dir" 2>"$err_file"; then
    cat "$err_file" >&2
    rm -f "$err_file"
    return 1
  fi
  rm -f "$err_file"

  rm -f "$dir/verified.sha" "$dir/review.md" "$dir/shards.txt" "$dir/pid-"* "$dir/review-"*.md "$dir/notes-"*.md "$dir/timeout-"* "$dir/run-"*
  printf '%s\n' "$slot" >"$dir/slots.txt"
  printf '%s=%s\n' "$slot" "$model" >"$dir/model.txt"
  write_pack_file "$abs_dir" "confirm" "$focus"
  timeout_sec=${REVIEW_TIMEOUT:-1800}

  prompt="You are post-fix confirmation reviewer [$slot] ($model) under unified rule 7. Read $abs_dir/pack.md, the fix diff $abs_dir/fix.patch, and ONLY the touched files listed in $abs_dir/touched-files.txt inside $abs_dir/repo (plus $abs_dir/precheck.log). Confirm ONLY two things: (1) whether the prior blocking findings are fixed, and (2) whether the fix broke adjacent code in those touched files. Do NOT re-review other files from Round 1, and do NOT re-run the full test suite. Write working notes to $abs_dir/notes-$slot.md and final report to $abs_dir/review-$slot.md. Line 1 MUST be literally '可接受' (when P0=0 and P1=0) or '不可接受' (when any P0 or P1 remains), and Line 2 MUST be literally 'COUNTS: P0=<n> P1=<n> P2=<n> P3=<n>'."
  local cmd=("$AGY" --model "$model" --dangerously-skip-permissions --disable-slash-commands --print-timeout "${timeout_sec}s" -p "$prompt")
  if [[ ${REVIEW_DRY:-0} == "1" ]]; then
    printf '%q ' "${cmd[@]}"
    echo
    cat "$dir/model.txt"
    return 0
  fi
  nohup "${cmd[@]}" >"$dir/run-$slot.out" 2>"$dir/run-$slot.err" </dev/null &
  echo $! >"$dir/pid-$slot"
  cat "$dir/model.txt"
}

write_combined_summary() {
  local dir=$1 unit slot key line1 m
  {
    echo "# Review Summary ($(basename "$dir"))"
    echo ""
    while IFS= read -r unit; do
      while IFS= read -r slot; do
        key=$(unit_key "$unit" "$slot")
        m=$(model_for_slot "$slot" 2>/dev/null || echo "$slot")
        if [[ -s "$dir/review-$key.md" ]]; then
          line1=$(awk 'NF { print; exit }' "$dir/review-$key.md")
        elif key_timed_out "$dir" "$key"; then
          line1="(timeout — surviving peer report used)"
        else
          line1="(missing)"
        fi
        echo "- **$key** (\`$m\`): $line1 — see \`review-$key.md\`"
      done < <(active_slots "$dir")
    done < <(active_units "$dir")
  } >"$dir/review.md"
}

cmd_wait() {
  load_cfg || return $?
  local id=${1:?usage: wait <id> [seconds]}
  local limit=${2:-${REVIEW_TIMEOUT:-1800}}
  local poll=${REVIEW_POLL_INTERVAL:-2}
  local elapsed=0
  local dir="$CFG_REVIEW_DIR/$id"
  local unit slot key pid alive slot_count u_ok u_timeout failed_total=0 timeout_total=0

  slot_count=$(active_slots "$dir" | wc -l | tr -d ' ')
  while IFS= read -r unit; do
    while IFS= read -r slot; do
      key=$(unit_key "$unit" "$slot")
      [[ -f "$dir/pid-$key" ]] || { echo "review.sh: $dir/pid-$key not found (run start or confirm first)" >&2; return 1; }
    done < <(active_slots "$dir")
  done < <(active_units "$dir")

  while true; do
    alive=0
    while IFS= read -r unit; do
      while IFS= read -r slot; do
        key=$(unit_key "$unit" "$slot")
        pid=$(cat "$dir/pid-$key" 2>/dev/null || true)
        [[ $pid =~ ^[0-9]+$ ]] || { echo "review.sh: invalid pid in $dir/pid-$key" >&2; return 1; }
        if kill -0 "$pid" 2>/dev/null; then
          alive=1
        fi
      done < <(active_slots "$dir")
    done < <(active_units "$dir")
    (( alive == 0 )) && break

    if (( elapsed >= limit )); then
      echo "review.sh: timeout (${limit}s) reached; terminating remaining reviewer(s)" >&2
      while IFS= read -r unit; do
        while IFS= read -r slot; do
          key=$(unit_key "$unit" "$slot")
          pid=$(cat "$dir/pid-$key" 2>/dev/null || true)
          if [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
            printf 'wait_timeout:%ss\n' "$limit" >"$dir/timeout-$key"
          fi
        done < <(active_slots "$dir")
      done < <(active_units "$dir")
      cmd_stop "$id" || true
      break
    fi
    sleep "$poll"
    elapsed=$((elapsed + poll))
  done

  while IFS= read -r unit; do
    u_ok=0
    u_timeout=0
    while IFS= read -r slot; do
      key=$(unit_key "$unit" "$slot")
      if [[ ! -s "$dir/review-$key.md" && -s "$dir/run-$key.out" ]] && ! key_timed_out "$dir" "$key"; then
        cp "$dir/run-$key.out" "$dir/review-$key.md"
      fi
      if [[ -s "$dir/review-$key.md" ]]; then
        u_ok=$((u_ok + 1))
      elif key_timed_out "$dir" "$key"; then
        echo "review.sh: reviewer [$key] timed out (${limit}s limit)" >&2
        u_timeout=$((u_timeout + 1))
        timeout_total=$((timeout_total + 1))
      else
        echo "review.sh: reviewer [$key] exited without producing $dir/review-$key.md (see $dir/run-$key.err)" >&2
        failed_total=$((failed_total + 1))
      fi
    done < <(active_slots "$dir")
    (( failed_total == 0 )) || return 3
    if (( u_ok == 0 )); then
      return 124
    fi
    if (( u_timeout > 0 && slot_count < 2 )); then
      return 124
    fi
  done < <(active_units "$dir")

  if (( timeout_total > 0 )); then
    echo "review.sh: single-side timeout handled via surviving peer report (unified review rule 5)" >&2
  fi
  write_combined_summary "$dir"
}

check_single_report() {
  local file=$1 label=$2 first_line counts_line bad_lines
  [[ -s $file ]] || { echo "verify [$label]: missing or empty $file" >&2; return 4; }
  first_line=$(awk 'NF { gsub(/^[#*[:space:]`]+|[[:space:]`]+$/, ""); print; exit }' "$file")
  if [[ ! $first_line =~ ^可接受 ]]; then
    echo "verify [$label]: verdict is '$first_line' (expected '可接受')" >&2
    return 4
  fi
  counts_line=$(grep -E '^COUNTS:[[:space:]]*P0=[0-9]+[[:space:]]+P1=[0-9]+' "$file" | head -1 || true)
  if [[ -n $counts_line ]] && [[ ! $counts_line =~ ^COUNTS:[[:space:]]*P0=0[[:space:]]+P1=0([[:space:]]|$) ]]; then
    echo "verify [$label]: non-zero P0/P1 count in '$counts_line'" >&2
    return 4
  fi
  bad_lines=$(grep -nE '(\[P[01](-[0-9]+)?\]|^[[:space:]]*\|[[:space:]]*\*{0,2}\[?P[01](-[0-9]+)?\]?[[:space:]\*]*\||^[[:space:]]*(#+|-|\*|[0-9]+\.)[[:space:]]*\*{0,2}\[?P[01](-[0-9]+)?\]?([:：[:space:]\*\.\)]|$))' "$file" \
    | grep -vEi '(无|没有|未发现|零|0[[:space:]]*个?|no|none|zero)[[:space:]]*(P0|P1|CONFIRMED)' \
    | grep -vEi '(已修复|已解决|已验证|RESOLVED|FIXED|VERIFIED|CLOSED|P0[[:space:]]*/[[:space:]]*P1)' || true)
  if [[ -n $bad_lines ]]; then
    echo "verify [$label]: unresolved P0/P1 finding(s) in $file despite '可接受' header:" >&2
    printf '%s\n' "$bad_lines" | sed 's/^/  line /' >&2
    return 4
  fi
  echo "verify [$label]: PASS ($first_line, P0/P1 = 0)"
}

cmd_verify() {
  load_cfg || return $?
  local id=${1:?usage: verify <id> [head]}
  local head=${2:-HEAD}
  local dir="$CFG_REVIEW_DIR/$id"
  local expected_sha actual_sha unit slot key rc=0 u_pass slot_count

  [[ -f $dir/precheck.sha ]] || { echo "review.sh: $dir/precheck.sha not found" >&2; return 1; }
  expected_sha=$(git rev-parse --verify "$head") || { echo "review.sh: unknown revision '$head'" >&2; return 1; }
  actual_sha=$(cat "$dir/precheck.sha")
  [[ $actual_sha == "$expected_sha" ]] || { echo "review.sh: precheck.sha ($actual_sha) != $head ($expected_sha)" >&2; return 1; }
  rm -f "$dir/verified.sha"

  slot_count=$(active_slots "$dir" | wc -l | tr -d ' ')
  while IFS= read -r unit; do
    u_pass=0
    while IFS= read -r slot; do
      key=$(unit_key "$unit" "$slot")
      if [[ ! -s "$dir/review-$key.md" ]] && (( slot_count >= 2 )) && key_timed_out "$dir" "$key"; then
        echo "verify [$key]: TIMEOUT — accepted via surviving peer"
        continue
      fi
      if check_single_report "$dir/review-$key.md" "$key"; then
        u_pass=$((u_pass + 1))
      else
        rc=$?
      fi
    done < <(active_slots "$dir")
    if (( u_pass == 0 )); then
      (( rc == 0 )) && rc=4
    fi
  done < <(active_units "$dir")

  if (( rc != 0 )); then
    return "$rc"
  fi
  write_combined_summary "$dir"
  printf '%s\n' "$expected_sha" >"$dir/verified.sha"
  echo "verified: stamped $dir/verified.sha ($expected_sha)"
}

cmd_check_gate() {
  local base=${1:?usage: check-gate <base> [head]}
  local head=${2:-HEAD}
  run_node_helper check-gate "$base" "$head"
}

cmd_hook_pre_commit() {
  load_cfg || return $?
  local git_dir branch merge_sha="" base_sha
  git_dir=$(git rev-parse --git-dir)
  branch=$(git symbolic-ref --short -q HEAD || true)

  if [[ -f "$git_dir/MERGE_HEAD" ]]; then
    merge_sha=$(git rev-parse MERGE_HEAD)
  elif [[ ${VIBE_PRE_MERGE:-0} == "1" ]]; then
    merge_sha=$(env | sed -nE 's/^GITHEAD_([0-9a-f]{40})=.*/\1/p' | head -n1)
  fi

  if [[ $branch == "$CFG_MAIN_BRANCH" && -n $merge_sha ]]; then
    base_sha=$(git merge-base HEAD "$merge_sha")
    run_node_helper check-gate "$base_sha" "$merge_sha" || return $?
    return 0
  fi

  if [[ $branch == "$CFG_MAIN_BRANCH" && -z $merge_sha ]]; then
    run_node_helper check-staged-main || return $?
  fi

  if [[ -n $CFG_COMMIT_CHECK && -z $merge_sha ]]; then
    bash -eo pipefail -c "$CFG_COMMIT_CHECK" || return $?
  fi
}

cmd_stop() {
  load_cfg --allow-missing || true
  local id=${1:?usage: stop <id>}
  local dir="${CFG_REVIEW_DIR:-.local/reviews}/$id"
  local pidfile pid i still_alive
  for pidfile in "$dir"/pid-*; do
    [[ -f $pidfile ]] || continue
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [[ $pid =~ ^[0-9]+$ ]]; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  for (( i = 0; i < 20; i++ )); do
    still_alive=0
    for pidfile in "$dir"/pid-*; do
      [[ -f $pidfile ]] || continue
      pid=$(cat "$pidfile" 2>/dev/null || true)
      if [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
        still_alive=1
      fi
    done
    (( still_alive == 0 )) && break
    sleep 0.1
  done
  for pidfile in "$dir"/pid-*; do
    [[ -f $pidfile ]] || continue
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  done
}

case ${1:-} in
  precheck)        shift; cmd_precheck "$@" ;;
  start)           shift; cmd_start "$@" ;;
  confirm)         shift; cmd_confirm "$@" ;;
  wait)            shift; cmd_wait "$@" ;;
  verify)          shift; cmd_verify "$@" ;;
  check-gate)      shift; cmd_check_gate "$@" ;;
  hook-pre-commit) shift; cmd_hook_pre_commit "$@" ;;
  stop)            shift; cmd_stop "$@" ;;
  *)
    echo "usage: $0 {precheck [--fix] <id> <base> [head]|start <id> [head] [focus]|confirm <id> <slot> <fix-base> [head] [focus]|wait <id> [seconds]|verify <id> [head]|check-gate <base> [head]|hook-pre-commit|stop <id>}" >&2
    exit 1
    ;;
esac
