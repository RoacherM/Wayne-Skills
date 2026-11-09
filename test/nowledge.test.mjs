import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const CAPTURE = join(REPO, 'skills/nowledge-mem/scripts/capture.sh');
const APPLY = join(REPO, 'global/nowledge/apply.sh');
const SOURCES = ['claude-code', 'codex', 'pi', 'grok', 'devin', 'antigravity'];

const fresh = () => mkdtempSync(join(tmpdir(), 'nowledge-'));

const fake = (dir, name, body) => {
  const p = join(dir, 'bin', name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
};

const FAKE_NMEM = `echo "nmem $*" >> "$CALL_LOG"
[ -n "\${FAIL_SRC:-}" ] && [ "$4" = "$FAIL_SRC" ] && { echo "boom: $4" >&2; exit 1; }
exit 0`;

const FAKE_UV = `echo "uv $*" >> "$CALL_LOG"
cat > "$(dirname "$0")/nmem" <<'EOS'
#!/bin/sh
echo "nmem $*" >> "$CALL_LOG"
exit 0
EOS
chmod +x "$(dirname "$0")/nmem"`;

const FAKE_LAUNCHCTL = `echo "launchctl $*" >> "$CALL_LOG"
exit 0`;

const rig = (dir) => {
  mkdirSync(join(dir, 'bin'), { recursive: true });
  mkdirSync(join(dir, 'home'), { recursive: true });
  return {
    PATH: `${join(dir, 'bin')}:/usr/bin:/bin`,
    HOME: join(dir, 'home'),
    CALL_LOG: join(dir, 'calls.log'),
    NMEM_APP_DIRS: join(dir, 'no-such-app'),
  };
};

const run = (script, env, args = []) =>
  spawnSync('/bin/bash', [script, ...args], { env, encoding: 'utf8' });

const calls = (dir) =>
  (existsSync(join(dir, 'calls.log')) ? readFileSync(join(dir, 'calls.log'), 'utf8') : '')
    .trim().split('\n').filter(Boolean);

test('capture.sh syncs all 6 sources with the exact apply command', () => {
  const dir = fresh();
  const env = rig(dir);
  fake(dir, 'nmem', FAKE_NMEM);

  const r = run(CAPTURE, env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(
    calls(dir),
    SOURCES.map((s) => `nmem t sync --from ${s} --all-projects --limit 20 --apply`),
  );
});

test('capture.sh keeps going when a source fails and still exits 0', () => {
  const dir = fresh();
  const env = { ...rig(dir), FAIL_SRC: 'codex' };
  fake(dir, 'nmem', FAKE_NMEM);

  const r = run(CAPTURE, env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(calls(dir).length, SOURCES.length);
  assert.match(r.stdout, /codex/);
  assert.match(r.stdout, /devin/);
});

test('capture.sh exits 0 and logs a line when nmem is not on PATH', () => {
  const dir = fresh();
  const env = rig(dir);
  const r = run(CAPTURE, env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nmem/);
});

test('apply.sh uses an existing nmem and never calls uv', () => {
  const dir = fresh();
  const env = rig(dir);
  fake(dir, 'nmem', FAKE_NMEM);
  fake(dir, 'uv', FAKE_UV);
  fake(dir, 'launchctl', FAKE_LAUNCHCTL);

  const r = run(APPLY, env);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!calls(dir).some((c) => c.startsWith('uv ')), calls(dir));
  assert.ok(
    existsSync(join(env.HOME, 'Library/LaunchAgents/com.wayne.nmem-capture.plist')),
  );
  assert.ok(calls(dir).some((c) => c.startsWith('launchctl bootstrap ')), calls(dir));
});

test('apply.sh stops with the bundled-CLI hint when nmem is missing but the app exists', () => {
  const dir = fresh();
  const app = join(dir, 'Nowledge Mem.app');
  mkdirSync(app, { recursive: true });
  const env = { ...rig(dir), NMEM_APP_DIRS: app };
  fake(dir, 'uv', FAKE_UV);
  fake(dir, 'launchctl', FAKE_LAUNCHCTL);

  const r = run(APPLY, env);
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Install bundled CLI/);
  assert.ok(!calls(dir).some((c) => c.startsWith('uv ')), calls(dir));
});

test('apply.sh installs nmem-cli via uv when neither nmem nor the app exists', () => {
  const dir = fresh();
  const env = rig(dir);
  fake(dir, 'uv', FAKE_UV);
  fake(dir, 'launchctl', FAKE_LAUNCHCTL);

  const r = run(APPLY, env);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    calls(dir).includes('uv tool install nmem-cli==0.10.112'),
    calls(dir),
  );
});
