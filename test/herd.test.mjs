import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(REPO_ROOT, 'skills/herd/bin');

function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of [
    'HERD_BOARD_HOST',
    'HERD_ROOT',
    'HERD_REMOTE_BIN',
    'HERD_INTERVAL',
    'HERD_DENY_PANES',
    'HERD_QUOTA_RE',
    'HERD_LANG',
    'HERD_BACKEND',
    'HERD_HC_BIN',
    'HERD_HERDR_BIN',
    'HERD_COORD_MODE',
    'HERD_NOTIFY_CMD',
    'HERD_PING_CMD',
    'HERD_PING_EXPECT',
    'HERD_PING_TIMEOUT',
    'HERD_PING_CWD',
    'HERD_PING_WORKERS',
    'HERD_DEFAULT_CLI',
    'HERD_RUN_DIR',
    'HC_TERMINAL_ID',
    'HERDR_ENV',
    'HERDR_BIN_PATH',
  ]) {
    delete env[key];
  }
  return { ...env, ...extra };
}

function runBin(cmd, args, { env = {}, input } = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    input,
    env: cleanEnv(env),
  });
}

function spawnAsync(cmd, args, env) {
  return new Promise((resolveDone, reject) => {
    const child = spawn(cmd, args, { env: cleanEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolveDone({ status, stdout, stderr }));
  });
}

function writeExecutable(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
  chmodSync(filePath, 0o755);
}

describe('herd board: herd-post & herd-read (fcntl.flock, zero external flock)', () => {
  it('serializes concurrent posts into contiguous seqs, supports bare names, --since, stdin, and missing board', async () => {
    const dir = makeTempDir('herd-board-');
    try {
      const env = { HERD_ROOT: join(dir, 'herd') };
      const projectDir = join(dir, 'herd/demo');

      const results = await Promise.all(
        [1, 2, 3, 4, 5].map((i) => spawnAsync(join(BIN, 'herd-post'), [projectDir, `w${i}`, `post ${i}`], env)),
      );
      for (const r of results) {
        assert.equal(r.status, 0, r.stderr);
      }

      const readAll = runBin(join(BIN, 'herd-read'), [projectDir, '--json'], { env });
      assert.equal(readAll.status, 0, readAll.stderr);
      const seqs = readAll.stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line).seq)
        .sort((a, b) => a - b);
      assert.deepEqual(seqs, [1, 2, 3, 4, 5]);

      const postBare = runBin(join(BIN, 'herd-post'), ['demo', 'coordinator', '@builder start, see BRIEF'], { env });
      assert.equal(postBare.status, 0, postBare.stderr);
      assert.equal(postBare.stdout.trim(), '6');

      const since5 = runBin(join(BIN, 'herd-read'), ['demo', '--since', '5'], { env });
      assert.equal(since5.status, 0);
      assert.equal(since5.stdout.trim().split('\n').length, 1);
      assert.match(since5.stdout, /^#6 \d{4}-\d{2}-\d{2}T.* coordinator: @builder start, see BRIEF/);

      const special = 'quote " dollar $HOME\nsecond line';
      const postStdin = runBin(join(BIN, 'herd-post'), ['demo', 'builder', '-'], { env, input: special });
      assert.equal(postStdin.status, 0, postStdin.stderr);
      assert.equal(postStdin.stdout.trim(), '7');

      const read7 = runBin(join(BIN, 'herd-read'), ['demo', '--since', '6', '--json'], { env });
      assert.equal(read7.status, 0);
      assert.equal(JSON.parse(read7.stdout.trim()).text, special);

      const missing = runBin(join(BIN, 'herd-read'), [join(dir, 'none')], { env });
      assert.equal(missing.status, 0);
      assert.equal(missing.stdout, '');

      const emptyText = runBin(join(BIN, 'herd-post'), ['demo', 'builder', '-'], { env, input: '' });
      assert.equal(emptyText.status, 2);

      const badSince = runBin(join(BIN, 'herd-read'), ['demo', '--since', 'abc'], { env });
      assert.equal(badSince.status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('herd-preflight: all 7 local CLIs, model routing, and error classification', () => {
  it('discovers and pings all 7 CLIs with --all and forwards per-CLI model flags for <cli>:<model>', () => {
    const dir = makeTempDir('herd-preflight-');
    try {
      const fakeBin = join(dir, 'fake-bin');
      mkdirSync(fakeBin, { recursive: true });
      const logFile = join(dir, 'invocations.log');
      const clis = ['agy', 'claude', 'codex', 'pi', 'epi', 'droid', 'grok'];
      for (const cli of clis) {
        writeExecutable(
          join(fakeBin, cli),
          `#!/usr/bin/env bash\necho "${cli} $*" >> "${logFile}"\necho "pong"\n`,
        );
      }

      const env = { PATH: `${fakeBin}:${process.env.PATH}` };
      const allRun = runBin(join(BIN, 'herd-preflight'), ['local', '--all'], { env });
      assert.equal(allRun.status, 0, allRun.stderr);
      const lines = allRun.stdout.trim().split('\n');
      assert.deepEqual(
        lines.map((l) => l.trim().split(/\s+/)),
        clis.map((cli) => [cli, 'ok']),
      );

      writeFileSync(logFile, '');
      const modelRun = runBin(
        join(BIN, 'herd-preflight'),
        [
          'local',
          'agy:gemini-4-carbon-high',
          'claude:sonnet',
          'codex:gpt-5.4',
          'pi:anthropic/sonnet',
          'epi:deepseek/deepseek-flash',
          'droid:claude-opus-5-5',
          'grok:grok-4',
        ],
        { env },
      );
      assert.equal(modelRun.status, 0, modelRun.stderr);
      const logged = readFileSync(logFile, 'utf8');
      assert.match(logged, /agy -p Reply with exactly: pong --model gemini-4-carbon-high --disable-slash-commands --dangerously-skip-permissions/);
      assert.match(logged, /claude -p Reply with exactly: pong --model sonnet --no-session-persistence/);
      assert.match(logged, /codex exec --ephemeral --skip-git-repo-check -m gpt-5\.4 Reply with exactly: pong/);
      assert.match(logged, /pi -p --no-session --no-tools --model anthropic\/sonnet Reply with exactly: pong/);
      assert.match(logged, /epi -p --no-session --no-tools --no-project --model deepseek\/deepseek-flash Reply with exactly: pong/);
      assert.match(logged, /droid exec --disable-builtin-skills -m claude-opus-5-5 Reply with exactly: pong/);
      assert.match(logged, /grok -p Reply with exactly: pong -m grok-4/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies ok, quota, no-capacity (503), timeout, missing, and error without requiring GNU timeout', () => {
    const dir = makeTempDir('herd-preflight-cls-');
    try {
      const fakeCli = join(dir, 'fakecli');
      writeExecutable(
        fakeCli,
        [
          '#!/usr/bin/env bash',
          'case "$1" in',
          '  good) echo "pong" ;;',
          '  spent) echo "RESOURCE_EXHAUSTED: quota reached"; exit 1 ;;',
          '  factory402) echo "API Error: 402 Factory: You\'ve reached your monthly standard usage limit (resets in 7h)."; exit 1 ;;',
          '  busy) echo "503 No capacity"; exit 1 ;;',
          '  slow) sleep 5 ;;',
          '  *) echo "unknown model"; exit 3 ;;',
          'esac',
        ].join('\n') + '\n',
      );

      const env = { HERD_PING_CMD: `${fakeCli} {model}`, HERD_PING_TIMEOUT: '1', HERD_PING_WORKERS: '4' };
      const res = runBin(join(BIN, 'herd-preflight'), ['local', 'good', 'spent', 'factory402', 'busy', 'slow', 'other'], { env });
      assert.equal(res.status, 1);
      const rows = res.stdout.trim().split('\n');
      assert.deepEqual(
        rows.slice(0, 5).map((line) => line.trim().split(/\s+/).slice(0, 2)),
        [
          ['good', 'ok'],
          ['spent', 'quota'],
          ['factory402', 'quota'],
          ['busy', 'no-capacity'],
          ['slow', 'timeout'],
        ],
      );
      assert.match(rows[5], /^other\s+error\(rc=3\): unknown model/);

      const allGood = runBin(join(BIN, 'herd-preflight'), ['local', 'good'], { env });
      assert.equal(allGood.status, 0);

      const missingRes = runBin(join(BIN, 'herd-preflight'), ['local', 'x'], {
        env: { HERD_PING_CMD: `${join(dir, 'does-not-exist')} {model}` },
      });
      assert.equal(missingRes.status, 1);
      assert.match(missingRes.stdout, /^x\s+missing$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('herd-watchd.py: hc backend (Herdr.app) with safe notify mode and rework-aware stall tracking', () => {
  it('routes @mentions, respects blocked deferral, never hc-sends interactive coordinator, resets [done] on rework, and detects quota', () => {
    const dir = makeTempDir('herd-watch-hc-');
    try {
      const stubHc = join(dir, 'hc');
      const callsLog = join(dir, 'hc-calls.log');
      const notifyLog = join(dir, 'notify.log');
      writeExecutable(
        stubHc,
        [
          '#!/usr/bin/env bash',
          `echo "$*" >> "${callsLog}"`,
          'cmd=$1; shift',
          'case "$cmd" in',
          '  get)',
          '    [ "$1" = --json ] && shift',
          '    target=$1',
          '    safe=${target//\\//_}',
          `    if [ "$target" = "ghost" ]; then echo '{"error":{"kind":"not_found"}}'; exit 3; fi`,
          `    if [ "$target" = "dead" ]; then echo '{"address":"dead","state":"exited","status":null}'; exit 0; fi`,
          `    if [ -f "${dir}/blocked-$safe" ]; then st=blocked; else st=idle; fi`,
          '    echo "{\\"address\\":\\"$target\\",\\"state\\":\\"live\\",\\"status\\":{\\"app\\":\\"claude\\",\\"state\\":\\"$st\\"}}"',
          '    ;;',
          '  send)',
          `    echo "SEND_HC_TID=\${HC_TERMINAL_ID:-<unset>}" >> "${callsLog}"`,
          '    exit 0',
          '    ;;',
          '  read)',
          '    lines=""; target=""',
          '    while [ $# -gt 0 ]; do',
          '      case "$1" in --lines) lines=$2; shift 2 ;; *) target=$1; shift ;; esac',
          '    done',
          '    if [ "$target" = "burner" ]; then',
          '      echo "[herd-watch] old echo quota reached"',
          '      echo "API Error: 402 Factory: You\'ve reached your monthly standard usage limit (resets in 7h)."',
          '    elif [ "$target" = "echoonly" ]; then',
          '      echo "[board] #1 from coordinator: quota reached"',
          '    fi',
          '    exit 0',
          '    ;;',
          'esac',
        ].join('\n') + '\n',
      );

      const herdRoot = join(dir, 'herd');
      const projDir = join(herdRoot, 'watch');
      mkdirSync(projDir, { recursive: true });
      const pastIso = new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      writeFileSync(
        join(projDir, 'roster.json'),
        JSON.stringify({
          project: 'watch',
          coordinator: { machine: 'local', pane: 't10g', mode: 'notify' },
          deadline_utc: pastIso,
          stall_minutes: 15,
          members: {
            builder: { machine: 'local', agent: 'builder' },
            checker: { machine: 'cpu2', agent: 'checker' },
            burner: { machine: 'local', agent: 'burner' },
            echoonly: { machine: 'local', agent: 'echoonly' },
            ghost: { machine: 'local', agent: 'ghost' },
            dead: { machine: 'local', agent: 'dead' },
            'fix-1': { machine: 'local', agent: 'fix-1' },
            'fix-2': { machine: 'local', agent: 'fix-2' },
          },
        }),
      );

      const env = {
        HERD_ROOT: herdRoot,
        HERD_HC_BIN: stubHc,
        HC_TERMINAL_ID: 't10g',
        HERD_NOTIFY_CMD: `printf '%s|%s|%s\\n' "$HERD_ALERT_KIND" "$HERD_ALERT_KEY" "$HERD_ALERT_TEXT" >> "${notifyLog}"`,
      };
      const post = (author, text) => {
        const r = runBin(join(BIN, 'herd-post'), ['watch', author, text], { env });
        assert.equal(r.status, 0, r.stderr);
      };
      const tickOnce = (extraEnv = {}) => {
        const r = runBin('python3', [join(BIN, 'herd-watchd.py'), '--once', 'watch'], { env: { ...env, ...extraEnv } });
        assert.equal(r.status, 0, r.stderr);
        return r;
      };

      post('coordinator', '@builder go');                                  // #1
      post('builder', 'mail me at a@builder.example, @nobody');            // #2 ignored
      post('builder', '@coordinator [done] report.md');                    // #3 -> notify coordinator, builder=done
      post('coordinator', '@fix check both');                              // #4 -> fix-1, fix-2
      writeFileSync(join(dir, 'blocked-cpu2_checker'), '1');
      post('coordinator', '@checker verify');                              // #5 -> blocked on cpu2/checker
      post('coordinator', '@ghost @dead ping');                            // #6 -> missing / exited -> FAIL, not blocking cursor

      tickOnce();

      const watchLog = readFileSync(join(projDir, 'watch.log'), 'utf8');
      const calls = readFileSync(callsLog, 'utf8');
      const alerts = readFileSync(join(projDir, 'alerts.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));

      assert.match(watchLog, /backend=hc/);
      assert.match(watchLog, /WAKE builder for #1/);
      assert.doesNotMatch(watchLog, /for #2/);
      assert.match(watchLog, /NOTIFY coordinator mention:#3/);
      assert.match(watchLog, /WAKE fix-1 for #4/);
      assert.match(watchLog, /WAKE fix-2 for #4/);
      assert.match(watchLog, /SKIP checker blocked, #5 pending/);
      assert.match(watchLog, /FAIL wake ghost #6: missing/);
      assert.match(watchLog, /FAIL wake dead #6: exited/);
      assert.match(watchLog, /ALERT coordinator deadline/);
      assert.match(watchLog, /ALERT coordinator quota:burner/);
      assert.doesNotMatch(watchLog, /quota:echoonly/, 'watcher echo line must not trigger quota alert');

      // hc addressing and safety: remote uses cpu2/checker, coordinator pane NEVER gets hc send, HC_TERMINAL_ID stripped on send
      assert.match(calls, /get --json cpu2\/checker/);
      assert.doesNotMatch(calls, /send cpu2\/checker/);
      assert.doesNotMatch(calls, /send t10g/, 'notify mode must never hc send into interactive coordinator pane');
      assert.match(calls, /SEND_HC_TID=<unset>/, 'hc send must strip HC_TERMINAL_ID so wakes are not wrapped in <hc from=coordinator>');
      assert.doesNotMatch(calls, /SEND_HC_TID=t10g/);
      assert.ok(alerts.some((a) => a.kind === 'mention' && a.key === '#3'));
      assert.ok(alerts.some((a) => a.kind === 'deadline' && a.key === 'deadline'));
      assert.ok(alerts.some((a) => a.kind === 'quota' && a.key === 'quota:burner'));
      assert.match(readFileSync(notifyLog, 'utf8'), /quota\|quota:burner\|/);

      // Unblock cpu2/checker -> delivers #5 without duplicating #1 or deadline
      rmSync(join(dir, 'blocked-cpu2_checker'));
      tickOnce();
      const watchLog2 = readFileSync(join(projDir, 'watch.log'), 'utf8');
      assert.match(watchLog2, /WAKE checker for #5/);
      assert.match(readFileSync(callsLog, 'utf8'), /send cpu2\/checker \[board\] #5 from coordinator: @checker verify/);
      assert.equal(watchLog2.match(/WAKE builder for #1/g).length, 1);
      assert.equal(watchLog2.match(/ALERT coordinator deadline/g).length, 1);

      // Rework resets builder's [done] state so a subsequent stall alert includes builder again
      post('coordinator', '@builder failed: test_api exited 1'); // #7
      tickOnce();
      const statePath = join(projDir, 'watch.state.json');
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      state.last_post_time = new Date(Date.now() - 20 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      writeFileSync(statePath, JSON.stringify(state));

      tickOnce();
      const alertsAfterStall = readFileSync(join(projDir, 'alerts.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      const stallAlert = alertsAfterStall.find((a) => a.kind === 'stall');
      assert.ok(stallAlert, 'stall alert should be recorded');
      assert.equal(stallAlert.key, 'stall:7');
      assert.match(stallAlert.text, /\bbuilder\b/, 'reworked builder must reappear in stall unfinished list');

      // --dry-run + HERD_LANG=zh + HERD_DENY_PANES never invokes hc
      const dryDir = join(herdRoot, 'dry');
      mkdirSync(dryDir, { recursive: true });
      writeFileSync(join(dryDir, 'roster.json'), readFileSync(join(projDir, 'roster.json'), 'utf8'));
      writeFileSync(callsLog, '');
      runBin(join(BIN, 'herd-post'), ['dry', 'coordinator', '@builder @burner go'], { env });
      const dryRun = runBin('python3', [join(BIN, 'herd-watchd.py'), '--once', '--dry-run', 'dry'], {
        env: { ...env, HERD_DENY_PANES: 'burner', HERD_LANG: 'zh' },
      });
      assert.equal(dryRun.status, 0, dryRun.stderr);
      assert.match(dryRun.stdout, /DRY would prompt local:builder: \[board\] #1 来自 coordinator/);
      assert.match(dryRun.stdout, /DENY refuse prompt to burner/);
      assert.equal(readFileSync(callsLog, 'utf8'), '', '--dry-run must never call hc');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('herd-watchd.py: legacy herdr backend, unattended coordinator mode, and herd-watch lifecycle', () => {
  it('supports legacy herdr --machine commands, unattended coordinator prompts, and herd-watch start/status/stop', () => {
    const dir = makeTempDir('herd-watch-herdr-');
    try {
      const stubHerdr = join(dir, 'herdr');
      const callsLog = join(dir, 'herdr-calls.log');
      writeExecutable(
        stubHerdr,
        [
          '#!/usr/bin/env bash',
          `echo "$*" >> "${callsLog}"`,
          '[ "$1" = --machine ] && shift 2',
          'case "$1 $2" in',
          '  "agent get")',
          '    echo \'{"result":{"agent":{"agent_status":"idle"}}}\'',
          '    ;;',
          '  "agent prompt")',
          '    echo \'{"result":{}}\'',
          '    ;;',
          '  "agent read")',
          '    if [ "$4" = "--source" ] && [ "$5" = "recent-unwrapped" ]; then exit 1; fi',
          '    if [ "$3" = "burner" ]; then echo "quota reached"; fi',
          '    exit 0',
          '    ;;',
          'esac',
        ].join('\n') + '\n',
      );

      const herdRoot = join(dir, 'herd');
      const projDir = join(herdRoot, 'legacy');
      mkdirSync(projDir, { recursive: true });
      writeFileSync(
        join(projDir, 'roster.json'),
        JSON.stringify({
          project: 'legacy',
          coordinator: { machine: 'local', pane: 'w1:p1', mode: 'unattended' },
          deadline_utc: new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          stall_minutes: 15,
          members: {
            checker: { machine: 'box-a', agent: 'checker' },
            burner: { machine: 'local', agent: 'burner' },
          },
        }),
      );

      const env = {
        HERD_ROOT: herdRoot,
        HERD_HERDR_BIN: stubHerdr,
        HERD_RUN_DIR: join(dir, 'run'),
        HERD_INTERVAL: '60',
      };
      runBin(join(BIN, 'herd-post'), ['legacy', 'coordinator', '@checker verify'], { env });
      const once = runBin('python3', [join(BIN, 'herd-watchd.py'), '--once', 'legacy'], { env });
      assert.equal(once.status, 0, once.stderr);

      const calls = readFileSync(callsLog, 'utf8');
      assert.match(calls, /--machine box-a agent get checker/);
      assert.match(calls, /--machine box-a agent prompt checker \[board\] #1/);
      assert.match(calls, /agent read burner --source visible/);
      assert.match(calls, /agent prompt w1:p1 \[herd-watch\] Deadline/);
      assert.match(calls, /agent prompt w1:p1 \[herd-watch\] Member burner/);

      // herd-watch lifecycle: start, idempotent start, status, stop, missing roster check
      const start1 = runBin(join(BIN, 'herd-watch'), ['start', 'legacy'], { env });
      assert.equal(start1.status, 0, start1.stderr);
      assert.match(start1.stdout, /^started pid \d+/);

      const start2 = runBin(join(BIN, 'herd-watch'), ['start', 'legacy'], { env });
      assert.equal(start2.status, 0);
      assert.match(start2.stdout, /^already running pid \d+/);

      const status = runBin(join(BIN, 'herd-watch'), ['status', 'legacy'], { env });
      assert.equal(status.status, 0);
      assert.match(status.stdout, /^running pid \d+/);

      const stop = runBin(join(BIN, 'herd-watch'), ['stop', 'legacy'], { env });
      assert.equal(stop.status, 0);
      assert.equal(stop.stdout.trim(), 'stopped');
      assert.match(readFileSync(join(projDir, 'watch.log'), 'utf8'), / STOP\n$/);

      const noRoster = runBin(join(BIN, 'herd-watch'), ['start', join(herdRoot, 'missing')], { env });
      assert.equal(noRoster.status, 1);
      assert.match(noRoster.stderr, /no roster\.json/);
      assert.equal(existsSync(join(dir, 'run/local_missing.pid')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
