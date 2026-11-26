import { describe, expect, test } from 'claude-code/testing'

import { lookOf, mix, panelSvg, parseColor, parseFrameArgs, parseFrames, pickWithLabel } from '../hooks/account'

const ID = '00000000-0000-0000-0000-000000000000'
const FRAMES = `${ID}=WORK:#3b82f6:#2563eb`
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 } } } as const
const NOW = Date.parse('2026-10-16T12:00:00Z')

describe('panelSvg', () => {
  test('the account shows as a border in the strip color, with no wash, even with the label off', () => {
    const p = panelSvg({ label: 'W', color: '#3b82f6', solid: '#2563eb' }, 'off', { source: '', width: 100, height: 40 })
    expect(p.source).toContain('fill="none" stroke="#2563eb"')
    expect(p.source).not.toContain('fill="#')
  })
  test('a left strip widens the panel and shifts the content past it; a right strip mirrors it', () => {
    const a = { label: 'W', color: '#3b82f6' }, inner = { source: '', width: 100, height: 40 }
    const base = panelSvg(a, 'off', inner), left = panelSvg(a, 'left', inner), right = panelSvg(a, 'right', inner)
    expect(left.width).toBe(base.width + 16) // the strip takes the 2px border's place on its side
    expect([left.x, left.y]).toEqual([18, base.y]) // the cards touch the strip
    expect([right.width, right.height, right.y]).toEqual([left.width, left.height, left.y])
    expect(right.x).toBe(left.width - left.x - inner.width)
    expect(right.width - right.x - inner.width).toBe(18) // the cards touch the right strip too
  })
})

describe('parseFrames', () => {
  test('valid, invalid and empty', () => {
    expect(parseFrames(`${FRAMES}, other=HOME:#00FF00`).get(ID)).toEqual({ label: 'WORK', color: '#3b82f6', solid: '#2563eb' })
    expect(parseFrames(`${FRAMES}, other=HOME:#00FF00`).get('other')?.color).toBe('#00ff00')
    expect(parseFrames(`${ID}=WORK:#3b82f6:#2563EB`).get(ID)).toEqual({ label: 'WORK', color: '#3b82f6', solid: '#2563eb' })
    expect(parseFrames(`${ID}=WORK:#3b82f6:blue`).size).toBe(0)
    expect(parseFrames(`${ID}=WORK:blue,${ID}=:#3b82f6,nonsense,${ID}=X:#3b82f`).size).toBe(0)
    expect(parseFrames(`${ID}=WO\u0001RK:#3b82f6`).size).toBe(0)
    expect(parseFrames('').size).toBe(0)
    expect(parseFrames(undefined).size).toBe(0)
  })
  test('mix is a solid 14% sRGB blend into the panel', () => {
    expect(mix('#2563eb')).toBe('#262f40')
    expect(mix('#262624')).toBe('#262624')
  })
  test('label shows only on the widest layout unless wrapped is show', () => {
    const fits = (max: number) => (g: number, strip: boolean) => g + (strip ? 1 : 0) <= max
    const all = [10, 8, 6]
    const rows = (g: number) => (g >= 8 ? 2 : 4) // 10 and 8 are one-line layouts, 6 wraps to 4 rows
    const l = lookOf(ID, { accountFrames: FRAMES, accountLabel: 'left' })
    expect(pickWithLabel(l, all, fits(11), rows)).toEqual({ grid: 10, strip: true })
    expect(pickWithLabel(l, all, fits(10), rows)).toEqual({ grid: 8, strip: true }) // a narrower one-line layout keeps the label
    expect(pickWithLabel(l, all, fits(8), rows)).toEqual({ grid: 8, strip: false }) // the strip would force 4 rows: drop it
    const show = lookOf(ID, { accountFrames: FRAMES, accountLabel: 'left', accountLabelWhenWrapped: 'show' })
    expect(pickWithLabel(show, all, fits(8), rows)).toEqual({ grid: 6, strip: true })
    expect(pickWithLabel(lookOf(ID, { accountFrames: FRAMES }), all, fits(99), rows).strip).toBe(false)
  })
})

describe('stored frames', () => {
  const stored = { [ID]: { label: 'HOME', color: '#16a34a', solid: '#12883c', side: 'right' as const } }
  test('the option wins over the stored entry and takes its side from accountLabel', () => {
    const l = lookOf(ID, { accountFrames: FRAMES, accountLabel: 'left' }, stored)
    expect(l.account?.label).toBe('WORK')
    expect(l.labelSide).toBe('left')
    expect(lookOf(ID, { accountFrames: FRAMES }, stored).labelSide).toBe('off')
  })
  test('a stored entry is used when the option lacks the id; its side shows unless accountLabel is left or right', () => {
    const other = { accountFrames: 'ffffffff-0000-0000-0000-000000000000=X:#3b82f6' }
    expect(lookOf(ID, other, stored)).toMatchObject({ account: { label: 'HOME' }, labelSide: 'right' })
    expect(lookOf(ID, { ...other, accountLabel: 'off' }, stored).labelSide).toBe('right')
    expect(lookOf(ID, { ...other, accountLabel: 'left' }, stored).labelSide).toBe('left')
    expect(lookOf(undefined, {}, stored).account).toBeUndefined()
    expect(lookOf('ffffffff-0000-0000-0000-000000000000', {}, stored).account).toBeUndefined()
  })
  test('frame args: color, label, side, derived strip', () => {
    expect(parseColor('#ABCDEF')).toBe('#abcdef')
    expect(parseColor('#abc')).toBeUndefined()
    expect(parseColor('toString')).toBeUndefined()
    expect(parseFrameArgs('blue WORK')).toEqual({ label: 'WORK', color: '#2563eb', solid: mix('#2563eb', 80, '#000000'), side: 'right' })
    expect(parseFrameArgs('#16a34a my work l')).toMatchObject({ label: 'my work', side: 'left' })
    expect(parseFrameArgs('blue WORK r')?.side).toBe('right')
    expect(parseFrameArgs('teal X off')?.side).toBe('off')
    for (const bad of ['', 'WORK', 'WORK mauve', 'A:B red', 'A,B red', 'ABCDEFGHIJKLMNOPQ red', 'blue', 'WORK blue']) expect(parseFrameArgs(bad)).toBeUndefined()
  })
})

describe('/usage-band frame', () => {
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
  cmd(ID, {}, ['frame blue WORK', 'frame'], (o, s) => {
    expect(o[0]).toContain('Frame set')
    expect(o[1]).toContain('WORK')
    expect(s).toContain('rotate(90)') // the band redraws with the right-hand label, no restart
    expect(s).toContain(`stroke=\\"${mix('#2563eb', 80, '#000000')}\\"`) // the border, in the strip color
  })
  cmd(ID, {}, ['frame blue WORK', 'frame off', 'frame'], (o, s) => {
    expect(o[1]).toContain('removed')
    expect(o[2]).toContain('No frame set')
    expect(s).not.toContain('rotate(')
  })
  cmd(ID, { accountFrames: FRAMES }, ['frame green HOME'], (o, s) => {
    expect(o[0]).toContain('accountFrames setting controls')
    expect(s).not.toContain('HOME')
  })
  cmd(ID, {}, ['frame mauve WORK', 'frame red ABCDEFGHIJKLMNOPQ', 'bogus'], o => o.forEach(t => expect(t).toContain('/usage-band frame')))
  cmd(undefined, {}, ['frame blue WORK'], o => expect(o[0]).toContain('no account id'))
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

  const cfg = { accountFrames: FRAMES, accountLabel: 'left' }
  // The desktop shows the account as a border in the strip color; the terminal as a wash.
  const mark = surface === 'desktop' ? 'stroke=\\"#2563eb\\"' : '#293341'
  for (const id of [undefined, 'ffffffff-0000-0000-0000-000000000000']) run(`no frame or label for ${id ?? 'no account'}`, cfg, id, s => { expect(s).not.toContain(mark); expect(s).not.toContain('WORK') })
  run('no frame: no panel, no zero-size boxes', {}, ID, s => {
    if (surface === 'desktop') expect(s).not.toContain('rx=\\"12\\"')
    expect(s).not.toContain('"height":"0%"')
    expect(s).not.toContain('"width":"0%"')
  })
  run('account frames the band', { accountFrames: FRAMES }, ID, s => { expect(s).toContain(mark); expect(s).not.toContain('WORK') })
  for (const [side, rot] of [['left', 'rotate(-90)'], ['right', 'rotate(90)']]) run(`label ${side}`, { ...cfg, accountLabel: side }, ID, s => surface === 'desktop' ? (expect(s).toContain(rot), expect(s).toContain('fill=\\"#2563eb\\"')) : expect(s).toContain('"#2563eb"'))
  run('wrapped layout hides the label by default', cfg, ID, s => { expect(s).toContain(mark); expect(s).not.toContain('rotate(') ; expect(s).not.toContain('"backgroundColor":"#2563eb"') }, 29)
  run('wrapped layout keeps the label when set to show', { ...cfg, accountLabelWhenWrapped: 'show' }, ID, s => surface === 'desktop' ? expect(s).toContain('rotate(-90)') : expect(s).toContain('"#2563eb"'), 29)
}
