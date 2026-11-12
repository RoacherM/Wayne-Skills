import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_REVIEW_SH = join(REPO_ROOT, 'skills/vibe-coding/scripts/review.sh');
const ENTRY_TEMPLATE_SH = join(REPO_ROOT, 'skills/vibe-coding/scripts/review-entry.sh');
const HOOKS_DIR = join(REPO_ROOT, 'skills/vibe-coding/scripts/hooks');

function run(cmd, args, cwd, envExtra = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test Author',
      GIT_AUTHOR_EMAIL: 'author@example.com',
      GIT_COMMITTER_NAME: 'Test Author',
      GIT_COMMITTER_EMAIL: 'author@example.com',
      VIBE_REVIEW_SH: GLOBAL_REVIEW_SH,
      REVIEW_POLL_INTERVAL: '1',
      ...envExtra,
    },
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function git(cwd, ...args) {
  const res = run('git', args, cwd);
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function createTempRepo(configOverride = null) {
  const dir = mkdtempSync(join(tmpdir(), 'vibe-review-test-'));
  git(dir, 'init', '-b', 'main');
  mkdirSync(join(dir, 'src/ui'), { recursive: true });
  mkdirSync(join(dir, 'src/auth'), { recursive: true });
  mkdirSync(join(dir, 'src/core'), { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, '.githooks'), { recursive: true });

  cpSync(ENTRY_TEMPLATE_SH, join(dir, 'scripts/review.sh'));
  chmodSync(join(dir, 'scripts/review.sh'), 0o755);
  cpSync(join(HOOKS_DIR, 'pre-commit'), join(dir, '.githooks/pre-commit'));
  cpSync(join(HOOKS_DIR, 'pre-merge-commit'), join(dir, '.githooks/pre-merge-commit'));
  chmodSync(join(dir, '.githooks/pre-commit'), 0o755);
  chmodSync(join(dir, '.githooks/pre-merge-commit'), 0o755);

  writeFileSync(join(dir, '.gitignore'), '.local/\n');
  writeFileSync(join(dir, 'AGENTS.md'), '# Test Repo\n');
  writeFileSync(join(dir, 'src/ui/view.js'), 'export const view = () => "v1";\n');
  writeFileSync(join(dir, 'src/core/engine.js'), 'export const engine = () => 1;\n');
  writeFileSync(join(dir, 'src/auth/token.js'), 'export const verifyToken = (t) => Boolean(t);\n');
  writeFileSync(join(dir, 'test/basic.test.js'), '// initial test\n');
  writeFileSync(join(dir, 'config.prod.env'), 'PORT=8080\n');

  const cfg = configOverride ?? {
    precheck: 'test -f src/core/engine.js',
    highRisk: ['src/auth/**'],
    shards: {
      ui: ['src/ui/**'],
      core: ['src/core/**'],
    },
    reviewDir: '.local/reviews',
    issueFile: 'docs/issues/INDEX.md',
    redactFiles: ['config*.env'],
    models: {
      carbon: 'gemini-4-carbon-high',
      argon: 'gemini-4-argon-high',
    },
  };
  if (cfg !== false) {
    writeFileSync(join(dir, '.review.json'), JSON.stringify(cfg, null, 2) + '\n');
  }

  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'chore: initial commit');
  git(dir, 'config', 'core.hooksPath', '.githooks');
  return dir;
}

function makeFakeAgy(binDir, name, body) {
  mkdirSync(binDir, { recursive: true });
  const p = join(binDir, name);
  writeFileSync(p, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

describe('unified review.sh and git gate hooks', () => {
  it('1. rejects unreviewed feature branch at merge gate (and direct code commit on main)', () => {
    const repo = createTempRepo();
    try {
      // Direct code commit on main is blocked by pre-commit hook
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "direct";\n');
      run('git', ['add', 'src/ui/view.js'], repo);
      const directCommit = run('git', ['commit', '-m', 'feat: direct on main'], repo);
      assert.notEqual(directCommit.status, 0);
      assert.match(directCommit.stderr, /\[pre-commit\] refusing direct commit/);
      git(repo, 'reset', '--hard', 'HEAD');

      // Feature branch with precheck only (no review verified.sha) is rejected on conflict-free merge --no-ff
      git(repo, 'switch', '-c', 'feat/unreviewed');
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "v2";\n');
      writeFileSync(join(repo, 'test/basic.test.js'), '// updated test\n');
      git(repo, 'add', 'src/ui/view.js', 'test/basic.test.js');
      git(repo, 'commit', '-m', 'feat: add v2 view');

      const pre = run('bash', ['scripts/review.sh', 'precheck', 'feat-1', 'main', 'HEAD'], repo);
      assert.equal(pre.status, 0, pre.stderr);

      git(repo, 'switch', 'main');
      const merge = run('git', ['merge', '--no-ff', 'feat/unreviewed', '-m', 'Merge feat/unreviewed'], repo);
      assert.notEqual(merge.status, 0);
      assert.match(merge.stderr, /\[merge-gate\] refusing to merge unreviewed commit/);
      run('git', ['merge', '--abort'], repo);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('2. allows bug fix with regression test and no high-risk path (and rejects --fix without test)', () => {
    const repo = createTempRepo();
    try {
      // --fix without test change is rejected
      git(repo, 'switch', '-c', 'fix/no-test');
      writeFileSync(join(repo, 'src/core/engine.js'), 'export const engine = () => 2;\n');
      git(repo, 'add', 'src/core/engine.js');
      git(repo, 'commit', '-m', 'fix: engine off-by-one without test');

      const noTestFix = run('bash', ['scripts/review.sh', 'precheck', '--fix', 'fix-bad', 'main', 'HEAD'], repo);
      assert.equal(noTestFix.status, 2);
      assert.match(noTestFix.stderr, /--fix requires regression test changes/);

      // --fix with test change and no high-risk path passes gate without calling review models
      git(repo, 'switch', '-c', 'fix/with-test', 'main');
      writeFileSync(join(repo, 'src/core/engine.js'), 'export const engine = () => 2;\n');
      writeFileSync(join(repo, 'test/basic.test.js'), '// regression test for engine=2\n');
      git(repo, 'add', 'src/core/engine.js', 'test/basic.test.js');
      git(repo, 'commit', '-m', 'fix: engine off-by-one with repro test');

      const okFix = run('bash', ['scripts/review.sh', 'precheck', '--fix', 'fix-ok', 'main', 'HEAD'], repo);
      assert.equal(okFix.status, 0, okFix.stderr);
      assert.ok(existsSync(join(repo, '.local/reviews/fix-ok/fix.sha')));
      assert.ok(!existsSync(join(repo, '.local/reviews/fix-ok/verified.sha')));

      git(repo, 'switch', 'main');
      const merge = run('git', ['merge', '--no-ff', 'fix/with-test', '-m', 'Merge fix/with-test'], repo);
      assert.equal(merge.status, 0, merge.stderr);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('3. rejects bug fix touching high-risk path at both precheck --fix and merge gate', () => {
    const repo = createTempRepo();
    try {
      git(repo, 'switch', '-c', 'fix/high-risk');
      writeFileSync(join(repo, 'src/auth/token.js'), 'export const verifyToken = (t) => t === "ok";\n');
      writeFileSync(join(repo, 'test/basic.test.js'), '// auth regression test\n');
      git(repo, 'add', 'src/auth/token.js', 'test/basic.test.js');
      git(repo, 'commit', '-m', 'fix: tighten token check');
      const headSha = git(repo, 'rev-parse', 'HEAD');

      const preFix = run('bash', ['scripts/review.sh', 'precheck', '--fix', 'fix-hr', 'main', 'HEAD'], repo);
      assert.equal(preFix.status, 2);
      assert.match(preFix.stderr, /high-risk path 'src\/auth\/token\.js'/);

      // Even if regular precheck passes and fix.sha is manually forged, merge gate still blocks without verified.sha
      const pre = run('bash', ['scripts/review.sh', 'precheck', 'fix-hr', 'main', 'HEAD'], repo);
      assert.equal(pre.status, 0, pre.stderr);
      writeFileSync(join(repo, '.local/reviews/fix-hr/fix.sha'), `${headSha}\n`);

      git(repo, 'switch', 'main');
      const merge = run('git', ['merge', '--no-ff', 'fix/high-risk', '-m', 'Merge high-risk fix'], repo);
      assert.notEqual(merge.status, 0);
      assert.match(merge.stderr, /high-risk path 'src\/auth\/token\.js' requires review verified\.sha/);
      run('git', ['merge', '--abort'], repo);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('4. splits diffs over 2000 lines into configured shards instead of rejecting', () => {
    const repo = createTempRepo();
    const binDir = mkdtempSync(join(tmpdir(), 'vibe-agy-bin-'));
    try {
      const fakeAgy = makeFakeAgy(
        binDir,
        'agy',
        `
model=""; prompt=""; ptimeout=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --model) model=$2; shift 2 ;;
    --print-timeout) ptimeout=$2; shift 2 ;;
    -p) prompt=$2; shift 2 ;;
    *) shift ;;
  esac
done
[[ $ptimeout == "1800s" ]] || { echo "expected 1800s, got $ptimeout" >&2; exit 2; }
[[ $prompt != *"notes-"* ]] || { echo "prompt must not ask for redundant notes file" >&2; exit 2; }
key=$(printf '%s' "$prompt" | sed -n 's/.*reviewer \\[\\([^]]*\\)\\].*/\\1/p')
dir=$(printf '%s' "$prompt" | sed -n 's/.*Read \\([^ ]*\\)\\/pack\\.md.*/\\1/p')
cat > "$dir/review-$key.md" <<'EOF'
可接受
COUNTS: P0=0 P1=0 P2=0 P3=0
无阻塞问题。
EOF
`,
      );

      git(repo, 'switch', '-c', 'feat/large');
      const bigUi = Array.from({ length: 1100 }, (_, i) => `export const ui_${i} = ${i};`).join('\n') + '\n';
      const bigCore = Array.from({ length: 1100 }, (_, i) => `export const core_${i} = ${i};`).join('\n') + '\n';
      writeFileSync(join(repo, 'src/ui/view.js'), bigUi);
      writeFileSync(join(repo, 'src/core/engine.js'), bigCore);
      git(repo, 'add', 'src/ui/view.js', 'src/core/engine.js');
      git(repo, 'commit', '-m', 'feat: 2200-line multi-subsystem feature');
      const bigSha = git(repo, 'rev-parse', 'HEAD');

      const pre = run('bash', ['scripts/review.sh', 'precheck', 'big-1', 'main', 'HEAD'], repo);
      assert.equal(pre.status, 0, pre.stderr);
      const shardsTxt = readFileSync(join(repo, '.local/reviews/big-1/shards.txt'), 'utf8').trim().split('\n');
      assert.deepEqual(shardsTxt, ['ui', 'core']);
      assert.ok(existsSync(join(repo, '.local/reviews/big-1/shards/ui.patch')));
      assert.ok(existsSync(join(repo, '.local/reviews/big-1/shards/core.patch')));

      const env = { REVIEW_AGY_BIN: fakeAgy };
      assert.equal(run('bash', ['scripts/review.sh', 'start', 'big-1', 'HEAD'], repo, env).status, 0);
      assert.equal(run('bash', ['scripts/review.sh', 'wait', 'big-1', '20'], repo, env).status, 0);
      assert.equal(run('bash', ['scripts/review.sh', 'verify', 'big-1', 'HEAD'], repo, env).status, 0);

      for (const k of ['ui-carbon', 'ui-argon', 'core-carbon', 'core-argon']) {
        assert.ok(existsSync(join(repo, `.local/reviews/big-1/review-${k}.md`)), `missing report for ${k}`);
      }
      assert.equal(readFileSync(join(repo, '.local/reviews/big-1/verified.sha'), 'utf8').trim(), bigSha);

      git(repo, 'switch', 'main');
      assert.equal(run('git', ['merge', '--no-ff', 'feat/large', '-m', 'Merge large feature'], repo).status, 0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('5. falls back to surviving peer report when one reviewer times out', () => {
    const repo = createTempRepo();
    const binDir = mkdtempSync(join(tmpdir(), 'vibe-agy-tmo-'));
    try {
      const fakeAgy = makeFakeAgy(
        binDir,
        'agy',
        `
model=""; prompt=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --model) model=$2; shift 2 ;;
    -p) prompt=$2; shift 2 ;;
    *) shift ;;
  esac
done
dir=$(printf '%s' "$prompt" | sed -n 's/.*Read \\([^ ]*\\)\\/pack\\.md.*/\\1/p')
if [[ $model == *carbon* ]]; then
  exec sleep 60
fi
cat > "$dir/review-argon.md" <<'EOF'
可接受
COUNTS: P0=0 P1=0 P2=1 P3=0
- [P2-1] non-blocking cleanup recorded in docs/issues/INDEX.md
EOF
`,
      );

      git(repo, 'switch', '-c', 'feat/timeout-peer');
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "peer-ok";\n');
      git(repo, 'add', 'src/ui/view.js');
      git(repo, 'commit', '-m', 'feat: peer fallback check');
      const sha = git(repo, 'rev-parse', 'HEAD');

      const env = { REVIEW_AGY_BIN: fakeAgy };
      assert.equal(run('bash', ['scripts/review.sh', 'precheck', 'tmo-1', 'main', 'HEAD'], repo, env).status, 0);
      assert.equal(run('bash', ['scripts/review.sh', 'start', 'tmo-1', 'HEAD'], repo, env).status, 0);
      const w = run('bash', ['scripts/review.sh', 'wait', 'tmo-1', '1'], repo, env);
      assert.equal(w.status, 0, w.stderr);
      assert.match(w.stderr, /surviving peer report/);

      const v = run('bash', ['scripts/review.sh', 'verify', 'tmo-1', 'HEAD'], repo, env);
      assert.equal(v.status, 0, v.stderr);
      assert.equal(readFileSync(join(repo, '.local/reviews/tmo-1/verified.sha'), 'utf8').trim(), sha);

      git(repo, 'switch', 'main');
      assert.equal(run('git', ['merge', '--no-ff', 'feat/timeout-peer', '-m', 'Merge after peer fallback'], repo).status, 0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('6. runs only the single specified model during post-fix confirm', () => {
    const repo = createTempRepo();
    const binDir = mkdtempSync(join(tmpdir(), 'vibe-agy-cfm-'));
    try {
      const logCalls = join(binDir, 'calls.log');
      const fakeAgy = makeFakeAgy(
        binDir,
        'agy',
        `
model=""; prompt=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --model) model=$2; shift 2 ;;
    -p) prompt=$2; shift 2 ;;
    *) shift ;;
  esac
done
echo "$model" >> "${logCalls}"
[[ $model == "gemini-4-carbon-high" ]] || { echo "unexpected model $model" >&2; exit 2; }
[[ $prompt == *"unified rule 7"* && $prompt == *"touched-files.txt"* ]] || { echo "missing rule 7 scope" >&2; exit 2; }
dir=$(printf '%s' "$prompt" | sed -n 's/.*Read \\([^ ]*\\)\\/pack\\.md.*/\\1/p')
cat > "$dir/review-carbon.md" <<'EOF'
可接受
COUNTS: P0=0 P1=0 P2=0 P3=0
阻塞问题已修复，相邻代码未受影响。
EOF
`,
      );

      git(repo, 'switch', '-c', 'feat/confirm-only-one');
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "r1-ui";\n');
      writeFileSync(join(repo, 'src/core/engine.js'), 'export const engine = () => 10;\n');
      git(repo, 'add', 'src/ui/view.js', 'src/core/engine.js');
      git(repo, 'commit', '-m', 'feat: round 1 touching two files');
      const r1Sha = git(repo, 'rev-parse', 'HEAD');

      // Round 2 fixes only src/ui/view.js
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "r2-ui-fixed";\n');
      git(repo, 'add', 'src/ui/view.js');
      git(repo, 'commit', '-m', 'fix: address carbon blocker in view.js');
      const r2Sha = git(repo, 'rev-parse', 'HEAD');

      const env = { REVIEW_AGY_BIN: fakeAgy };
      assert.equal(run('bash', ['scripts/review.sh', 'precheck', 'cfm-1', r1Sha, r2Sha], repo, env).status, 0);
      const c = run('bash', ['scripts/review.sh', 'confirm', 'cfm-1', 'carbon', r1Sha, r2Sha, 'fix null guard'], repo, env);
      assert.equal(c.status, 0, c.stderr);
      assert.equal(readFileSync(join(repo, '.local/reviews/cfm-1/slots.txt'), 'utf8').trim(), 'carbon');
      assert.equal(readFileSync(join(repo, '.local/reviews/cfm-1/touched-files.txt'), 'utf8').trim(), 'src/ui/view.js');
      assert.ok(!existsSync(join(repo, '.local/reviews/cfm-1/pid-argon')));

      assert.equal(run('bash', ['scripts/review.sh', 'wait', 'cfm-1', '20'], repo, env).status, 0);
      assert.equal(run('bash', ['scripts/review.sh', 'verify', 'cfm-1', r2Sha], repo, env).status, 0);
      assert.deepEqual(readFileSync(logCalls, 'utf8').trim().split('\n'), ['gemini-4-carbon-high']);
      assert.equal(readFileSync(join(repo, '.local/reviews/cfm-1/verified.sha'), 'utf8').trim(), r2Sha);

      git(repo, 'switch', 'main');
      assert.equal(run('git', ['merge', '--no-ff', 'feat/confirm-only-one', '-m', 'Merge confirmed feature'], repo).status, 0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('7. reports clear errors when .review.json or the global runner is missing', () => {
    const repo = createTempRepo(false);
    try {
      const missingCfg = run('bash', ['scripts/review.sh', 'precheck', 'no-cfg', 'HEAD', 'HEAD'], repo);
      assert.equal(missingCfg.status, 1);
      assert.match(missingCfg.stderr, /missing review config '.*\.review\.json'/);
      assert.match(missingCfg.stderr, /review\.config\.example\.json/);

      const missingRunner = run('bash', ['scripts/review.sh', 'precheck', 'no-runner', 'HEAD', 'HEAD'], repo, {
        VIBE_REVIEW_SH: join(repo, 'nonexistent-global-review.sh'),
      });
      assert.equal(missingRunner.status, 1);
      assert.match(missingRunner.stderr, /global unified review runner not found/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('8. blocks unredacted credentials without echoing secrets, while redacting configured redactFiles', () => {
    const repo = createTempRepo();
    try {
      const fakeToken = ['sk', 'proj', 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6'].join('-');

      // 8a. Unredacted credential in code file is blocked and never echoed in output
      git(repo, 'switch', '-c', 'feat/leaked-secret');
      writeFileSync(join(repo, 'src/core/engine.js'), `export const key = "${fakeToken}";\n`);
      git(repo, 'add', 'src/core/engine.js');
      git(repo, 'commit', '-m', 'feat: accidental hardcoded credential');

      const blocked = run('bash', ['scripts/review.sh', 'precheck', 'cred-1', 'main', 'HEAD'], repo);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /credential guard blocked diff\.patch/);
      assert.ok(!blocked.stderr.includes(fakeToken), 'stderr must never print the secret value');
      assert.ok(!blocked.stdout.includes(fakeToken), 'stdout must never print the secret value');
      assert.ok(!existsSync(join(repo, '.local/reviews/cred-1/diff.patch')));

      // 8b. File matching redactFiles has values masked to <REDACTED> in snapshot and diff.patch
      git(repo, 'switch', '-c', 'feat/redacted-env', 'main');
      writeFileSync(join(repo, 'config.prod.env'), `PORT=8080\nOPENAI_API_KEY=${fakeToken}\n`);
      writeFileSync(join(repo, 'src/ui/view.js'), 'export const view = () => "clean";\n');
      git(repo, 'add', 'config.prod.env', 'src/ui/view.js');
      git(repo, 'commit', '-m', 'feat: update env and view');

      const ok = run('bash', ['scripts/review.sh', 'precheck', 'cred-redacted', 'main', 'HEAD'], repo);
      assert.equal(ok.status, 0, ok.stderr);
      const patch = readFileSync(join(repo, '.local/reviews/cred-redacted/diff.patch'), 'utf8');
      const snapEnv = readFileSync(join(repo, '.local/reviews/cred-redacted/repo/config.prod.env'), 'utf8');
      assert.ok(!existsSync(join(repo, '.local/reviews/cred-redacted/before')), 'must not export redundant full before/ snapshot');
      assert.ok(!patch.includes(fakeToken), 'diff.patch must not contain raw secret from redactFiles');
      assert.ok(!snapEnv.includes(fakeToken), 'frozen snapshot must not contain raw secret from redactFiles');
      assert.match(patch, /OPENAI_API_KEY=<REDACTED>/);
      assert.match(snapEnv, /OPENAI_API_KEY=<REDACTED>/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
