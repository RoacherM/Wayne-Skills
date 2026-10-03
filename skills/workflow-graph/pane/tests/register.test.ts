import { expect, mock, test } from 'claude-code/testing'

const at = (minute: number) => `2026-10-03T10:${String(minute).padStart(2, '0')}:00+08:00`
const fact = (minute: number, event: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ time: at(minute), task: 'B7', event, node: '修复', by: '主控', ...extra })

const PANE = {
  plugin: 'workflow-pane',
  component: 'Pane',
  requestId: 'workflow-pane',
  surface: 'terminal',
  viewport: { columns: 100, rows: 30 },
  props: { title: 'Workflow', isFocused: true, bodyColumns: 70, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

// log() returns the file's current content, or null when it does not exist. Every read sees a
// new size so the mod's cache never hides a change.
function stubSession(on: any, log: () => string | null) {
  const shown = { toasts: [] as string[], status: [] as string[] }
  let reads = 0
  on('ui.status', ($: any, e: any) => { shown.status.push(e.text); return { value: undefined } })
  on('ui.toast', ($: any, e: any) => { shown.toasts.push(e.text); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work' }))
  on('fs.exists', () => ({ value: log() !== null }))
  on('fs.stat', () => ({ value: { kind: 'file', size: ++reads, mtimeMs: reads, isLink: false } }))
  on('fs.read', () => ({ value: log() }))
  return shown
}

const start = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

test('no toast on the first refresh; one for each new fact that waits on the orchestrator', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse(at(30)) })
  let lines = [fact(0, 'start'), fact(5, 'done')]
  const shown = stubSession(on, () => lines.join('\n'))
  await start($)
  expect(shown.toasts).toEqual([])
  lines = [...lines, fact(6, 'return', { node: '审查', to: '修复', round: 1, cap: 3 }), fact(9, 'question', { to: '主控' })]
  await clock.advance(5000)
  lines = [...lines, fact(10, 'answer'), fact(12, 'question', { to: '主控' })]
  await clock.advance(5000)
  expect(shown.toasts).toEqual(['B7 · 修复 → 有提问', 'B7 · 修复 → 有提问'])
})

test('the pane shows node, state and rounds; bad lines are named, not hidden', async ($, on) => {
  mock.clock(on, { now: Date.parse(at(30)) })
  const shown = stubSession(on, () =>
    [fact(0, 'start'), fact(5, 'done'), fact(6, 'return', { node: '审查', to: '修复', round: 2, cap: 3 }), '{oops'].join('\n'),
  )
  await start($)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: 'B7' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '修改中' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '退回 2/3' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /第 4 行 not JSON/ })).toBeDefined()
  expect(shown.status.at(-1)).toBe('1 修改中 · 1 行无效')
})

test('a missing log is said plainly', async ($, on) => {
  mock.clock(on, { now: Date.parse(at(30)) })
  const shown = stubSession(on, () => null)
  await start($)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /这里还没有 .workflow\/log.jsonl/ })).toBeDefined()
  expect(shown.status.at(-1)).toBe('no .workflow/log.jsonl here')
})
