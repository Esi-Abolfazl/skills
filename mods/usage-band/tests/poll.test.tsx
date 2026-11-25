import { describe, expect, test } from 'claude-code/testing'

import { parsePlan, parseUsage, planName } from '../hooks/register'
import type { Stats } from '../types'
import { NO_SCAN } from '../hooks/scan'
import { buildView } from '../hooks/view'

describe('polled limits', () => {
  test('reads both windows, drops what is not a number', () => {
    const body = JSON.stringify({ five_hour: { utilization: 23.456, resets_at: '2026-11-10T20:00:00Z' }, seven_day: { utilization: '9' }, extra: {} })
    expect(parseUsage(body)).toEqual([{ kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-11-10T20:00:00Z' }])
    // Shape of a real reply (2026-11-26): the Fable limit is only in `limits`, the seven_day_* keys are null.
    const extra = JSON.stringify({
      five_hour: { utilization: 1 },
      seven_day_opus: null,
      limits: [
        { kind: 'session', group: 'session', percent: 1, scope: null },
        { kind: 'weekly_all', group: 'weekly', percent: 80, scope: null },
        { kind: 'weekly_scoped', group: 'weekly', percent: 21, resets_at: '2026-11-28T06:00:00Z', scope: { model: { id: null, display_name: 'Fable' }, surface: null } },
        { kind: 'weekly_scoped', group: 'weekly', percent: null, scope: { model: { display_name: 'Opus' } } },
        { kind: 'weekly_scoped', group: 'weekly', percent: 5, scope: { model: null, surface: 'cowork' } },
        { kind: 'weekly_scoped', group: 'weekly', percent: 7, scope: { model: { display_name: 'Fable' }, surface: 'cowork' } },
      ],
      weekly_scoped_shares: [{ limit_index: 2, used_percent_of_weekly: 11, allowance_percent_of_weekly: 50 }, { limit_index: 9, used_percent_of_weekly: 'x' }],
    })
    expect(parseUsage(extra)).toEqual([
      { kind: 'five_hour', percentUsed: 1, resetsAt: undefined },
      { kind: 'seven_day_fable', percentUsed: 21, label: 'Fable', resetsAt: '2026-11-28T06:00:00Z', ofWeekly: 11 },
    ])
    expect(parseUsage('not json')).toEqual([])
    expect(parseUsage('null')).toEqual([])
  })
})

describe('plan name', () => {
  test('maps the organization type and tier; falls back; omits when absent', () => {
    expect(planName('claude_max', 'default_claude_max_20x')).toBe('Max 20x')
    expect(planName('claude_max', 'default_claude_max_5x')).toBe('Max 5x')
    expect(planName('claude_max')).toBe('Max')
    expect(planName('claude_pro')).toBe('Pro')
    expect(planName('claude_team', 'default_claude_max_5x')).toBe('Team')
    expect(planName('claude_enterprise')).toBe('Enterprise')
    expect(planName('claude_free_trial')).toBe('Free Trial')
    expect(planName(undefined)).toBeUndefined()
    expect(parsePlan(JSON.stringify({ organization: { organization_type: 'claude_max', rate_limit_tier: 'default_claude_max_20x' } }))).toBe('Max 20x')
    expect(parsePlan(JSON.stringify({ organization: {}, account: { has_claude_pro: true } }))).toBe('Pro')
    expect(parsePlan(JSON.stringify({ organization: { organization_type: 5 }, account: { has_claude_max: true } }))).toBe('Max')
    expect(parsePlan('{}')).toBeUndefined()
    expect(parsePlan('nope')).toBeUndefined()
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
