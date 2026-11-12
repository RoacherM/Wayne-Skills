import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintRepo } from '../skills/vibe-coding/scripts/doc-lint.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_LINT_BIN = join(REPO_ROOT, 'skills/vibe-coding/scripts/doc-lint.mjs');

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'doc-lint-test-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'docs/subsystems'), { recursive: true });
  writeFileSync(join(dir, 'AGENTS.md'), '# Test Repo\n');
  writeFileSync(
    join(dir, 'DESIGN.md'),
    '---\ntitle: Main\ndescription: Main design.\n---\n\n# Overview\n\n## 1. 架构边界\n',
  );
  writeFileSync(
    join(dir, 'docs/subsystems/auth.md'),
    '---\ntitle: Auth\ndescription: Auth subsystem.\n---\n\n# Auth\n\n## 协议与契约（含新旧混用）\n\n### 2. Token Refresh\n',
  );
  return dir;
}

describe('doc-lint anchor and metadata checks', () => {
  it('passes valid DESIGN.md and docs/subsystems/*.md#anchor references (prefix, numbered, and slug)', () => {
    const dir = makeFixture();
    try {
      writeFileSync(
        join(dir, 'src/ok.ts'),
        [
          '// See DESIGN.md「架构边界」 and DESIGN.md「1. 架构边界」',
          '// Subsystem refs: docs/subsystems/auth.md#协议与契约，以及 docs/subsystems/auth.md#token-refresh',
          'export const ok = true;',
        ].join('\n'),
      );
      const res = lintRepo(dir);
      assert.equal(res.ok, true);
      assert.deepEqual(res.findings, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags broken docs/subsystems/x.md#章节 when file or heading is missing', () => {
    const dir = makeFixture();
    try {
      writeFileSync(
        join(dir, 'src/bad.ts'),
        [
          '// Missing file: docs/subsystems/billing.md#计费规则',
          '// Missing heading: docs/subsystems/auth.md#不存在的章节',
          '// Missing design heading: DESIGN.md「未知章节」',
          'export const bad = false;',
        ].join('\n'),
      );
      const cli = spawnSync(process.execPath, [DOC_LINT_BIN, dir, '--json'], { encoding: 'utf8' });
      assert.equal(cli.status, 1);
      const parsed = JSON.parse(cli.stdout);
      assert.equal(parsed.ok, false);
      const rules = parsed.findings.map((f) => `${f.rule}:${f.message}`);
      assert.ok(rules.some((r) => r.includes('broken-subsystem-anchor') && r.includes('docs/subsystems/billing.md does not exist')));
      assert.ok(rules.some((r) => r.includes('broken-subsystem-anchor') && r.includes('docs/subsystems/auth.md#不存在的章节')));
      assert.ok(rules.some((r) => r.includes('broken-design-anchor') && r.includes('DESIGN.md「未知章节」')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks Nimbus frontmatter and issue queue state machine', () => {
    const dir = makeFixture();
    try {
      writeFileSync(join(dir, 'docs/subsystems/broken.md'), '# No frontmatter\n');
      mkdirSync(join(dir, 'docs/issues'), { recursive: true });
      writeFileSync(join(dir, 'docs/issues/INDEX.md'), '# Issues\n- I-001\n');
      writeFileSync(
        join(dir, 'docs/issues/I-001-done.md'),
        '---\nid: I-001\ntitle: Done item\nstatus: done\n---\n',
      );
      writeFileSync(
        join(dir, 'docs/issues/I-002-bad.md'),
        '---\nid: I-002\ntitle: Bad status\nstatus: mystery\n---\n',
      );

      const res = lintRepo(dir);
      assert.equal(res.ok, false);
      const byRule = new Set(res.findings.map((f) => f.rule));
      assert.ok(byRule.has('missing-frontmatter'));
      assert.ok(byRule.has('zombie-done-issue'));
      assert.ok(byRule.has('issue-invalid-status'));
      assert.ok(byRule.has('orphan-issue-card'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runs CLI entry when invoked through a symlink (like ~/.agents/skills/vibe-coding/scripts/doc-lint.mjs)', () => {
    const dir = makeFixture();
    const linkDir = mkdtempSync(join(tmpdir(), 'doc-lint-link-'));
    try {
      const linkBin = join(linkDir, 'doc-lint.mjs');
      symlinkSync(DOC_LINT_BIN, linkBin);
      writeFileSync(join(dir, 'src/bad.ts'), '// DESIGN.md「未知章节」\nexport const x = 1;\n');
      const cli = spawnSync(process.execPath, [linkBin, dir, '--json'], { encoding: 'utf8' });
      assert.equal(cli.status, 1, 'symlinked CLI must execute lintRepo and exit 1 on errors');
      const parsed = JSON.parse(cli.stdout);
      assert.equal(parsed.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(linkDir, { recursive: true, force: true });
    }
  });
});
