import { describe, expect, mock, test } from 'claude-code/testing'

import type { ModelRow } from '../types'
import { hourOf, parseQuery, windowStarts } from '../hooks/models'
import { costOf, stale } from '../hooks/prices'
import { buildModels } from '../hooks/view'

const row = (model: string, o: Partial<ModelRow> = {}): ModelRow => ({ period: 'week', source: 'all', model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, sessions: 1, ...o })

describe('models card figures', () => {
  test('a model with a price is costed, one without is n/a and counted', () => {
    expect(Math.round(costOf('claude-opus-5-5', { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 })! * 100)).toBe(2920)
    expect(costOf('claude-haiku-4-5-20251001', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(1)
    expect(costOf('claude-unknown-9', { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 })).toBeUndefined()
    const m = buildModels([row('claude-opus-5-5', { input: 1e6 }), row('claude-unknown-9', { input: 5e6 }), row('*', { sessions: 3 })], 'week', 'all')!
    expect(m.unpriced).toBe(1)
    expect(m.usd).toBe(4)
    // Share falls back to tokens while a model has no price: it must not read 100 % for the one priced model.
    expect(m.byCost).toBe(false)
    expect(m.lines.map(l => Math.round(l.share))).toEqual([83, 17])
    expect(m.sessions).toBe(3)
  })

  test('share sums to 100 when every model is priced, and the filter picks period and source', () => {
    const rows = [
      row('claude-opus-5-5', { output: 1e6 }),
      row('claude-sonnet-5-5', { output: 1e6 }),
      row('claude-opus-5-5', { period: 'day', output: 5e6 }),
      row('claude-opus-5-5', { source: 'sub', output: 7e6 }),
    ]
    const m = buildModels(rows, 'week', 'all')!
    expect(m.byCost).toBe(true)
    expect(Math.round(m.lines.reduce((n, l) => n + l.share, 0))).toBe(100)
    expect(m.lines[0]!.model).toBe('claude-opus-5-5')
    expect(buildModels(rows, 'day', 'all')!.lines[0]!.output).toBe(5e6)
    expect(buildModels(rows, 'week', 'sub')!.lines[0]!.output).toBe(7e6)
    expect(buildModels(rows, 'month', 'all')!.lines).toEqual([])
    expect(buildModels(undefined, 'week', 'all')).toBeUndefined()
  })

  test('windows start at the hour holding now minus the span', () => {
    const now = Date.parse('2026-11-10T12:30:00Z')
    expect(windowStarts(now)).toEqual({ D: '2026-11-09T12', W: '2026-11-03T12', M: '2026-10-11T12' })
    expect(hourOf(now)).toBe('2026-11-10T12')
  })

  test('the query output is read, junk lines dropped', () => {
    const rows = parseQuery('S week all claude-opus-5-5 1 2 3 4 5\nS bogus all x 1 2 3 4 5\nnoise\n')
    expect(rows).toEqual([{ period: 'week', source: 'all', model: 'claude-opus-5-5', input: 1, output: 2, cacheRead: 3, cacheWrite: 4, sessions: 5 }])
  })

  test('price parity: warns past 15 % and $0.50, not for small sums or small gaps', () => {
    expect(stale(10, 12)).toBe(true)
    expect(stale(10, 10.4)).toBe(false)
    expect(stale(0.1, 0.4)).toBe(false)
  })
})

const NOW = Date.parse('2026-11-10T12:00:00Z')
const PANE = (bodyColumns: number) => ({ component: 'Pane', requestId: 'usage-band', props: { title: 'Usage details', isFocused: true, bodyColumns, placement: 'dock' } }) as const
const QUERY = [
  'S week all claude-opus-5-5 0 1000000 0 0 4',
  'S week all * 0 1000000 0 0 4',
  'S day all claude-opus-5-5 0 3000000 0 0 1',
  'S day all * 0 3000000 0 0 1',
].join('\n')

describe('models card in the pane', () => {
  test('a timer scan fills it: models with an estimate, a period button changes the figures', async ($, on) => {
    const o = on as unknown as (ev: string, fn: (...a: never[]) => unknown) => void
    const clock = mock.clock(on as never, { now: NOW })
    const done = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    o('env.get', ((_$: unknown, e: { name: string }) => ({ value: e.name === 'HOME' ? '/home/me' : undefined })) as never)
    o('session.id', () => ({ value: 'abc' }))
    o('session.turns', () => ({ value: 0 }))
    o('command.register', () => ({ value: undefined }))
    o('session.start', ((_$: unknown, e: unknown) => e) as never)
    o('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 1000, window: 10_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } } }))
    o('process.run', ((_$: unknown, e: { argv: string[] }) => ({ value: { ...done, stdout: e.argv[0] === 'awk' ? QUERY : '' } })) as never)

    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
    await clock.advance(10)
    // Wide first; the choices are kept, so the narrow pane that follows starts on Day with the card open.
    for (const columns of [120, 40]) {
      const pane = await $.ui.mount({ plugin: 'usage-band', surface: 'desktop', ...PANE(columns) } as never)
      const header = async () => {
        const all = (await pane.findAll({ type: 'Client' } as never)) as unknown as { props: { props: { id: string; summary: string } } }[]
        return all.find(c => c.props.props.id === 'models')!.props.props.summary
      }
      const first = columns === 120
      expect(await header()).toBe(first ? 'Week · $20.00' : 'Day · $60.00')
      if (!first) {
        expect(await pane.find({ type: 'Text', text: /\$60\.00 estimate/ } as never)).toBeDefined()
        await pane.unmount()
        continue
      }
      // A click on the header opens the card; then the figures, and the period buttons, are drawn.
      await pane.resize({ columns, rows: 1, in: 'open-models' } as never)
      await pane.pointer({ type: 'up', x: columns - 5, y: 0, button: 'left', in: 'open-models' } as never)
      expect(await pane.find({ type: 'Text', text: /\$20\.00 estimate/ } as never)).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /4 sessions/ } as never)).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /claude-opus-5-5/ } as never)).toBeDefined()
      // The tabs are Clients that draw the chip; the selected one is the filled one.
      const tabs = (await pane.findAll({ type: 'Client' } as never)) as unknown as { key: string; props: { props: { id: string; active?: boolean } } }[]
      expect(tabs.find(t => t.props.props.id === 'week')!.props.props.active).toBe(true)
      await pane.resize({ columns: 5, rows: 1, in: 'period-day' } as never)
      await pane.pointer({ type: 'up', x: 2, y: 0, button: 'left', in: 'period-day' } as never)
      expect(await pane.find({ type: 'Text', text: /\$60\.00 estimate/ } as never)).toBeDefined()
      expect(await header()).toBe('Day · $60.00')
      await pane.unmount()
    }
  })
})

describe('scan timing', () => {
  test('a turn ends while the models scan is still running', async ($, on) => {
    const o = on as unknown as (ev: string, fn: (...a: never[]) => unknown) => void
    const clock = mock.clock(on as never, { now: NOW })
    let scanStarted = false
    o('env.get', ((_$: unknown, e: { name: string }) => ({ value: e.name === 'HOME' ? '/home/me' : undefined })) as never)
    o('session.id', () => ({ value: 'abc' }))
    o('session.turns', () => ({ value: 1 }))
    o('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 1, window: 10, percent: 0 }, rateLimits: [], cost: { usd: 1 } } }))
    o('turn.complete', () => ({ text: '' }))
    // The models scan never answers; every other command does.
    o('process.run', ((_$: unknown, e: { argv: string[] }) => {
      if (e.argv[0] === '/bin/sh' && String(e.argv[2]).includes('mkdir "$lock"')) {
        scanStarted = true
        return new Promise(() => undefined)
      }
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }) as never)
    await $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' } as never)
    await clock.advance(10)
    expect(scanStarted).toBe(true)
  })
})
