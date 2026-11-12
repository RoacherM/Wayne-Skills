// Lock-free parallel agent corrections inbox (~/.agents/corrections/inbox/*.md).
// Agents running in parallel across any repo drop one uniquely named Markdown card per cross-repo lesson;
// `wayne-skills inbox` inspects pending cards and `wayne-skills inbox --apply` merges MEMORY.md#<section>
// entries into global/MEMORY.md + ~/.agents/MEMORY.md and archives processed cards into promoted/.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = fileURLToPath(new URL('../..', import.meta.url));

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2').trim();

export function parseCard(raw) {
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = unquote(line.slice(idx + 1));
  }
  if (!meta.target || !meta.rule) return null;
  const rule = meta.rule.startsWith('- ') ? meta.rule : `- ${meta.rule}`;
  return { target: meta.target, rule, body: match[2].trim() };
}

function appendRule(markdown, section, rule) {
  const heading = `\n## ${section}\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) return null;
  if (markdown.split('\n').includes(rule)) return markdown;
  const next = markdown.indexOf('\n## ', start + heading.length);
  const before = (next === -1 ? markdown : markdown.slice(0, next)).trimEnd();
  const after = next === -1 ? '' : `\n${markdown.slice(next + 1)}`;
  const sep = before.endsWith(`## ${section}`) ? '\n\n' : '\n';
  return `${before}${sep}${rule}\n${after}`;
}

function inboxFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.startsWith('.') && f.endsWith('.md'))
    .sort();
}

function writeAtomic(dest, text) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, dest);
}

function archiveCard(promotedDir, file, card, section, date) {
  mkdirSync(promotedDir, { recursive: true });
  const slug = file.replace(/\.md$/, '').replace(/^(\d{8}-\d{6}|\d{4}-\d{2}-\d{2})-/, '').replace(/^global-/, '');
  const archivedName = `${date}-global-${slug}.md`;
  const prefix = card.body ? `${card.body}\n\n` : '';
  const content = `${prefix}## 规则\n${card.rule}\n\n落到：wayne-skills/global/MEMORY.md#${section}（${date}）\n`;
  writeAtomic(join(promotedDir, archivedName), content);
  return archivedName;
}

export function listInbox(home) {
  const dir = join(home, '.agents/corrections/inbox');
  return inboxFiles(dir).map((file) => {
    const card = parseCard(readFileSync(join(dir, file), 'utf8'));
    if (!card) return `${file} [格式无效：缺 target 或 rule]`;
    return `${file} -> ${card.target}：${card.rule}`;
  });
}

function processCard(file, ctx) {
  const srcPath = join(ctx.inboxDir, file);
  const card = parseCard(readFileSync(srcPath, 'utf8'));
  if (!card) return `跳过 ${file}：格式无效（缺 target 或 rule）`;
  if (!card.target.startsWith('MEMORY.md#')) return `待人工审阅 ${file} -> ${card.target}：${card.rule}`;
  const section = card.target.slice('MEMORY.md#'.length);
  const nextMem = appendRule(ctx.memory, section, card.rule);
  if (nextMem === null) return `保留 ${file}：MEMORY.md 中不存在小节「${section}」`;
  ctx.memory = nextMem;
  ctx.applied += 1;
  const archived = archiveCard(ctx.promotedDir, file, card, section, ctx.date);
  rmSync(srcPath);
  return `已合入 MEMORY.md#${section} 并归档 ${archived}`;
}

export function applyInbox(home, { repo = DEFAULT_REPO, now = new Date() } = {}) {
  const inboxDir = join(home, '.agents/corrections/inbox');
  const files = inboxFiles(inboxDir);
  if (!files.length) return [];
  const lockDir = join(inboxDir, '.merge.lock');
  mkdirSync(lockDir);
  try {
    const memRepoPath = join(repo, 'global/MEMORY.md');
    const ctx = {
      inboxDir,
      promotedDir: join(home, '.agents/corrections/promoted'),
      memory: readFileSync(memRepoPath, 'utf8'),
      date: now.toISOString().slice(0, 10),
      applied: 0,
    };
    const log = files.map((file) => processCard(file, ctx));
    if (ctx.applied > 0) {
      writeAtomic(memRepoPath, ctx.memory);
      writeAtomic(join(home, '.agents/MEMORY.md'), ctx.memory);
    }
    return log;
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}
