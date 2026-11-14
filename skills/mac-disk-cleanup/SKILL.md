---
name: mac-disk-cleanup
description: "Use when a Mac is low on disk space or the user asks what uses the disk: \"disk space\", \"free up space\", \"storage full\", \"clear caches\", \"what is eating my disk\", \"clean DerivedData / simulators / node_modules\". Not for backups, moving a photo library, or a failing disk."
---

# mac-disk-cleanup

Find what fills a Mac's disk, propose deletes with their rebuild cost, and delete only what the user approves, one item at a time. The gain is what `df` reports, never a sum of `du` numbers.

## When to use

- The disk is full or nearly full, or a build fails with "No space left on device".
- The user asks what uses the disk, or asks to clear developer caches.
- Not for backups, Time Machine setup, moving a photo library, or a disk that reports errors (run Disk Utility First Aid and back up first).

## 1. Survey (read-only)

Run nothing that deletes in this step.

1. Record the free space: `df -h /`. Keep the number for step 5.
2. Find the large stores: `du -sh ~/Library/Developer/* ~/Library/Caches/* ~/.gradle ~/.cache/* 2>/dev/null | sort -h | tail -30`.
3. Measure each tool's store with its own command. [targets.md](targets.md) lists each store: measure command, clean command, dry-run flag and rebuild cost.
4. Find dead projects' build outputs under `<projects-root>`: `node_modules`, `.venv`, Rust `target`, `.next`, .NET `bin`/`obj`. Rank by last activity: `git -C <repo> log -1 --format=%cr`.

`du` overstates on APFS. pnpm (11.x) clones files with copy-on-write, not hardlinks, so `du` counts each clone in full. Per-folder totals can sum past the disk size. Treat `du` as a ranking, not as the gain.

## 2. Report and wait

Show one table, largest first:

| Store | Size (du) | Clean command | Rebuild cost | Risk |
|---|---|---|---|---|

- Every row gets a rebuild cost: "re-downloads on next build", "rebuilds on next device connect", "gone for good".
- Propose an order. Then wait for the user's yes on each row. A yes to one row is not a yes to the others.
- Show a dry run first wherever the tool has one (`brew cleanup -n`, `simctl runtime delete --dry-run`).

## 3. Before each delete

1. **Lock holder.** A cache command that waits on a lock has a holder. Find it with `lsof <lockfile>` (uv: `lsof ~/.cache/uv/.lock`), never with a `ps` name pattern: another app can start the holder. Never pass `--force` to `uv cache clean` or `uv cache prune` while a holder runs: it skips the in-use check.
2. **Running app.** Quit the owner first: Xcode before DerivedData, the browser before its cache (ask the user to quit it), Gradle daemons before Gradle caches (`gradle --stop`, then check `pgrep -fl GradleDaemon`). Stop dev servers and builds before you delete a project's build output.
3. **LaunchAgent with KeepAlive.** launchd restarts a killed KeepAlive process at once. Record the plist path first, then:
   ```bash
   launchctl bootout gui/$(id -u)/<label>
   ```
   Clean. Then restore it:
   ```bash
   launchctl bootstrap gui/$(id -u) <plist-path>
   launchctl print gui/$(id -u)/<label>
   ```
4. **Tool's own command first.** Prefer `cargo clean`, `pnpm store prune`, `brew cleanup`, `simctl runtime delete` over `rm -rf`.
5. **Protected paths.** sudo does not bypass macOS privacy protection (TCC) or App Management. Move such items to the Trash through Finder:
   ```bash
   osascript -e 'tell application "Finder" to delete (POSIX file "<path>" as alias)'
   ```
   A script that deletes guards each path variable with `${VAR:?}`.

## 4. Order for shared blocks

pnpm frees blocks only when every copy is gone. Delete dead projects' `node_modules` first, then run `pnpm store prune`. It removes only packages no project references.

## 5. Verify

1. Run `df -h /` again. Report the change against the number from step 1.
2. `df` did not move: APFS local snapshots hold the deleted blocks. Check `tmutil listlocalsnapshots /` and tell the user.
3. Restart each service you stopped. Check that exactly one instance of each runs (`launchctl print`, `pgrep -fl <name>`).
4. Report each store: deleted, skipped, or blocked, and why.

## Moving data off the disk

Check the target drive first: `diskutil info <volume>`. exFAT drops permissions, symlinks and extended attributes. It suits archives and media, not active git repos. Move the projects with the oldest last commit first.

## Common mistakes

| Mistake | Fix |
|---|---|
| Report the sum of `du` numbers as space freed | Report the `df` change only |
| `pnpm store prune` before deleting dead `node_modules` | Delete the dead projects first, then prune |
| Find a lock holder with `ps aux \| grep uv` | `lsof` on the lock file; another app can own the holder |
| `uv cache clean --force` to skip a wait | Find and stop the holder, or skip uv |
| Kill a process that comes straight back | It is a KeepAlive LaunchAgent: `bootout`, clean, `bootstrap` |
| Delete DerivedData with Xcode open | Quit Xcode first |
| Delete Gradle caches while a daemon runs | `gradle --stop`, then compare with the projects' wrapper versions |
| Delete Xcode Archives as a cache | They hold dSYMs for shipped builds: ask first |
| `simctl runtime delete` with no dry run | `--dry-run` first; keep the runtime for the installed Xcode |
| Delete in `~/Library/Application Support` by size | It holds app data. Only an uninstalled app's leftover goes, after you check `/Applications` |
| Expect Docker or OrbStack to shrink after a file delete | The disk image keeps its size; read `docker system df`, prune only on request |
| `sudo rm` on a protected path | Finder through `osascript` |
| Delete several stores on one yes | One yes per row |
