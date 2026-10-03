// Reads a workflow-graph log (.workflow/log.jsonl, SKILL.md section 6) and derives one row per
// task. Nothing is stored: every row is computed again from the facts.

export const EVENTS = new Set(['start', 'done', 'question', 'answer', 'blocked', 'gate', 'return', 'handoff', 'finish'])
const REQUIRED = ['time', 'task', 'event', 'node', 'by']

export const STATE_LABELS = {
  working: '进行中',
  done: '已交付',
  question: '有提问',
  blocked: '卡住',
  'gate-pass': '闸门通过',
  'gate-fail': '闸门未过',
  fixing: '修改中',
  handoff: '已移交',
  finished: '完成',
}

// SKILL.md section 6, step 5: states that wait on the orchestrator.
export const NEEDS_MAIN = new Set(['done', 'question', 'blocked', 'gate-fail', 'handoff'])

// Returns the valid facts, each with timeMs and its line number, and one error per bad line.
export function parseLog(text) {
  const facts = []
  const errors = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const fail = (message) => errors.push({ line: i + 1, message })
    let fact
    try {
      fact = JSON.parse(line)
    } catch {
      return fail('not JSON')
    }
    const missing = REQUIRED.filter((k) => typeof fact?.[k] !== 'string' || fact[k] === '')
    if (missing.length) return fail('missing ' + missing.join(', '))
    if (!EVENTS.has(fact.event)) return fail('unknown event ' + fact.event)
    if (fact.event === 'gate' && fact.result !== 'pass' && fact.result !== 'fail') {
      return fail('gate result must be pass or fail')
    }
    const timeMs = Date.parse(fact.time)
    if (Number.isNaN(timeMs)) return fail('bad time ' + fact.time)
    facts.push({ ...fact, timeMs, lineNo: i + 1 })
  })
  return { facts, errors }
}

function stateOf(fact) {
  switch (fact.event) {
    case 'start':
      return { state: 'working', node: fact.node }
    case 'done':
      return { state: 'done', node: fact.node }
    case 'question':
      return { state: 'question', node: fact.node, to: fact.to }
    case 'blocked':
      return { state: 'blocked', node: fact.node }
    case 'gate':
      return { state: fact.result === 'pass' ? 'gate-pass' : 'gate-fail', node: fact.node, gate: fact.gate }
    case 'return':
      return { state: 'fixing', node: fact.to ?? fact.node }
    case 'handoff':
      return { state: 'handoff', node: fact.node, to: fact.to }
    case 'finish':
      return { state: 'finished', node: fact.node }
  }
}

// SKILL.md section 6, step 2: an unanswered question decides; otherwise the latest fact that is
// neither a question nor an answer does.
function decidingFact(facts) {
  const asked = facts.filter((f) => f.event === 'question' || f.event === 'answer')
  const lastAsked = asked[asked.length - 1]
  if (lastAsked?.event === 'question') return lastAsked
  return facts.findLast((f) => f.event !== 'question' && f.event !== 'answer') ?? null
}

export function deriveTasks(facts, nowMs) {
  const byTask = new Map()
  for (const f of facts) {
    if (!byTask.has(f.task)) byTask.set(f.task, [])
    byTask.get(f.task).push(f)
  }
  const rows = []
  for (const [task, list] of byTask) {
    list.sort((a, b) => a.timeMs - b.timeMs || a.lineNo - b.lineNo)
    const last = list[list.length - 1]
    const deciding = decidingFact(list)
    const state = deciding ? stateOf(deciding) : { state: 'working', node: last.node }
    const returns = list.filter((f) => f.event === 'return')
    const rounds = Math.max(0, ...returns.map((f) => Number(f.round) || 0))
    const cap = returns.findLast((f) => f.cap !== undefined)?.cap
    const startedMs = list[0].timeMs
    const endMs = state.state === 'finished' ? deciding.timeMs : nowMs
    rows.push({ task, ...state, rounds, cap, startedMs, cycleMs: endMs - startedMs, lastMs: last.timeMs })
  }
  return rows
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 60) return minutes + 'm'
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return hours + 'h' + String(minutes % 60).padStart(2, '0') + 'm'
  return Math.floor(hours / 24) + 'd'
}

// Active tasks first, oldest start first; finished tasks after, most recently finished first.
export function sortRows(rows) {
  const active = rows.filter((r) => r.state !== 'finished').sort((a, b) => a.startedMs - b.startedMs)
  const finished = rows
    .filter((r) => r.state === 'finished')
    .sort((a, b) => b.startedMs + b.cycleMs - (a.startedMs + a.cycleMs))
  return { active, finished }
}

export function summary(rows) {
  const counts = {}
  for (const r of rows) if (r.state !== 'finished') counts[r.state] = (counts[r.state] ?? 0) + 1
  return Object.entries(counts)
    .map(([state, n]) => n + ' ' + STATE_LABELS[state])
    .join(' · ')
}
