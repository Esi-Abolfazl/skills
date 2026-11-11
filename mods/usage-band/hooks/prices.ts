import type { Tokens } from '../types'

// USD per million tokens at the API's standard rates. The transcripts record no prices.
// Source: https://platform.claude.com/docs/en/about-claude/pricing, read 2026-11-10.
// shortcut: a hand-kept list; it goes stale with each new model or price change. A model not listed has no price
// (the card shows its tokens and "n/a"); the parity check (stale below) warns when this session's tokens no longer
// price to the engine's own cost. Update the list, then the date above.
// shortcut: cache writes are priced at the 5 minute rate (the transcript splits 5 minute from 1 hour writes in
// usage.cache_creation, which the scan does not keep); a 1 hour write costs 1.6x to 2x more.
// shortcut: Haiku 5.5 doubles its rates for prompts over 100,000 tokens; per message sizes are not kept, so the
// lower rate is used for all of it.
// shortcut: no data-residency (1.1x) or batch discounts.
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }
const p = (input: number, cacheWrite: number, cacheRead: number, output: number): Price => ({ input, cacheWrite, cacheRead, output })

const OPUS_OLD = p(5, 6.25, 0.5, 25)
const OPUS_LEGACY = p(15, 18.75, 1.5, 75)
const FABLE_5 = p(10, 12.5, 1, 50)
const FABLE_5_1 = p(10, 12.5, 0.25, 50)
const FABLE_5_2 = p(8, 10, 0.2, 40)
const SONNET_OLD = p(3, 3.75, 0.3, 15)

const PRICES: Record<string, Price> = {
  'claude-fable-5-2': FABLE_5_2,
  'claude-mythos-5-2': FABLE_5_2,
  'claude-fable-5-1': FABLE_5_1,
  'claude-mythos-5-1': FABLE_5_1,
  'claude-fable-5': FABLE_5,
  'claude-mythos-5': FABLE_5,
  'claude-opus-5-5': p(4, 5, 0.2, 20),
  'claude-opus-5': OPUS_OLD,
  'claude-opus-4-8': OPUS_OLD,
  'claude-opus-4-7': OPUS_OLD,
  'claude-opus-4-6': OPUS_OLD,
  'claude-opus-4-5': OPUS_OLD,
  'claude-opus-4-1': OPUS_LEGACY,
  'claude-opus-4': OPUS_LEGACY,
  'claude-sonnet-5-5': p(2, 2.5, 0.1, 10),
  'claude-sonnet-5': p(2, 2.5, 0.2, 10),
  'claude-sonnet-4-6': SONNET_OLD,
  'claude-sonnet-4-5': SONNET_OLD,
  'claude-sonnet-4': SONNET_OLD,
  'claude-haiku-5-5': p(0.1, 0.125, 0.01, 0.5),
  'claude-haiku-4-5': p(1, 1.25, 0.1, 5),
}

// A model id may carry a date (claude-haiku-4-5-20251001); the list keys do not.
const priceOf = (model: string): Price | undefined => PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, '')]

export function costOf(model: string, t: Tokens): number | undefined {
  const r = priceOf(model)
  return r && (t.input * r.input + t.output * r.output + t.cacheRead * r.cacheRead + t.cacheWrite * r.cacheWrite) / 1e6
}

// The prices have drifted from the engine's cost: a gap over 15 % and over $0.50.
export const stale = (est: number, engine: number) => Math.abs(est - engine) > 0.5 && Math.abs(est - engine) > 0.15 * engine
