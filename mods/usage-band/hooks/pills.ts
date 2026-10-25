// Pure layout of the band: no engine calls, so tests can drive it.

export type Tone = 'limit5h' | 'limit7d' | 'in' | 'out' | 'ctx' | 'time' | 'cost' | 'pass' | 'fail' | 'stale'
export type Seg =
  | { kind: 'icon'; name: keyof typeof ICONS }
  | { kind: 'text'; s: string; bold?: boolean; dim?: boolean; warn?: boolean }
  // mark: the clock's tick; line: where auto-compact runs; both 0 to 100 along the bar.
  | { kind: 'bar'; pct: number; mark?: number; line?: number; w?: number }
  | { kind: 'sep' }
  // spark: recent values as small bars, scaled to the largest.
  | { kind: 'spark'; values: number[] }
// glyph stands in for the icon where only text draws (the terminal); alert rings the pill;
// sub is a second line, drawn when the card stands alone in its column, two rows tall.
export type Alert = 'warn' | 'hot'
export type Pill = { tone: Tone; segs: Seg[]; title: string; glyph: string; alert?: Alert; sub?: Seg[] }

export const HOUR = 3_600_000
export const WINDOWS: Record<string, number> = { five_hour: 5 * HOUR, seven_day: 168 * HOUR }

export function fmtTokens(n: number): string {
  const one = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  if (n >= 1e6) return `${one(n / 1e6)}M`
  if (n >= 1e3) return `${one(n / 1e3)}k`
  return String(Math.round(n))
}

export function fmtSpan(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// The bar's tick: how far through the window the clock is, so usage ahead of the tick burns too fast.
export function windowMark(kind: string, resetsAt: string | undefined, now: number): number | undefined {
  const span = WINDOWS[kind]
  if (span === undefined || resetsAt === undefined) return undefined
  const left = Date.parse(resetsAt) - now
  if (!Number.isFinite(left)) return undefined
  return Math.min(100, Math.max(0, (1 - left / span) * 100))
}

const ICONS = {
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  download: '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  fold: '<path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2"/><path d="m15 19-3-3-3 3"/><path d="m15 5-3 3-3-3"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cross: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  flask: '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>',
  coin: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
}

// Light, then dark: pill background and icon/accent colour.
const TONES: Record<Tone, [string, string, string]> = {
  limit5h: ['#d9e8df', '#4f8a6b', '#7fc4a0'],
  limit7d: ['#e3def3', '#7b61c9', '#a993ee'],
  in: ['#f4dcd5', '#c4553f', '#ef8a74'],
  out: ['#dbebd8', '#4f9a52', '#86cf88'],
  ctx: ['#dce2f6', '#4a5fd1', '#8ea0f5'],
  time: ['#dbeaee', '#3d8296', '#78bfd3'],
  cost: ['#f1e6cc', '#a8831a', '#e0bb52'],
  pass: ['#dbebd8', '#3f8a43', '#86cf88'],
  fail: ['#f6d6d1', '#c4402c', '#ef7a66'],
  stale: ['#e6e5e0', '#7d7c76', '#a9a8a2'],
}

const CHAR = 7.25 // 12px monospace advance
export const H = 28
export const PAD = 10
export const GAP = 6 // between pills
const SEG = 6 // between the parts of one pill
const ICON = 15
export const BAR = 46

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function segWidth(s: Seg): number {
  if (s.kind === 'icon') return ICON
  if (s.kind === 'bar') return s.w ?? BAR
  if (s.kind === 'sep') return 1
  if (s.kind === 'spark') return Math.max(0, s.values.length * 5 - 2)
  return s.s.length * CHAR
}

const lineWidth = (segs: Seg[]) => segs.reduce((w, s) => w + segWidth(s), 0) + Math.max(0, segs.length - 1) * SEG
export const pillWidth = (p: Pill) => Math.ceil(PAD * 2 + Math.max(lineWidth(p.segs), p.sub ? lineWidth(p.sub) : 0))

// The meter thresholds every bar and ring share: amber from 60%, red from 85%.
export const level = (pct: number): Alert | undefined => (pct >= 85 ? 'hot' : pct >= 60 ? 'warn' : undefined)

// Width past the pill's own goes into its first bar, so a stretched meter reads as a longer meter.
function drawPill(p: Pill, x: number, y: number, w = pillWidth(p), h = H): string {
  const extra = w - pillWidth(p)
  const barAt = p.segs.findIndex(s => s.kind === 'bar')
  if (extra > 0 && barAt >= 0) {
    const bar = p.segs[barAt] as Extract<Seg, { kind: 'bar' }>
    p = { ...p, segs: p.segs.map((s, i) => (i === barAt ? { ...bar, w: (bar.w ?? BAR) + extra } : s)) }
  }
  let out = `<g class="${p.tone}"><title>${esc(p.title)}</title><rect class="bg" x="${x}" y="${y}" width="${w}" height="${h}" rx="${H / 2}"/>`
  if (p.alert) out += `<rect class="ring ${p.alert}" x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="${H / 2 - 0.75}"/>`
  // A tall card centres each line on its own row's middle, so its lines sit level with the cards beside it.
  const two = p.sub !== undefined && h > H
  out += drawLine(p.segs, x + PAD, y + H / 2)
  if (two) out += drawLine(p.sub!, x + PAD, y + h - H / 2)
  return out + '</g>'
}

function drawLine(segs: Seg[], left: number, mid: number): string {
  let out = ''
  let cx = left
  for (const s of segs) {
    if (s.kind === 'icon') {
      out += `<g class="ic" transform="translate(${cx} ${mid - ICON / 2}) scale(${ICON / 24})">${ICONS[s.name]}</g>`
    } else if (s.kind === 'text') {
      out += `<text class="${s.warn ? 'w' : s.bold ? 'b' : s.dim ? 'd' : 't'}" x="${cx}" y="${mid + 4}">${esc(s.s)}</text>`
    } else if (s.kind === 'spark') {
      const top = Math.max(...s.values, 0)
      s.values.forEach((v, k) => {
        const h = top > 0 ? Math.max(2, Math.round((v / top) * 14)) : 2
        out += `<rect class="spark" x="${cx + k * 5}" y="${mid + 7 - h}" width="3" height="${h}" rx="1"/>`
      })
    } else if (s.kind === 'sep') {
      out += `<line class="sep" x1="${cx + 0.5}" y1="${mid - 8}" x2="${cx + 0.5}" y2="${mid + 8}"/>`
    } else {
      const bw = s.w ?? BAR
      const fill = (Math.min(100, Math.max(0, s.pct)) / 100) * bw
      out += `<rect class="track" x="${cx}" y="${mid - 3}" width="${bw}" height="6" rx="3"/>`
      if (fill > 0) out += `<rect class="f-${level(s.pct) ?? 'ok'}" x="${cx}" y="${mid - 3}" width="${Math.max(3, fill)}" height="6" rx="3"/>`
      if (s.line !== undefined) {
        const lx = cx + (Math.min(100, Math.max(0, s.line)) / 100) * bw
        out += `<rect class="cline" x="${lx - 1}" y="${mid - 8}" width="2" height="16" rx="1"/>`
      }
      if (s.mark !== undefined) {
        const mx = cx + (s.mark / 100) * bw
        out += `<rect class="mark" x="${mx - 1}" y="${mid - 7}" width="2" height="14" rx="1"/>`
      }
    }
    cx += segWidth(s) + SEG
  }
  return out
}

function style(): string {
  const font = `ui-monospace,'SF Mono',Menlo,monospace`
  let light = `.t,.b,.w{fill:#33322e;font:12px ${font}}.b,.w{font-weight:700}.d{fill:#8a8983;font:12px ${font}}.track{fill:#1f1e1d;fill-opacity:.12}.f-ok{fill:#8db27a}.f-warn{fill:#d9a441}.f-hot{fill:#d4604a}.w{fill:#b97a12}.ring{fill:none;stroke-width:1.5}.ring.warn{stroke:#d9a441}.ring.hot{stroke:#d4604a}.mark{fill:#33322e}.cline{fill:#c27a2c}.spark{fill:#a8831a;fill-opacity:.75}.sep{stroke:#1f1e1d;stroke-opacity:.2}.ic{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`
  let dark = `.t,.b{fill:#ecebe6}.d{fill:#9c9b95}.track{fill:#fff;fill-opacity:.14}.mark{fill:#ecebe6}.w{fill:#e9b44c}.cline{fill:#eaa75c}.spark{fill:#e0bb52;fill-opacity:.75}.sep{stroke:#fff;stroke-opacity:.2}`
  for (const [tone, [bg, ic, icDark]] of Object.entries(TONES)) {
    light += `.${tone} .bg{fill:${bg}}.${tone} .ic{stroke:${ic}}`
    dark += `.${tone} .bg{fill:${icDark};fill-opacity:.16}.${tone} .ic{stroke:${icDark}}`
  }
  return `${light}@media (prefers-color-scheme:dark){${dark}}`
}

// A grid of columns, each a top and a bottom cell; a cell holds one pill or several side by side.
// A column is as wide as its wider cell; a narrower cell's first pill stretches so both cells share edges.
// A column of one pill is that pill, two rows tall.
export type Cell = Pill | Pill[] | undefined
export type Column = [Cell, Cell] | [Pill]

const cellPills = (c: Cell): Pill[] => (c === undefined ? [] : Array.isArray(c) ? c : [c])
const cellWidth = (ps: Pill[]) => ps.reduce((w, p) => w + pillWidth(p), 0) + Math.max(0, ps.length - 1) * GAP

const gridCols = (columns: Column[]) => columns.map(c => c.map(cellPills)).filter(c => c.some(ps => ps.length > 0))
const natural = (cols: Pill[][][]) => cols.map(c => Math.max(...c.map(cellWidth)))
const sum = (ws: number[], gaps: number) => ws.reduce((a, w) => a + w, 0) + Math.max(0, gaps) * GAP

// The desktop gives the band's slot in columns (bodyColumns), not pixels. Measured: 94 columns
// = ~817px, 58 columns = ~515px. Not a flat factor (8.6px a column left ~18px bare at 58), so a
// line through both. shortcut: if the desktop changes its font or padding, measure again.
export const slotPx = (columns: number) => Math.floor(columns * 8.4 + 28)

// The narrowest a set of grids can be drawn without scaling.
export const bandWidth = (...grids: Column[][]) => Math.max(1, ...grids.map(g => sum(natural(gridCols(g)), gridCols(g).length - 1)))

// One grid of columns, two rows tall, drawn at `top`. Room up to `fill` goes to the columns whose
// widest cell holds a meter, so their bars grow alike; with none, to the first column.
// Where each card landed in the drawing, in its pixels: what a click over it is tested against.
export type CardRect = { x: number; y: number; w: number; h: number; tone: Tone }

function drawGrid(columns: Column[], top: number, fill: number): { body: string; width: number; boxes: CardRect[] } {
  const cols = gridCols(columns)
  const widths = natural(cols)
  const room = Math.floor(fill - sum(widths, cols.length - 1))
  if (room > 0 && widths.length > 0) {
    const metered = cols.flatMap((c, i) => (c.some(ps => ps[0]?.segs.some(s => s.kind === 'bar') && cellWidth(ps) === widths[i]) ? [i] : []))
    const takers = metered.length > 0 ? metered : [0]
    takers.forEach((i, k) => (widths[i]! += Math.floor(room / takers.length) + (k < room % takers.length ? 1 : 0)))
  }
  const width = sum(widths, cols.length - 1)
  let body = ''
  const boxes: CardRect[] = []
  let x = 0
  cols.forEach((c, i) => {
    const colW = widths[i]!
    const h = c.length === 1 ? 2 * H + GAP : H
    c.forEach((ps, row) => {
      const extra = colW - cellWidth(ps)
      let px = x
      ps.forEach((p, k) => {
        const w = pillWidth(p) + (k === 0 ? extra : 0)
        body += drawPill(p, px, top + row * (H + GAP), w, h)
        boxes.push({ x: px, y: top + row * (H + GAP), w, h, tone: p.tone })
        px += w + GAP
      })
    })
    x += colW + GAP
  })
  return { body, width, boxes }
}

// Grids stacked top to bottom, each two rows of pills, all stretched to one right edge: `fill`
// pixels, or the widest grid's own width when that is wider, so no row ends short of another.
export function bandSvg(grids: Column[][], fill = 0): { source: string; width: number; height: number; boxes: CardRect[] } {
  const edge = Math.max(fill, bandWidth(...grids))
  const drawn = grids.map((g, i) => drawGrid(g, i * (2 * H + 2 * GAP), edge))
  const body = drawn.map(d => d.body).join('')
  const width = Math.max(1, ...drawn.map(d => d.width))
  const height = grids.length * (2 * H + GAP) + (grids.length - 1) * GAP
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>${style()}</style>${body}</svg>`
  return { source, width, height, boxes: drawn.flatMap(d => d.boxes) }
}

// One line of plain text for terminals.
const segText = (s: Seg) =>
  s.kind === 'text' ? s.s : s.kind === 'sep' ? '·' : s.kind === 'spark' ? '' : s.kind === 'bar' ? '▮'.repeat(Math.round(s.pct / 20)) + '▯'.repeat(5 - Math.round(s.pct / 20)) : ''

export const bandText = (pills: Pill[]) =>
  pills.map(p => [p.glyph, ...p.segs.map(segText)].filter(Boolean).join(' ')).join('   ')
