import { describe, expect, test } from 'claude-code/testing'

import { bandRows } from './drawn'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 200, scroll: { offset: 0, bodyRows: 6 } } } as const
const NOW = Date.parse('2026-10-16T12:00:00Z')
const FILE = '/home/me/.claude/usage-band/limits.json'
const ACCOUNT_FILE = '/home/me/.claude/usage-band/limits/acc-1.json'
const WEEK = { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-18T12:00:00Z' }

describe('kept limits', () => {
  test('a turn keeps a changed reading once; a new session draws it, skipping entries not in shape', async ($, on) => {
    let file = ''
    let writes = 0
    let rateLimits: unknown[] = [WEEK]
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
    on('session.id', () => ({ value: 'abc' }))
    on('session.turns', () => ({ value: 0 }))
    on('process.run', (_$, e) => {
      const a = e.argv
      if (a[0] === 'cat' && a[1] === FILE) return { value: { exitCode: file ? 0 : 1, stdout: file, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      if (a[0] === '/bin/sh' && a[4] === FILE) (writes++, (file = String(a[5])))
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 0, window: 1_000_000, percent: 0 }, rateLimits, cost: { usd: 1 } } }))
    on('clock.now', () => ({ value: NOW }))
    on('turn.complete', () => ({ text: '' }))
    on('session.start', (_$, e) => e)
    on('clock.every', () => ({ value: undefined }))
    on('command.register', () => ({ value: undefined }))
    const turn = { answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' } as const

    await $.turn.complete(turn)
    await $.turn.complete(turn)
    expect(writes).toBe(1)
    expect(JSON.parse(file)).toEqual({ at: NOW, limits: [WEEK] })

    // A file from another version or a broken write: the bad entries drop, the good one still draws.
    file = JSON.stringify({ at: 1, limits: [null, { kind: 'five_hour', percentUsed: '9' }, WEEK] })
    rateLimits = []
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
    const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND } as never)
    await ui.resize({ columns: 200, rows: 4, in: 'band' } as never)
    const text = bandRows(await ui.drawn({ in: 'band' } as never)).join('\n')
    expect(text).toContain('41%')
    expect(text).not.toContain('5h')
  })

  test('an engine-only reading keeps the per-model windows until they reset; the write is atomic', async ($, on) => {
    let file = ''
    let script = ''
    let rateLimits: unknown[] = []
    const FABLE = { kind: 'seven_day_fable', label: 'Fable', percentUsed: 21, resetsAt: '2026-10-18T12:00:00Z' }
    const GONE = { kind: 'seven_day_old', percentUsed: 5, resetsAt: '2026-10-10T12:00:00Z' }
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
    on('session.id', () => ({ value: 'abc' }))
    on('session.turns', () => ({ value: 0 }))
    on('process.run', (_$, e) => {
      const a = e.argv
      if (a[0] === '/bin/sh' && a[4] === FILE) (script = String(a[2]), (file = String(a[5])))
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 0, window: 1_000_000, percent: 0 }, rateLimits, cost: { usd: 1 } } }))
    on('clock.now', () => ({ value: NOW }))
    on('turn.complete', () => ({ text: '' }))
    const turn = { answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' } as const

    rateLimits = [WEEK, FABLE, GONE]
    await $.turn.complete(turn)
    expect(script).toContain('"$1.tmp" && mv "$1.tmp" "$1"')
    rateLimits = [{ ...WEEK, percentUsed: 50 }]
    await $.turn.complete(turn)
    expect(JSON.parse(file).limits.map((l: { kind: string }) => l.kind)).toEqual(['seven_day', 'seven_day_fable'])
    expect(JSON.parse(file).limits[1].label).toBe('Fable')
  })

  test('an account with no file of its own reads the old shared file, and never writes it', async ($, on) => {
    const writes: string[] = []
    let rateLimits: unknown[] = []
    const old = JSON.stringify({ at: 1, limits: [WEEK] })
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/me' : e.name === 'CLAUDE_CODE_ACCOUNT_UUID' ? 'acc-1' : undefined }))
    on('session.id', () => ({ value: 'abc' }))
    on('session.turns', () => ({ value: 0 }))
    on('process.run', (_$, e) => {
      const a = e.argv
      if (a[0] === 'cat') return { value: { exitCode: a[1] === FILE ? 0 : 1, stdout: a[1] === FILE ? old : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      if (a[0] === '/bin/sh' && String(a[4]).includes('/usage-band/')) writes.push(String(a[4]))
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('session.usage', () => ({ value: { startedAt: NOW, context: { tokens: 0, window: 1_000_000, percent: 0 }, rateLimits, cost: { usd: 1 } } }))
    on('clock.now', () => ({ value: NOW }))
    on('turn.complete', () => ({ text: '' }))
    on('session.start', (_$, e) => e)
    on('clock.every', () => ({ value: undefined }))
    on('command.register', () => ({ value: undefined }))
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
    const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND } as never)
    await ui.resize({ columns: 200, rows: 4, in: 'band' } as never)
    expect(bandRows(await ui.drawn({ in: 'band' } as never)).join('\n')).toContain('41%')
    expect(writes).not.toContain(FILE)
    rateLimits = [WEEK]
    await $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' } as const)
    expect(writes).toEqual([ACCOUNT_FILE])
  })
})
