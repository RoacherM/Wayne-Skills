import { bold, dim, inverse, rule, truncate, width } from './ansi.ts';
import { project } from './project.ts';
import type { Tree } from './project.ts';
import type { Event, Node, NodeState } from './types.ts';
import { rootIndex } from './views/common.ts';
import { renderDetail } from './views/detail.ts';
import { renderEvents } from './views/events.ts';
import { boardNodes, renderStatusLines } from './views/status.ts';
import { renderTree, treeRow, visibleNodes } from './views/tree.ts';

export interface TuiSource {
  load: () => { nodes: Node[]; events: Event[] };
  today: string;
  readOnly?: boolean;
}

const TABS = [
  { key: 'status', label: '看板' },
  { key: 'tree', label: '树' },
  { key: 'events', label: '事件' },
] as const;
type Tab = (typeof TABS)[number]['key'];
type Page = Tab | 'detail';

const HINTS: Record<Page, string> = {
  status: '↑↓ 选择   ⏎ 详情   ←→/Tab 切页   r 重读   q 退出',
  tree: '↑↓ 选择   ⏎ 详情   a 显示已完成/取消   / 筛选   ←→/Tab 切页   q 退出',
  detail: '↑↓ 切换节点   PgUp/PgDn 滚动   esc 返回   q 退出',
  events: '↑↓/PgUp/PgDn 滚动   ←→/Tab 切页   q 退出',
};
const FILTER_HINT = '输入以筛选节点   ⏎/↓ 选择   esc 清除';
const CHROME = 5;

export function runTui(src: TuiSource): Promise<void> {
  const out = process.stdout;
  const inp = process.stdin;
  let tab: Tab = 'status';
  let detail = false;
  const page = (): Page => (detail ? 'detail' : tab);
  let sel = 0;
  let filter = '';
  let filterMode = false;
  let showAll = false;
  const scroll: Record<Page, number> = { status: 0, tree: 0, detail: 0, events: 0 };
  let tree: Tree;
  let list: NodeState[] = []; // selectable nodes on the current tab
  let bodyH = 20;

  const rebuildList = () => {
    if (tab === 'status') list = boardNodes(tree);
    else {
      const q = filter.trim().toLowerCase();
      list = visibleNodes(tree, showAll);
      if (q) list = list.filter((s) => [s.node.id, s.node.name, s.node.area ?? ''].some((t) => t.toLowerCase().includes(q)));
    }
    sel = Math.min(sel, Math.max(0, list.length - 1));
  };

  const reload = () => {
    const { nodes, events } = src.load();
    tree = project(nodes, events, src.today);
    rebuildList();
  };

  const tabBar = (cols: number) => {
    const left = TABS.map((t) => {
      if (t.key !== tab) return dim(` ${t.label} `);
      const cur = detail && list[sel] ? ` ${t.label} › ${list[sel].node.id} ` : ` ${t.label} `;
      return inverse(bold(cur));
    }).join(' ');
    const info = [`${tree.all.length} 节点`, tree.week, `${dim('today')} ${src.today}`, src.readOnly ? dim('示例数据') : '']
      .filter(Boolean)
      .join(dim(' · '));
    return ' ' + left + ' '.repeat(Math.max(1, cols - width(left) - width(info) - 2)) + info + ' ';
  };

  const filterLine = () => {
    if (detail) return dim(' ‹ esc 返回');
    if (filterMode) return ` ⌕ ${filter}${inverse(' ')}`;
    if (filter) return ` ⌕ ${filter}  ${dim(`${list.length} 个匹配 · esc 清除`)}`;
    if (tab === 'tree') return dim(` ⌕ 按 / 筛选节点…${showAll ? '   （含已完成/取消）' : ''}`);
    return '';
  };

  const content = (cols: number): { lines: string[]; keep: number } => {
    if (!detail && tab === 'status') {
      const r = renderStatusLines(tree, { width: cols, selected: sel, bare: true });
      return { lines: r.lines, keep: r.selectedLine };
    }
    if (!detail && tab === 'tree') {
      if (filter.trim()) return { lines: list.map((s, i) => treeRow(tree, s, i === sel, cols)), keep: sel };
      const r = renderTree(tree, { width: cols, selected: sel, bare: true, showDone: showAll });
      return { lines: r.lines, keep: r.selectedLine };
    }
    if (!detail && tab === 'events') return { lines: renderEvents(tree, { width: cols }), keep: -1 };
    const s = list[sel];
    return {
      lines: s ? renderDetail(s, { width: cols, today: src.today, colorIdx: rootIndex(tree, s), maxEvents: 60, tree }) : [dim('  没有匹配的节点。')],
      keep: -1,
    };
  };

  const draw = () => {
    const cols = out.columns || 100;
    const rows = out.rows || 30;
    bodyH = Math.max(1, rows - CHROME);
    const { lines, keep } = content(cols);
    const pg = page();
    const max = Math.max(0, lines.length - bodyH);
    let off = Math.min(scroll[pg], max);
    if (keep >= 0) {
      if (keep < off) off = keep;
      else if (keep >= off + bodyH) off = keep - bodyH + 1;
    }
    scroll[pg] = off;
    const body = lines.slice(off, off + bodyH).map((l) => truncate(l, cols));
    while (body.length < bodyH) body.push('');
    const pos = lines.length > bodyH ? dim(`  ${off + 1}-${Math.min(off + bodyH, lines.length)}/${lines.length}`) : '';
    const footer = dim(' ' + (filterMode ? FILTER_HINT : HINTS[pg])) + pos;
    out.write('\x1b[H\x1b[2J' + [truncate(tabBar(cols), cols), rule(cols), truncate(filterLine(), cols), ...body, rule(cols), truncate(footer, cols)].join('\n'));
  };

  const switchTab = (d: number) => {
    const i = TABS.findIndex((t) => t.key === tab);
    tab = TABS[(i + d + TABS.length) % TABS.length].key;
    detail = false;
    rebuildList();
  };
  const select = (d: number) => {
    const before = sel;
    sel = Math.max(0, Math.min(list.length - 1, sel + d));
    if (sel !== before) scroll.detail = 0;
  };
  const scrollBy = (d: number) => {
    scroll[page()] = Math.max(0, scroll[page()] + d);
  };

  return new Promise<void>((resolve) => {
    const cleanup = () => {
      inp.off('data', onKey);
      out.off('resize', draw);
      if (inp.isTTY) inp.setRawMode(false);
      inp.pause();
      out.write('\x1b[?25h\x1b[?1049l');
      resolve();
    };

    const onFilterKey = (k: string) => {
      if (k === '\x1b') { filter = ''; filterMode = false; rebuildList(); }
      else if (k === '\r' || k === '\x1b[B' || k === '\t') { filterMode = false; sel = 0; }
      else if (k === '\x7f' || k === '\b') { filter = filter.slice(0, -1); rebuildList(); }
      else if (k >= ' ' && !k.startsWith('\x1b')) { filter += k; sel = 0; rebuildList(); }
    };

    const onKey = (buf: Buffer) => {
      const k = buf.toString();
      if (k === '\x03') return cleanup();
      if (filterMode) { onFilterKey(k); return draw(); }
      if (k === 'q') return cleanup();
      const pg = page();
      const listy = pg !== 'events';
      if (k === '/' && tab === 'tree' && !detail) filterMode = true;
      else if (k === 'a' && tab === 'tree' && !detail) { showAll = !showAll; rebuildList(); }
      else if (k === '\t' || k === '\x1b[C') switchTab(1);
      else if (k === '\x1b[Z' || k === '\x1b[D') switchTab(-1);
      else if (k >= '1' && k <= String(TABS.length)) { tab = TABS[+k - 1].key; detail = false; rebuildList(); }
      else if (k === '\x1b[A' || k === 'k') listy ? select(-1) : scrollBy(-1);
      else if (k === '\x1b[B' || k === 'j') listy ? select(1) : scrollBy(1);
      else if (k === '\x1b[5~') pg === 'detail' || pg === 'events' ? scrollBy(-bodyH) : select(-bodyH);
      else if (k === '\x1b[6~') pg === 'detail' || pg === 'events' ? scrollBy(bodyH) : select(bodyH);
      else if (k === 'g') listy && !detail ? select(-Infinity) : (scroll[pg] = 0);
      else if (k === 'G') listy && !detail ? select(Infinity) : (scroll[pg] = Number.MAX_SAFE_INTEGER);
      else if (k === '\r' || k === 'l') { if (list.length && tab !== 'events') detail = true; }
      else if (k === '\x1b' || k === 'h') { if (detail) detail = false; else if (filter) { filter = ''; rebuildList(); } else { tab = 'status'; rebuildList(); } }
      else if (k === 'r') reload();
      draw();
    };

    reload();
    out.write('\x1b[?1049h\x1b[?25l');
    if (inp.isTTY) inp.setRawMode(true);
    inp.resume();
    inp.on('data', onKey);
    out.on('resize', draw);
    draw();
  });
}
