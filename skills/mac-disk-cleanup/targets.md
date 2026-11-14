# Cleanup targets

Each row: where the store lives, how to measure it, how to clean it, its dry run, and what a delete costs later. Every clean command waits for the user's yes on that row.

| Store | Measure | Clean | Dry run | Rebuild cost |
|---|---|---|---|---|
| Xcode DerivedData | `du -sh ~/Library/Developer/Xcode/DerivedData` | Quit Xcode, then delete the folder's contents | none | Each project rebuilds in full on next build |
| iOS DeviceSupport | `du -sh ~/Library/Developer/Xcode/iOS\ DeviceSupport` | Delete old OS versions | none | Rebuilds on the next device connect |
| Xcode Archives | `du -sh ~/Library/Developer/Xcode/Archives` | Ask first, per archive | none | Gone for good: archives hold dSYMs for shipped builds |
| Simulator runtimes | `xcrun simctl runtime list` | `xcrun simctl runtime delete <id>` (or `--notUsedSinceDays <n>`, `--unusable`, `--outdated`) | `--dry-run` | Re-download from Xcode settings; booted simulators shut down |
| Simulator devices | `xcrun simctl list devices unavailable` | `xcrun simctl delete unavailable` | the list command | None: they belong to removed runtimes |
| Gradle | `du -sh ~/.gradle/caches/*` | `gradle --stop`, then delete per-version folders under `~/.gradle/caches/<version>` | compare with `distributionUrl` in each project's `gradle/wrapper/gradle-wrapper.properties` | Named versions re-download on next build; say which |
| pnpm store | `pnpm store path`, then `du -sh` on it (overstates) | Dead `node_modules` first, then `pnpm store prune` | none | Pruned packages re-download on next install |
| uv cache | `uv cache size`, `uv cache dir` | `uv cache prune`, or `uv cache clean` for all | none | Packages re-download on next sync; never `--force` while `lsof ~/.cache/uv/.lock` shows a holder |
| Homebrew | `brew cleanup -n` | `brew cleanup` (`-s` also scrubs downloads) | `-n` | Old versions and downloads are gone; current formulae stay |
| Docker / OrbStack | `docker system df` | `docker system prune` only on request | `docker system df` | Images re-pull; the disk image does not shrink on file delete |
| Browser cache | `du -sh ~/Library/Caches/<browser>` | The user quits the browser, then clears it in the browser's settings | none | Sites reload assets; skip while the browser runs |
| Project build outputs (`node_modules`, `.venv`, Rust `target`, `.next`, .NET `bin`/`obj`) | `du -sh <dir>`; last activity with `git -C <repo> log -1 --format=%cr` | The tool's own command (`cargo clean`, `dotnet clean`), else delete the folder | none | Rebuilds from the lockfile; check one exists and no dev server or build runs |
| `~/Library/Application Support` | `du -sh ~/Library/Application\ Support/*` | Only a leftover of an uninstalled app, after a check of `/Applications` | none | App data: never delete by size alone |
| APFS local snapshots | `tmutil listlocalsnapshots /` | Tell the user; macOS thins them on its own | none | They hold deleted blocks until they expire |
