import { describe, expect, test } from 'claude-code/testing'

import { lookOf, mix, panelSvg, parseColor, parseTintArgs, parseTints, pickWithLabel } from '../hooks/account'

const ID = '00000000-0000-0000-0000-000000000000'
const TINTS = `${ID}=WORK:#3b82f6:#2563eb`
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 } } } as const
const NOW = Date.parse('2026-10-16T12:00:00Z')

describe('panelSvg', () => {
  test('a left strip widens the panel and shifts the content past it', () => {
    const a = { label: 'W', color: '#3b82f6' }, inner = { source: '', width: 100, height: 40 }
    const base = panelSvg(a, 'off', inner)
    const left = panelSvg(a, 'left', inner)
    expect(left.width).toBe(base.width + 18)
    expect([left.x, left.y]).toEqual([base.x + 18, base.y])
  })
  test('a right strip is the left geometry mirrored', () => {
    const a = { label: 'W', color: '#3b82f6' }, inner = { source: '', width: 100, height: 40 }
    const left = panelSvg(a, 'left', inner), right = panelSvg(a, 'right', inner)
    expect([right.width, right.height, right.y]).toEqual([left.width, left.height, left.y])
    expect(left.x - 0).toBe(right.width - right.x - inner.width) // left gap before content == right gap after it
    expect(right.x).toBe(left.width - left.x - inner.width)
  })
})

describe('parseTints', () => {
  test('valid, invalid and empty', () => {
    expect(parseTints(`${TINTS}, other=HOME:#00FF00`).get(ID)).toEqual({ label: 'WORK', color: '#3b82f6', solid: '#2563eb' })
    expect(parseTints(`${TINTS}, other=HOME:#00FF00`).get('other')?.color).toBe('#00ff00')
    expect(parseTints(`${ID}=WORK:blue,${ID}=:#3b82f6,nonsense,${ID}=X:#3b82f`).size).toBe(0)
    expect(parseTints(`${ID}=WO\u0001RK:#3b82f6`).size).toBe(0)
    expect(parseTints('').size).toBe(0)
    expect(parseTints(undefined).size).toBe(0)
  })
  test('optional solid strip color', () => {
    expect(parseTints(`${ID}=WORK:#3b82f6:#2563EB`).get(ID)).toEqual({ label: 'WORK', color: '#3b82f6', solid: '#2563eb' })
    expect(parseTints(`${ID}=WORK:#3b82f6:blue`).size).toBe(0)
  })
  test('mix is a solid 14% sRGB blend into the panel', () => {
    expect(mix('#2563eb')).toBe('#262f40')
    expect(mix('#262624')).toBe('#262624')
  })
  test('label shows only on the widest layout unless wrapped is show', () => {
    const fits = (max: number) => (g: number, strip: boolean) => g + (strip ? 1 : 0) <= max
    const all = [10, 8, 6]
    const rows = (g: number) => (g >= 8 ? 2 : 4) // 10 and 8 are one-line layouts, 6 wraps to 4 rows
    const l = lookOf(ID, { accountTints: TINTS, accountLabel: 'left' })
    expect(pickWithLabel(l, all, fits(11), rows)).toEqual({ grid: 10, strip: true })
    expect(pickWithLabel(l, all, fits(10), rows)).toEqual({ grid: 8, strip: true }) // a narrower one-line layout keeps the label
    expect(pickWithLabel(l, all, fits(8), rows)).toEqual({ grid: 8, strip: false }) // the strip would force 4 rows: drop it
    const show = lookOf(ID, { accountTints: TINTS, accountLabel: 'left', accountLabelWhenWrapped: 'show' })
    expect(pickWithLabel(show, all, fits(8), rows)).toEqual({ grid: 6, strip: true })
    expect(pickWithLabel(lookOf(ID, { accountTints: TINTS }), all, fits(99), rows).strip).toBe(false)
  })
  test('the old min-columns option is ignored', () => {
    const l = lookOf(ID, { accountTints: TINTS, accountLabel: 'left', accountLabelMinColumns: '999' } as never)
    expect(pickWithLabel(l, [1], () => true, () => 1).strip).toBe(true)
  })
})

describe('stored tints', () => {
  const stored = { [ID]: { label: 'HOME', color: '#16a34a', solid: '#12883c', side: 'right' as const } }
  test('the option wins over the stored entry and takes its side from accountLabel', () => {
    const l = lookOf(ID, { accountTints: TINTS, accountLabel: 'left' }, stored)
    expect(l.account?.label).toBe('WORK')
    expect(l.labelSide).toBe('left')
    expect(lookOf(ID, { accountTints: TINTS }, stored).labelSide).toBe('off')
  })
  test('a stored entry is used when the option lacks the id; its side shows unless accountLabel is left or right', () => {
    const other = { accountTints: 'ffffffff-0000-0000-0000-000000000000=X:#3b82f6' }
    expect(lookOf(ID, other, stored)).toMatchObject({ account: { label: 'HOME' }, labelSide: 'right' })
    expect(lookOf(ID, { ...other, accountLabel: 'off' }, stored).labelSide).toBe('right')
    expect(lookOf(ID, { ...other, accountLabel: 'left' }, stored).labelSide).toBe('left')
    expect(lookOf(undefined, {}, stored).account).toBeUndefined()
    expect(lookOf('ffffffff-0000-0000-0000-000000000000', {}, stored).account).toBeUndefined()
  })
  test('colors: names, hex, bad input', () => {
    expect(parseColor('Blue')).toBe('#2563eb')
    expect(parseColor('#ABCDEF')).toBe('#abcdef')
    expect(parseColor('#abc')).toBeUndefined()
    expect(parseColor('toString')).toBeUndefined()
  })
  test('tint args: label, color, side, derived strip', () => {
    expect(parseTintArgs('WORK blue')).toEqual({ label: 'WORK', color: '#2563eb', solid: mix('#2563eb', 80, '#000000'), side: 'right' })
    expect(parseTintArgs('my work #16a34a left')?.label).toBe('my work')
    expect(parseTintArgs('X teal off')?.side).toBe('off')
    for (const bad of ['', 'WORK', 'WORK mauve', 'A:B red', 'A,B red', 'ABCDEFGHIJKLMNOPQ red', 'blue']) expect(parseTintArgs(bad)).toBeUndefined()
  })
})

describe('/usage-band tint', () => {
  const cmd = (id: string | undefined, options: Record<string, string>, steps: string[], check: (out: string[], s: string) => void) =>
    test(`flow ${steps.join(' | ')}`, { options } as never, async ($, on) => {
      on('session.usage', () => ({ value: { startedAt: NOW - 3_600_000, context: { tokens: 1000, window: 1_000_000, percent: 1 }, cost: { usd: 1 }, rateLimits: [] } }))
      on('session.turns', () => ({ value: 5 }))
      on('clock.now', () => ({ value: NOW }))
      on('env.get', (_$, e) => ({ value: e.name === 'CLAUDE_CODE_ACCOUNT_UUID' ? id : undefined }))
      const kept = new Map<string, unknown>()
      on('store.get', (_$, e) => ({ value: kept.get(e.key) }))
      on('store.set', (_$, e) => (kept.set(e.key, JSON.parse(JSON.stringify(e.value))), { value: undefined }))
      const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'desktop', ...BAND } as never)
      const out: string[] = []
      for (const args of steps) out.push(String((await $.command.run({ command: 'usage-band', args })).text))
      check(out, JSON.stringify(await ui.drawn()))
      await ui.unmount()
    })
  cmd(ID, {}, ['tint'], o => expect(o[0]).toContain('No tint set'))
  cmd(ID, {}, ['tint WORK blue', 'tint'], (o, s) => {
    expect(o[0]).toContain('Tint set')
    expect(o[1]).toContain('WORK')
    expect(s).toContain('rotate(90)') // the band redraws with the right-hand label, no restart
    expect(s).toContain(mix('#2563eb'))
  })
  cmd(ID, {}, ['tint WORK blue', 'tint off', 'tint'], (o, s) => {
    expect(o[1]).toContain('removed')
    expect(o[2]).toContain('No tint set')
    expect(s).not.toContain('rotate(')
  })
  cmd(ID, { accountTints: TINTS }, ['tint HOME green'], (o, s) => {
    expect(o[0]).toContain('accountTints setting controls')
    expect(s).not.toContain('HOME')
  })
  cmd(ID, {}, ['tint WORK mauve', 'tint ABCDEFGHIJKLMNOPQ red', 'bogus'], o => o.forEach(t => expect(t).toContain('/usage-band tint')))
  cmd(undefined, {}, ['tint WORK blue'], o => expect(o[0]).toContain('no account id'))
})

for (const surface of ['terminal', 'desktop'] as const) {
  const run = (name: string, options: Record<string, string>, id: string | undefined, check: (s: string) => void, columns = 120) =>
    test(`${surface}: ${name}`, { options } as never, async ($, on) => {
      on('session.usage', () => ({ value: { startedAt: NOW - 3_600_000, context: { tokens: 1000, window: 1_000_000, percent: 1 }, cost: { usd: 1 }, rateLimits: [] } }))
      on('session.turns', () => ({ value: 5 }))
      on('clock.now', () => ({ value: NOW }))
      on('env.get', (_$, e) => ({ value: e.name === 'CLAUDE_CODE_ACCOUNT_UUID' ? id : undefined }))
      const ui = await $.ui.mount({ plugin: 'usage-band', surface, ...BAND, props: { ...BAND.props, bodyColumns: columns } } as never)
      if (surface === 'terminal') await (ui as unknown as { resize(a: object): Promise<void> }).resize({ columns, rows: 4, in: 'band' })
      check(JSON.stringify(surface === 'terminal' ? await ui.drawn({ in: 'band' } as never) : await ui.drawn()))
      await ui.unmount()
    })

  const cfg = { accountTints: TINTS, accountLabel: 'left' }
  run('no account, no tint or label', cfg, undefined, s => { expect(s).not.toContain('#293341'); expect(s).not.toContain('WORK') })
  run('other account, no tint or label', cfg, 'ffffffff-0000-0000-0000-000000000000', s => { expect(s).not.toContain('#293341'); expect(s).not.toContain('WORK') })
  if (surface === 'desktop') run('no tint: no panel, 0.5.2 tree shape', {}, ID, s => {
    expect(s).toContain('"flexDirection":"column"},"children":[{"type":"Box","props":{"key":"row-0","width":"100%"')
    expect(s).not.toContain('rx=\\"12\\"')
    expect(s).not.toContain('"height":"0%"')
    expect(s).not.toContain('"width":"0%"')
  })
  run('account tints the band', { accountTints: TINTS }, ID, s => { expect(s).toContain('#293341'); expect(s).not.toContain('WORK') })
  run('label left', cfg, ID, s => surface === 'desktop' ? (expect(s).toContain('rotate(-90)'), expect(s).toContain('fill=\\"#2563eb\\"')) : expect(s).toContain('"#2563eb"'))
  run('label right', { ...cfg, accountLabel: 'right' }, ID, s => surface === 'desktop' ? (expect(s).toContain('rotate(90)'), expect(s).toContain('fill=\\"#2563eb\\"')) : expect(s).toContain('"#2563eb"'))
  run('wrapped layout hides the label by default', cfg, ID, s => { expect(s).toContain('#293341'); expect(s).not.toContain('rotate(') ; expect(s).not.toContain('"backgroundColor":"#2563eb"') }, 30)
  run('wrapped layout keeps the label when set to show', { ...cfg, accountLabelWhenWrapped: 'show' }, ID, s => surface === 'desktop' ? expect(s).toContain('rotate(-90)') : expect(s).toContain('"#2563eb"'), 30)
}
