// The band laid out in terminal cells for the Client module: the same pills and grids as the SVG
// (pills.ts), measured in cells, so the module can pick a layout for its real width and hit-test
// a click to the card under it. Pure: the module and the tests share it.
import type { Column, Pill, Seg, Tone } from './pills'

export type Placed = { pill: Pill; x: number; w: number; bar?: number }
export type Laid = { rows: Placed[][]; width: number }

export const GLYPH: Record<string, string> = {
  gauge: '◔',
  history: '↺',
  calendar: '▦',
  upload: '↑',
  download: '↓',
  layers: '≋',
  fold: '⇕',
  bot: '◷',
  coin: '$',
  check: '✓',
  cross: '✗',
  flask: '○',
}

export const BAR_CELLS = 8
const PAD = 1 // cells inside a card, each side
const GAP = 1 // cells between cards

export function segCells(s: Seg): number {
  if (s.kind === 'icon') return 1
  if (s.kind === 'text') return [...s.s].length
  if (s.kind === 'bar') return s.w ?? BAR_CELLS
  if (s.kind === 'sep') return 1
  return s.values.length
}

const lineCells = (segs: Seg[]) => segs.reduce((w, s) => w + segCells(s), 0) + Math.max(0, segs.length - 1)
export const pillCells = (p: Pill) => PAD * 2 + Math.max(lineCells(p.segs), p.sub ? lineCells(p.sub) : 0)

type Cell = Pill[]
// A missing cell arrives as null: Client props are JSON.
const cellsOf = (c: Pill | Pill[] | undefined | null): Cell => (c == null ? [] : Array.isArray(c) ? c : [c])
const cellWidth = (ps: Cell) => ps.reduce((w, p) => w + pillCells(p), 0) + Math.max(0, ps.length - 1) * GAP
const hasBar = (p?: Pill) => p?.segs.some(s => s.kind === 'bar') === true

const cols = (g: Column[]) => g.map(c => c.map(cellsOf)).filter(c => c.some(ps => ps.length > 0))
const natural = (cs: Cell[][]) => cs.map(c => Math.max(...c.map(cellWidth)))
const total = (ws: number[]) => ws.reduce((a, w) => a + w, 0) + Math.max(0, ws.length - 1) * GAP

export const gridsCells = (grids: Column[][]) => Math.max(0, ...grids.map(g => total(natural(cols(g)))))

// Grids stacked top to bottom, all stretched to one right edge (`fill`, or the widest grid's own
// width when wider). Room goes to the columns whose widest cell holds a meter, so their bars grow
// alike; with none, to the first column. A narrower cell's first pill takes its cell's slack.
export function layCells(grids: Column[][], fill: number): Laid {
  const edge = Math.max(fill, gridsCells(grids))
  const rows: Placed[][] = []
  for (const g of grids) {
    const cs = cols(g)
    const widths = natural(cs)
    const room = edge - total(widths)
    if (room > 0 && widths.length > 0) {
      const metered = cs.flatMap((c, i) => (c.some(ps => hasBar(ps[0]) && cellWidth(ps) === widths[i]) ? [i] : []))
      const takers = metered.length > 0 ? metered : [0]
      takers.forEach((i, k) => (widths[i]! += Math.floor(room / takers.length) + (k < room % takers.length ? 1 : 0)))
    }
    const top: Placed[] = []
    const bottom: Placed[] = []
    let x = 0
    cs.forEach((c, i) => {
      c.forEach((ps, row) => {
        const extra = widths[i]! - cellWidth(ps)
        let px = x
        ps.forEach((p, k) => {
          const w = pillCells(p) + (k === 0 ? extra : 0)
          const slack = w - pillCells(p)
          ;(row === 0 ? top : bottom).push({ pill: p, x: px, w, ...(slack > 0 && hasBar(p) ? { bar: slack } : {}) })
          // A column of one pill is two rows tall: its second line takes the bottom row.
          if (c.length === 1) bottom.push({ pill: { ...p, segs: p.sub ?? [] }, x: px, w })
          px += w + GAP
        })
      })
      x += widths[i]! + GAP
    })
    rows.push(top, bottom)
  }
  return { rows, width: edge }
}

// The first layout that fits `columns`, else the last (narrowest) one.
export const pickLayout = (layouts: Column[][][], columns: number) => layouts.find(g => gridsCells(g) <= columns) ?? layouts[layouts.length - 1]!

export const hit = (laid: Laid, x: number, y: number) => laid.rows[y]?.find(p => x >= p.x && x < p.x + p.w)?.pill

// Which section of the details pane a card opens.
export const SECTION: Record<Tone, string> = {
  limit5h: 'limits',
  limit7d: 'limits',
  in: 'tokens',
  out: 'tokens',
  ctx: 'context',
  time: 'turns',
  cost: 'cost',
  pass: 'tests',
  fail: 'tests',
  stale: 'tests',
}

// Card colours: an accent that reads on light and dark, and the same accent at low alpha behind.
export const ACCENT: Record<Tone, string> = {
  limit5h: '#5f9e7c',
  limit7d: '#8b74d6',
  in: '#d0664f',
  out: '#5aa45d',
  ctx: '#6478e0',
  time: '#4a93a8',
  cost: '#c29a2a',
  pass: '#4f9a52',
  fail: '#d0503c',
  stale: '#8a8983',
}
export const ALERT = { warn: '#d9a441', hot: '#d4604a' } as const
export const tint = (hex: string, alpha: string) => `${hex}${alpha}`
