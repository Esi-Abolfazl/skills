// Account frame and edge label: pure parts shared by the hooks module and the Client module.
export type Account = { label: string; color: string; solid?: string }
export type Side = 'off' | 'left' | 'right'
export type Look = { account?: Account; labelSide: Side; whenWrapped: boolean }

const ENTRY = /^\s*([^=,:\s]+)=([^:,\x00-\x1f]+):(#[0-9a-fA-F]{6})(?::(#[0-9a-fA-F]{6}))?\s*$/

// `accountId=LABEL:#color[:#solid],...` (#solid colors the strip, else #color); an entry that does not match is skipped.
export function parseFrames(s: string | undefined): Map<string, Account> {
  const out = new Map<string, Account>()
  for (const part of (s ?? '').split(',')) {
    const m = ENTRY.exec(part)
    if (m) out.set(m[1]!, { label: m[2]!.trim(), color: m[3]!.toLowerCase(), ...(m[4] ? { solid: m[4].toLowerCase() } : {}) })
  }
  return out
}

// What `/usage-band frame` keeps per account in the plugin store.
export type StoredFrame = { label: string; color: string; solid: string; side: Side }
export type Frames = Record<string, StoredFrame>

const explicitSide = (v: unknown) => (v === 'left' || v === 'right' ? v : undefined)

// The `accountFrames` option wins over the stored entry. An option entry takes its side from `accountLabel`;
// a stored entry from its own side, unless `accountLabel` is explicitly left or right.
export function lookOf(id: string | undefined, o: { accountFrames?: unknown; accountLabel?: unknown; accountLabelWhenWrapped?: unknown }, stored: Frames = {}): Look {
  const opt = id ? parseFrames(typeof o.accountFrames === 'string' ? o.accountFrames : '').get(id) : undefined
  const kept = id && !opt && Object.hasOwn(stored, id) ? stored[id] : undefined
  // The store is a file anyone can edit: a kept entry is drawn only if it still parses.
  const mine = kept ? parseFrameArgs(`${kept.color} ${kept.label} ${kept.side}`) : undefined
  const labelSide: Side = opt ? (explicitSide(o.accountLabel) ?? 'off') : mine ? (explicitSide(o.accountLabel) ?? mine.side) : (explicitSide(o.accountLabel) ?? 'off')
  return {
    account: opt ?? (mine && { label: mine.label, color: mine.color, solid: mine.solid }),
    labelSide,
    whenWrapped: o.accountLabelWhenWrapped === 'show',
  }
}

export const PALETTE: Record<string, string> = {
  blue: '#2563eb', green: '#16a34a', orange: '#ea580c', red: '#dc2626', purple: '#9333ea',
  pink: '#db2777', teal: '#0d9488', yellow: '#ca8a04', gray: '#6b7280',
}
export const parseColor = (s: string): string | undefined => {
  const t = s.trim().toLowerCase()
  return Object.hasOwn(PALETTE, t) ? PALETTE[t] : /^#[0-9a-f]{6}$/.test(t) ? t : undefined
}

export const FRAME_USAGE = '/usage-band frame <color> <LABEL> [right|r|left|l|off] | /usage-band frame off | /usage-band frame. Colors: ' + Object.keys(PALETTE).join(', ') + ' or #rrggbb.'

const SIDES: Record<string, Side> = { left: 'left', l: 'left', right: 'right', r: 'right', off: 'off' }

// `<color> <LABEL> [side]` (the words after `frame`); undefined when it does not parse.
export function parseFrameArgs(rest: string): StoredFrame | undefined {
  const w = rest.trim().split(/\s+/).filter(Boolean)
  const side: Side = SIDES[w.at(-1)?.toLowerCase() ?? ''] ? SIDES[w.pop()!.toLowerCase()]! : 'right'
  const color = parseColor(w.shift() ?? '')
  const label = w.join(' ')
  if (!color || !label || label.length > 16 || /[:,\x00-\x1f]/.test(label)) return undefined
  return { label, color, solid: mix(color, 80, '#000000'), side }
}

// One rule for both surfaces.
// `fits(grid, strip)` says whether a layout fits with or without the strip's room; `all` is roomiest first.
// The label stays while the band keeps the row count of its widest layout; `rows` counts a layout's rows.
export function pickWithLabel<G>(l: Look, all: G[], fits: (g: G, strip: boolean) => boolean, rows: (g: G) => number): { grid: G; strip: boolean } {
  const pick = (strip: boolean) => {
    const i = all.findIndex(g => fits(g, strip))
    return i < 0 ? all.length - 1 : i
  }
  if (l.account !== undefined && l.labelSide !== 'off') {
    const i = pick(true)
    if (rows(all[i]!) === rows(all[0]!) || l.whenWrapped) return { grid: all[i]!, strip: true }
  }
  return { grid: all[pick(false)]!, strip: false }
}

export const PANEL = '#262624'
// Solid sRGB mix of `hex` at `pct` percent into `base`, like CSS color-mix(in srgb, hex pct%, base).
export function mix(hex: string, pct = 14, base = PANEL): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  return '#' + [0, 1, 2].map(i => Math.round((ch(hex, i) * pct + ch(base, i) * (100 - pct)) / 100).toString(16).padStart(2, '0')).join('')
}
export const washOf = (a: Account) => mix(a.color)
export const stripColor = (a: Account) => a.solid ?? a.color

// Assumed cell size of the desktop and mobile surfaces (their cells are not monospace, so this is a
// ceiling for the Client's Svg strip, whose height cannot be measured): 9 x 20 px.
export const CELL_W = 9
export const CELL_H = 20
export const STRIP_PX = 18
export const PANEL_R = 12
export const PANEL_PAD = 2 // the border's width: the cards sit right against it, and right against the strip
export const SLOT_UNDER = 37 // panel width = slotPx + this leaves the host's own padding on both sides; measured against the desktop app

const esc = (t: string) => t.replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`)

// The strip at `x`, `h` tall, with only its outer corners (on `side`) rounded.
function strip(a: Account, side: 'left' | 'right', x: number, h: number): string {
  const r = PANEL_R, w = STRIP_PX
  const d = side === 'left'
    ? `M${x + r} 0H${x + w}V${h}H${x + r}A${r} ${r} 0 0 1 ${x} ${h - r}V${r}A${r} ${r} 0 0 1 ${x + r} 0Z`
    : `M${x} 0H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${r}V${h - r}A${r} ${r} 0 0 1 ${x + w - r} ${h}H${x}Z`
  return (
    `<path d="${d}" fill="${stripColor(a)}"/>` +
    `<text transform="translate(${x + w / 2} ${h / 2}) rotate(${side === 'left' ? -90 : 90})" text-anchor="middle" dominant-baseline="central" ` +
    `fill="#ffffff" font-weight="700" font-size="9" letter-spacing="0.12em" font-family="ui-monospace, 'SF Mono', Menlo, monospace">${esc(a.label)}</text>`
  )
}

// Standalone strip for surfaces that draw only the strip (the Client on mobile).
export const stripSvg = (a: Account, side: 'left' | 'right', height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_PX}" height="${height}" viewBox="0 0 ${STRIP_PX} ${height}">${strip(a, side, 0, height)}</svg>`

// The desktop panel: a border in the strip's color (the strip reads as its thick side), optional strip, and the pills drawing (`inner`) inside the padding.
export function panelSvg(a: Account, side: Side, inner: { source: string; width: number; height: number }) {
  // The strip replaces the border on its side, so that side has no padding.
  const s = side === 'off' ? 0 : STRIP_PX - PANEL_PAD
  const width = s + 2 * PANEL_PAD + inner.width
  const height = inner.height + 2 * PANEL_PAD
  const px = side === 'left' ? STRIP_PX : PANEL_PAD
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (side === 'off' ? '' : strip(a, side, side === 'left' ? 0 : width - STRIP_PX, height)) +
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${PANEL_R - 1}" fill="none" stroke="${stripColor(a)}" stroke-width="2"/>` +
    `<svg x="${px}" y="${PANEL_PAD}" width="${inner.width}" height="${inner.height}">${inner.source}</svg></svg>`
  return { source, width, height, x: px, y: PANEL_PAD }
}
