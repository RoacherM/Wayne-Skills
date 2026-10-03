import { expect, test } from 'claude-code/testing'
import { deriveTasks, formatDuration, parseLog, sortRows, summary } from '../hooks/derive.js'

const at = (minute: number) => `2026-10-03T10:${String(minute).padStart(2, '0')}:00+08:00`
const ms = (minute: number) => Date.parse(at(minute))
const fact = (minute: number, event: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ time: at(minute), task: 'B7', event, node: '修复', by: '主控', ...extra })
const rowsOf = (lines: string[], nowMinute = 59) => deriveTasks(parseLog(lines.join('\n')).facts, ms(nowMinute))
const only = (lines: string[], nowMinute?: number) => rowsOf(lines, nowMinute)[0]

test('each event reads as its state', () => {
  expect(only([fact(0, 'start')]).state).toBe('working')
  expect(only([fact(0, 'start'), fact(5, 'done')]).state).toBe('done')
  expect(only([fact(0, 'start'), fact(5, 'question', { to: '主控' })]).state).toBe('question')
  expect(only([fact(0, 'start'), fact(5, 'blocked')]).state).toBe('blocked')
  expect(only([fact(0, 'start'), fact(5, 'gate', { gate: '合并', result: 'pass' })]).state).toBe('gate-pass')
  expect(only([fact(0, 'start'), fact(5, 'gate', { gate: '合并', result: 'fail' })]).state).toBe('gate-fail')
  expect(only([fact(0, 'start'), fact(5, 'handoff', { to: '用户' })]).state).toBe('handoff')
  expect(only([fact(0, 'start'), fact(5, 'finish', { node: '合并' })]).state).toBe('finished')
})

test('a return puts the task back in the target node; rounds are the largest round, not a count', () => {
  const row = only([
    fact(0, 'start'),
    fact(5, 'done'),
    fact(6, 'return', { node: '审查', to: '修复', round: 1, cap: 3 }),
    fact(7, 'return', { node: '审查', to: '修复', round: 1, cap: 3 }), // the same fact written twice
  ])
  expect(row.state).toBe('fixing')
  expect(row.node).toBe('修复')
  expect(row.rounds).toBe(1)
  expect(row.cap).toBe(3)
})

test('an answer goes back to the state before its question', () => {
  const lines = [fact(0, 'start'), fact(5, 'question', { to: '主控' }), fact(6, 'answer')]
  expect(only(lines).state).toBe('working')
  // Two questions in a row, both answered
  const twice = [...lines, fact(7, 'question', { to: '主控' }), fact(8, 'answer')]
  expect(only(twice).state).toBe('working')
  // Answered during a fix round: still fixing in the same node
  const inFix = [fact(0, 'start'), fact(5, 'return', { node: '审查', to: '修复', round: 1 }), fact(6, 'question'), fact(7, 'answer')]
  expect(only(inFix).state).toBe('fixing')
})

test('a delivery made while a question was open counts once the question is answered', () => {
  const asked = [fact(0, 'start'), fact(5, 'question', { to: '主控' }), fact(6, 'done')]
  expect(only(asked).state).toBe('question')
  expect(only([...asked, fact(7, 'answer')]).state).toBe('done')
  // An answer with no question is ignored
  expect(only([fact(0, 'start'), fact(5, 'answer')]).state).toBe('working')
})

test('facts are ordered by time, then by their place in the file', () => {
  expect(only([fact(5, 'done'), fact(0, 'start')]).state).toBe('done')
  expect(only([fact(5, 'start'), fact(5, 'done')]).state).toBe('done')
  expect(only([fact(5, 'done'), fact(5, 'start')]).state).toBe('working')
})

test('the cap comes from the latest return that has one', () => {
  const row = only([fact(0, 'return', { to: '修复', round: 1, cap: 3 }), fact(5, 'return', { to: '修复', round: 2 })])
  expect(row.rounds).toBe(2)
  expect(row.cap).toBe(3)
})

test('facts after finish reopen the task', () => {
  const row = only([fact(0, 'start'), fact(10, 'finish'), fact(20, 'start')], 45)
  expect(row.state).toBe('working')
  expect(row.cycleMs).toBe(45 * 60_000)
})

test('cycle runs from the first fact to finish, or to now', () => {
  expect(only([fact(0, 'start'), fact(30, 'finish')]).cycleMs).toBe(30 * 60_000)
  expect(only([fact(0, 'start')], 45).cycleMs).toBe(45 * 60_000)
})

test('bad lines are reported with their line numbers and the good lines still count', () => {
  const { facts, errors } = parseLog(
    [fact(0, 'start'), '{not json', JSON.stringify({ time: at(1), task: 'B7', event: 'start' }), fact(2, 'teleport'), JSON.stringify({ time: 'yesterday', task: 'B7', event: 'done', node: 'x', by: 'y' }), ''].join('\n'),
  )
  expect(facts.length).toBe(1)
  expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5])
  expect(errors[1].message).toBe('missing node, by')
  expect(errors[2].message).toBe('unknown event teleport')
})

test('a gate fact needs result pass or fail', () => {
  const { facts, errors } = parseLog(
    [fact(0, 'gate', { gate: 'G1', result: 'pass' }), fact(1, 'gate', { gate: 'G1' }), fact(2, 'gate', { gate: 'G1', result: 'Fail' })].join('\n'),
  )
  expect(facts.length).toBe(1)
  expect(errors.map((e) => e.message)).toEqual(['gate result must be pass or fail', 'gate result must be pass or fail'])
})

test('active tasks first, oldest first; finished after, most recently finished first', () => {
  const row = (task: string, state: string, startedMs: number, cycleMs: number) => ({ task, state, startedMs, cycleMs })
  const { active, finished } = sortRows([row('A', 'working', 20, 1), row('F1', 'finished', 0, 10), row('B', 'done', 10, 1), row('F2', 'finished', 5, 30)] as any)
  expect(active.map((r: any) => r.task)).toEqual(['B', 'A'])
  expect(finished.map((r: any) => r.task)).toEqual(['F2', 'F1'])
})

test('durations and the summary line', () => {
  expect(formatDuration(42 * 60_000)).toBe('42m')
  expect(formatDuration(125 * 60_000)).toBe('2h05m')
  expect(formatDuration(72 * 3_600_000)).toBe('3d')
  expect(summary([{ state: 'done' }, { state: 'done' }, { state: 'working' }, { state: 'finished' }] as any)).toBe('2 已交付 · 1 进行中')
})
