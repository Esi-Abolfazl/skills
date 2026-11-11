import type { ModelRow } from '../types'

// Per-model usage across every session on the machine, read from every transcript under <config>/projects
// (subagent transcripts included: they are most of the files and most of the other models).
// State, in <config>/usage-band/models/:
//   offsets  one line per transcript: path TAB bytes already read. A shrunk file starts over.
//   ledger   one line per API message: id hour model session main|sub in out cacheRead cacheWrite.
// Rules an agent would break:
//   1. A message counts ONCE, by its id, across all files. Streaming repeats a message over several lines and a resumed
//      or copied session repeats it in another file: the ledger is keyed by id and the last line of an id wins.
//      Never sum per file.
//   2. Ledger rows are never deleted or rewritten because a transcript left the disk. Claude Code removes old
//      transcripts after cleanupPeriodDays; the ledger is what keeps "All" longer than that.
// shortcut: no pruning (about 100 bytes a message, 13 MB at 130k messages); prune rows older than a year when the ledger passes 100 MB.
// shortcut: macOS stat (-f); the mod is built and tested on macOS only.

// $1 projects dir, $2 state dir, $3 the awk program, $4 bytes to read this run (at least one file is always read).
// Exit 3: another run holds the lock (a lock older than 10 minutes is a dead run's). Prints "more" when files are left.
export const MODELS_SH = String.raw`proj=$1 sd=$2 prog=$3 budget=$4
mkdir -p "$sd"
lock="$sd/lock"
if ! mkdir "$lock" 2>/dev/null; then
  if [ -n "$(find "$lock" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rm -rf "$lock"; mkdir "$lock" 2>/dev/null || exit 3; else exit 3; fi
fi
tmp="$sd/tmp.$$"
trap 'rm -rf "$lock" "$tmp".*' EXIT HUP INT TERM
[ -f "$sd/offsets" ] || : > "$sd/offsets"
[ -f "$sd/ledger" ] || : > "$sd/ledger"
find "$proj" -name '*.jsonl' -exec stat -f '%z %N' {} + 2>/dev/null | LC_ALL=C awk -v OFFS="$sd/offsets" -v BUDGET="$budget" '
BEGIN { while ((getline l < OFFS) > 0) { i = index(l, "\t"); o[substr(l, 1, i - 1)] = substr(l, i + 1) + 0 } }
{ sz = $1 + 0; p = $0; sub(/^[0-9]+ /, "", p); off = (p in o) ? o[p] : 0; if (off > sz) off = 0
  if (sz > off) { if (got >= BUDGET) { more = 1; next } print sz "\t" off "\t" p; got += sz - off } }
END { if (more) print "more" > "/dev/stderr" }' > "$tmp.todo" 2> "$tmp.more"
if [ -s "$tmp.todo" ]; then
  tab=$(printf '\t')
  while IFS="$tab" read -r sz off p; do
    c=0; [ -z "$(tail -c 1 "$p")" ] && c=1
    [ "$c" -eq 1 ] || printf '\n'
    printf '@@F\t%s\t%s\t%s\n' "$p" "$off" "$c"
    { [ "$off" -gt 0 ] && dd bs=1 skip="$off" count=0 2>/dev/null; head -c $((sz - off)); } < "$p"
  done < "$tmp.todo" | LC_ALL=C awk -v LED="$sd/ledger" -v OFFS="$sd/offsets" -v NEW="$tmp.new" -v OFFNEW="$tmp.off" "$prog" || exit 1
  mv "$tmp.new" "$sd/ledger" && mv "$tmp.off" "$sd/offsets"
fi
[ -s "$tmp.more" ] && echo more
exit 0`

// stdin: for each file "@@F TAB path TAB offset TAB complete" and then its bytes from that offset.
// A last line with no newline yet (complete 0) is left for the next run: the offset stops before it.
export const MODELS_AWK = String.raw`function num(s, k) { if (match(s, "\"" k "\":[0-9]+")) return substr(s, RSTART + length(k) + 3, RLENGTH - length(k) - 3) + 0; return 0 }
function sess(p,   b) {
  if (match(p, /[^\/]+\/subagents\//)) return substr(p, RSTART, RLENGTH - 11)
  b = p; sub(/^.*\//, "", b); sub(/\.jsonl$/, "", b); return b
}
function proc(line,   pre, s, ts, id, m, u, i, o, r, w) {
  pre = substr(line, 1, 800)
  if (!index(pre, "\"role\":\"assistant\"")) return
  if (!match(pre, /"id":"msg_[A-Za-z0-9]+"/)) return
  id = substr(pre, RSTART + 6, RLENGTH - 7)
  if (!match(pre, /"model":"[^"]+"/)) return
  m = substr(pre, RSTART + 9, RLENGTH - 10)
  if (m == "<synthetic>") return
  s = line; ts = ""
  while (match(s, /"timestamp":"[^"]*"/)) { ts = substr(s, RSTART + 13, RLENGTH - 14); s = substr(s, RSTART + RLENGTH) }
  if (ts == "") return
  u = line
  while (match(u, /"usage":\{/)) u = substr(u, RSTART + RLENGTH)
  i = num(u, "input_tokens"); o = num(u, "output_tokens"); r = num(u, "cache_read_input_tokens"); w = num(u, "cache_creation_input_tokens")
  if (i + o + r + w == 0) return
  # The last line of an id wins (rule 1 above): streaming repeats a message with a growing output count.
  if (!(id in lh)) ls[id] = sess(path) SUBSEP (path ~ /\/subagents\// ? "sub" : "main")
  lh[id] = substr(ts, 1, 13); lm[id] = m; li[id] = i; lo[id] = o; lr[id] = r; lw[id] = w
}
function endfile() { if (have && cmpl) { proc(prev); used += length(prev) + 1 } have = 0; if (path != "") off[path] = base + used }
BEGIN {
  while ((getline rec < LED) > 0) { split(rec, f, " "); id = f[1]; lh[id] = f[2]; lm[id] = f[3]; ls[id] = f[4] SUBSEP f[5]; li[id] = f[6]; lo[id] = f[7]; lr[id] = f[8]; lw[id] = f[9] }
  close(LED)
  while ((getline rec < OFFS) > 0) { j = index(rec, "\t"); off[substr(rec, 1, j - 1)] = substr(rec, j + 1) + 0 }
  close(OFFS)
}
{
  if (substr($0, 1, 3) == "@@F") { endfile(); split($0, h, "\t"); path = h[2]; base = h[3] + 0; cmpl = h[4] + 0; used = 0; next }
  if (have) { proc(prev); used += length(prev) + 1 }
  prev = $0; have = 1
}
END {
  endfile()
  for (id in lh) { split(ls[id], a, SUBSEP); print id, lh[id], lm[id], a[1], a[2], li[id], lo[id], lr[id], lw[id] > NEW }
  for (p in off) print p "\t" off[p] > OFFNEW
  close(NEW); close(OFFNEW)
}`

// Reads the ledger once: sums per period, source and model, with distinct sessions. -v D, W, M are the hour
// (YYYY-MM-DDTHH, UTC) each window starts at. Output is a few hundred lines at most. Model * is the total of all
// models: its sessions are distinct across them, which the per-model counts cannot be added to give.
export const MODELS_QUERY_AWK = String.raw`BEGIN { cut["day"] = D; cut["week"] = W; cut["month"] = M; cut["all"] = "" }
function add(p, src, m, s,   k, q) {
  k = p SUBSEP src SUBSEP m
  I[k] += $6; O[k] += $7; R[k] += $8; Wr[k] += $9
  q = k SUBSEP s
  if (!(q in S)) { S[q] = 1; C[k]++ }
}
{
  for (p in cut) if (p == "all" || $2 >= cut[p]) { add(p, "all", $3, $4); add(p, $5, $3, $4); add(p, "all", "*", $4); add(p, $5, "*", $4) }
}
END { for (k in I) { split(k, a, SUBSEP); print "S", a[1], a[2], a[3], I[k], O[k], R[k], Wr[k], C[k] } }`

// This session's own sums per model, all time (-v SID the session id), for main transcripts alone and for everything
// with its subagents: the parity check's input. It is not known whether the engine's cost counts subagents, so both are priced.
export const MODELS_SESSION_AWK = String.raw`$4 == SID { k = $3; A[k] += $6; B[k] += $7; C[k] += $8; D[k] += $9; if ($5 == "main") { a[k] += $6; b[k] += $7; c[k] += $8; d[k] += $9 } }
END { for (k in A) { print "S all all " k, A[k], B[k], C[k], D[k], 1; if (k in a) print "S all main " k, a[k], b[k], c[k], d[k], 1 } }`

export const PERIODS = ['day', 'week', 'month', 'all'] as const
export const SOURCES = ['all', 'main', 'sub'] as const
const SPAN_MS = { day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 }

// The hour a window starts at: the hour holding now minus the span, so a window's edge is off by up to an hour.
export const hourOf = (ms: number) => new Date(ms).toISOString().slice(0, 13)
export const windowStarts = (now: number) => ({ D: hourOf(now - SPAN_MS.day), W: hourOf(now - SPAN_MS.week), M: hourOf(now - SPAN_MS.month) })

export function parseQuery(stdout: string): ModelRow[] {
  const rows: ModelRow[] = []
  for (const line of stdout.split('\n')) {
    const [tag, period, source, model, i, o, r, w, n] = line.trim().split(' ')
    if (tag !== 'S' || period === undefined || source === undefined || model === undefined) continue
    if (!(PERIODS as readonly string[]).includes(period) || !(SOURCES as readonly string[]).includes(source)) continue
    rows.push({ period: period as ModelRow['period'], source: source as ModelRow['source'], model, input: Number(i) || 0, output: Number(o) || 0, cacheRead: Number(r) || 0, cacheWrite: Number(w) || 0, sessions: Number(n) || 0 })
  }
  return rows
}
