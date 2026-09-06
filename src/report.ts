// Report delivery and scheduling, the pure half: which report file / event a report maps to, the markdown that goes into
// Apple Notes, the launchd plist, the prompts a headless agent gets. No fs, no exec: cli.ts does the side effects.
import { basename } from 'node:path';
import YAML from 'yaml';
import { dayOf, sortEvents, weekLabel } from './dates.ts';
import type { Event } from './types.ts';

export type ReportKind = 'daily' | 'weekly';
export const REPORT_KINDS: readonly ReportKind[] = ['daily', 'weekly'];
export const KIND_CN: Record<ReportKind, string> = { daily: '日报', weekly: '周报' };

/** The period a report event belongs to: the day for daily, the ISO week for weekly (the `week` field wins when present). */
export function reportLabel(e: Event): string {
  return e.kind === 'weekly' ? (e.week ?? weekLabel(dayOf(e.ts))) : dayOf(e.ts);
}

/** The report event already recorded for this period, if any: the reason a re-run after a missed 11:00 is a no-op. */
export function existingReport(events: readonly Event[], kind: ReportKind, label: string): Event | null {
  return [...sortEvents(events)].reverse().find((e) => e.type === 'report' && e.kind === kind && reportLabel(e) === label) ?? null;
}

export interface ReportStatus {
  today: string;
  week: string;
  daily: { last: Event | null; today: Event | null };
  weekly: { last: Event | null; thisWeek: Event | null };
}

export function reportStatus(events: readonly Event[], today: string, week: string): ReportStatus {
  const rev = [...sortEvents(events)].reverse();
  const last = (kind: ReportKind) => rev.find((e) => e.type === 'report' && e.kind === kind) ?? null;
  return {
    today,
    week,
    daily: { last: last('daily'), today: existingReport(events, 'daily', today) },
    weekly: { last: last('weekly'), thisWeek: existingReport(events, 'weekly', week) },
  };
}

/** File name under reports/ for a report: `2026-W36.md` (weekly) or `2026-09-06.md` (daily). */
export function reportFile(label: string): string {
  return `${label}.md`;
}

export function defaultTitle(kind: ReportKind, label: string): string {
  return `OKR ${KIND_CN[kind]} ${label}`;
}

// ── markdown → Notes html ──────────────────────────────
// Apple Notes takes a small HTML subset. Enough of markdown for a report: headings, paragraphs, lists, fenced code,
// bold / code / links inline. Anything else stays as text.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  const parts: string[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    parts.push(esc(s.slice(last, m.index)));
    if (m[1]) parts.push(`<tt>${esc(m[1].slice(1, -1))}</tt>`);
    else if (m[2]) parts.push(`<b>${esc(m[2].slice(2, -2))}</b>`);
    else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m[3])!;
      parts.push(`<a href="${esc(mm[2])}">${esc(mm[1])}</a>`);
    }
    last = m.index + m[0].length;
  }
  parts.push(esc(s.slice(last)));
  return parts.join('');
}

export function mdToHtml(md: string): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let code: string[] | null = null;
  let para: string[] = [];
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const flushPara = () => {
    if (para.length) out.push(`<div>${para.map(inline).join('<br>')}</div>`);
    para = [];
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (code) {
      if (/^```/.test(raw)) {
        out.push(`<pre>${code.map(esc).join('<br>')}</pre>`);
        code = null;
      } else code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (/^```/.test(line)) {
      flushPara();
      closeList();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      closeList();
      const lvl = Math.min(h[1].length, 3);
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      const kind = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (/^\s*(?:---|\*\*\*)\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push('<hr>');
      continue;
    }
    if (list && /^\s{2,}/.test(raw)) {
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, `<br>${inline(line.trim())}</li>`);
      continue;
    }
    closeList();
    para.push(line.trim());
  }
  if (code) out.push(`<pre>${code.map(esc).join('<br>')}</pre>`);
  flushPara();
  closeList();
  return out.join('\n');
}

/**
 * AppleScript that upserts one note by title inside a folder of the default Notes account. Folder, title and body
 * arrive as `argv` (osascript - folder title html), so nothing is interpolated into the script.
 */
export const NOTES_SCRIPT = `on run argv
  set folderName to item 1 of argv
  set noteTitle to item 2 of argv
  set noteBody to item 3 of argv
  tell application "Notes"
    set acct to default account
    if not (exists folder folderName of acct) then
      make new folder at acct with properties {name:folderName}
    end if
    set f to folder folderName of acct
    set hits to (every note of f whose name is noteTitle)
    if (count of hits) > 0 then
      set body of (item 1 of hits) to noteBody
      return "updated"
    else
      make new note at f with properties {name:noteTitle, body:noteBody}
      return "created"
    end if
  end tell
end run
`;

/** Body Notes stores: the title as first line (Notes derives the note name from it), then the converted markdown. */
export function notesBody(title: string, md: string): string {
  return `<h1>${esc(title)}</h1>\n${mdToHtml(md)}`;
}

// ── launchd ────────────────────────────────────────────

export interface JobSpec {
  label: string;
  program: string[];
  hour: number;
  minute: number;
  weekday?: number; // 0 = Sunday … 6, launchd convention; omit for daily
  env: Record<string, string>;
  log: string;
  workdir: string;
}

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function plistXml(j: JobSpec): string {
  const cal = [`\t\t<key>Hour</key>\n\t\t<integer>${j.hour}</integer>`, `\t\t<key>Minute</key>\n\t\t<integer>${j.minute}</integer>`];
  if (j.weekday !== undefined) cal.unshift(`\t\t<key>Weekday</key>\n\t\t<integer>${j.weekday}</integer>`);
  const env = Object.entries(j.env)
    .map(([k, v]) => `\t\t<key>${x(k)}</key>\n\t\t<string>${x(v)}</string>`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `\t<key>Label</key>\n\t<string>${x(j.label)}</string>`,
    '\t<key>ProgramArguments</key>\n\t<array>',
    ...j.program.map((p) => `\t\t<string>${x(p)}</string>`),
    '\t</array>',
    '\t<key>StartCalendarInterval</key>\n\t<dict>',
    ...cal,
    '\t</dict>',
    '\t<key>EnvironmentVariables</key>\n\t<dict>',
    env,
    '\t</dict>',
    `\t<key>WorkingDirectory</key>\n\t<string>${x(j.workdir)}</string>`,
    `\t<key>StandardOutPath</key>\n\t<string>${x(j.log)}</string>`,
    `\t<key>StandardErrorPath</key>\n\t<string>${x(j.log)}</string>`,
    '\t<key>RunAtLoad</key>\n\t<false/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

export function jobLabel(kind: ReportKind): string {
  return `com.roacherm.okr.${kind}`;
}

/** "HH:MM" → hour / minute, or null. */
export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, 日: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

/** "mon" / "1" / "周一" → launchd weekday number, or null. */
export function parseWeekday(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/^(周|星期|礼拜)/, '');
  if (/^[0-6]$/.test(t)) return Number(t);
  if (t === '7') return 0;
  const k = t.slice(0, 3);
  return k in WEEKDAYS ? WEEKDAYS[k] : t in WEEKDAYS ? WEEKDAYS[t] : null;
}

// ── headless agent ─────────────────────────────────────

/** How to hand a prompt to an agent binary on stdin and get plain text back. Unknown binaries get the prompt on stdin, nothing else. */
export function agentCommand(bin: string, extra: string[] = []): { cmd: string; args: string[] } {
  const name = basename(bin);
  if (name.startsWith('claude')) return { cmd: bin, args: ['-p', '--output-format', 'text', ...extra] };
  if (name.startsWith('codex')) return { cmd: bin, args: ['exec', '--skip-git-repo-check', ...extra, '-'] };
  return { cmd: bin, args: extra };
}

const RULES = [
  '规则：',
  '- 只输出报告正文（markdown），不要开场白、不要解释、不要代码块包裹整份报告。',
  '- 所有事实来自下面的 JSON，不要执行命令，不要编造数值和用时；不确定就说不确定。',
  '- 用中文，短句，直接说事；每条任务给 id 和一句为什么。没内容的小节写「无」。',
];

export function dailyPrompt(data: unknown): string {
  return [
    '你是用户的 OKR 助理，写今天的日报，用户在 macOS 备忘录里读。',
    ...RULES,
    '',
    '按顺序写这些小节（二级标题）：',
    '1. 待确认提案：brief.proposals 非空时提醒用户确认（列文件名），否则写「无」。',
    '2. 今日顺序：从 plan.planned 和 plan.carryOver 里挑今天做的，按顺序列，每条一句理由（截止、阻塞、依赖、上层落后）。',
    '3. 到期与阻塞：brief.overdue / dueSoon / blocked。',
    '4. 待验收与已领取：brief.reviewStale 与 brief.claimed（谁领的、领了多久）。',
    '5. 建议拆解：挑一个最该拆的任务或 KR（缺 spec、太大、卡住的），给 2–4 条子任务建议，只是建议不落盘。',
    '6. 昨日进度：changes 里的事件按节点归纳，一条一句。',
    '',
    '数据：',
    JSON.stringify(data, null, 1),
  ].join('\n');
}

export function weeklyPrompt(data: unknown): string {
  return [
    '你是用户的 OKR 助理，写周报：回顾上周（review），提出本周计划（proposal）。存成 markdown，用户在 reports/ 和备忘录里读。',
    ...RULES,
    '- 图表用文本块（进度条用 ▓░）。',
    '',
    '按顺序写这些小节（二级标题）：',
    '1. 上周回顾：review.done（完成了什么、用时）、review.events 数量、commits 里各仓库提交的归纳。',
    '2. 各目标评估与周变化：review.nodes 按树的缩进列 objective / KR / 里程碑，给进度、本周变化 delta、health；落后的说原因（引用具体任务）。',
    '3. 吞吐：review.velocity 近几周完成数和趋势。',
    '4. 本周提案：从 candidates 和 thisWeek.carryOver 里挑本周要做的，按优先顺序列，每条一句为什么；遗留任务要么进计划要么退出。',
    '5. 风险：阻塞、停滞、快到期但没排进来的、缺 spec 的。',
    '',
    '最后附一个 ```yaml 代码块，内容是 plan.yaml（会存成 reports/<week>.plan.yaml 等用户确认）：',
    '```yaml',
    `week: ${(data as { thisWeek?: { week?: string } }).thisWeek?.week ?? '<week>'}`,
    'new:            # 可选：新任务，parent 必须是已有节点 id；字段 name / priority(P0-P3) / deadline / spec{goal,accept[],verify,links[]}',
    '  - {parent: kr1, name: 例子, priority: P1}',
    'plan: [t1, new:0]   # 本周全集，按顺序；new:N 引用 new 列表下标',
    'drop: []            # 退出本周的遗留任务 id',
    '```',
    'thisWeek.carryOver 里的每个 id 必须出现在 plan 或 drop 里。plan 里只能放 task 的 id（candidates 里的）。',
    '',
    '数据：',
    JSON.stringify(data, null, 1),
  ].join('\n');
}

/** Take the trailing ```yaml plan block out of an agent's weekly output. Markdown keeps everything else. */
/**
 * The plan block the agent wrote must be for the week the job ran for: a wrong or missing `week:` is replaced
 * (line-wise, so comments survive); yaml that does not parse is kept as-is for the user to fix by hand.
 */
export function normalizePlanWeek(plan: string, week: string): string {
  let doc: unknown;
  try {
    doc = YAML.parse(plan);
  } catch {
    return plan;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return plan;
  if ((doc as Record<string, unknown>).week === week) return plan;
  if (/^week:.*$/m.test(plan)) return plan.replace(/^week:.*$/m, `week: ${week}`);
  return `week: ${week}\n${plan}`;
}

export function splitWeekly(text: string): { markdown: string; plan: string | null } {
  const re = /```ya?ml[^\n]*\n([\s\S]*?)```/g;
  let found: RegExpExecArray | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) if (/^\s*(week|plan|new|drop)\s*:/m.test(m[1])) found = m;
  if (!found) return { markdown: text.trim() + '\n', plan: null };
  const markdown = (text.slice(0, found.index) + text.slice(found.index + found[0].length)).trim() + '\n';
  return { markdown, plan: found[1].trim() + '\n' };
}

/** Next free `<week>.plan.yaml` / `<week>.plan-N.yaml` name given the files already there. */
export function nextPlanFile(week: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  if (!taken.has(`${week}.plan.yaml`)) return `${week}.plan.yaml`;
  for (let n = 2; ; n++) if (!taken.has(`${week}.plan-${n}.yaml`)) return `${week}.plan-${n}.yaml`;
}
