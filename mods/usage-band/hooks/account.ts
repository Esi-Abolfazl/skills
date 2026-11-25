// Account tint and edge label: pure parts shared by the hooks module and the Client module.
export type Account = { label: string; color: string; solid?: string }
export type Side = 'off' | 'left' | 'right'
export type Look = { account?: Account; labelSide: Side; whenWrapped: boolean }

const ENTRY = /^\s*([^=,:\s]+)=([^:,\x00-\x1f]+):(#[0-9a-fA-F]{6})(?::(#[0-9a-fA-F]{6}))?\s*$/

// `accountId=LABEL:#wash[:#solid],...` (#solid colors the strip, else #wash); an entry that does not match is skipped.
export function parseTints(s: string | undefined): Map<string, Account> {
  const out = new Map<string, Account>()
  for (const part of (s ?? '').split(',')) {
    const m = ENTRY.exec(part)
    if (m) out.set(m[1]!, { label: m[2]!.trim(), color: m[3]!.toLowerCase(), ...(m[4] ? { solid: m[4].toLowerCase() } : {}) })
  }
  return out
}

export function lookOf(id: string | undefined, o: { accountTints?: unknown; accountLabel?: unknown; accountLabelWhenWrapped?: unknown }): Look {
  const side = o.accountLabel === 'left' || o.accountLabel === 'right' ? o.accountLabel : 'off'
  return {
    account: id ? parseTints(typeof o.accountTints === 'string' ? o.accountTints : '').get(id) : undefined,
    labelSide: side,
    whenWrapped: o.accountLabelWhenWrapped === 'show',
  }
}

// One rule for both surfaces: the strip shows only on the widest layout (index 0), unless whenWrapped.
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
export const PANEL_PAD = 3
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

// The desktop panel: rounded wash, optional strip, and the pills drawing (`inner`) inside the padding.
export function panelSvg(a: Account, side: Side, inner: { source: string; width: number; height: number }) {
  const s = side === 'off' ? 0 : STRIP_PX
  const width = s + 2 * PANEL_PAD + inner.width
  const height = inner.height + 2 * PANEL_PAD
  const px = (side === 'left' ? s : 0) + PANEL_PAD
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" rx="${PANEL_R}" fill="${washOf(a)}"/>` +
    (side === 'off' ? '' : strip(a, side, side === 'left' ? 0 : width - STRIP_PX, height)) +
    `<svg x="${px}" y="${PANEL_PAD}" width="${inner.width}" height="${inner.height}">${inner.source}</svg></svg>`
  return { source, width, height, x: px, y: PANEL_PAD }
}
