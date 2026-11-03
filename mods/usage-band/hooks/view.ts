// Every figure the band and the details pane show, worked out once from the stored stats and the
// engine's usage. Pure, so tests can drive it without an engine.
import type { SessionUsage } from 'claude-code'

import type { RateLimit, Stats } from '../types'
import { WINDOWS, fmtSpan, fmtTokens, level, windowMark } from './pills'
import type { Alert, Column, Pill } from './pills'

export type Detail = 0 | 1 | 2

// stale: a reading kept from before this session's first reply; its pace is not projected.
export type Limit = { kind: string; pct: number; left?: number; mark?: number; fullIn?: number; alert?: Alert; stale?: boolean }

const worse = (a?: Alert, b?: Alert): Alert | undefined => (a === 'hot' || b === 'hot' ? 'hot' : a ?? b)

// Pace: usage per elapsed ms, carried forward. Warns only when the window fills before it resets.
export function readLimit(usage: SessionUsage, kind: string, now: number): Limit | undefined {
  const l = usage.rateLimits.find(r => r.kind === kind)
  if (l === undefined) return undefined
  const left = l.resetsAt ? Date.parse(l.resetsAt) - now : undefined
  const mark = windowMark(kind, l.resetsAt, now)
  const span = WINDOWS[kind]
  let fullIn: number | undefined
  if (mark !== undefined && span !== undefined && left !== undefined && mark > 0 && l.percentUsed > 0 && l.percentUsed < 100) {
    const msPerPct = (span * (mark / 100)) / l.percentUsed
    const ms = (100 - l.percentUsed) * msPerPct
    if (ms < left) fullIn = Math.round(ms)
  }
  return { kind, pct: l.percentUsed, left, mark, fullIn, alert: worse(level(l.percentUsed), fullIn !== undefined ? 'warn' : undefined) }
}

export type Context = { used: number; max: number; pct: number; compactAt?: number; compactPct?: number; turnsLeft?: number; growth?: number; alert?: Alert }

// Turns to auto-compact: the context's average rise over the last few turns since the last compaction.
export function readContext(s: Stats, usage: SessionUsage): Context {
  const used = usage.context.tokens ?? 0
  const max = s.maxTokens ?? usage.context.window
  const pct = max > 0 ? (used / max) * 100 : 0
  const compactAt = s.compactAt
  const compactPct = compactAt !== undefined && max > 0 ? (compactAt / max) * 100 : undefined
  const recent = s.scan.log.slice(-Math.max(0, Math.min(s.scan.sinceCompact, s.scan.log.length))).filter(t => t.ctx > 0).slice(-6)
  const growth = recent.length >= 2 ? (recent[recent.length - 1]!.ctx - recent[0]!.ctx) / (recent.length - 1) : undefined
  const turnsLeft = growth !== undefined && growth > 0 && compactAt !== undefined && compactAt > used ? Math.ceil((compactAt - used) / growth) : undefined
  // Nearness to the compaction is what matters; with auto-compact off, nearness to the window.
  const alert = level(compactAt !== undefined && compactAt > 0 ? (used / compactAt) * 100 : pct)
  return { used, max, pct, compactAt, compactPct, turnsLeft, growth, alert }
}

export const cacheRate = (s: Stats) => {
  const t = s.scan.tokens
  const all = t.input + t.cacheRead + t.cacheWrite
  return all > 0 ? (t.cacheRead / all) * 100 : undefined
}

// A kept reading is good until its window resets; after that its figure means nothing.
export const keptLimits = (kept: RateLimit[], now: number) => kept.filter(l => l.resetsAt === undefined || Date.parse(l.resetsAt) > now)

function limitPill(l: Limit | undefined, detail: Detail): Pill | undefined {
  if (l === undefined) return undefined
  const is5h = l.kind === 'five_hour'
  const pct = Math.round(l.pct)
  return {
    tone: is5h ? 'limit5h' : 'limit7d',
    glyph: '',
    alert: l.alert,
    title:
      (l.stale ? 'Last seen, before this session\'s first reply. ' : '') +
      `${is5h ? '5-hour' : '7-day'} limit: ${pct}% used` +
      (l.left !== undefined ? `, resets in ${fmtSpan(l.left)}` : '') +
      (l.fullIn !== undefined ? `. At this pace it is full in ${fmtSpan(l.fullIn)}, before the reset` : '') +
      '. The tick is how far through the window the clock is.',
    segs: [
      { kind: 'icon', name: is5h ? 'gauge' : 'calendar' },
      { kind: 'text', s: is5h ? '5h' : '7d', dim: true },
      { kind: 'bar', pct: l.pct, mark: l.mark },
      { kind: 'text', s: `${pct}%`, bold: !l.stale, dim: l.stale },
      ...(detail >= 2 && l.fullIn !== undefined ? ([{ kind: 'text', s: `full ${fmtSpan(l.fullIn)}`, warn: true }] as const) : []),
      ...(l.left !== undefined ? ([{ kind: 'sep' }, { kind: 'icon', name: 'history', dim: true }, { kind: 'text', s: fmtSpan(l.left), dim: true }] as const) : []),
    ],
  }
}

function contextPill(c: Context, compactions: number, detail: Detail): Pill {
  return {
    tone: 'ctx',
    glyph: 'ctx',
    alert: c.alert,
    title:
      `Context: ${c.used.toLocaleString()} of ${c.max.toLocaleString()} tokens. ` +
      (c.compactAt !== undefined ? `Auto-compact at ${c.compactAt.toLocaleString()}. ` : 'Auto-compact is off. ') +
      (c.turnsLeft !== undefined ? `About ${c.turnsLeft} turns to it, at ${fmtTokens(c.growth ?? 0)} a turn. ` : '') +
      `Compacted ${compactions} ${compactions === 1 ? 'time' : 'times'} this session.`,
    segs: [
      { kind: 'icon', name: 'layers' },
      { kind: 'text', s: 'ctx', dim: true },
      { kind: 'bar', pct: c.pct },
      { kind: 'text', s: `${Math.round(c.pct)}%`, bold: true },
      ...(detail >= 1 && c.turnsLeft !== undefined ? ([{ kind: 'text', s: `~${c.turnsLeft}t`, warn: c.turnsLeft <= 3 }] as const) : []),
      { kind: 'sep' },
      { kind: 'text', s: `${fmtTokens(c.used)}/${fmtTokens(c.max)}`, dim: true },
      { kind: 'icon', name: 'fold' },
      { kind: 'text', s: `×${compactions}`, bold: true },
    ],
  }
}

// The card two rows tall: the label on line 1, the verdict on line 2.
function testsPill(s: Stats): Pill | undefined {
  const t = s.tests
  if (t === undefined) return undefined
  const counts = t.state === 'fail' ? `${t.failed ?? ''} failed`.trim() : t.passed !== undefined ? `${t.passed} passed` : 'passed'
  return {
    tone: t.state,
    glyph: t.state === 'pass' ? '✓' : t.state === 'fail' ? '✗' : '○',
    title: t.state === 'stale' ? 'Code changed since the last test run' : `Last test run: ${counts}`,
    segs: [{ kind: 'icon', name: t.state === 'pass' ? 'check' : t.state === 'fail' ? 'cross' : 'flask' }, { kind: 'text', s: 'tests', dim: true }],
    sub: [{ kind: 'text', s: t.state === 'stale' ? 'stale' : counts, bold: true }],
  }
}

export type View = {
  meters: (detail: Detail) => Column[]
  session: (detail: Detail) => Column[]
  pills: Pill[]
  limits: (Limit | undefined)[]
  context: Context
  avg?: number
  last?: number
  cache?: number
}

export function buildView(s: Stats, usage: SessionUsage, now: number): View {
  const { scan, scanError, turnCosts } = s
  // No reading yet this session: the last one kept, minus any window that has since reset.
  const stale = usage.rateLimits.length === 0 && (s.lastLimits?.length ?? 0) > 0
  const live: SessionUsage = stale ? { ...usage, rateLimits: keptLimits(s.lastLimits!, now) as SessionUsage['rateLimits'] } : usage
  const limits = [readLimit(live, 'five_hour', now), readLimit(live, 'seven_day', now)].map(l =>
    l && stale ? { ...l, stale: true, fullIn: undefined, alert: level(l.pct) } : l,
  )
  const context = readContext(s, usage)
  const cache = cacheRate(s)
  const inTokens = scan.tokens.input + scan.tokens.cacheWrite
  const last = turnCosts[turnCosts.length - 1]
  const avg = usage.cost && scan.turns > 0 ? usage.cost.usd / scan.turns : undefined

  const agent = (detail: Detail): Pill => ({
    tone: 'time',
    glyph: 'agent',
    title: scanError ? `Could not read the transcript: ${scanError}` : `Agent time ${fmtSpan(scan.agentMs)} over ${scan.turns} turns`,
    segs: [
      ...(scanError ? ([{ kind: 'text', s: '⚠', bold: true }] as const) : []),
      { kind: 'icon', name: 'bot' },
      { kind: 'text', s: 'agent', dim: true },
      { kind: 'text', s: fmtSpan(scan.agentMs), bold: true },
      { kind: 'text', s: detail >= 1 ? `${scan.turns} ${scan.turns === 1 ? 'turn' : 'turns'}` : `${scan.turns}t`, dim: true },
    ],
  })
  const input = (detail: Detail): Pill => ({
    tone: 'in',
    glyph: '↑',
    title:
      `Input sent: ${inTokens.toLocaleString()} tokens (uncached + cache writes). Cache reads: ${scan.tokens.cacheRead.toLocaleString()}` +
      (cache !== undefined ? `. ${Math.round(cache)}% of input came from the cache` : ''),
    segs: [
      { kind: 'icon', name: 'upload' },
      { kind: 'text', s: 'in', dim: true },
      { kind: 'text', s: fmtTokens(inTokens), bold: true },
      ...(detail >= 1 && cache !== undefined ? ([{ kind: 'text', s: `${Math.round(cache)}% cached`, dim: true }] as const) : []),
    ],
  })
  const output: Pill = {
    tone: 'out',
    glyph: '↓',
    title: `Output: ${scan.tokens.output.toLocaleString()} tokens`,
    segs: [{ kind: 'icon', name: 'download' }, { kind: 'text', s: 'out', dim: true }, { kind: 'text', s: fmtTokens(scan.tokens.output), bold: true }],
  }
  const cost = (detail: Detail): Pill | undefined =>
    usage.cost && {
      tone: 'cost',
      glyph: '$',
      title:
        `Session cost $${usage.cost.usd.toFixed(2)}` +
        (last !== undefined ? `. Last turn $${last.toFixed(2)}` : '') +
        (avg !== undefined ? `. Average $${avg.toFixed(2)} a turn over ${scan.turns} turns` : '') +
        (turnCosts.length > 1 ? `. Bars: the last ${turnCosts.length} turns` : ''),
      segs: [
        { kind: 'icon', name: 'coin' },
        { kind: 'text', s: `$${usage.cost.usd.toFixed(2)}`, bold: true },
        ...(detail >= 1 && last !== undefined ? ([{ kind: 'text', s: `last $${last.toFixed(2)}`, dim: true }] as const) : []),
        ...(detail >= 2 && avg !== undefined ? ([{ kind: 'text', s: `⌀ $${avg.toFixed(2)}`, dim: true }] as const) : []),
        ...(detail >= 2 && turnCosts.length > 1 ? ([{ kind: 'spark', values: turnCosts }] as const) : []),
      ],
    }

  const tests = testsPill(s)
  // With a test run seen:                  Without:
  //   5h | in  | ctx         | tests          5h | in  | ctx
  //   7d | out | agent, cost | (tests)        7d | out | agent, cost
  // The tests card is two rows tall: its label, then its verdict.
  // Narrow, the meters and the session stack as two grids of the same shape.
  const meters = (detail: Detail): Column[] => [
    [limitPill(limits[0], detail), limitPill(limits[1], detail)],
    [input(detail), output],
  ]
  const session = (detail: Detail): Column[] => {
    const c = cost(detail)
    const ctx = contextPill(context, scan.compactions, detail)
    const work: Column = [ctx, c ? [agent(detail), c] : agent(detail)]
    return tests ? [work, [tests]] : [work]
  }
  const pills = [...meters(2), ...session(2)].flat(2).filter((p): p is Pill => p !== undefined)
  return { meters, session, pills, limits, context, avg, last, cache }
}

// The layouts to try, roomiest first: two lines with full, then less, detail; then four lines.
// Two lines at full, then less, detail; then four lines the same way. Detail goes before height.
export const layouts = (v: View): Column[][][] => [
  ...([2, 1, 0] as const).map(d => [[...v.meters(d), ...v.session(d)]]),
  ...([2, 1, 0] as const).map(d => [v.meters(d), v.session(d)]),
]
