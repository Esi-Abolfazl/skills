import { describe, expect, test } from 'claude-code/testing'

import type { Stats } from '../types'
import { HOUR, bandWidth } from '../hooks/pills'
import { isCode, isTestCommand, testOutcome } from '../hooks/testrun'
import { buildView, cacheRate, layouts, readContext, readLimit } from '../hooks/view'
import { NO_SCAN } from '../hooks/scan'

const NOW = Date.parse('2026-10-16T12:00:00Z')
const usage = (over: object = {}) =>
  ({ startedAt: NOW, context: { tokens: 200_000, window: 1_000_000, percent: 20 }, rateLimits: [], cost: { usd: 4 }, ...over }) as never
const base: Stats = { transcript: '', scan: NO_SCAN, turnCosts: [] }

describe('view', () => {
  test('pace: 50% used 1h into 5h fills in 1h, before the 4h reset, so it warns', () => {
    const u = usage({ rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt: new Date(NOW + 4 * HOUR).toISOString() }] })
    const l = readLimit(u, 'five_hour', NOW)!
    expect(l.fullIn).toBe(HOUR)
    expect(l.alert).toBe('warn')
  })
  test('pace: behind the clock never warns; thresholds still colour it', () => {
    const u = usage({ rateLimits: [{ kind: 'seven_day', percentUsed: 90, resetsAt: new Date(NOW + 1 * HOUR).toISOString() }] })
    const l = readLimit(u, 'seven_day', NOW)!
    expect(l.fullIn).toBe(undefined)
    expect(l.alert).toBe('hot')
  })
  test('before a reply, the last kept limits show faded, without pace; a reset window drops out', () => {
    const at = (h: number) => new Date(NOW + h * HOUR).toISOString()
    const kept = [
      { kind: 'five_hour', percentUsed: 70, resetsAt: at(-1) },
      { kind: 'seven_day', percentUsed: 50, resetsAt: at(48) },
    ]
    const v = buildView({ ...base, lastLimits: kept }, usage(), NOW)
    expect(v.limits[0]).toBe(undefined)
    expect(v.limits[1]!.stale).toBe(true)
    expect(v.limits[1]!.fullIn).toBe(undefined)
    const fresh = buildView({ ...base, lastLimits: kept }, usage({ rateLimits: [{ kind: 'seven_day', percentUsed: 52, resetsAt: at(48) }] }), NOW)
    expect(fresh.limits[1]!.stale).toBe(undefined)
    expect(fresh.limits[1]!.pct).toBe(52)
  })
  test('context forecast: turns since the last compaction, at their average rise', () => {
    const log = [100_000, 150_000, 200_000].map((ctx, i) => ({ startAt: i, ms: 1, ctx }))
    const s: Stats = { ...base, compactAt: 400_000, maxTokens: 500_000, scan: { ...NO_SCAN, log: [{ startAt: 0, ms: 1, ctx: 480_000 }, ...log], sinceCompact: 3 } }
    const c = readContext(s, usage())
    expect(c.max).toBe(500_000)
    expect(c.pct).toBe(40)
    expect(c.growth).toBe(50_000)
    expect(c.turnsLeft).toBe(4)
    expect(c.alert).toBe(undefined)
  })
  test('cache rate is cache reads over all input', () => {
    expect(cacheRate({ ...base, scan: { ...NO_SCAN, tokens: { input: 10, output: 0, cacheRead: 80, cacheWrite: 10 } } })).toBe(80)
    expect(cacheRate(base)).toBe(undefined)
  })
  test('the tests pill sits beside ctx only once a run was seen', () => {
    expect(buildView(base, usage(), NOW).pills.some(p => p.segs.some(s => s.kind === 'text' && s.s === 'tests'))).toBe(false)
    // ctx over agent and cost either way; with a run seen, the tests card stands beside them, two rows tall.
    const tone = (p: unknown) => (p as { tone: string }).tone
    const v = buildView({ ...base, tests: { state: 'fail', failed: 2, passed: 10 } }, usage(), NOW)
    const [work, tests] = v.session(2)
    expect(tone(work![0])).toBe('ctx')
    expect((work![1] as unknown[]).map(tone)).toEqual(['time', 'cost'])
    expect(tests!.length).toBe(1)
    const card = tests![0] as { segs: { s?: string }[]; sub: { s?: string }[] }
    expect(card.segs.map(s => s.s).filter(Boolean)).toEqual(['tests'])
    expect(card.sub.map(s => s.s)).toEqual(['2 failed'])
    const none = buildView(base, usage(), NOW).session(2)
    expect(none.length).toBe(1)
    expect((none[0]![1] as unknown[]).map(tone)).toEqual(['time', 'cost'])
  })
})

describe('layout choice', () => {
  // The figures of a real screenshot at ~840px: 2 lines must fit an ~800px slot, inside it.
  test('a full band at ~800px stays on two lines, inside the slot', () => {
    const u = usage({
      context: { tokens: 333_700, window: 1_000_000 },
      cost: { usd: 12.97 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 0, resetsAt: new Date(NOW + 5 * HOUR).toISOString() },
        { kind: 'seven_day', percentUsed: 61, resetsAt: new Date(NOW + 113 * HOUR).toISOString() },
      ],
    })
    const log = [250_000, 280_000, 310_000, 333_700].map((ctx, i) => ({ startAt: i, ms: 1, ctx }))
    const s: Stats = {
      ...base,
      maxTokens: 500_000,
      compactAt: 400_000,
      turnCosts: [0.4, 1.2],
      scan: { ...NO_SCAN, turns: 13, agentMs: 35 * 60_000, sinceCompact: 4, log, tokens: { input: 400, output: 146_300, cacheRead: 30_000_000, cacheWrite: 290_000 } },
    }
    const all = layouts(buildView(s, u, NOW))
    const pick = all.find(g => bandWidth(...g) <= 800)
    expect(pick?.length).toBe(1)
    expect(bandWidth(...pick!)).toBeLessThan(801)
  })
})

describe('testrun', () => {
  test('knows test runners and nothing else', () => {
    for (const c of ['pnpm test', 'pnpm run test:unit', 'uv run pytest -q', 'cd x && vitest run', 'claude plugin test ./m', 'go test ./...']) expect(isTestCommand(c)).toBe(true)
    for (const c of ['ls tests', 'cat test.txt', 'git commit -m "add test"', 'pnpm build']) expect(isTestCommand(c)).toBe(false)
  })
  test('reads the summary counts; a failed count fails the run', () => {
    expect(testOutcome(false, ' 12 pass\n 0 fail\n')).toEqual({ state: 'pass', passed: 12, failed: 0 })
    expect(testOutcome(false, 'Tests: 2 failed, 10 passed')).toEqual({ state: 'fail', passed: 10, failed: 2 })
    expect(testOutcome(true, 'boom').state).toBe('fail')
  })
  test('only source edits stale a run', () => {
    expect(isCode('/a/b.tsx')).toBe(true)
    expect(isCode('/a/README.md')).toBe(false)
  })
})
