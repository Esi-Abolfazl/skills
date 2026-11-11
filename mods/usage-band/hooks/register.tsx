import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { RateLimit, Stats } from '../types'
import { bandSvg, bandText, bandWidth, fmtSpan, fmtTokens, meterColor, slotPx } from './pills'
import { NO_SCAN, SCAN_AWK, SCAN_SH, parseScan } from './scan'
import { isCode, isTestCommand, testOutcome } from './testrun'
import { ACCENT } from './cells'
import { VERSION } from './version'
import { MODELS_AWK, MODELS_QUERY_AWK, MODELS_SESSION_AWK, MODELS_SH, PERIODS, SOURCES, parseQuery, windowStarts } from './models'
import { costOf, stale as pricesStale } from './prices'
import { buildModels, buildView, layouts, polledFresh } from './view'

type ClientEl = (p: { key: string; module: string; props: unknown; width: string; height?: string }) => never
type SvgEl = (p: { source: string; width: number; height: number; alt: string }) => never
const PANE = 'usage-band'
// Surfaces that tore down one of this plugin's Clients: under load the desktop's module frame misses its
// watchdogs (10s to load, 2s to draw) and takes every instance of the plugin with it. There the sites
// draw without Clients until the next retry.
const down = new Set<string>()
const RETRY_MS = 30_000
const EMPTY: Stats = { transcript: '', scan: NO_SCAN, turnCosts: [] }
const stats = atom({ plugin: 'usage-band', key: 'stats' } as const, EMPTY)
// A Stats kept by an older version lacks newer fields; the spread fills them in.
const load = async ($: EngineInterface): Promise<Stats> => {
  const s = { ...EMPTY, ...(await read($, stats)) }
  return { ...s, scan: { ...NO_SCAN, ...s.scan } }
}

// The transcript is the one record of the whole session (turns before this band loaded, reloads,
// compactions), so tokens, agent time and compactions are read from it, never kept as counters.
// Awaited by the hook that asks: work a hook leaves running is cut off when its dispatch ends.
// Each scan reads only the bytes past the last one (SCAN_SH), its state in <config>/usage-band/<session id>.state.
// The transcript is <config>/projects/<cwd, mangled>/<session id>.jsonl; found by id, not by re-deriving the mangling.
// Found here, not taken from UserPromptSubmit's transcript_path: a plugin in an outer tier can skip that hook.
const configDir = async ($: EngineInterface) => (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`

async function findTranscript($: EngineInterface): Promise<string> {
  const known = (await load($)).transcript
  const id = await $.session.id()
  // A path kept from another session id (a /clear) is looked up again, even though that file still exists.
  if (known.endsWith(`/${id}.jsonl`) && (await $.fs.exists(known).catch(() => false))) return known
  // Copies of a session's transcript can sit under other project folders; the one being written is the newest.
  const r = await $.process.run(['find', `${await configDir($)}/projects`, '-maxdepth', '2', '-name', `${id}.jsonl`, '-exec', 'ls', '-t', '{}', '+'])
  const path = r.stdout.split('\n')[0]?.trim() ?? ''
  if (path !== '') await update($, stats, s => ({ ...EMPTY, ...s, transcript: path }))
  return path
}

// The last rate limits, in one file for every session, overwritten in place, so it never grows.
const limitsFile = async ($: EngineInterface) => `${await configDir($)}/usage-band/limits.json`
const isRateLimit = (l: unknown): l is RateLimit => {
  const r = l as Partial<RateLimit> | null
  return typeof r?.kind === 'string' && typeof r.percentUsed === 'number' && (r.resetsAt === undefined || typeof r.resetsAt === 'string')
}
async function readKeptLimits($: EngineInterface): Promise<RateLimit[] | undefined> {
  const r = await $.process.run(['cat', await limitsFile($)]).catch(() => undefined)
  if (r?.exitCode !== 0) return undefined
  try {
    const kept: unknown = JSON.parse(r.stdout)
    // Shared by every session and version: an entry not in this shape would break every draw.
    return Array.isArray(kept) ? kept.filter(isRateLimit) : undefined
  } catch {
    return undefined
  }
}
// Written only when the reading changed, so at most once a turn.
async function keepLimits($: EngineInterface, limits: RateLimit[]) {
  const json = JSON.stringify(limits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })))
  if (json === JSON.stringify((await load($)).lastLimits ?? null)) return
  await $.process.run(['/bin/sh', '-c', 'mkdir -p "$(dirname "$1")" && printf %s "$2" > "$1"', 'sh', await limitsFile($), json])
  await update($, stats, s => ({ ...EMPTY, ...s, lastLimits: JSON.parse(json) }))
}

// The engine's reading comes only from this session's own replies, so other sessions and claude.ai never move it.
// The account's usage endpoint (what /usage shows) is polled instead. The credential stays in the engine: the
// handle from authorize() is spent by $.http.fetch.
// shortcut: the endpoint is undocumented; a changed shape or a failure keeps the engine's reading, and a failure
// is not retried for BACKOFF_MS. Replace it when the engine exposes the account's limits itself.
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const POLL_MS = 60_000
const BACKOFF_MS = 300_000
let backoffUntil = 0
let polling = false
export function parseUsage(text: string): RateLimit[] {
  let body: Record<string, { utilization?: unknown; resets_at?: unknown } | null | undefined>
  try {
    body = JSON.parse(text)
  } catch {
    return []
  }
  return (['five_hour', 'seven_day'] as const).flatMap(kind => {
    const w = body?.[kind]
    if (typeof w?.utilization !== 'number') return []
    return [{ kind, percentUsed: Math.round(w.utilization * 10) / 10, resetsAt: typeof w.resets_at === 'string' ? w.resets_at : undefined }]
  })
}
async function pollLimits($: EngineInterface) {
  const now = await $.clock.now()
  if (polling || now < backoffUntil) return
  // Fast turns would fetch once each; the timer's period is the freshness that matters.
  const at = (await load($)).limitsAt
  if (at !== undefined && now - at < POLL_MS / 2) return
  polling = true
  try {
    const auth = (await $.session.authorize())?.handle
    if (auth === undefined) return
    const r = await $.http.fetch(USAGE_URL, { auth, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
    const limits = r.ok ? parseUsage(r.text) : []
    if (limits.length === 0) {
      backoffUntil = now + BACKOFF_MS
      return
    }
    await keepLimits($, limits)
    await update($, stats, s => ({ ...EMPTY, ...s, limitsAt: now }))
  } catch {
    backoffUntil = now + BACKOFF_MS
  } finally {
    polling = false
  }
}

// Per-model usage across all sessions (hooks/models.ts). Runs from timers, never from a hook that holds a dispatch:
// a dispatch's end cuts off work it left running. Each run reads about SCAN_BYTES and takes under a minute;
// while files are left the next run follows at once, so a first scan is several short runs.
const SCAN_BYTES = 1_000_000_000
const SCAN_RUNS = 40
const SCAN_MS = 300_000
let scanning = false
let parityWanted = false
let lastQuery = ''
async function scanModels($: EngineInterface, parity = false) {
  if (scanning) {
    parityWanted ||= parity
    return
  }
  scanning = true
  parityWanted ||= parity
  try {
    const base = await configDir($)
    const dir = `${base}/usage-band/models`
    for (let run = 0; run < SCAN_RUNS; run++) {
      const r = await $.process.run(['/bin/sh', '-c', MODELS_SH, 'sh', `${base}/projects`, dir, MODELS_AWK, String(SCAN_BYTES)], { timeoutMs: 120_000 })
      // 3: another session holds the lock; its ledger is read below all the same.
      if (r.exitCode !== 0 && r.exitCode !== 3) throw new Error(`models scan exited ${r.exitCode}: ${r.stderr.slice(0, 120)}`)
      const now = await $.clock.now()
      const { D, W, M } = windowStarts(now)
      const q = await $.process.run(['awk', '-v', `D=${D}`, '-v', `W=${W}`, '-v', `M=${M}`, MODELS_QUERY_AWK, `${dir}/ledger`])
      if (q.exitCode !== 0) throw new Error(`models query exited ${q.exitCode}`)
      const more = r.exitCode === 0 && r.stdout.includes('more')
      const check = parityWanted && !more ? await sessionParity($, dir) : undefined
      if (check !== undefined) parityWanted = false
      // An idle run that finds the same figures redraws nothing.
      const key = `${q.stdout}|${more}`
      if (key !== lastQuery || check !== undefined) await update($, stats, s => ({ ...EMPTY, ...s, models: parseQuery(q.stdout), modelsMore: more, modelsError: undefined, ...(check !== undefined ? { parity: check } : {}) }))
      lastQuery = key
      if (!more) break
    }
  } catch (err) {
    await update($, stats, s => ({ ...EMPTY, ...s, modelsError: String(err).slice(0, 160) }))
  } finally {
    scanning = false
  }
}
// This session's priced ledger rows against the engine's own cost: a gap means the price table is stale (or a model is unpriced).
async function sessionParity($: EngineInterface, dir: string) {
  const engine = (await $.session.usage().catch(() => undefined))?.cost?.usd
  if (engine === undefined) return undefined
  const q = await $.process.run(['awk', '-v', `SID=${await $.session.id()}`, MODELS_SESSION_AWK, `${dir}/ledger`])
  if (q.exitCode !== 0) return undefined
  const rows = parseQuery(q.stdout)
  const price = (source: 'main' | 'all') => rows.filter(r => r.source === source).reduce((n, r) => n + (costOf(r.model, r) ?? 0), 0)
  const [main, all] = [price('main'), price('all')]
  // Stale only when neither reading matches: the engine's cost may or may not include subagents.
  return { est: all, engine, stale: pricesStale(main, engine) && pricesStale(all, engine) }
}

const fail = ($: EngineInterface, scanError: string) => update($, stats, s => ({ ...EMPTY, ...s, scanError }))

async function rescan($: EngineInterface) {
  const transcript = await findTranscript($)
  // A new session has no transcript until its first prompt lands: nothing to scan yet, not an error.
  if (transcript === '') return (await $.session.turns().catch(() => 1)) === 0 ? undefined : fail($, 'transcript not found')
  const stateFile = `${await configDir($)}/usage-band/${await $.session.id()}.state`
  // A session's first scan reads the whole transcript (~8.5 s at 156 MB with macOS awk); the limit leaves room for far larger ones.
  const r = await $.process.run(['/bin/sh', '-c', SCAN_SH, 'sh', transcript, stateFile, SCAN_AWK], { timeoutMs: 120_000 })
  if (r.exitCode !== 0) return fail($, `scan exited ${r.exitCode}: ${r.stderr.slice(0, 120)}`)
  const scan = parseScan(r.stdout)
  // A local estimate (no API call): the window /context measures against, and where auto-compact runs.
  const breakdown = (await $.session.usage({ breakdown: 'summary' }).catch(() => undefined))?.context.breakdown
  const maxTokens = breakdown?.rawMaxTokens
  const compactAt = breakdown?.isAutoCompactEnabled ? breakdown.autoCompactThreshold : undefined
  await update($, stats, s => ({ ...EMPTY, ...s, scan, maxTokens: maxTokens ?? s.maxTokens, compactAt, scanError: undefined }))
}
const refresh = ($: EngineInterface) => rescan($).catch(err => fail($, String(err).slice(0, 160)))

const openDetails = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Usage details' })
// Nothing chosen yet: Context, the section most read, is the one drawn open.
const toggleSection = ($: EngineInterface, id: string) =>
  update($, stats, x => {
    const was = new Set(x.open ?? ['context'])
    if (!was.delete(id)) was.add(id)
    return { ...EMPTY, ...x, open: [...was] }
  })

const clock = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // First, so a failure below never stops it. A Client that fails again is dropped again.
    $.clock.every(POLL_MS, () => pollLimits($))
    $.clock.every(RETRY_MS, () => {
      if (down.size === 0) return
      down.clear()
      $.ui.invalidate('ui.render')
    })
    await $.command.register({ name: 'usage-band', description: 'Open the usage details pane (limits, context, tokens, turns, tests)' })
    // The cost so far is the baseline the next turn's own cost is measured from.
    const usd = (await $.session.usage().catch(() => undefined))?.cost?.usd
    const kept = await readKeptLimits($)
    await update($, stats, s => ({ ...EMPTY, ...s, costBase: usd ?? s.costBase, lastLimits: kept ?? s.lastLimits }))
    // Scan state of sessions untouched for two weeks is only a cache: a resumed one rescans in full.
    await $.process.run(['find', `${await configDir($)}/usage-band`, '-name', '*.state*', '-mtime', '+14', '-delete']).catch(() => undefined)
    $.clock.every(SCAN_MS, () => void scanModels($))
    $.clock.after(1, () => void scanModels($))
    $.clock.after(1, () => void pollLimits($))
    await refresh($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'usage-band' }, async $ => {
    await openDetails($)
    return { text: 'Usage details opened.' }
  })

  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await refresh($)
    return done
  }).catch(($, e, next) => next(e))

  // A test run sets the tests pill; a later code edit marks it stale.
  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash' && isTestCommand(e.command)) {
      const ran = await next(e)
      if (ran.deny === undefined) {
        // Core sets `text` (the output as the model reads it); Bash's own record is the fallback.
        const rec = ran.result as { stdout?: string; stderr?: string } | undefined
        const tests = testOutcome(ran.isError === true, ran.text ?? `${rec?.stdout ?? ''}\n${rec?.stderr ?? ''}`)
        await update($, stats, s => ({ ...EMPTY, ...s, tests }))
      }
      return ran
    }
    if ((e.tool === 'Edit' || e.tool === 'Write') && isCode(e.file_path)) {
      const ran = await next(e)
      if (ran.deny === undefined && !ran.isError) {
        await update($, stats, s => (s.tests && s.tests.state !== 'stale' ? { ...s, tests: { state: 'stale' as const } } : s))
      }
      return ran
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    const usage = await $.session.usage().catch(() => undefined)
    // The polled figure is the account's; the reply's only fills in when polling is down. A fetch has no timeout, so it runs from a timer.
    $.clock.after(1, () => void pollLimits($))
    if (usage && usage.rateLimits.length > 0 && !polledFresh(await load($), await $.clock.now())) await keepLimits($, usage.rateLimits).catch(() => undefined)
    const usd = usage?.cost?.usd
    if (usd !== undefined) {
      await update($, stats, x => {
        const s = { ...EMPTY, ...x }
        // A total below the baseline means the ledger started over (/clear): the whole total is this turn's.
        const turn = s.costBase === undefined ? undefined : usd >= s.costBase ? usd - s.costBase : usd
        // A main turn always costs something: a zero is a turn already counted (a reload re-bases mid-turn).
        const isTurn = turn !== undefined && turn > 0
        return { ...s, costBase: usd, turnCosts: isTurn ? [...s.turnCosts, turn].slice(-10) : s.turnCosts }
      })
    }
    // The scan runs on a timer: this hook's dispatch would cut it off. Its parity check needs a ledger that has this turn.
    $.clock.after(1, () => void scanModels($, true))
    await refresh($)
    return done
  }).catch(($, e, next) => next(e))

  // A click on a card: open the details pane with that card's section first.
  on('ui.message', async ($, e, next) => {
    const toggle = (e.data as { toggle?: unknown } | null)?.toggle
    if (typeof toggle === 'string') {
      await toggleSection($, toggle)
      return {}
    }
    const pick = (e.data as { pick?: { row?: unknown; id?: unknown } } | null)?.pick
    if (pick && typeof pick.id === 'string' && (pick.row === 'period' || pick.row === 'source')) {
      const row = pick.row, id = pick.id
      if ((row === 'period' ? PERIODS : SOURCES).includes(id as never)) await update($, stats, s => ({ ...EMPTY, ...s, [row]: id }))
      return {}
    }
    const open = (e.data as { open?: unknown } | null)?.open
    if (typeof open !== 'string') return next(e)
    // The clicked card's section alone is open, scrolled to the top of the pane.
    await update($, stats, s => ({ ...EMPTY, ...s, focus: open, open: [open] }))
    await openDetails($)
    await $.ui.scroll({ to: { key: open }, in: PANE, block: 'start' }).catch(() => undefined)
    return {}
  }).catch(($, e, next) => next(e))

  // The engine draws the failed Client's site again once this answers; the render hooks leave it out.
  on('ui.fault', ($, e, next) => {
    down.add(e.surface)
    return next(e)
  })

  // Never calls next: this band replaces whatever plugins beneath would draw here.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const v = buildView(await load($), await $.session.usage(), await $.clock.now())
    const alt = v.pills.map(p => p.title).join('. ')
    const table = $.ui.resolve(e)
    const { Box, Text } = table


    // The terminal: chips in its monospace cells, laid out to the region's real width; they take clicks.
    if (e.surface === 'terminal' && 'Client' in table && !down.has(e.surface)) {
      const { Client } = table as unknown as { Client: ClientEl }
      // Client props are plain JSON: the round trip drops unset fields and turns a missing cell into null.
      const props = JSON.parse(JSON.stringify({ layouts: layouts(v) }))
      return <Client key="band" module="./band.client.tsx" props={props} width="100%" />
    }
    // Every other surface draws the SVG. Its cells are not monospace (the desktop's are proportional),
    // so the chips would not line up there.
    if ('Svg' in table) {
      const { Svg } = table as unknown as { Svg: SvgEl }
      const slot = slotPx(e.props.bodyColumns)
      const all = layouts(v)
      const grids = all.find(g => bandWidth(...g) <= slot) ?? all[all.length - 1]!
      const svg = bandSvg(grids, slot)
      const drawing = <Svg source={svg.source} width={svg.width} height={svg.height} alt={alt} />
      if (!('Client' in table) || down.has(e.surface)) return drawing
      // An Svg takes no clicks, so invisible strips lie over it, one per row of cards, each as tall as
      // its share of the drawing (rows are evenly spaced, so the strip edges fall in the gaps).
      const { Client } = table as unknown as { Client: ClientEl }
      const tops = [...new Set(svg.boxes.map(b => b.y))].sort((a, b) => a - b)
      return (
        // No size on the wrapper: a Box measures in cells, the Svg in pixels; it wraps the drawing.
        <Box position="relative">
          {drawing}
          <Box position="absolute" top={0} left={0} width="100%" height="100%" flexDirection="column">
            {tops.map(top => {
              // A two-row card belongs to every strip it spans.
              const row = JSON.parse(JSON.stringify({ boxes: svg.boxes.filter(b => b.y <= top && top < b.y + b.h), width: svg.width }))
              return (
                <Box key={`row-${top}`} width="100%" height={`${100 / tops.length}%`}>
                  <Client key={`hit-${top}`} module="./hit.client.tsx" props={row} width="100%" height="100%" />
                </Box>
              )
            })}
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="row" gap={1} width={e.props.bodyColumns}>
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="truncate-end">
            {bandText(v.pills)}
          </Text>
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = await load($)
    const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => $.session.usage())
    const v = buildView(s, usage, await $.clock.now())
    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const Svg = 'Svg' in table ? (table as unknown as { Svg: SvgEl }).Svg : undefined
    const c = v.context
    const open = new Set(s.open ?? ['context'])
    const Client = 'Client' in table && !down.has(e.surface) ? (table as unknown as { Client: ClientEl }).Client : undefined
    const join = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(' · ')
    const pct = (n: number) => `${n.toFixed(1).replace(/\.0$/, '')}%`
    // shortcut: the same cell-to-pixel factor as the band; measure again if the desktop changes its font.
    const barPx = Math.max(120, Math.floor((e.props.bodyColumns - 6) * 8.6))

    // A meter: coloured parts along one track, an optional amber line (auto-compact) and tick (the clock).
    const bar = (key: string, parts: { n: number; color: string }[], total: number, marks: { at?: number; line?: number } = {}) => {
      if (total <= 0) return null
      if (Svg) {
        let x = 0
        const segs = parts
          .filter(p => p.n > 0)
          .map(p => {
            const w = (p.n / total) * barPx
            const r = `<rect x="${x.toFixed(1)}" y="2" width="${Math.max(1, w - 1.5).toFixed(1)}" height="6" fill="${p.color}"/>`
            x += w
            return r
          })
          .join('')
        const at = (v?: number) => (v === undefined ? '' : `<rect x="${((v / 100) * barPx - 1).toFixed(1)}" y="0" width="2" height="10" rx="1" fill="${marks.line === v ? '#eaa75c' : '#ecebe6'}"/>`)
        const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${barPx}" height="10" viewBox="0 0 ${barPx} 10"><defs><clipPath id="r"><rect y="2" width="${barPx}" height="6" rx="3"/></clipPath></defs><rect y="2" width="${barPx}" height="6" rx="3" fill="#8a8983" fill-opacity=".25"/><g clip-path="url(#r)">${segs}</g>${at(marks.line)}${at(marks.at)}</svg>`
        return <Svg key={key} source={source} width={barPx} height={10} alt="" />
      }
      const cells = Math.max(10, e.props.bodyColumns - 6)
      return (
        <Text key={key}>
          {parts.map((p, i) => <Text key={`${i}`} color={p.color}>{'━'.repeat(Math.round((p.n / total) * cells))}</Text>)}
          <Text dimColor>{'━'.repeat(Math.max(0, cells - parts.reduce((w, p) => w + Math.round((p.n / total) * cells), 0)))}</Text>
        </Text>
      )
    }
    // A row: a colour dot and the name on the left, the figure and its share right-aligned.
    const item = (label: string, value: string, share = '', o: { dot?: string; dim?: boolean } = {}) => (
      <Box key={`${label}|${value}`} flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={1}>
          {o.dot !== undefined && <Text color={o.dot}>■</Text>}
          <Text dimColor={o.dim} wrap="truncate-end">{label}</Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text dimColor>{value}</Text>
          {share !== '' && (
            <Box width={6} justifyContent="flex-end">
              <Text dimColor={o.dim}>{share}</Text>
            </Box>
          )}
        </Box>
      </Box>
    )
    const headline = (key: string, big: string, right = '') => (
      <Box key={key} flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text bold>{big}</Text>
        <Text dimColor>{right}</Text>
      </Box>
    )
    // Phrases that wrap whole: a narrow pane moves the next phrase to its own line, never splits one.
    const note = (key: string, text: string | string[], warn = false) => (
      <Box key={key} marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={2}>
        {(Array.isArray(text) ? text : [text]).map(t => (
          <Text key={t} dimColor={!warn} color={warn ? 'warning' : undefined}>
            {t}
          </Text>
        ))}
      </Box>
    )
    // A card: its title opens and closes it; closed, the summary on the right says the gist.
    const card = (id: string, title: string, summary: string, body: RenderChildren[]) => (
      <Box key={id} flexDirection="column" borderStyle="round" borderDimColor paddingX={1} marginBottom={1}>
        {Client ? (
          <Client key={`open-${id}`} module="./header.client.tsx" props={{ id, title, summary, open: open.has(id) }} width="100%" />
        ) : (
          <Box flexDirection="row" justifyContent="space-between">
            <Button key={`open-${id}`} plain onPress={() => toggleSection($, id)}>
              <Text dimColor>{open.has(id) ? '▾  ' : '▸  '}</Text>
              <Text bold>{title}</Text>
            </Button>
            {!open.has(id) && <Text dimColor>{summary}</Text>}
          </Box>
        )}
        {open.has(id) && body}
      </Box>
    )

    const PALETTE = ['#4a8df0', '#e0643a', '#1f9e6e', '#d39a1a', '#9c9b95']
    const parts = (usage.context.breakdown?.categories ?? []).filter(k => k.tokens > 0 && k.kind !== 'free')
    const live = parts.filter(k => !/deferred/i.test(k.name)).sort((x, y) => y.tokens - x.tokens)
    const deferred = parts.filter(k => /deferred/i.test(k.name))
    const color = (i: number) => PALETTE[Math.min(i, PALETTE.length - 1)]!
    const t = s.scan.tokens
    const log = s.scan.log.slice(-10)
    // turnCosts covers only turns since the band loaded: they line up with the newest turns.
    const turnCost = (i: number) => s.turnCosts[s.turnCosts.length - (log.length - i)]
    const limits = v.limits.filter((l): l is NonNullable<typeof l> => l !== undefined)
    const period = s.period ?? 'week'
    const source = s.source ?? 'all'
    const m = buildModels(s.models, period, source)
    const PERIOD_LABEL = { day: 'Day', week: 'Week', month: 'Month', all: 'All' } as const
    const SOURCE_LABEL = { all: 'Everything', main: 'Main', sub: 'Subagents' } as const
    const tabRow = <K extends string>(row: 'period' | 'source', ids: readonly K[], label: Record<K, string>, active: K) => (
      <Box key={row} flexDirection="row" gap={Client ? 0 : 1} marginTop={1} width="100%">
        {ids.map(id =>
          Client ? (
            // A segmented control: equal shares of the card width; a width in characters wraps in a proportional font.
            <Client key={`${row}-${id}`} module="./tab.client.tsx" props={{ row, id, label: label[id], active: id === active }} width={`${Math.floor(100 / ids.length)}%`} />
          ) : (
            <Button key={id} plain onPress={() => void update($, stats, x => ({ ...EMPTY, ...x, [row]: id }))}>
              <Text bold={id === active} underline={id === active} dimColor={id !== active}>{id === active ? `[${label[id]}]` : label[id]}</Text>
            </Button>
          ),
        )}
      </Box>
    )
    const usdText = (n: number | undefined) => (n === undefined ? 'n/a' : `$${n.toFixed(2)}`)
    const modelsBody: RenderChildren[] = [
      tabRow('period', PERIODS, PERIOD_LABEL, period),
      tabRow('source', SOURCES, SOURCE_LABEL, source),
      ...(s.modelsError ? [note('err', `Could not read the sessions: ${s.modelsError}`, true)] : []),
      ...(m === undefined
        ? [note('wait', 'Reading your sessions…')]
        : m.lines.length === 0
          ? [note('empty', 'No usage in this period.')]
          : [
              headline('h', m.usd !== undefined ? `${usdText(m.usd)} estimate` : `${fmtTokens(m.tokens)} tokens`, `${m.sessions} ${m.sessions === 1 ? 'session' : 'sessions'}`),
              bar('mb', m.lines.map((l, i) => ({ n: m.byCost ? (l.usd ?? 0) : l.tokens, color: color(i) })), m.byCost ? (m.usd ?? 0) : m.tokens),
              ...m.lines.map((l, i) => item(l.model, join(fmtTokens(l.tokens), usdText(l.usd)), pct(l.share), { dot: color(i) })),
              note('basis', [m.byCost ? 'Share of estimated cost.' : 'Share of tokens.', 'Tokens include cache reads.', 'Estimated at API prices, not what a subscription pays.']),
              ...(m.unpriced > 0 ? [note('unpriced', `${m.unpriced} ${m.unpriced === 1 ? 'model has' : 'models have'} no price yet: counted in tokens only.`, true)] : []),
            ]),
      ...(s.modelsMore ? [note('more', 'Still reading older sessions: the figures grow.')] : []),
      ...(s.parity?.stale ? [note('parity', `Prices may be stale: this session's tokens price at ${usdText(s.parity.est)}, the engine says ${usdText(s.parity.engine)}.`, true)] : []),
    ]
    const verdict = s.tests && (s.tests.state === 'pass' ? 'Passed' : s.tests.state === 'fail' ? 'Failed' : 'Stale')
    const counts = s.tests && join(s.tests.passed !== undefined && `${s.tests.passed} passed`, s.tests.failed !== undefined && `${s.tests.failed} failed`)

    return (
      // At least the pane's height, so the spacer pins the version line to its bottom edge.
      <Box flexDirection="column" minHeight={e.props.scroll?.bodyRows}>
        {s.scanError && <Text color="warning">Could not read the transcript: {s.scanError}</Text>}
        {card('context', 'Context', `${Math.round(c.pct)}% · ${fmtTokens(c.used)} / ${fmtTokens(c.max)}`, [
          headline('h', `${Math.round(c.pct)}% used`, `${fmtTokens(c.used)} / ${fmtTokens(c.max)}`),
          bar('bar', live.length > 0 ? live.map((k, i) => ({ n: k.tokens, color: color(i) })) : [{ n: c.used, color: PALETTE[0]! }], c.max, { line: c.compactPct }),
          ...live.map((k, i) => item(k.name, fmtTokens(k.tokens), pct((k.tokens / c.max) * 100), { dot: color(i) })),
          ...(c.max > c.used ? [item('Free space', fmtTokens(c.max - c.used), pct(((c.max - c.used) / c.max) * 100), { dot: '#3a3a38' })] : []),
          ...deferred.map(k => item(k.name, fmtTokens(k.tokens), '—', { dot: '#5a5a57', dim: true })),
          note(
            'n',
            [
              c.compactAt !== undefined ? `${fmtTokens(Math.max(0, c.compactAt - c.used))} until auto-compact` : 'auto-compact off',
              join(c.turnsLeft !== undefined && `~${c.turnsLeft} turns`, `compacted ×${s.scan.compactions}`),
            ],
            c.alert !== undefined,
          ),
        ])}
        {card(
          'limits',
          'Limits',
          join(...limits.map(l => `${l.kind === 'five_hour' ? '5h' : '7d'} ${Math.round(l.pct)}%`)),
          limits.length === 0
            ? [note('none', 'No reading yet.')]
            : [
                ...(limits.some(l => l.stale) ? [note('stale', 'Last seen in an earlier session: no reply here yet.')] : []),
                ...limits.flatMap(l => [
                headline(`h-${l.kind}`, `${l.kind === 'five_hour' ? '5-hour' : '7-day'} · ${Math.round(l.pct)}% used`, l.left !== undefined ? `resets in ${fmtSpan(l.left)}` : ''),
                bar(`b-${l.kind}`, [{ n: l.pct, color: meterColor(l.pct) }], 100, { at: l.mark }),
                ...(l.fullIn !== undefined ? [note(`f-${l.kind}`, `At this pace it is full in ~${fmtSpan(l.fullIn)}, before the reset.`, true)] : []),
              ]),
              ],
        )}
        {card('tokens', 'Tokens', join(`in ${fmtTokens(t.input + t.cacheWrite)}`, `out ${fmtTokens(t.output)}`), [
          headline('h', `${fmtTokens(t.input + t.cacheWrite + t.output)} sent and received`, v.cache !== undefined ? `${Math.round(v.cache)}% cached` : ''),
          item('Input', fmtTokens(t.input + t.cacheWrite), '', { dot: ACCENT.in }),
          item('Output', fmtTokens(t.output), '', { dot: ACCENT.out }),
          item('Cache reads', fmtTokens(t.cacheRead), '', { dot: '#9c9b95', dim: true }),
        ])}
        {card('cost', 'Cost', usage.cost ? `$${usage.cost.usd.toFixed(2)}` : 'n/a', [
          headline('h', usage.cost ? `$${usage.cost.usd.toFixed(2)}` : 'n/a', `${s.scan.turns} turns`),
          ...(v.avg !== undefined ? [item('Average a turn', `$${v.avg.toFixed(2)}`)] : []),
          ...(v.last !== undefined ? [item('Last turn', `$${v.last.toFixed(2)}`)] : []),
        ])}
        {card('models', 'Models', m === undefined ? 'reading…' : join(PERIOD_LABEL[period], m.usd !== undefined ? usdText(m.usd) : `${fmtTokens(m.tokens)}`), modelsBody)}
        {card(
          'turns',
          'Turns',
          join(`${s.scan.turns}`, `agent ${fmtSpan(s.scan.agentMs)}`),
          [
            headline('h', `${s.scan.turns} turns`, `agent ${fmtSpan(s.scan.agentMs)}`),
            ...(log.length === 0
              ? [note('none', 'No turns yet.')]
              : log
                  .map((turn, i) => {
                    const cost = turnCost(i)
                    return item(`${clock(turn.startAt)}  ${fmtSpan(turn.ms)}`, `ctx ${fmtTokens(turn.ctx)}`, cost !== undefined ? `$${cost.toFixed(2)}` : '')
                  })
                  .reverse()),
          ],
        )}
        {card(
          'tests',
          'Tests',
          s.tests === undefined ? 'none yet' : (verdict ?? '').toLowerCase(),
          s.tests === undefined
            ? [note('none', 'No test run seen yet.')]
            : [headline('h', verdict!, counts ?? ''), ...(s.tests.state === 'stale' ? [note('n', 'Code changed since the last run.')] : [])],
        )}
        <Box flexGrow={1} />
        <Text dimColor>usage-band v{VERSION}</Text>
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
