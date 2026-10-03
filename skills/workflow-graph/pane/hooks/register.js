// Workflow pane: /workflow-pane opens a pane with one row per task in .workflow/log.jsonl
// (workflow-graph SKILL.md section 6), and a line under the prompt keeps the counts.
// It only displays; it never writes the log or starts a turn.
import { NEEDS_MAIN, STATE_LABELS, deriveTasks, formatDuration, parseLog, sortRows, summary } from './derive.js'

const PANE = 'workflow-pane'
const LOG = '.workflow/log.jsonl'
const REFRESH_MS = 5000
const FINISHED_SHOWN = 5
const COLUMN_WIDTHS = [10, 10, 10, 10, 8]

const STATE_STYLE = {
  done: { color: 'yellow', bold: true },
  question: { color: 'yellow', bold: true },
  handoff: { color: 'yellow', bold: true },
  blocked: { color: 'red', bold: true },
  'gate-fail': { color: 'red', bold: true },
  finished: { dimColor: true },
}

let rows = []
let badLines = [] // { line, message } for log lines that could not be read
let error = '' // a failure that stops the whole refresh; the last good rows stay on screen
let missing = false
let refreshing = false
let lastSeen = null // task → state and time of its deciding fact; null until the first refresh
let cache = { mtimeMs: -1, size: -1, text: '' }

async function readLog($) {
  if (!(await $.fs.exists(LOG))) return null
  const stat = await $.fs.stat(LOG)
  if (stat.mtimeMs !== cache.mtimeMs || stat.size !== cache.size) {
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, text: await $.fs.read(LOG) }
  }
  return cache.text
}

// A toast for each task that newly waits on the orchestrator. Comparing the latest fact's time
// too means a second question in the same node still toasts.
function announceChanges($) {
  const seen = new Map(rows.map((r) => [r.task, r.state + ':' + r.lastMs]))
  if (lastSeen) {
    for (const r of rows) {
      if (NEEDS_MAIN.has(r.state) && lastSeen.get(r.task) !== seen.get(r.task)) {
        $.ui.toast(r.task + ' · ' + r.node + ' → ' + STATE_LABELS[r.state])
      }
    }
  }
  lastSeen = seen
}

function statusLine() {
  if (error) return error
  if (missing) return 'no ' + LOG + ' here'
  const parts = [summary(rows) || '无进行中的任务']
  if (badLines.length) parts.push(badLines.length + ' 行无效')
  return parts.join(' · ')
}

async function refresh($) {
  if (refreshing) return
  refreshing = true
  try {
    const text = await readLog($)
    missing = text === null
    const { facts, errors } = parseLog(text ?? '')
    badLines = errors
    rows = deriveTasks(facts, await $.clock.now())
    error = ''
    announceChanges($)
  } catch (err) {
    error = String(err.message ?? err)
  } finally {
    refreshing = false
    $.ui.status(statusLine())
    $.ui.invalidate('ui.render')
  }
}

// One line of the table: cells = [[text, textProps], ...] in COLUMN_WIDTHS order.
function drawLine({ Box, Text }, key, cells) {
  return Box({
    key,
    flexDirection: 'row',
    columnGap: 2,
    children: cells.map(([text, props], i) =>
      Box({ width: COLUMN_WIDTHS[i], children: [Text({ wrap: 'truncate-end', ...props, children: [text] })] }),
    ),
  })
}

function drawRow(el, r) {
  const finished = r.state === 'finished'
  const rounds = r.rounds > 0 ? '退回 ' + r.rounds + (r.cap ? '/' + r.cap : '') : ''
  return drawLine(el, r.task, [
    [r.task, finished ? { dimColor: true } : { bold: true }],
    [r.node, { dimColor: finished }],
    [STATE_LABELS[r.state], STATE_STYLE[r.state] ?? {}],
    [rounds, r.cap && r.rounds >= r.cap ? { color: 'red' } : { dimColor: true }],
    [formatDuration(r.cycleMs), { dimColor: true }],
  ])
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    $.clock.every(REFRESH_MS, () => refresh($))
    await refresh($)
    await $.command.register({
      name: 'workflow-pane',
      description: 'Open the workflow pane (.workflow/log.jsonl)',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'workflow-pane' }, async ($) => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Workflow', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const { active, finished } = sortRows(rows)
    const shown = finished.slice(0, FINISHED_SHOWN)
    const children = []
    if (error) children.push(Text({ color: 'red', children: [error] }))
    if (missing) children.push(Text({ dimColor: true, children: ['这里还没有 ' + LOG] }))
    if (badLines.length) {
      const first = badLines[0]
      children.push(
        Text({ color: 'red', wrap: 'truncate-end', children: [badLines.length + ' 行无效，第一处：第 ' + first.line + ' 行 ' + first.message] }),
      )
    }
    children.push(
      Text({ bold: true, children: [summary(rows) || '无进行中的任务'] }),
      drawLine(el, 'header', ['任务', '节点', '状态', '退回', '周期'].map((t) => [t, { dimColor: true }])),
      ...active.map((r) => drawRow(el, r)),
      ...shown.map((r) => drawRow(el, r)),
    )
    if (finished.length > shown.length) {
      children.push(Text({ dimColor: true, children: ['更早完成 ' + (finished.length - shown.length) + ' 个'] }))
    }
    return Box({ flexDirection: 'column', children })
  })
}
