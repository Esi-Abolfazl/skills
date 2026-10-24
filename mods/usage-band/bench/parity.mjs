// Parity check for the resumable scan, on real transcripts (the plugin tests have no process or files):
// grows a copy of each transcript in random cuts (mid-line ones too), scans after every cut, and compares
// the last output with one scan of the whole file from no state.
// Usage: node mods/usage-band/bench/parity.mjs [transcript.jsonl ...]   (default: the 5 largest under ~/.claude/projects)
import { execFileSync } from 'node:child_process'
import { appendFileSync, closeSync, mkdtempSync, openSync, readSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const { SCAN_AWK, SCAN_SH } = await import(new URL('../hooks/scan.ts', import.meta.url).href)

const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(projects)
      .flatMap(d => {
        try {
          return readdirSync(join(projects, d)).filter(f => f.endsWith('.jsonl')).map(f => join(projects, d, f))
        } catch {
          return []
        }
      })
      .sort((a, b) => statSync(b).size - statSync(a).size)
      .slice(0, 5)

const scan = (file, state) => execFileSync('/bin/sh', ['-c', SCAN_SH, 'sh', file, state, SCAN_AWK], { maxBuffer: 1 << 28 }).toString()

let failed = 0
for (const file of files) {
  const size = statSync(file).size
  const work = mkdtempSync(join(tmpdir(), 'usage-band-parity-'))
  const copy = join(work, 't.jsonl')
  const whole = scan(file, join(work, 'whole.state'))
  const fd = openSync(file, 'r')
  let at = 0
  let cuts = 0
  let out = ''
  while (at < size) {
    const step = Math.min(size - at, 1 + Math.floor(Math.random() * (size / 6)))
    const buf = Buffer.alloc(step)
    readSync(fd, buf, 0, step, at)
    appendFileSync(copy, buf)
    at += step
    cuts++
    out = scan(copy, join(work, 'cuts.state'))
  }
  closeSync(fd)
  rmSync(work, { recursive: true })
  const same = out === whole
  if (!same) failed++
  console.log(`${same ? 'SAME' : 'DIFF'} ${(size / 2 ** 20).toFixed(1)} MB in ${cuts} cuts  ${file}`)
}
process.exit(failed ? 1 : 0)
