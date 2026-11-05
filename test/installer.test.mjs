import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installedAgents, LINKED_AGENTS, linkSkill, readManifest, REPO, sync } from '../bin/wayne-skills.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'wayne-skills-'));
const antigravity = LINKED_AGENTS.find((a) => a.id === 'antigravity');

test('only agents whose home exists are targeted, so no directory is created for the rest', () => {
  const home = fresh();
  mkdirSync(join(home, '.claude'));
  assert.deepEqual(installedAgents(home).map((a) => a.id), ['claude-code']);
  assert.ok(!existsSync(join(home, '.gemini')));
});

test('Antigravity gets a relative link into ~/.agents/skills that resolves', () => {
  const home = fresh();
  mkdirSync(join(home, '.gemini/antigravity'), { recursive: true });
  mkdirSync(join(home, '.agents/skills/demo'), { recursive: true });
  writeFileSync(join(home, '.agents/skills/demo/SKILL.md'), 'x');
  assert.deepEqual(installedAgents(home).map((a) => a.id), ['antigravity']);

  linkSkill(home, antigravity, 'demo');
  linkSkill(home, antigravity, 'demo');
  assert.equal(readlinkSync(join(home, '.gemini/config/skills/demo')), '../../../.agents/skills/demo');
  assert.ok(existsSync(join(home, '.gemini/config/skills/demo/SKILL.md')));
});

test('a real directory in the agent skills dir is left alone', () => {
  const home = fresh();
  mkdirSync(join(home, '.gemini/config/skills/demo'), { recursive: true });
  writeFileSync(join(home, '.gemini/config/skills/demo/SKILL.md'), 'mine');
  assert.match(linkSkill(home, antigravity, 'demo'), /没动/);
  assert.ok(existsSync(join(home, '.gemini/config/skills/demo/SKILL.md')));
});

const skill = (dir, text = 'x') => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), text);
};

test('sync replaces a copy with a link to the repo, moves the copy to backup, and links Claude Code', () => {
  const home = fresh();
  const repo = fresh();
  mkdirSync(join(home, '.claude'));
  skill(join(repo, 'skills/demo'), 'repo');
  skill(join(home, '.agents/skills/demo'), 'old copy');
  const now = new Date('2026-11-05T12:00:00Z');

  sync(home, { links: { demo: 'skills/demo' } }, { repo, now });
  assert.equal(readlinkSync(join(home, '.agents/skills/demo')), join(repo, 'skills/demo'));
  assert.equal(readFileSync(join(home, '.claude/skills/demo/SKILL.md'), 'utf8'), 'repo');
  assert.equal(readFileSync(join(home, '.agents/backup/sync-20261105-120000/demo/SKILL.md'), 'utf8'), 'old copy');
  assert.deepEqual(sync(home, { links: { demo: 'skills/demo' } }, { repo, now }), [], 'second run changes nothing');
});

test('sync installs only missing remote skills and only reports missing external ones', () => {
  const home = fresh();
  skill(join(home, '.agents/skills/have'));
  const calls = [];
  const log = sync(home, { remote: { 'o/r': ['have', 'need'] }, external: { ext: 'ext install' } }, {
    repo: fresh(),
    installRemote: (src, names) => calls.push([src, names]),
  });
  assert.deepEqual(calls, [['o/r', ['need']]]);
  assert.ok(log.includes('缺 ext：跑 ext install'));
});

test('sync --prune removes what the manifest does not list, keeps dotfiles, and trims the lock', () => {
  const home = fresh();
  mkdirSync(join(home, '.claude'));
  skill(join(home, '.agents/skills/keep'));
  skill(join(home, '.agents/skills/gone'));
  writeFileSync(join(home, '.agents/skills/.hidden'), '');
  writeFileSync(join(home, '.agents/.skill-lock.json'), JSON.stringify({ version: 3, skills: { keep: {}, gone: {}, stale: {} } }));
  sync(home, { remote: { 'o/r': ['keep'] } }, { repo: fresh(), prune: true, installRemote: () => assert.fail('nothing missing') });

  assert.deepEqual(readdirSync(join(home, '.agents/skills')).sort(), ['.hidden', 'keep']);
  assert.deepEqual(readdirSync(join(home, '.claude/skills')), ['keep']);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(home, '.agents/.skill-lock.json'), 'utf8')).skills), ['keep']);
});

test('the repo manifest only links skills that exist in the repo', () => {
  for (const p of Object.values(readManifest().links)) {
    if (!p.startsWith('~/')) assert.ok(existsSync(join(REPO, p, 'SKILL.md')), p);
  }
});

test('sync fetches a files entry only when its destination is missing', () => {
  const home = fresh();
  const calls = [];
  const fetchFiles = (spec, dest) => {
    calls.push([spec, dest]);
    mkdirSync(dest, { recursive: true });
  };
  const manifest = { files: { '~/.agents/docs': 'o/r/docs' } };
  sync(home, manifest, { repo: fresh(), fetchFiles });
  sync(home, manifest, { repo: fresh(), fetchFiles });
  assert.deepEqual(calls, [['o/r/docs', join(home, '.agents/docs')]]);
});
