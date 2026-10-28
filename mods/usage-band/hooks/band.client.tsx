// The band's surface module: draws the cards as tinted chips in the region's real width and turns
// a click on a card into a post naming its pane section. No `$` here: the hooks module answers.
import type { ClientSurface } from 'claude-code'

import { ACCENT, ALERT, BAR_CELLS, GLYPH, SECTION, hit, layCells, pickLayout, tint } from './cells'
import type { Placed } from './cells'
import { level } from './pills'
import type { Column, Seg } from './pills'

type Props = { layouts: Column[][][] }
type State = { hover?: string }

const SPARK = '▁▂▃▄▅▆▇█'
const meter = (pct: number) => {
  const a = level(pct)
  return a && ALERT[a]
}

export default function Band(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const laid = layCells(pickLayout(props.layouts, surface.columns), surface.columns)
  const hover = surface.state?.hover

  surface.onPointer(e => {
    const card = hit(laid, e.x, e.y)
    // Tones are unique on the band, so a two-row card lights up as one.
    const id = card?.tone
    if (e.type === 'up' && e.button === 'left' && card) surface.post({ open: SECTION[card.tone] })
    if ((e.type === 'move' || e.type === 'enter' || e.type === 'leave') && (e.type === 'leave' ? undefined : id) !== hover) {
      surface.setState({ hover: e.type === 'leave' ? undefined : id })
    }
  })

  const seg = (s: Seg, accent: string, barExtra: number, k: number) => {
    if (s.kind === 'icon') return <Text key={`${k}`} color={s.dim ? undefined : accent} dimColor={s.dim}>{GLYPH[s.name] ?? '•'}</Text>
    if (s.kind === 'sep') return <Text key={`${k}`} dimColor>│</Text>
    if (s.kind === 'text') return <Text key={`${k}`} bold={s.bold || s.warn} dimColor={s.dim} color={s.warn ? ALERT.warn : undefined}>{s.s}</Text>
    if (s.kind === 'spark') {
      const top = Math.max(...s.values, 0)
      const bars = s.values.map(v => SPARK[top > 0 ? Math.min(7, Math.round((v / top) * 7)) : 0]).join('')
      return <Text key={`${k}`} color={accent}>{bars}</Text>
    }
    const w = (s.w ?? BAR_CELLS) + barExtra
    const fill = Math.round((Math.min(100, Math.max(0, s.pct)) / 100) * w)
    const at = (pct?: number) => (pct === undefined ? -1 : Math.min(w - 1, Math.round((pct / 100) * (w - 1))))
    const mark = at(s.mark)
    const line = at(s.line)
    const color = meter(s.pct) ?? accent
    return (
      <Text key={`${k}`}>
        {Array.from({ length: w }, (_, i) =>
          i === mark ? <Text key={`${i}`} bold>┃</Text> : i === line ? <Text key={`${i}`} color={ALERT.warn}>┃</Text> : <Text key={`${i}`} color={i < fill ? color : undefined} dimColor={i >= fill}>━</Text>,
        )}
      </Text>
    )
  }

  const card = (p: Placed, id: string, left: number) => {
    const accent = ACCENT[p.pill.tone]
    const back = p.pill.alert ? ALERT[p.pill.alert] : accent
    const parts = p.pill.segs.flatMap((s, k) => (k === 0 ? [seg(s, accent, p.bar ?? 0, k)] : [<Text key={`s${k}`}> </Text>, seg(s, accent, p.bar ?? 0, k)]))
    return (
      <Box key={id} width={p.w} marginLeft={left} paddingX={1} backgroundColor={tint(back, p.pill.tone === hover ? '55' : p.pill.alert ? '3a' : '26')}>
        <Text wrap="truncate-end">{parts}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {laid.rows.map((row, y) => (
        <Box key={`${y}`} flexDirection="row">
          {row.map((p, i) => card(p, `${y}:${i}`, p.x - (i === 0 ? 0 : row[i - 1]!.x + row[i - 1]!.w)))}
        </Box>
      ))}
    </Box>
  )
}
