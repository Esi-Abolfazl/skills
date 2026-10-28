import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Stats } from '../types'
import { bandSvg, bandText, bandWidth, fmtSpan, fmtTokens, slotPx } from './pills'
import { NO_SCAN, SCAN_AWK, SCAN_SH, parseScan } from './scan'
import { isCode, isTestCommand, testOutcome } from './testrun'
import { ACCENT, ALERT } from './cells'
import { buildView, layouts } from './view'

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

const fail = ($: EngineInterface, scanError: string) => update($, stats, s => ({ ...EMPTY, ...s, scanError }))

async function rescan($: EngineInterface) {
  const transcript = await findTranscript($)
  if (transcript === '') return fail($, 'transcript not found')
  const stateFile = `${await configDir($)}/usage-band/${await $.session.id()}.state`
  // A session's first scan reads the whole transcript (~2.5 s at 96 MB); the limit leaves room for far larger ones.
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
    $.clock.every(RETRY_MS, () => {
      if (down.size === 0) return
      down.clear()
      $.ui.invalidate('ui.render')
    })
    await $.command.register({ name: 'usage-band', description: 'Open the usage details pane (limits, context, tokens, turns, tests)' })
    // The cost so far is the baseline the next turn's own cost is measured from.
    const usd = (await $.session.usage().catch(() => undefined))?.cost?.usd
    await update($, stats, s => ({ ...EMPTY, ...s, costBase: usd ?? s.costBase }))
    // Scan state of sessions untouched for two weeks is only a cache: a resumed one rescans in full.
    await $.process.run(['find', `${await configDir($)}/usage-band`, '-name', '*.state*', '-mtime', '+14', '-delete']).catch(() => undefined)
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
    const usd = (await $.session.usage().catch(() => undefined))?.cost?.usd
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
    const costOf = (i: number) => s.turnCosts[s.turnCosts.length - (log.length - i)]
    const limits = v.limits.filter((l): l is NonNullable<typeof l> => l !== undefined)
    const verdict = s.tests && (s.tests.state === 'pass' ? 'Passed' : s.tests.state === 'fail' ? 'Failed' : 'Stale')
    const counts = s.tests && join(s.tests.passed !== undefined && `${s.tests.passed} passed`, s.tests.failed !== undefined && `${s.tests.failed} failed`)

    return (
      <Box flexDirection="column">
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
            : limits.flatMap(l => [
                headline(`h-${l.kind}`, `${l.kind === 'five_hour' ? '5-hour' : '7-day'} · ${Math.round(l.pct)}% used`, l.left !== undefined ? `resets in ${fmtSpan(l.left)}` : ''),
                bar(`b-${l.kind}`, [{ n: l.pct, color: l.alert ? ALERT[l.alert] : '#8db27a' }], 100, { at: l.mark }),
                ...(l.fullIn !== undefined ? [note(`f-${l.kind}`, `At this pace it is full in ~${fmtSpan(l.fullIn)}, before the reset.`, true)] : []),
              ]),
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
                    const cost = costOf(i)
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
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
