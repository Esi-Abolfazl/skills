import { describe, expect, test } from 'claude-code/testing'

import { parseUsage } from '../hooks/register'
import type { Stats } from '../types'
import { NO_SCAN } from '../hooks/scan'
import { buildView } from '../hooks/view'

describe('polled limits', () => {
  test('reads both windows, drops what is not a number', () => {
    const body = JSON.stringify({ five_hour: { utilization: 23.456, resets_at: '2026-11-10T20:00:00Z' }, seven_day: { utilization: '9' }, extra: {} })
    expect(parseUsage(body)).toEqual([{ kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-10T20:00:00Z' }])
    expect(parseUsage('not json')).toEqual([])
    expect(parseUsage('null')).toEqual([])
  })
})

describe('polled limits in the view', () => {
  test('a fresh poll beats the engine reading and is not drawn faded; an old one does not', () => {
    const NOW = Date.parse('2026-11-10T12:00:00Z')
    const kept = [{ kind: 'five_hour', percentUsed: 60, resetsAt: '2026-11-10T15:00:00Z' }]
    const usage = { startedAt: NOW, context: { tokens: 0, window: 1_000_000, percent: 0 }, rateLimits: [{ kind: 'five_hour', percentUsed: 10, resetsAt: '2026-11-10T15:00:00Z' }] } as never
    const s: Stats = { transcript: '', scan: NO_SCAN, turnCosts: [], lastLimits: kept }
    const fresh = buildView({ ...s, limitsAt: NOW - 1000 }, usage, NOW).limits[0]
    expect(fresh?.pct).toBe(60)
    expect(fresh?.stale).toBeUndefined()
    expect(buildView({ ...s, limitsAt: NOW - 400_000 }, usage, NOW).limits[0]).toMatchObject({ pct: 10 })
  })
})
