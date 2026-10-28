import { describe, expect, test } from 'claude-code/testing'

import { BAR, GAP, GREY, H, HOUR, PAD, bandSvg, bandText, bandWidth, fmtSpan, fmtTokens, level, meterColor, pillWidth, windowMark } from '../hooks/pills'
import type { Pill } from '../hooks/pills'

describe('pills', () => {
  test('formats tokens and spans', () => {
    expect(fmtTokens(15_600)).toBe('15.6k')
    expect(fmtTokens(954_200)).toBe('954.2k')
    expect(fmtTokens(1_200_000)).toBe('1.2M')
    expect(fmtTokens(500_000)).toBe('500k')
    expect(fmtSpan(2 * HOUR + 40 * 60_000)).toBe('2h 40m')
    expect(fmtSpan(31 * HOUR)).toBe('1d 7h')
    expect(fmtSpan(2 * HOUR)).toBe('2h')
    expect(fmtSpan(3 * 24 * HOUR)).toBe('3d')
    expect(fmtSpan(-5)).toBe('0m')
  })

  test('the tick sits at the elapsed share of the window', () => {
    const now = Date.parse('2026-10-16T12:00:00Z')
    const resets = new Date(now + 2.5 * HOUR).toISOString()
    expect(windowMark('five_hour', resets, now)).toBe(50)
    expect(windowMark('spend_limit', resets, now)).toBe(undefined)
    expect(windowMark('five_hour', undefined, now)).toBe(undefined)
  })

  test('a meter turns colour where its card turns alert, not before', () => {
    for (const pct of [0, 59, 60, 72, 84, 85, 100]) expect(meterColor(pct) === GREY).toBe(level(pct) === undefined)
  })

  test('a near-limit card is tinted, a calm one not', () => {
    const pill = (alert?: 'warn' | 'hot'): Pill => ({ tone: 'ctx', glyph: 'ctx', title: '', alert, segs: [{ kind: 'text', s: 'ctx' }] })
    expect(bandSvg([[[pill('warn')]]]).source).toContain('alert warn"')
    expect(bandSvg([[[pill('hot')]]]).source).toContain('alert hot"')
    expect(bandSvg([[[pill()]]]).source).not.toContain(' alert ')
  })

  test('lays pills out as two rows of equal-width columns, escaped, with no panel', () => {
    const pill: Pill = { tone: 'cost', glyph: '$', title: '<x>', segs: [{ kind: 'icon', name: 'coin' }, { kind: 'text', s: '$4.32' }] }
    const wide: Pill = { ...pill, segs: [...pill.segs, { kind: 'text', s: 'longer text' }] }
    const { source, width, height } = bandSvg([[[pill, wide], [pill, undefined], [undefined, undefined]]])
    expect(source.includes('&lt;x&gt;')).toBe(true)
    expect(source.includes('<x>')).toBe(false)
    expect(source.includes('panel')).toBe(false)
    expect(source.split('class="bg"').length - 1).toBe(3)
    expect(height).toBe(2 * H + GAP)
    expect(width).toBe(pillWidth(wide) + GAP + pillWidth(pill))
    expect(source.match(new RegExp(`width="${pillWidth(wide)}"`, 'g'))?.length).toBe(2)
    expect(bandText([pill])).toBe('$ $4.32')
  })

  test('a column of one pill draws it two rows tall, its second line on the lower row', () => {
    const a: Pill = { tone: 'ctx', glyph: '', title: 't', segs: [{ kind: 'text', s: 'top' }] }
    const tall: Pill = { tone: 'pass', glyph: '', title: 't', segs: [{ kind: 'text', s: 'one' }], sub: [{ kind: 'text', s: 'a longer second line' }] }
    const { source, height, boxes } = bandSvg([[[a, a], [tall]]])
    expect(height).toBe(2 * H + GAP)
    expect(boxes.find(b => b.tone === 'pass')).toMatchObject({ y: 0, h: 2 * H + GAP, w: pillWidth(tall) })
    expect(source.includes(`>one</text>`) && source.includes(`y="${H / 2 + 4}">one`)).toBe(true)
    expect(source.includes(`y="${H + GAP + H / 2 + 4}">a longer second line`)).toBe(true)
  })

  test('two pills in one cell share the column edges with the cell above', () => {
    const pill: Pill = { tone: 'cost', glyph: '$', title: 't', segs: [{ kind: 'text', s: 'x' }] }
    const wide: Pill = { ...pill, segs: [{ kind: 'text', s: 'a much longer pill text here' }] }
    const { width, source } = bandSvg([[[wide, [pill, pill]]]])
    expect(bandSvg([[[pill, pill]], [[wide, undefined]]]).height).toBe(4 * H + 3 * GAP)
    expect(width).toBe(pillWidth(wide))
    const stretched = pillWidth(wide) - GAP - pillWidth(pill)
    expect(source.includes(`width="${stretched}"`)).toBe(true)
  })

  test('fills the given width, putting the room into the first column\'s bar', () => {
    const meter: Pill = { tone: 'limit5h', glyph: '', title: 't', segs: [{ kind: 'bar', pct: 50 }, { kind: 'text', s: '50%' }] }
    const other: Pill = { tone: 'in', glyph: '', title: 't', segs: [{ kind: 'text', s: '1k' }] }
    const grid = [[meter, meter], [other, other]] as const
    const tight = bandWidth([...grid])
    const { width, source } = bandSvg([[...grid]], tight + 100)
    expect(width).toBe(tight + 100)
    const groove = source.match(/class="groove"[^>]*/)?.[0] ?? ''
    expect(groove).toContain(`x="${PAD}"`)
    expect(groove).toContain(`y="${H / 2 - 4}"`)
    expect(groove).toContain(`width="${BAR + 100}"`)
    expect(bandSvg([[...grid]], tight - 50).width).toBe(tight)
  })

  test('two meter columns split the room, so their bars grow alike', () => {
    const meter: Pill = { tone: 'limit5h', glyph: '', title: 't', segs: [{ kind: 'bar', pct: 50 }, { kind: 'text', s: '50%' }] }
    const other: Pill = { tone: 'in', glyph: '', title: 't', segs: [{ kind: 'text', s: '1k' }] }
    const grid = [[meter, meter], [other, other], [meter, other]] as const
    const { source } = bandSvg([[...grid]], bandWidth([...grid]) + 100)
    const bars = [...source.matchAll(/class="groove"[^>]*width="(\d+)"/g)].map(m => m[1])
    expect(bars).toEqual(['96', '96', '96'])
  })

  test('stacked grids share one right edge even when the fill is narrower than the widest', () => {
    const meter: Pill = { tone: 'limit5h', glyph: '', title: 't', segs: [{ kind: 'bar', pct: 50 }, { kind: 'text', s: 'a long label here' }] }
    const short: Pill = { tone: 'in', glyph: '', title: 't', segs: [{ kind: 'bar', pct: 5 }] }
    const top = [[meter, meter]] as const
    const bottom = [[short, short]] as const
    const { source, width } = bandSvg([[...top], [...bottom]], 10)
    expect(width).toBe(pillWidth(meter))
    expect(source.split(`width="${pillWidth(meter)}" height="${H}"`).length - 1).toBe(4)
  })
})
