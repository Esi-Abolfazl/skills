// Pure layout of the band: no engine calls, so tests can drive it.

export type Tone = 'limit5h' | 'limit7d' | 'in' | 'out' | 'ctx' | 'time' | 'cost' | 'pass' | 'fail' | 'stale'
export type Seg =
  // dim: drawn in the muted text colour, for an icon that labels a figure rather than the card.
  | { kind: 'icon'; name: keyof typeof ICONS; dim?: boolean }
  | { kind: 'text'; s: string; bold?: boolean; dim?: boolean; warn?: boolean }
  // mark: the clock's tick; line: where auto-compact runs; both 0 to 100 along the bar.
  | { kind: 'bar'; pct: number; mark?: number; line?: number; w?: number }
  | { kind: 'sep' }
  // spark: recent values as small bars, scaled to the largest.
  | { kind: 'spark'; values: number[] }
// glyph stands in for the icon where only text draws (the terminal); alert tints the pill;
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

// Whole hours and days drop the empty unit: a reset at 2h reads "2h", not "2h 0m".
export function fmtSpan(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`
  return h % 24 === 0 ? `${Math.floor(h / 24)}d` : `${Math.floor(h / 24)}d ${h % 24}h`
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
  // A clock at five o'clock: the five-hour window.
  gauge: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l2.5 4.3"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  // Plain arrows, centred: tokens going up to the model, and coming back down.
  upload: '<path d="M12 20V4"/><path d="m5 11 7-7 7 7"/>',
  download: '<path d="M12 4v16"/><path d="m5 13 7 7 7-7"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  fold: '<path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2"/><path d="m15 19-3-3-3 3"/><path d="m15 5-3 3-3-3"/>',
  bot: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cross: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  flask: '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>',
  coin: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
}

// Light, then dark: pill background and icon/accent colour.
const TONES: Record<Tone, [string, string, string]> = {
  limit5h: ['#d9e8df', '#2f8a5c', '#5fe0a0'],
  limit7d: ['#e3def3', '#6a46d6', '#b39cff'],
  in: ['#e6e5e0', '#4a4943', '#e8e6df'],
  out: ['#e6e5e0', '#7d7c76', '#9a988f'],
  ctx: ['#dce2f6', '#3550e0', '#8fa4ff'],
  time: ['#dbeaee', '#1f8aa8', '#5fd2f0'],
  cost: ['#f1e6cc', '#b8860b', '#ffd04a'],
  pass: ['#dbebd8', '#2f8a33', '#7ee683'],
  fail: ['#f6d6d1', '#d2321c', '#ff6f58'],
  stale: ['#e6e5e0', '#6f6e68', '#b8b7b0'],
}

const CHAR = 7.25 // 12px monospace advance
export const H = 28
export const PAD = 9 // px of inset inside a card, each side: tight enough for the next detail tier at 94 columns
export const GAP = 6 // between pills
const SEG = 5 // between the parts of one pill
const ICON = 15
export const BAR = 46
const RADIUS = 8 // a card's corners: squared off, matching the panel around the band
// An icon-led line starts this much left, so its icon and dot share the rounded end's centre.
const DOT_SHIFT = PAD - (H - ICON) / 2
const DOT_INSET = 4 // card showing round the icon tile, even on every side

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

// The alert thresholds: amber from 60%, red from 85%.
const WARN = 60
const HOT = 85
export const level = (pct: number): Alert | undefined => (pct >= HOT ? 'hot' : pct >= WARN ? 'warn' : undefined)

// Width past the pill's own goes into its first bar, so a stretched meter reads as a longer meter.
function drawPill(p: Pill, x: number, y: number, w = pillWidth(p), h = H): string {
  const extra = w - pillWidth(p)
  const barAt = p.segs.findIndex(s => s.kind === 'bar')
  if (extra > 0 && barAt >= 0) {
    const bar = p.segs[barAt] as Extract<Seg, { kind: 'bar' }>
    p = { ...p, segs: p.segs.map((s, i) => (i === barAt ? { ...bar, w: (bar.w ?? BAR) + extra } : s)) }
  }
  // A neutral card, so a meter turning red never clashes with it; its tone is a tile behind the icon,
  // inset evenly from the card's corner.
  const dot = p.segs[0]?.kind === 'icon'
  const left = x + PAD - (dot ? DOT_SHIFT : 0)
  // A warning or hot card tints its tile, icon and background, the same cue the terminal gives with its tinted chip.
  const a = p.alert ? ` alert ${p.alert}` : ''
  // The tile and card take the meter's own colour, so they deepen from amber to red as it fills;
  // a meter still grey (context nearing auto-compact well short of the window) keeps the alert colour.
  const bar = p.segs.find(s => s.kind === 'bar') as Extract<Seg, { kind: 'bar' }> | undefined
  const tint = p.alert && bar ? meterColor(bar.pct) : GREY
  const al = tint !== GREY ? ` style="--al:${tint}"` : ''
  let out = `<g class="${p.tone}${a}"${al}><title>${esc(p.title)}</title><rect class="bg" x="${x}" y="${y}" width="${w}" height="${h}" rx="${RADIUS}"/>`
  if (dot) {
    const s = H - 2 * DOT_INSET
    const tx = left + ICON / 2 - s / 2
    // Faint behind the icon, deepening toward the tile's edge in its own colour; it floats just off
    // the card, lit faintly from the top left, over a soft shadow.
    const ty = y + DOT_INSET
    const r = RADIUS - DOT_INSET
    const id = `t${Math.round(x)}-${Math.round(y)}`
    out +=
      `<filter id="${id}c" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5"/></filter>` +
      `<rect fill="#000" fill-opacity=".55" filter="url(#${id}c)" x="${tx}" y="${ty + 2}" width="${s}" height="${s}" rx="${r}"/>` +
      `<rect class="acc dot" x="${tx}" y="${ty}" width="${s}" height="${s}" rx="${r}"/>` +
      `<radialGradient id="${id}e"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></radialGradient>` +
      `<mask id="${id}m"><rect fill="url(#${id}e)" x="${tx}" y="${ty}" width="${s}" height="${s}"/></mask>` +
      `<rect class="acc" fill-opacity=".1" mask="url(#${id}m)" x="${tx}" y="${ty}" width="${s}" height="${s}" rx="${r}"/>` +
      `<linearGradient id="${id}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>` +
      `<rect fill="url(#${id}d)" x="${tx}" y="${ty}" width="${s}" height="${s}" rx="${r}"/>`
  }
  // A tall card centres each line on its own row's middle, so its lines sit level with the cards beside it.
  const two = p.sub !== undefined && h > H
  out += drawLine(p.segs, left, y + H / 2)
  if (two) out += drawLine(p.sub!, left, y + h - H / 2)
  return out + '</g>'
}

function drawLine(segs: Seg[], left: number, mid: number): string {
  let out = ''
  let cx = left
  for (const s of segs) {
    if (s.kind === 'icon') {
      // A coloured icon sits on a faint shadow just below it; a faded one stands alone.
      if (!s.dim)
        out += `<g class="ic-sh" transform="translate(${cx} ${mid - ICON / 2 + 0.7}) scale(${ICON / 24})">${ICONS[s.name]}</g>`
      out += `<g class="ic${s.dim ? ' dim' : ''}" transform="translate(${cx} ${mid - ICON / 2}) scale(${ICON / 24})">${ICONS[s.name]}</g>`
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
      const c = meterColor(s.pct)
      const id = `m${Math.round(cx)}-${Math.round(mid)}`
      out += drawFill(id, c, cx, mid, bw, fill)
      if (s.line !== undefined) {
        const lx = cx + (Math.min(100, Math.max(0, s.line)) / 100) * bw
        out += `<rect class="cline" x="${lx - 1}" y="${mid - 8}" width="2" height="16" rx="1"/>`
      }
      if (s.mark !== undefined) {
        const mx = cx + (s.mark / 100) * bw
        // A small dot above the bar in the bar's own colour, its neck flaring smoothly into the top edge.
        out += `<path fill="${c}" d="${pin(mx, mid - 4, 2, 4, 0.6, 2.6)}"/>`
      }
    }
    cx += segWidth(s) + SEG
  }
  return out
}

// A dot of radius r centred `up` above t, on a neck of half-width n that flares to half-width f at t.
const pin = (mx: number, t: number, r: number, up: number, n: number, f: number) => {
  const c = t - up
  return (
    `M${mx - r} ${c}A${r} ${r} 0 0 1 ${mx + r} ${c}` +
    `C${mx + r} ${c + r * 0.7} ${mx + n} ${c + r} ${mx + n} ${c + r + (up - r) * 0.4}Q${mx + n} ${t} ${mx + f} ${t}` +
    `L${mx - f} ${t}Q${mx - n} ${t} ${mx - n} ${c + r + (up - r) * 0.4}C${mx - n} ${c + r} ${mx - r} ${c + r * 0.7} ${mx - r} ${c}Z`
  )
}
// A meter, barely raised: a groove in the meter's colour, faint and outlined so the room left shows,
// shaded at its top; and a rod a touch lighter above than below. Reads as flat until looked at closely.
function drawFill(id: string, c: string, x: number, mid: number, bw: number, fill: number): string {
  const y = mid - 4
  const groove =
    `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".04"/></linearGradient>` +
    `<rect fill="${c}" fill-opacity=".06" stroke="${c}" stroke-opacity=".22" stroke-width="1" x="${x + 0.5}" y="${y + 0.5}" width="${bw - 1}" height="7" rx="3.5"/>` +
    `<rect class="groove" fill="url(#${id}g)" x="${x}" y="${y}" width="${bw}" height="8" rx="4"/>`
  if (fill <= 0) return groove
  const w = Math.max(4, fill)
  return (
    groove +
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>` +
    `<rect fill="${c}" x="${x}" y="${y}" width="${w}" height="8" rx="4"/>` +
    `<rect fill="url(#${id})" x="${x}" y="${y}" width="${w}" height="8" rx="4"/>`
  )
}

function style(): string {
  const font = `ui-monospace,'SF Mono',Menlo,monospace`
  let light = `.t,.b,.w{fill:#33322e;font:12px ${font}}.b,.w{font-weight:700}.d{fill:#8a8983;font:12px ${font}}.w{fill:#b97a12}.cline{fill:#c27a2c}.spark{fill:#a8831a;fill-opacity:.75}.sep{stroke:#1f1e1d;stroke-opacity:.2}.ic{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}`
  let dark = `.t,.b{fill:#ecebe6}.d{fill:#9c9b95}.w{fill:#e9b44c}.cline{fill:#eaa75c}.spark{fill:#e0bb52;fill-opacity:.75}.sep{stroke:#fff;stroke-opacity:.2}`
  for (const [tone, [, ic, icDark]] of Object.entries(TONES)) {
    light += `.${tone} .acc{fill:${ic}}.${tone} .ic{stroke:${ic}}`
    dark += `.${tone} .acc{fill:${icDark}}.${tone} .ic{stroke:${icDark}}`
  }
  light += `.bg{fill:#1f1e1d;fill-opacity:.06}.dot{fill-opacity:.22}.ic.dim{stroke:#8a8983;opacity:.55}.alert.warn .acc{fill:var(--al,#c08a1e)}.alert.warn .bg{fill:var(--al,#c08a1e);fill-opacity:.14}.alert.warn .ic:not(.dim){stroke:var(--al,#c08a1e)}.alert.hot .acc{fill:var(--al,#cf4a34)}.alert.hot .bg{fill:var(--al,#cf4a34);fill-opacity:.14}.alert.hot .ic:not(.dim){stroke:var(--al,#cf4a34)}.ic-sh{fill:none;stroke:#000;stroke-opacity:.3;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}`
  dark += `.ic.dim{stroke:#9c9b95}.alert.warn .acc{fill:var(--al,#e9b44c)}.alert.warn .bg{fill:var(--al,#e9b44c);fill-opacity:.14}.alert.warn .ic:not(.dim){stroke:var(--al,#e9b44c)}.alert.hot .acc{fill:var(--al,#ff7a63)}.alert.hot .bg{fill:var(--al,#ff7a63);fill-opacity:.14}.alert.hot .ic:not(.dim){stroke:var(--al,#ff7a63)}`
  dark += `.bg{fill:#fff;fill-opacity:.06}`
  return `${light}@media (prefers-color-scheme:dark){${dark}}`
}

// A meter's colour: grey while there is room, then amber warming through orange to red as it
// fills, so colour on the band only ever means attention. Grey never blends into the warm
// colours (that mix reads as brown); it steps to amber, and only saturated colours blend.
// Amber and red sit on level()'s thresholds, so a meter turns when its card's alert does.
export const GREY = '#9a988f'
const STOPS: [number, [number, number, number]][] = [
  [WARN, [0xf5, 0xb5, 0x44]],
  [(WARN + HOT) / 2, [0xf2, 0x80, 0x3a]],
  [HOT, [0xe8, 0x48, 0x3f]],
]
export function meterColor(pct: number): string {
  const [first, ...rest] = STOPS
  let [at, rgb] = first!
  if (pct < at) return GREY
  for (const [next, to] of rest) {
    if (pct < next) {
      const t = (pct - at) / (next - at)
      return hex(rgb.map((v, i) => v + (to[i]! - v) * t) as typeof rgb)
    }
    ;[at, rgb] = [next, to]
  }
  return hex(rgb)
}
const hex = (rgb: number[]) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

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
