#!/usr/bin/env node
// Audit a repository's documentation and issue queue against the vibe-coding standard.
// Usage: node doc-lint.mjs [repo-root] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'target', '.next',
  '.astro', '.scratch', '.metrics', 'coverage', 'vendor', 'archive',
]);
const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go']);
const VALID_ISSUE_STATUS = new Set([
  'ready', 'in_progress', 'needs-decision', 'external-blocked', 'ops-approval', 'verifying-dev', 'done',
]);
const NOISY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.jsonl', '.csv', '.mp4', '.mov']);

function walkCode(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkCode(p, out);
    else if (CODE_EXTS.has(extname(ent.name))) out.push(p);
  }
  return out;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return meta;
}

function extractHeadings(markdown) {
  return [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
}

function slugifyHeading(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[`*_~()[\]{}<>:;,.!?'"“”‘’「」【】（）]/g, '')
    .replace(/\s+/g, '-');
}

function safeDecode(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function singleHeadingMatch(h, target, targetSlug) {
  const stripped = h.replace(/^(?:§?\d+(?:\.\d+)*\.?\s+)/, '');
  if (h.startsWith(target) || stripped.startsWith(target)) return true;
  if (!targetSlug) return false;
  return slugifyHeading(h) === targetSlug || slugifyHeading(stripped) === targetSlug;
}

function headingMatches(headings, rawTarget) {
  const target = safeDecode(rawTarget).trim();
  const targetSlug = slugifyHeading(target);
  return headings.some((h) => singleHeadingMatch(h, target, targetSlug));
}

function checkAgentsEntry(root, warn) {
  const agentsPath = join(root, 'AGENTS.md');
  if (!existsSync(agentsPath)) {
    warn('agents-missing', 'AGENTS.md', 'Missing AGENTS.md entrypoint at repository root.');
    return;
  }
  const lines = readFileSync(agentsPath, 'utf8').split(/\r?\n/).length;
  if (lines > 85) warn('agents-length', 'AGENTS.md', `AGENTS.md has ${lines} lines (target <= 80 lines).`);
}

function isLintSelfFile(file) {
  return file.endsWith('doc-lint.mjs') || file.endsWith('doc-lint.test.mjs');
}

function readDocHeadings(fullPath) {
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) return null;
  return extractHeadings(readFileSync(fullPath, 'utf8'));
}

function checkDesignRefs(text, relFile, designHeadings, error) {
  if (!designHeadings) return;
  for (const m of text.matchAll(/DESIGN\.md「([^」\r\n]+)」/g)) {
    if (!headingMatches(designHeadings, m[1])) {
      error('broken-design-anchor', relFile, `References DESIGN.md「${m[1]}」, but no matching heading exists in DESIGN.md.`);
    }
  }
}

function checkSubsystemRefs(text, relFile, getHeadings, error) {
  const pattern = /docs\/subsystems\/([A-Za-z0-9_./-]+\.md)#([^\s`'")\]>\}，。；：！？、“”‘’「」【】]+)/g;
  for (const m of text.matchAll(pattern)) {
    const subRel = `docs/subsystems/${m[1]}`;
    const anchor = m[2];
    const headings = getHeadings(subRel);
    if (!headings) {
      error('broken-subsystem-anchor', relFile, `References ${subRel}#${anchor}, but ${subRel} does not exist.`);
    } else if (!headingMatches(headings, anchor)) {
      error('broken-subsystem-anchor', relFile, `References ${subRel}#${anchor}, but no matching heading exists in ${subRel}.`);
    }
  }
}

function checkCodeAnchors(root, error) {
  const designHeadings = readDocHeadings(join(root, 'DESIGN.md'));
  const cache = new Map();
  const getHeadings = (subRel) => {
    if (!cache.has(subRel)) cache.set(subRel, readDocHeadings(join(root, subRel)));
    return cache.get(subRel);
  };
  for (const file of walkCode(root)) {
    if (isLintSelfFile(file)) continue;
    const text = readFileSync(file, 'utf8');
    const relFile = relative(root, file);
    checkDesignRefs(text, relFile, designHeadings, error);
    checkSubsystemRefs(text, relFile, getHeadings, error);
  }
}

function checkDocsRootHygiene(docsDir, warn) {
  for (const ent of readdirSync(docsDir, { withFileTypes: true })) {
    const rel = join('docs', ent.name);
    if (ent.isFile() && NOISY_EXTS.has(extname(ent.name).toLowerCase())) {
      warn('docs-root-blob', rel, 'Binary/data artifact in docs/ root; move to .scratch/ or docs/archive/.');
    }
    if (ent.isDirectory() && /-audit-\d{8}$/.test(ent.name)) {
      warn('docs-root-audit', rel, 'Point-in-time audit folder in docs/ root; merge mechanism into docs/subsystems/, split tasks into docs/issues/, and archive raw data.');
    }
  }
}

function isValidSubsystemDoc(filePath) {
  const fm = parseFrontmatter(readFileSync(filePath, 'utf8'));
  return Boolean(fm && fm.title && fm.description);
}

function checkSubsystemFrontmatter(docsDir, error) {
  const subsystemsDir = join(docsDir, 'subsystems');
  if (!existsSync(subsystemsDir) || !statSync(subsystemsDir).isDirectory()) return;
  for (const name of readdirSync(subsystemsDir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    if (!isValidSubsystemDoc(join(subsystemsDir, name))) {
      error('missing-frontmatter', join('docs/subsystems', name), 'Subsystem doc must start with Nimbus YAML frontmatter containing `title` and `description`.');
    }
  }
}

function isZombieSpec(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const unchecked = (text.match(/^\s*-\s*\[\s\]/gm) || []).length;
  const checked = (text.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
  return checked > 0 && unchecked === 0;
}

function checkSpecs(docsDir, warn) {
  const specsDir = join(docsDir, 'specs');
  if (!existsSync(specsDir) || !statSync(specsDir).isDirectory()) return;
  for (const name of readdirSync(specsDir)) {
    if (name.endsWith('.md') && isZombieSpec(join(specsDir, name))) {
      warn('zombie-spec', join('docs/specs', name), 'All checkboxes are [x]; merge facts into DESIGN.md / docs/subsystems/ and delete the spec.');
    }
  }
}

function hasRequiredIssueFields(fm) {
  return Boolean(fm && fm.id && fm.status && fm.title);
}

function validateIssueCard(issuesDir, name, indexText, warn, error) {
  const rel = join('docs/issues', name);
  const fm = parseFrontmatter(readFileSync(join(issuesDir, name), 'utf8'));
  if (!hasRequiredIssueFields(fm)) {
    error('issue-frontmatter', rel, 'Issue card must have YAML frontmatter with `id`, `title`, and `status`.');
    return;
  }
  if (!VALID_ISSUE_STATUS.has(fm.status)) {
    error('issue-invalid-status', rel, `Invalid status "${fm.status}". Allowed: ${[...VALID_ISSUE_STATUS].join(', ')}.`);
  }
  if (fm.status === 'done') {
    warn('zombie-done-issue', rel, 'Issue status is `done`; record commit & test in docs/issues/INDEX.md and delete the card file.');
  }
  if (!indexText.includes(name) && !indexText.includes(fm.id)) {
    warn('orphan-issue-card', rel, `Issue ${fm.id} is not referenced in docs/issues/INDEX.md.`);
  }
}

function checkIssues(docsDir, warn, error) {
  const issuesDir = join(docsDir, 'issues');
  if (!existsSync(issuesDir) || !statSync(issuesDir).isDirectory()) return;
  const indexPath = join(issuesDir, 'INDEX.md');
  if (!existsSync(indexPath)) {
    error('issues-index-missing', 'docs/issues/INDEX.md', 'docs/issues/ exists but INDEX.md is missing.');
    return;
  }
  const indexText = readFileSync(indexPath, 'utf8');
  for (const name of readdirSync(issuesDir)) {
    if (name.startsWith('I-') && name.endsWith('.md')) {
      validateIssueCard(issuesDir, name, indexText, warn, error);
    }
  }
}

export function lintRepo(repoRoot) {
  const root = resolve(repoRoot);
  const findings = [];
  const warn = (rule, file, message) => findings.push({ severity: 'warn', rule, file, message });
  const error = (rule, file, message) => findings.push({ severity: 'error', rule, file, message });

  checkAgentsEntry(root, warn);
  checkCodeAnchors(root, error);

  const docsDir = join(root, 'docs');
  if (existsSync(docsDir) && statSync(docsDir).isDirectory()) {
    checkDocsRootHygiene(docsDir, warn);
    checkSubsystemFrontmatter(docsDir, error);
    checkSpecs(docsDir, warn);
    checkIssues(docsDir, warn, error);
  }

  return { root, ok: !findings.some((f) => f.severity === 'error'), findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const targetRoot = args.find((a) => !a.startsWith('-')) || process.cwd();
  const report = lintRepo(targetRoot);

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.findings.length === 0) {
    console.log(`✓ doc-lint passed (${report.root})`);
  } else {
    for (const f of report.findings) {
      console.log(`[${f.severity.toUpperCase()}] (${f.rule}) ${f.file}: ${f.message}`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}
