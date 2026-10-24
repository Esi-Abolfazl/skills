import type { Scan } from '../types'

// One pass over the session's transcript (JSONL, often past the 4 MiB $.fs.read limit): every turn's
// first and last timestamp and the context its last reply was answered over (T), each background task from its launching tool call
// to the notification that it finished (W: work between turns), each compaction (B), the token usage of each assistant message once (streaming repeats a
// message over several lines), and the compaction boundaries. Quotes inside message text are
// escaped in JSONL, so an unescaped key match is structural; the top-level timestamp is a line's last.
// shortcut: a background task counts only once its notification lands (a running one, or one with no tool-use-id such as a
// Monitor event, adds nothing yet); track open launches from their "running in background" results if a live tick matters.
// shortcut: subagent transcripts live in their own files and are not counted; read subagents/*.jsonl too if their tokens matter.
// Resumable: the state file (ST in, NEW out) keeps the transcript it was read from (P), the bytes already read (O),
// the open turn and counters (V), the lines printed so far (E), launches (L) and each message's usage (M: a
// message id recurs thousands of lines later, so every id is kept, not only the last). Without a state file it is
// one pass over the whole file. A line the writer has not finished (no newline yet) is left for the next scan.
export const SCAN_AWK = String.raw`function num(s, k) { if (match(s, "\"" k "\":[0-9]+")) return substr(s, RSTART + length(k) + 3, RLENGTH - length(k) - 3) + 0; return 0 }
function keep(x) { kept[++nk] = x; print x }
function scan(line,   pre, s, ts, tail, k, id, u) {
  n++
  pre = substr(line, 1, 400)
  if (index(pre, "\"isSidechain\":true")) return
  if (index(line, "\"subtype\":\"compact_boundary\"")) { c++; keep("B") }
  s = line; ts = ""; tail = ""
  while (match(s, /"timestamp":"[^"]*"/)) { ts = substr(s, RSTART + 13, RLENGTH - 14); tail = substr(s, RSTART + RLENGTH); s = tail }
  if (ts == "") return
  if (index(tail, "\"promptSource\":")) {
    if (start != "") keep("T " start " " end " " (tc + 0))
    if (index(line, "<task-notification>") && match(line, /<tool-use-id>toolu_[A-Za-z0-9]+/)) { k = substr(line, RSTART + 13, RLENGTH - 13); if (k in launch) keep("W " launch[k] " " ts) }
    start = ts; end = ts; tc = 0; return
  }
  if (index(pre, "\"role\":\"assistant\"")) {
    end = ts
    if (match(line, /"type":"tool_use","id":"toolu_[A-Za-z0-9]+"/)) launch[substr(line, RSTART + 24, RLENGTH - 25)] = ts
    id = "n" n
    if (match(pre, /"id":"msg_[A-Za-z0-9]+"/)) id = substr(pre, RSTART + 6, RLENGTH - 7)
    u = line
    while (match(u, /"usage":\{/)) u = substr(u, RSTART + RLENGTH)
    ui[id] = num(u, "input_tokens"); uo[id] = num(u, "output_tokens"); ur[id] = num(u, "cache_read_input_tokens"); uw[id] = num(u, "cache_creation_input_tokens")
    tc = ui[id] + ur[id] + uw[id]
  } else if (index(pre, "\"role\":\"user\"")) end = ts
}
BEGIN {
  while ((getline rec < ST) > 0) {
    split(rec, f, " ")
    if (f[1] == "V") { c = f[2]; n = f[3]; start = f[4] == "-" ? "" : f[4]; end = f[5] == "-" ? "" : f[5]; tc = f[6] }
    else if (f[1] == "E") keep(substr(rec, 3))
    else if (f[1] == "L") launch[f[2]] = f[3]
    else if (f[1] == "M") { ui[f[2]] = f[3]; uo[f[2]] = f[4]; ur[f[2]] = f[5]; uw[f[2]] = f[6] }
  }
  close(ST)
}
{ if (have) { scan(prev); used += length(prev) + 1 } prev = $0; have = 1 }
END {
  if (have && COMPLETE) { scan(prev); used += length(prev) + 1 }
  if (start != "") print "T", start, end, tc + 0
  for (k in ui) { i += ui[k]; o += uo[k]; r += ur[k]; w += uw[k] }
  print "U", i + 0, o + 0, r + 0, w + 0
  print "C", c + 0
  print "P " ENVIRON["SCAN_PATH"] > NEW
  print "O", BASE + used > NEW
  print "V", c + 0, n + 0, (start == "" ? "-" : start), (end == "" ? "-" : end), tc + 0 > NEW
  for (j = 1; j <= nk; j++) print "E", kept[j] > NEW
  for (k in launch) print "L", k, launch[k] > NEW
  for (k in ui) print "M", k, ui[k], uo[k], ur[k], uw[k] > NEW
  close(NEW)
}`

// Runs SCAN_AWK over the bytes past the state's offset: $1 transcript, $2 state file, $3 the awk program.
// dd seeks to the offset (macOS tail -c +N reads every byte before it: 2.7 s at 96 MB); a shrunk file starts over.
// The state's first line names the transcript it was read from: one session id can have several transcripts
// (copies under other project folders), and an offset into one means nothing in another.
// With no new bytes head is skipped: macOS head rejects -c 0.
export const SCAN_SH = String.raw`f=$1 st=$2 prog=$3
mkdir -p "$(dirname "$st")"
size=$(wc -c < "$f" | tr -d ' ')
off=0
[ -f "$st" ] && [ "$(head -n 1 "$st")" = "P $f" ] && off=$(sed -n 's/^O //p' "$st")
case $off in ''|*[!0-9]*) off=0 ;; esac
if [ "$off" -gt "$size" ]; then off=0; fi
[ "$off" -eq 0 ] && rm -f "$st"
complete=0
[ "$size" -gt 0 ] && [ "$(tail -c +"$size" "$f" | od -An -tx1 | tr -d ' \n')" = 0a ] && complete=1
{ dd bs=1 skip="$off" count=0 2>/dev/null; [ "$size" -gt "$off" ] && head -c $((size - off)); } < "$f" | LC_ALL=C SCAN_PATH="$f" awk -v ST="$st" -v NEW="$st.$$" -v BASE="$off" -v COMPLETE="$complete" "$prog" || exit 1
mv "$st.$$" "$st"`

export const NO_SCAN: Scan = { agentMs: 0, turns: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compactions: 0, log: [], sinceCompact: 0 }
const LOG = 20

// Agent time is the union of turns and background tasks: a turn that hands work to a background task ends
// while that work runs, and turns or tasks that overlap count once.
function unionMs(spans: [number, number][]): number {
  let ms = 0
  let reach = -Infinity
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (b > reach) ms += b - Math.max(a, reach)
    reach = Math.max(reach, b)
  }
  return ms
}

export function parseScan(stdout: string): Scan {
  const scan: Scan = { ...NO_SCAN, tokens: { ...NO_SCAN.tokens }, log: [] }
  const spans: [number, number][] = []
  for (const line of stdout.split('\n')) {
    const [tag, a = '', b = '', c = '', d = ''] = line.trim().split(' ')
    if (tag === 'B') {
      scan.sinceCompact = 0
    } else if (tag === 'T') {
      const ms = Date.parse(b) - Date.parse(a)
      const turnMs = Number.isFinite(ms) && ms > 0 ? ms : 0
      scan.turns += 1
      scan.sinceCompact += 1
      if (turnMs > 0) spans.push([Date.parse(a), Date.parse(b)])
      scan.log = [...scan.log, { startAt: Date.parse(a) || 0, ms: turnMs, ctx: Number(c) || 0 }].slice(-LOG)
    } else if (tag === 'W') {
      const [from, to] = [Date.parse(a), Date.parse(b)]
      if (to > from) spans.push([from, to])
    } else if (tag === 'U') {
      scan.tokens = { input: Number(a) || 0, output: Number(b) || 0, cacheRead: Number(c) || 0, cacheWrite: Number(d) || 0 }
    } else if (tag === 'C') {
      scan.compactions = Number(a) || 0
    }
  }
  scan.agentMs = unionMs(spans)
  return scan
}
