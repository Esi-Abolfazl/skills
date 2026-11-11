// The models scan on hand-made transcripts: a streamed message repeated, the same message in a second file, a
// subagent file, a line still being written, a deleted file, a shrunk file, and two scans at once.
// Usage: node --experimental-strip-types mods/usage-band/bench/models.mjs
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { MODELS_SH, MODELS_AWK, MODELS_QUERY_AWK, MODELS_SESSION_AWK, parseQuery, windowStarts } = await import(new URL('../hooks/models.ts', import.meta.url).href)

const line = (id, model, ts, u, extra = '') => JSON.stringify({ parentUuid: null, isSidechain: extra !== '', message: { model, id, type: 'message', role: 'assistant', content: [], usage: { input_tokens: u[0], output_tokens: u[1], cache_read_input_tokens: u[2], cache_creation_input_tokens: u[3] } }, uuid: id + ts, timestamp: ts })
const NOW = Date.parse('2026-11-10T12:30:00Z')
const work = mkdtempSync(join(tmpdir(), 'usage-band-models-'))
const proj = join(work, 'projects')
const sd = join(work, 'state')
mkdirSync(join(proj, 'p1', 'sess-a', 'subagents'), { recursive: true })
mkdirSync(join(proj, 'p2'), { recursive: true })
const A = join(proj, 'p1', 'sess-a.jsonl')
const SUB = join(proj, 'p1', 'sess-a', 'subagents', 'agent-1.jsonl')
const B = join(proj, 'p2', 'sess-b.jsonl')

writeFileSync(A, [
  line('msg_1', 'claude-opus-5-5', '2026-11-10T11:00:00.000Z', [10, 5, 100, 20]),
  // streaming: the same message again with a bigger output: the last wins
  line('msg_1', 'claude-opus-5-5', '2026-11-10T11:00:01.000Z', [10, 50, 100, 20]),
  line('msg_2', '<synthetic>', '2026-11-10T11:01:00.000Z', [1, 1, 1, 1]),
  line('msg_3', 'claude-sonnet-5-5', '2026-11-03T08:00:00.000Z', [1, 2, 3, 4]),
].join('\n') + '\n')
writeFileSync(SUB, line('msg_4', 'claude-sonnet-5-5', '2026-11-10T11:30:00.000Z', [7, 8, 9, 10], 'sub') + '\n')
// a resumed copy: msg_1 again in another file
writeFileSync(B, line('msg_1', 'claude-opus-5-5', '2026-11-10T11:00:01.000Z', [10, 50, 100, 20]) + '\n')

const BUDGET = '1000000000'
const run = (budget = BUDGET) => execFileSync('/bin/sh', ['-c', MODELS_SH, 'sh', proj, sd, MODELS_AWK, budget]).toString()
const query = () => {
  const { D, W, M } = windowStarts(NOW)
  return parseQuery(execFileSync('awk', ['-v', `D=${D}`, '-v', `W=${W}`, '-v', `M=${M}`, MODELS_QUERY_AWK, join(sd, 'ledger')]).toString())
}
const find = (rows, period, source, model) => rows.find(r => r.period === period && r.source === source && r.model === model)
const check = (name, ok, got) => {
  if (!ok) {
    console.error(`FAIL ${name}`, got === undefined ? '' : JSON.stringify(got))
    process.exitCode = 1
  } else console.log(`ok   ${name}`)
}

run()
let rows = query()
const opus = find(rows, 'all', 'all', 'claude-opus-5-5')
check('a streamed message and a copy in another file count once, last line wins', opus?.output === 50 && opus.input === 10 && opus.sessions === 1, opus)
check('<synthetic> is dropped', rows.every(r => r.model !== '<synthetic>'))
const sonnetAll = find(rows, 'all', 'all', 'claude-sonnet-5-5')
check('main plus subagents is everything', sonnetAll?.input === 8 && find(rows, 'all', 'main', 'claude-sonnet-5-5')?.input === 1 && find(rows, 'all', 'sub', 'claude-sonnet-5-5')?.input === 7, sonnetAll)
check('a subagent row belongs to its parent session', sonnetAll?.sessions === 1, sonnetAll)
check('windows: msg_3 is 7 days and 4 hours old, so month and all only', find(rows, 'week', 'all', 'claude-sonnet-5-5')?.input === 7 && find(rows, 'month', 'all', 'claude-sonnet-5-5')?.input === 8, find(rows, 'week', 'all', 'claude-sonnet-5-5'))

check('the * total counts sessions across models', find(rows, 'all', 'all', '*')?.sessions === 2, find(rows, 'all', 'all', '*'))
const sess = parseQuery(execFileSync('awk', ['-v', 'SID=sess-a', MODELS_SESSION_AWK, join(sd, 'ledger')]).toString())
check('session sums: main alone and with subagents', find(sess, 'all', 'main', 'claude-sonnet-5-5')?.input === 1 && find(sess, 'all', 'all', 'claude-sonnet-5-5')?.input === 8, sess)

// a line still being written is left for the next scan, and read once it is finished
const half = line('msg_5', 'claude-haiku-5-5', '2026-11-10T12:00:00.000Z', [3, 3, 3, 3])
appendFileSync(A, half.slice(0, 40))
run()
check('an unfinished last line is not counted', find(query(), 'all', 'all', 'claude-haiku-5-5') === undefined)
appendFileSync(A, half.slice(40) + '\n')
run()
check('it is counted once it is finished', find(query(), 'all', 'all', 'claude-haiku-5-5')?.input === 3)

// only new bytes are read: a second scan with nothing new leaves the ledger as it was
const before = readFileSync(join(sd, 'ledger'), 'utf8')
run()
check('a scan with nothing new changes nothing', readFileSync(join(sd, 'ledger'), 'utf8') === before)

// rule 2: a transcript leaving the disk keeps its rows
rmSync(SUB)
run()
check('a deleted transcript keeps its rows', find(query(), 'all', 'sub', 'claude-sonnet-5-5')?.input === 7)

// a shrunk file starts over and does not double count
writeFileSync(B, line('msg_1', 'claude-opus-5-5', '2026-11-10T11:00:01.000Z', [10, 50, 100, 20]) + '\n')
run()
check('a rewritten file does not double count', find(query(), 'all', 'all', 'claude-opus-5-5')?.output === 50)

// the byte budget: one file per run while behind, and "more" says so
rmSync(sd, { recursive: true })
const out = run('1')
check('a small budget reads one file and says more', out.trim() === 'more' && find(query(), 'all', 'all', 'claude-opus-5-5') !== undefined, out)

// two scans at once: one runs, the other leaves with 3, the ledger stays whole
rmSync(sd, { recursive: true })
const one = () => new Promise(res => { const c = spawn('/bin/sh', ['-c', MODELS_SH, 'sh', proj, sd, MODELS_AWK, BUDGET]); c.on('close', code => res(code)) })
const codes = await Promise.all([one(), one(), one()])
rows = query()
check('concurrent scans leave a consistent ledger', find(rows, 'all', 'all', 'claude-opus-5-5')?.output === 50 && codes.every(c => c === 0 || c === 3), codes)

rmSync(work, { recursive: true })
