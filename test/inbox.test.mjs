import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main, REPO } from '../bin/wayne-skills.js';
import { applyInbox, listInbox, parseCard } from '../global/corrections/inbox.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'wayne-inbox-'));

const SAMPLE_MEMORY = `# MEMORY.md

## 界面与原型

- **原型先行**：先交可打开的原型。

## 编码与验证

- **快检优先**：先跑静态快检。

## 文档与沟通

## 环境与配额

- **薄编排**：额度紧时串成单脚本。
`;

test('parseCard validates frontmatter at trust boundary and returns null on malformed input', () => {
  assert.equal(parseCard('no frontmatter at all'), null);
  assert.equal(parseCard('---\ntarget: MEMORY.md#编码与验证\n---\nbody'), null);
  assert.equal(parseCard('---\nrule: - **x**：y\n---\nbody'), null);

  const card = parseCard('---\ntarget: "MEMORY.md#编码与验证"\nrule: "**新条文**：先查后改。"\n---\n\n## 触发\n用户反馈\n');
  assert.deepEqual(card, {
    target: 'MEMORY.md#编码与验证',
    rule: '- **新条文**：先查后改。',
    body: '## 触发\n用户反馈',
  });
});

test('empty inbox returns empty logs without touching MEMORY.md', () => {
  const home = fresh();
  const repo = fresh();
  mkdirSync(join(repo, 'global'), { recursive: true });
  writeFileSync(join(repo, 'global/MEMORY.md'), SAMPLE_MEMORY);

  assert.deepEqual(listInbox(home), []);
  assert.deepEqual(applyInbox(home, { repo }), []);
  assert.ok(!existsSync(join(home, '.agents/MEMORY.md')));
});

test('applyInbox merges parallel MEMORY.md cards, deduplicates rules, archives to promoted, and holds non-MEMORY or invalid cards', () => {
  const home = fresh();
  const repo = fresh();
  const inbox = join(home, '.agents/corrections/inbox');
  mkdirSync(inbox, { recursive: true });
  mkdirSync(join(repo, 'global'), { recursive: true });
  writeFileSync(join(repo, 'global/MEMORY.md'), SAMPLE_MEMORY);

  writeFileSync(
    join(inbox, '20261112-180100-trace-real-101.md'),
    '---\ntarget: MEMORY.md#编码与验证\nrule: "- **实测验收**：跑 3 次真实调用。"\n---\n\n## 触发\n漏跑真实调用\n',
  );
  writeFileSync(
    join(inbox, '20261112-180100-plain-prose-202.md'),
    '---\ntarget: MEMORY.md#文档与沟通\nrule: **直白表达**：一句话说清结论。\n---\n\n## 触发\n写得太绕\n',
  );
  writeFileSync(
    join(inbox, '20261112-180101-dup-trace-303.md'),
    '---\ntarget: MEMORY.md#编码与验证\nrule: - **实测验收**：跑 3 次真实调用。\n---\n\n## 触发\n另一分屏重复记了同一条\n',
  );
  writeFileSync(
    join(inbox, '20261112-180102-core-404.md'),
    '---\ntarget: AGENTS.md\nrule: - **新原则**：需人工审阅。\n---\n\n## 触发\n底层原则候选\n',
  );
  writeFileSync(
    join(inbox, '20261112-180103-skill-505.md'),
    '---\ntarget: vibe-coding\nrule: - **新编码规范**：需合入 skill。\n---\n',
  );
  writeFileSync(
    join(inbox, '20261112-180104-unknown-sec-606.md'),
    '---\ntarget: MEMORY.md#不存在的小节\nrule: - **错节**：写错了标题。\n---\n',
  );
  writeFileSync(join(inbox, '20261112-180105-broken-707.md'), 'broken card without frontmatter');

  const listed = listInbox(home);
  assert.equal(listed.length, 7);
  assert.match(listed[0], /plain-prose-202\.md -> MEMORY\.md#文档与沟通/);
  assert.match(listed[1], /trace-real-101\.md -> MEMORY\.md#编码与验证/);
  assert.match(listed[6], /broken-707\.md \[格式无效/);

  const now = new Date('2026-11-12T10:00:00Z');
  const log = applyInbox(home, { repo, now });
  assert.equal(log.length, 7);

  const updated = readFileSync(join(repo, 'global/MEMORY.md'), 'utf8');
  assert.equal(readFileSync(join(home, '.agents/MEMORY.md'), 'utf8'), updated);
  assert.equal(updated.split('- **实测验收**：跑 3 次真实调用。').length - 1, 1, 'rule inserted exactly once');
  assert.match(updated, /## 编码与验证\n\n- \*\*快检优先\*\*：先跑静态快检。\n- \*\*实测验收\*\*：跑 3 次真实调用。\n\n## 文档与沟通/);
  assert.match(updated, /## 文档与沟通\n\n- \*\*直白表达\*\*：一句话说清结论。\n\n## 环境与配额/);

  const remaining = readdirSync(inbox).sort();
  assert.deepEqual(remaining, [
    '20261112-180102-core-404.md',
    '20261112-180103-skill-505.md',
    '20261112-180104-unknown-sec-606.md',
    '20261112-180105-broken-707.md',
  ]);

  const promoted = readdirSync(join(home, '.agents/corrections/promoted')).sort();
  assert.deepEqual(promoted, [
    '2026-11-12-global-dup-trace-303.md',
    '2026-11-12-global-plain-prose-202.md',
    '2026-11-12-global-trace-real-101.md',
  ]);
  const archived = readFileSync(join(home, '.agents/corrections/promoted/2026-11-12-global-trace-real-101.md'), 'utf8');
  assert.match(archived, /## 触发\n漏跑真实调用/);
  assert.match(archived, /## 规则\n- \*\*实测验收\*\*：跑 3 次真实调用。/);
  assert.match(archived, /落到：wayne-skills\/global\/MEMORY\.md#编码与验证（2026-11-12）/);
});

test('CLI inbox subcommand lists, applies in isolated repo, and rejects unknown flags', () => {
  const home = fresh();
  const repo = fresh();
  mkdirSync(join(repo, 'global'), { recursive: true });
  writeFileSync(join(repo, 'global/MEMORY.md'), SAMPLE_MEMORY);
  mkdirSync(join(home, '.agents/corrections/inbox'), { recursive: true });
  writeFileSync(
    join(home, '.agents/corrections/inbox/20261112-180200-env-808.md'),
    '---\ntarget: MEMORY.md#环境与配额\nrule: - **复制安装**：默认复制而非软链。\n---\n',
  );
  main(['inbox', '--apply'], { home, repo });
  assert.match(readFileSync(join(home, '.agents/MEMORY.md'), 'utf8'), /- \*\*复制安装\*\*：默认复制而非软链。\n$/);

  const cli = join(REPO, 'bin/wayne-skills.js');
  const empty = spawnSync('node', [cli, 'inbox'], { encoding: 'utf8', env: { ...process.env, HOME: home } });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.stdout.trim(), 'inbox 为空');

  const bad = spawnSync('node', [cli, 'inbox', '--unknown'], { encoding: 'utf8', env: { ...process.env, HOME: home } });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /wayne-skills inbox/);
});
