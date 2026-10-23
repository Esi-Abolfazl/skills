import { describe, expect, test } from 'claude-code/testing'

import { SCAN_SH } from '../hooks/scan'
import { bandRows } from './drawn'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 200, scroll: { offset: 0, bodyRows: 6 } } } as const
const NOW = Date.parse('2026-10-16T12:00:00Z')
const SCAN = 'T 2026-10-16T08:50:00.000Z 2026-10-16T08:55:00.000Z\nU 1000 2000 50000 4000\nC 2\n'

describe('rescan', () => {
  test('a turn finds the transcript by session id, scans it, and the band shows it', async ($, on) => {
    let argvs: string[][] = []
    let id = 'old'
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
    on('session.id', () => ({ value: id }))
    on('fs.exists', () => ({ value: true }))
    on('process.run', (_$, e) => {
      argvs.push([...e.argv])
      const out = e.argv[0] === 'find' ? `/home/me/.claude/projects/-p/${id}.jsonl\n` : e.argv[2] === SCAN_SH ? SCAN : ''
      return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('session.usage', (_$, e) => ({
      value: {
        startedAt: NOW,
        context: {
          tokens: 218_200,
          window: 1_000_000,
          percent: 22,
          ...((e as { breakdown?: string }).breakdown ? { breakdown: { rawMaxTokens: 500_000, autoCompactThreshold: 400_000, isAutoCompactEnabled: true } } : {}),
        },
        rateLimits: [],
        cost: { usd: 3 },
      },
    }))
    on('clock.now', () => ({ value: NOW }))
    on('turn.complete', () => ({ text: '' }))
    const turn = { answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' } as const

    await $.turn.complete(turn)
    // Kept while the session id matches: no second lookup.
    argvs = []
    await $.turn.complete(turn)
    expect(argvs.some(a => a[0] === 'find')).toBe(false)

    // A /clear gives a new session id: the kept path still exists but is another session's, so it is looked up again.
    id = 'abc'
    argvs = []
    await $.turn.complete(turn)

    expect(argvs.find(a => a[0] === 'find')).toEqual(['find', '/home/me/.claude/projects', '-maxdepth', '2', '-name', 'abc.jsonl', '-exec', 'ls', '-t', '{}', '+'])
    // The scan resumes from the session's state file, kept beside the config, not in the transcript's folder.
    expect(argvs.find(a => a[2] === SCAN_SH)?.slice(4, 6)).toEqual(['/home/me/.claude/projects/-p/abc.jsonl', '/home/me/.claude/usage-band/abc.state'])

    const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND } as never)
    await ui.resize({ columns: 200, rows: 4, in: 'band' } as never)
    const text = bandRows(await ui.drawn({ in: 'band' } as never)).join('\n')
    expect(text).toContain('44%')
    expect(text).toContain('218.2k/500k ⇕ ×2')
    expect(text).toContain('↑ in 5k')
    expect(text).toContain('↓ out 2k')
    expect(text).toContain('agent 5m 1 turn')
    expect(text).toContain('$ $3.00 ⌀ $3.00')
    await ui.unmount()
  })
})
