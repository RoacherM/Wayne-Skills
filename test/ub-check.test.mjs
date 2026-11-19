import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FALLBACK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = existsSync(join(process.cwd(), 'skills/ub-mode/scripts/ub'))
  ? process.cwd()
  : FALLBACK_ROOT;
const UB_BIN = join(REPO_ROOT, 'skills/ub-mode/scripts/ub');

function runUb(args, cwd, extraEnv = {}) {
  return spawnSync('sh', [UB_BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

function runCheckJson(args, cwd) {
  const res = runUb(['check', '--json', ...args], cwd);
  return { status: res.status, stderr: res.stderr, data: JSON.parse(res.stdout) };
}

function makeDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
}

describe('ub check: Python rules', () => {
  it('flags fixed sleeps, flake retries, unexplained skips/xfails, empty tests, and broad silent fallbacks while allowing valid patterns', () => {
    const dir = makeDir('ub-check-py-');
    try {
      mkdirSync(join(dir, 'tests'), { recursive: true });
      mkdirSync(join(dir, 'src'), { recursive: true });

      writeFileSync(
        join(dir, 'tests/test_sample.py'),
        [
          'import time',
          'from asyncio import sleep as async_sleep',
          'import unittest',
          'import pytest',
          'from pytest import mark',
          '',
          'def poll_until_ready():',
          '    time.sleep(0.05)  # helper outside test_* is allowed',
          '',
          '@pytest.mark.flaky(reruns=2)',
          '@mark.flaky',
          '@pytest.mark.timeout(5)',
          '@pytest.mark.repeat(10)',
          'def test_bad_sleep_and_flaky():',
          '    time.sleep(0.2)',
          '    while False:',
          '        time.sleep(0.01)',
          '    time.sleep(0)',
          '',
          '@pytest.fixture',
          'async def sample_fixture():',
          '    await async_sleep(0)',
          '    await async_sleep(0.3)',
          '',
          '@pytest.mark.skip',
          '@pytest.mark.xfail',
          '@pytest.mark.skipif(True, reason="")',
          '@unittest.expectedFailure',
          'def test_skips_bad():',
          '    pytest.skip()',
          '    assert True',
          '',
          '@pytest.mark.skip(reason="linux only")',
          '@pytest.mark.xfail(reason="upstream bug #42")',
          '@pytest.mark.skipif(True, reason="ci only")',
          'def test_skips_with_reason():',
          '    pytest.skip("env missing")',
          '',
          'def test_empty_pass():',
          '    """docstring only"""',
          '    pass',
          '',
          'def test_empty_ellipsis():',
          '    ...',
          '',
          'class TestHooks:',
          '    def setup_method(self):',
          '        time.sleep(0.2)',
        ].join('\n') + '\n',
      );

      writeFileSync(
        join(dir, 'src/loader.py'),
        [
          'import time',
          '',
          'def prod_sleep():',
          '    time.sleep(1)',
          '',
          'def bad_fallback(x):',
          '    try:',
          '        return [int(x)]',
          '    except Exception as exc:',
          '        print(exc)',
          '        return []',
          '',
          'def bad_bare_except(x):',
          '    try:',
          '        return str(x)',
          '    except:  # noqa: E722',
          '        return ""',
          '',
          'def ok_none_fallback(x):',
          '    try:',
          '        return [int(x)]',
          '    except Exception:',
          '        return None',
          '',
          'def ok_narrow_except(p):',
          '    try:',
          '        return open(p).readlines()',
          '    except FileNotFoundError:',
          '        return []',
          '',
          'def ok_reraise(x):',
          '    try:',
          '        return [int(x)]',
          '    except Exception:',
          '        raise',
        ].join('\n') + '\n',
      );

      const { status, data } = runCheckJson([], dir);
      assert.equal(status, 1);
      assert.equal(data.ok, false);

      const hits = data.findings.map((f) => `${f.file}:${f.line}:${f.rule}`);
      assert.deepEqual(hits, [
        'src/loader.py:11:ub-check(no-silent-fallback)',
        'src/loader.py:17:ub-check(no-silent-fallback)',
        'tests/test_sample.py:10:ub-check(no-flake-masking)',
        'tests/test_sample.py:11:ub-check(no-flake-masking)',
        'tests/test_sample.py:15:ub-check(no-fixed-sleep)',
        'tests/test_sample.py:23:ub-check(no-fixed-sleep)',
        'tests/test_sample.py:25:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:26:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:27:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:28:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:30:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:39:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:43:ub-check(no-skipped-or-empty-test)',
        'tests/test_sample.py:48:ub-check(no-fixed-sleep)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ub check: JS/TS rules', () => {
  it('flags skip/only/empty tests, fixed sleeps including node:test before hooks, retries, and catch fallbacks while allowing node:test timeout caps', () => {
    const dir = makeDir('ub-check-js-');
    try {
      mkdirSync(join(dir, 'test'), { recursive: true });
      mkdirSync(join(dir, 'src'), { recursive: true });

      writeFileSync(
        join(dir, 'test/sample.test.mjs'),
        [
          "import { before, test } from 'node:test';",
          "import { setTimeout as delay } from 'node:timers/promises';",
          '',
          'before(async () => {',
          '  await delay(50);',
          '});',
          '',
          "test('bounded timeout is allowed', { timeout: 2000 }, async (t) => {",
          "  t.skip('needs linux');",
          '  await delay(0);',
          '  while (false) {',
          '    await delay(10);',
          '  }',
          '});',
          '',
          "test.only('focused test', () => { console.log(1); });",
          "test.skip('skipped test', () => { console.log(1); });",
          "test('skip opt true', { skip: true }, () => { console.log(1); });",
          "test('skip opt reason ok', { skip: 'needs gpu' }, () => { console.log(1); });",
          "test('retry masking', { retry: 2 }, () => { console.log(1); });",
          "test('empty body', () => {});",
          "test('promise sleep and bare t.skip', async (t) => {",
          '  t.skip();',
          '  await new Promise((r) => setTimeout(r, 100));',
          '});',
          '',
          'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
          'function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }',
          "test('local sleep helpers and playwright conditional skip', async () => {",
          "  test.skip(process.env.CI === '1', 'browser unavailable on CI');",
          '  test.skip(process.env.CI === \'1\');',
          '  await sleep(0);',
          '  await sleep(50);',
          '  await waitMs(50);',
          '});',
        ].join('\n') + '\n',
      );

      writeFileSync(
        join(dir, 'test/fake-timers.test.ts'),
        [
          "import { test, vi } from 'vitest';",
          "test('fake timers exempt sleep', async () => {",
          '  vi.useFakeTimers();',
          '  await new Promise((r) => setTimeout(r, 500));',
          '});',
        ].join('\n') + '\n',
      );

      writeFileSync(
        join(dir, 'src/api.ts'),
        [
          'export async function loadBad(fn: () => Promise<string[]>) {',
          '  try {',
          '    return await fn();',
          '  } catch (err) {',
          '    console.warn(err);',
          '    return [];',
          '  }',
          '}',
          'export const dotCatch = (p: Promise<object>) => p.catch(() => ({}));',
          'export async function loadOk(fn: () => Promise<string[]>) {',
          '  try {',
          '    return await fn();',
          '  } catch {',
          '    return null;',
          '  }',
          '}',
          'export async function loadRethrow(fn: () => Promise<string[]>) {',
          '  try {',
          '    return await fn();',
          '  } catch (err) {',
          '    throw err;',
          '  }',
          '}',
        ].join('\n') + '\n',
      );

      const { status, data } = runCheckJson([], dir);
      assert.equal(status, 1);
      const hits = data.findings.map((f) => `${f.file}:${f.line}:${f.rule}`);
      assert.deepEqual(hits, [
        'src/api.ts:6:ub-check(no-silent-fallback)',
        'src/api.ts:9:ub-check(no-silent-fallback)',
        'test/sample.test.mjs:5:ub-check(no-fixed-sleep)',
        'test/sample.test.mjs:16:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:17:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:18:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:20:ub-check(no-flake-masking)',
        'test/sample.test.mjs:21:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:23:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:24:ub-check(no-fixed-sleep)',
        'test/sample.test.mjs:31:ub-check(no-skipped-or-empty-test)',
        'test/sample.test.mjs:33:ub-check(no-fixed-sleep)',
        'test/sample.test.mjs:34:ub-check(no-fixed-sleep)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ub check: Rust rules', () => {
  it('flags imported and qualified sleeps, bare #[ignore], and empty tests while exempting start_paused, zero duration, and production code', () => {
    const dir = makeDir('ub-check-rs-');
    try {
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(
        join(dir, 'src/lib.rs'),
        [
          'use std::time::Duration;',
          'use tokio::{time::sleep};',
          '',
          'pub fn prod_wait() {',
          '    std::thread::sleep(Duration::from_millis(50));',
          '}',
          '',
          '#[cfg(test)]',
          'mod tests {',
          '    use super::*;',
          '',
          '    #[test]',
          '    #[ignore]',
          '    fn bad_test() {',
          '        std::thread::sleep(Duration::from_millis(10));',
          '        while false {',
          '            std::thread::sleep(Duration::from_millis(1));',
          '        }',
          '        std::thread::sleep(Duration::ZERO);',
          '    }',
          '',
          '    #[tokio::test]',
          '    async fn bad_imported_sleep() {',
          '        sleep(Duration::from_millis(20)).await;',
          '    }',
          '',
          '    #[tokio::test(start_paused = true)]',
          '    async fn ok_paused_time() {',
          '        sleep(Duration::from_secs(60)).await;',
          '    }',
          '',
          '    #[test]',
          '    #[ignore = "requires gpu"]',
          '    fn empty_test() {}',
          '}',
        ].join('\n') + '\n',
      );

      const { status, data } = runCheckJson([], dir);
      assert.equal(status, 1);
      const hits = data.findings.map((f) => `${f.file}:${f.line}:${f.rule}`);
      assert.deepEqual(hits, [
        'src/lib.rs:13:ub-check(no-skipped-or-empty-test)',
        'src/lib.rs:15:ub-check(no-fixed-sleep)',
        'src/lib.rs:24:ub-check(no-fixed-sleep)',
        'src/lib.rs:34:ub-check(no-skipped-or-empty-test)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ub check: inline exemptions, git/path semantics, and exit codes', () => {
  it('supports inline allow comments with mandatory reasons and rejects reasonless ones', () => {
    const dir = makeDir('ub-check-allow-');
    try {
      mkdirSync(join(dir, 'tests'), { recursive: true });
      writeFileSync(
        join(dir, 'tests/test_allow.py'),
        [
          'import time',
          'def test_exempt():',
          '    # ub-check: allow no-fixed-sleep: hardware warm-up delay',
          '    time.sleep(0.1)',
          '    time.sleep(0.1)',
          '    time.sleep(0.1)  # ub-check: allow no-fixed-sleep: same-line reason',
          '    time.sleep(0.2)',
          '    # ub-check: allow no-fixed-sleep',
          '    time.sleep(0.1)',
        ].join('\n') + '\n',
      );
      writeFileSync(
        join(dir, 'top_test.py'),
        'import time\ndef test_root_suffix():\n    time.sleep(0.1)\n',
      );
      writeFileSync(
        join(dir, 'test_prefix.py'),
        'import time\ndef test_root_prefix():\n    time.sleep(0.1)\n',
      );

      const { status, data } = runCheckJson([], dir);
      assert.equal(status, 1);
      const hits = data.findings.map((f) => `${f.file}:${f.line}:${f.column}:${f.rule}`);
      assert.deepEqual(hits, [
        'test_prefix.py:3:5:ub-check(no-fixed-sleep)',
        'tests/test_allow.py:5:5:ub-check(no-fixed-sleep)',
        'tests/test_allow.py:7:5:ub-check(no-fixed-sleep)',
        'tests/test_allow.py:8:5:ub-check(invalid-allow-comment)',
        'tests/test_allow.py:9:5:ub-check(no-fixed-sleep)',
        'top_test.py:3:5:ub-check(no-fixed-sleep)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies test roles relative to root even when the repo lives inside a parent folder named test', () => {
    const outer = makeDir('ub-check-nested-');
    try {
      const repo = join(outer, 'test', 'myproj');
      mkdirSync(join(repo, 'src'), { recursive: true });
      writeFileSync(
        join(repo, 'src/app.mjs'),
        'export function run(test) { test.skip("not a test file", () => {}); }\n',
      );
      writeFileSync(
        join(repo, 'src/test_runner.mjs'),
        'export function run(test) { test.skip("not a py test", () => {}); }\n',
      );
      writeFileSync(
        join(repo, 'src/helper_test.rs'),
        'use std::time::Duration;\npub fn wait() { std::thread::sleep(Duration::from_millis(5)); }\n',
      );
      const { status, data } = runCheckJson([], repo);
      assert.equal(status, 0);
      assert.equal(data.ok, true);
      assert.deepEqual(data.findings, []);
    } finally {
      rmSync(outer, { recursive: true, force: true });
    }
  });

  it('respects .gitignore, SKIP_DIRS, repo-root test classification, changed-lines-only --changed, syntax error exit 2, and python -P isolation', () => {
    const dir = makeDir('ub-check-git-');
    try {
      git(dir, ['init', '-q']);
      git(dir, ['config', 'user.email', 'test@example.com']);
      git(dir, ['config', 'user.name', 'Test']);
      writeFileSync(join(dir, '.gitignore'), 'generated/\n');
      mkdirSync(join(dir, 'generated'), { recursive: true });
      mkdirSync(join(dir, 'dist'), { recursive: true });
      mkdirSync(join(dir, 'vendor'), { recursive: true });
      mkdirSync(join(dir, 'src'), { recursive: true });
      mkdirSync(join(dir, 'test'), { recursive: true });
      mkdirSync(join(dir, 'check'), { recursive: true });

      // Poisoned files matching stdlib / check.cli module names must not shadow ub check (-P)
      writeFileSync(join(dir, 'check.py'), 'raise SystemExit(99)\n');
      writeFileSync(join(dir, 'check/cli.py'), 'raise SystemExit(0)\n');
      writeFileSync(join(dir, 'json.py'), 'raise RuntimeError("shadowed json")\n');

      // Gitignored and tracked SKIP_DIRS / minified artifacts must be skipped
      writeFileSync(join(dir, 'generated/bad.js'), 'export const f = () => { try { return 1; } catch { return []; } };\n');
      writeFileSync(join(dir, 'dist/bundle.js'), 'export const d = () => { try { return 1; } catch { return []; } };\n');
      writeFileSync(join(dir, 'vendor/lib.js'), 'export const v = () => { try { return 1; } catch { return []; } };\n');
      writeFileSync(join(dir, 'src/app.min.js'), 'export const m=()=>Promise.resolve().catch(()=>[]);\n');

      // Legacy file with pre-existing violation on line 2
      writeFileSync(
        join(dir, 'src/legacy.js'),
        [
          'export function oldBad() {',
          '  try { return 1; } catch { return []; }',
          '}',
          'export function ok() {',
          '  return 1;',
          '}',
        ].join('\n') + '\n',
      );
      writeFileSync(
        join(dir, 'test/smoke.mjs'),
        "import { test } from 'node:test';\ntest.only('focused', () => { console.log(1); });\n",
      );

      git(dir, ['add', '.gitignore', 'dist/bundle.js', 'vendor/lib.js', 'src/app.min.js', 'src/legacy.js', 'test/smoke.mjs', 'check.py', 'check/cli.py', 'json.py']);
      git(dir, ['commit', '-q', '-m', 'init']);

      // Running from test/ subdirectory still classifies test/smoke.mjs as test via git repo root
      const fromSub = runCheckJson(['.'], join(dir, 'test'));
      assert.equal(fromSub.status, 1);
      assert.equal(fromSub.data.findings[0].rule, 'ub-check(no-skipped-or-empty-test)');

      // Full scan skips dist/, vendor/, generated/, and *.min.js
      const full = runCheckJson([], dir);
      assert.equal(full.status, 1);
      assert.deepEqual(
        full.data.findings.map((f) => f.file),
        ['src/legacy.js', 'test/smoke.mjs'],
      );

      // Clean working tree: --changed says "no changed files to check"
      const emptyChanged = runUb(['check', '--changed'], dir);
      assert.equal(emptyChanged.status, 0);
      assert.match(emptyChanged.stdout, /no changed files to check/);

      // Combining --changed with explicit path exits 64
      const badCombo = runUb(['check', '--changed', 'src'], dir);
      assert.equal(badCombo.status, 64);

      // Editing only clean lines in legacy.js passes --changed (untouched line 2 is ignored)
      writeFileSync(
        join(dir, 'src/legacy.js'),
        [
          'export function oldBad() {',
          '  try { return 1; } catch { return []; }',
          '}',
          'export function ok() {',
          '  return 2;',
          '}',
        ].join('\n') + '\n',
      );
      const cleanEdit = runCheckJson(['--changed'], dir);
      assert.equal(cleanEdit.status, 0);
      assert.equal(cleanEdit.data.ok, true);

      // Introducing a new violation in legacy.js fails --changed on only the new line
      writeFileSync(
        join(dir, 'src/legacy.js'),
        [
          'export function oldBad() {',
          '  try { return 1; } catch { return []; }',
          '}',
          'export function ok() {',
          '  try { return 2; } catch { return {}; }',
          '}',
        ].join('\n') + '\n',
      );
      const dirtyEdit = runCheckJson(['--changed'], dir);
      assert.equal(dirtyEdit.status, 1);
      assert.deepEqual(
        dirtyEdit.data.findings.map((f) => `${f.file}:${f.line}`),
        ['src/legacy.js:5'],
      );

      // Untracked new file is checked in full
      writeFileSync(join(dir, 'src/new.js'), 'export const g = () => { try { return 1; } catch { return {}; } };\n');
      const withUntracked = runCheckJson(['--changed'], dir);
      assert.equal(withUntracked.status, 1);
      assert.ok(withUntracked.data.findings.some((f) => f.file === 'src/new.js'));

      // Syntax error file exits 2 with ok=false
      writeFileSync(join(dir, 'src/broken.py'), 'def oops(:\n    pass\n');
      const syntaxErr = runCheckJson(['src/broken.py'], dir);
      assert.equal(syntaxErr.status, 2);
      assert.equal(syntaxErr.data.ok, false);
      assert.match(syntaxErr.data.error, /syntax error/);

      // Missing path exits 2 with ok=false
      const missing = runCheckJson(['does-not-exist.py'], dir);
      assert.equal(missing.status, 2);
      assert.equal(missing.data.ok, false);
      assert.ok(missing.data.error.includes('path not found'));

      // Check bytecode was not written into the skill repo
      assert.equal(existsSync(join(REPO_ROOT, 'skills/ub-mode/check/__pycache__')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('scripts/ub: Python .venv preflight', () => {
  it('checks Python targets even without pyproject.toml, skips non-Python targets in mixed repos, and handles --use-existing-coverage', () => {
    const dir = makeDir('ub-preflight-');
    try {
      // Script-only repo with no pyproject.toml (like storyforge)
      mkdirSync(join(dir, 'scripts'), { recursive: true });
      writeFileSync(join(dir, 'scripts/fx_catalog.py'), 'def f():\n    return 1\n');

      const scriptFile = runUb(['crapper', 'scripts/fx_catalog.py'], dir);
      assert.equal(scriptFile.status, 2);
      assert.match(scriptFile.stderr, /uv venv && uv pip install --python \.venv\/bin\/python coverage pytest/);

      const scriptDir = runUb(['crapper', 'scripts'], dir);
      assert.equal(scriptDir.status, 2);

      const defaultRoot = runUb(['crapper'], dir);
      assert.equal(defaultRoot.status, 2);

      // Now turn into a mixed repo with pyproject.toml + TypeScript file
      writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "demo"\n[tool.pytest.ini_options]\n');
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src/a.ts'), 'export const x = 1;\n');

      // Explicit non-Python file target must NOT be blocked by Python .venv preflight
      const tsOnly = runUb(['crapper', '--no-coverage', 'src/a.ts'], dir);
      assert.equal(tsOnly.status, 0);
      const tsWithCov = runUb(['crapper', 'src/a.ts'], dir);
      assert.notEqual(tsWithCov.status, 2, 'non-.py target must bypass Python .venv preflight');

      // Python target with pyproject.toml gives -e . hint
      const noVenvCrap = runUb(['crapper', 'scripts/fx_catalog.py'], dir);
      assert.equal(noVenvCrap.status, 2);
      assert.match(noVenvCrap.stderr, /uv venv && uv pip install -e \. coverage pytest/);

      const noVenvMut = runUb(['mutator', 'scripts/fx_catalog.py'], dir);
      assert.equal(noVenvMut.status, 2);
      assert.match(noVenvMut.stderr, /requires \.venv/);

      // --help bypasses preflight
      const help = runUb(['crapper', '--help'], dir);
      assert.equal(help.status, 0);

      // Fake .venv/bin/python missing coverage and pytest
      mkdirSync(join(dir, '.venv/bin'), { recursive: true });
      const fakePy = join(dir, '.venv/bin/python');
      writeFileSync(fakePy, '#!/bin/sh\nexit 1\n');
      chmodSync(fakePy, 0o755);

      const noCov = runUb(['crapper', 'scripts/fx_catalog.py'], dir);
      assert.equal(noCov.status, 2);
      assert.match(noCov.stderr, /missing 'coverage'/);

      const noCovMut = runUb(['mutator', 'scripts/fx_catalog.py'], dir);
      assert.equal(noCovMut.status, 2);
      assert.match(noCovMut.stderr, /missing 'coverage'/);

      // mutator --use-existing-coverage skips coverage check and checks pytest instead
      const existingCovMut = runUb(['mutator', '--use-existing-coverage', 'scripts/fx_catalog.py'], dir);
      assert.equal(existingCovMut.status, 2);
      assert.match(existingCovMut.stderr, /missing 'pytest'/);

      const noPytest = runUb(['mutator', '--no-coverage', 'scripts/fx_catalog.py'], dir);
      assert.equal(noPytest.status, 2);
      assert.match(noPytest.stderr, /missing 'pytest'/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
