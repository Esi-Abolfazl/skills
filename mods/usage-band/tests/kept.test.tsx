import { describe, expect, test } from 'claude-code/testing'

import { bandRows } from './drawn'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 200, scroll: { offset: 0, bodyRows: 6 } } } as const
const NOW = Date.parse('2026-10-16T12:00:00Z')
const FILE = '/home/me/.claude/usage-band/limits.json'
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
    expect(JSON.parse(file)).toEqual([WEEK])

    // A file from another version or a broken write: the bad entries drop, the good one still draws.
    file = JSON.stringify([null, { kind: 'five_hour', percentUsed: '9' }, WEEK])
    rateLimits = []
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
    const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND } as never)
    await ui.resize({ columns: 200, rows: 4, in: 'band' } as never)
    const text = bandRows(await ui.drawn({ in: 'band' } as never)).join('\n')
    expect(text).toContain('41%')
    expect(text).not.toContain('5h')
  })
})
