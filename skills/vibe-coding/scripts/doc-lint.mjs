#!/usr/bin/env node
// Audit a repository's documentation and issue queue against the vibe-coding standard.
// Usage: node doc-lint.mjs [repo-root] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const root = resolve(args.find((a) => !a.startsWith('-')) || process.cwd());

const findings = [];
const warn = (rule, file, message) => findings.push({ severity: 'warn', rule, file, message });
const error = (rule, file, message) => findings.push({ severity: 'error', rule, file, message });

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', '.next', '.astro', '.scratch', '.metrics', 'coverage', 'vendor', 'archive']);
const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go']);
const VALID_ISSUE_STATUS = new Set(['ready', 'in_progress', 'needs-decision', 'external-blocked', 'ops-approval', 'verifying-dev', 'done']);

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

// 1. Check AGENTS.md size (<= 80 lines recommended)
const agentsPath = join(root, 'AGENTS.md');
if (existsSync(agentsPath)) {
  const lines = readFileSync(agentsPath, 'utf8').split(/\r?\n/).length;
  if (lines > 85) warn('agents-length', 'AGENTS.md', `AGENTS.md has ${lines} lines (target <= 80 lines).`);
} else {
  warn('agents-missing', 'AGENTS.md', 'Missing AGENTS.md entrypoint at repository root.');
}

// 2. Check DESIGN.md「章节」 references in code
const designPath = join(root, 'DESIGN.md');
if (existsSync(designPath)) {
  const designText = readFileSync(designPath, 'utf8');
  const headings = new Set(
    [...designText.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim()),
  );
  for (const file of walkCode(root)) {
    if (file.endsWith('doc-lint.test.mjs') || file.endsWith('doc-lint.mjs')) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/DESIGN\.md「([^」$]+)」/g)) {
      const target = m[1];
      const matched = [...headings].some((h) => h === target || h.startsWith(target));
      if (!matched) {
        error('broken-design-anchor', relative(root, file), `References DESIGN.md「${target}」, but no matching heading exists in DESIGN.md.`);
      }
    }
  }
}

// 3. Check docs/ root hygiene & Nimbus frontmatter on docs/subsystems/*.md
const docsDir = join(root, 'docs');
if (existsSync(docsDir) && statSync(docsDir).isDirectory()) {
  const rootEntries = readdirSync(docsDir, { withFileTypes: true });
  const noisyExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.jsonl', '.csv', '.mp4', '.mov']);
  for (const ent of rootEntries) {
    const rel = join('docs', ent.name);
    if (ent.isFile() && noisyExts.has(extname(ent.name).toLowerCase())) {
      warn('docs-root-blob', rel, 'Binary/data artifact in docs/ root; move to .scratch/ or docs/archive/.');
    }
    if (ent.isDirectory() && /-audit-\d{8}$/.test(ent.name)) {
      warn('docs-root-audit', rel, 'Point-in-time audit folder in docs/ root; merge mechanism into docs/subsystems/, split tasks into docs/issues/, and archive raw data.');
    }
  }

  const subsystemsDir = join(docsDir, 'subsystems');
  if (existsSync(subsystemsDir) && statSync(subsystemsDir).isDirectory()) {
    for (const name of readdirSync(subsystemsDir)) {
      if (!name.endsWith('.md') || name === 'README.md') continue;
      const rel = join('docs/subsystems', name);
      const fm = parseFrontmatter(readFileSync(join(subsystemsDir, name), 'utf8'));
      if (!fm || !fm.title || !fm.description) {
        error('missing-frontmatter', rel, 'Subsystem doc must start with Nimbus YAML frontmatter containing `title` and `description`.');
      }
    }
  }

  // 4. Check docs/specs/ for zombie all-[x] files
  const specsDir = join(docsDir, 'specs');
  if (existsSync(specsDir) && statSync(specsDir).isDirectory()) {
    for (const name of readdirSync(specsDir)) {
      if (!name.endsWith('.md')) continue;
      const text = readFileSync(join(specsDir, name), 'utf8');
      const unchecked = (text.match(/^\s*-\s*\[\s\]/gm) || []).length;
      const checked = (text.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
      if (checked > 0 && unchecked === 0) {
        warn('zombie-spec', join('docs/specs', name), 'All checkboxes are [x]; merge facts into DESIGN.md / docs/subsystems/ and delete the spec.');
      }
    }
  }

  // 5. Check docs/issues/ state machine consistency
  const issuesDir = join(docsDir, 'issues');
  if (existsSync(issuesDir) && statSync(issuesDir).isDirectory()) {
    const indexPath = join(issuesDir, 'INDEX.md');
    if (!existsSync(indexPath)) {
      error('issues-index-missing', 'docs/issues/INDEX.md', 'docs/issues/ exists but INDEX.md is missing.');
    } else {
      const indexText = readFileSync(indexPath, 'utf8');
      for (const name of readdirSync(issuesDir)) {
        if (!name.startsWith('I-') || !name.endsWith('.md')) continue;
        const rel = join('docs/issues', name);
        const fm = parseFrontmatter(readFileSync(join(issuesDir, name), 'utf8'));
        if (!fm || !fm.id || !fm.status || !fm.title) {
          error('issue-frontmatter', rel, 'Issue card must have YAML frontmatter with `id`, `title`, and `status`.');
          continue;
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
    }
  }
}

if (jsonMode) {
  console.log(JSON.stringify({ root, ok: !findings.some((f) => f.severity === 'error'), findings }, null, 2));
} else if (findings.length === 0) {
  console.log(`✓ doc-lint passed (${root})`);
} else {
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] (${f.rule}) ${f.file}: ${f.message}`);
  }
}
process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0);
