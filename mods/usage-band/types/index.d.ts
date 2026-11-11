export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
// log: the last turns, oldest first, ctx the context the turn's last reply was answered over;
// sinceCompact: turns since the last compaction (all of them when there was none).
export type TurnLog = { startAt: number; ms: number; ctx: number }
export type Scan = { agentMs: number; turns: number; tokens: Tokens; compactions: number; log: TurnLog[]; sinceCompact: number }
// A rate limit as the engine reports it: kind five_hour or seven_day, percentUsed 0 to 100.
export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }
// One model's sums over a period and source, from the models ledger (hooks/models.ts); dollars are worked out when drawn.
export type ModelRow = Tokens & { period: 'day' | 'week' | 'month' | 'all'; source: 'all' | 'main' | 'sub'; model: string; sessions: number }
export type Tests = { state: 'pass' | 'fail' | 'stale'; passed?: number; failed?: number }
// maxTokens: the window /context measures against (the compaction window, which may be under the model's).
// scanError: why the last transcript read failed, shown on the band instead of silent zeros.
// turnCosts: the last turns' cost, newest last, each the session cost's rise over that turn; costBase: the total
// when the last turn ended. The transcript records no prices, so these are kept as the session goes.
export type Stats = {
  transcript: string
  scan: Scan
  maxTokens?: number
  compactAt?: number
  scanError?: string
  turnCosts: number[]
  costBase?: number
  // The last rate limits seen, in any session: the engine reports them only with a reply, so a session
  // opened or resumed shows these, faded, until its own first one.
  lastLimits?: RateLimit[]
  // When lastLimits was last polled from the account (ms); fresh readings outrank the engine's.
  limitsAt?: number
  // The models card: sums per period, source and model; why a read failed; whether a first scan is still catching up.
  models?: ModelRow[]
  modelsError?: string
  modelsMore?: boolean
  // This session's tokens priced against the engine's cost, read after a turn's scan: stale when they disagree.
  parity?: { est: number; engine: number; stale: boolean }
  // The models card's filters.
  period?: 'day' | 'week' | 'month' | 'all'
  source?: 'all' | 'main' | 'sub'
  // The last test run's outcome, 'stale' once code changed after it; absent before any run.
  tests?: Tests
  // The pane section a clicked card asked for; it opens when clicked.
  focus?: string
  // The pane's sections drawn open; the rest show their header and summary only.
  open?: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { stats: Stats }
  }
}
