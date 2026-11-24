# b99 lead track (batch 99, release 0.128.0)

Lead branch `batch99-lead` in `../wt99-lead`, cut from 8df1376b7 (0.127.0). Ten tracks on Sonnet in `../wt99-<name>`: horse99, portals99, mpobjects99, credit99, console99, mpperf99, spcopy99, tiles99, entnbt99, mobrec99. Rules: `../artifacts/b99-lead/track-rules.md`.

## Review and merges
- Every track diff was read before `git merge --no-ff`. All ten merged cleanly; git auto-merged `main.js` (horse99 + entnbt99), `server-survival.js` and `simulation.js`.
- Checked in review: `TerrainPeek.searchGet` uses the same column index and edit encoding as `get`; every `readItemTag` caller guards a null tag; `installJukeboxes` already had the `spawnInert` hook; `InertDrops.restore` takes undefined; `--u` is global for the XP bar width; `jsonFloat` reads back through the same path as single player; `flySpeed`/`groundAccel` fall back to the module speeds when `state.abilitySpeeds` is undefined.
- Lead fix 62981072d: `goneHit`'s sound for a removed body carries `dim`, because `deliverSounds` can no longer look the body up in `sim.players`.
- Watch: mobrec99's `WatchClosest` `<=` tie rule touches every watching mob; the full suite (all older village-fight replays) passed with it.

## Verification
- `npm test` once on the merged tree: 10928/10928 (`../artifacts/b99-lead/test.log`). `npm run build` ok. Bridge unittest 5 ok. No browser checks.

## Open
- "Still open from batch 99" in `public/research/remaining-gaps.md`. Biggest items: the server's ghost-disc inert drop, client prediction with default ability speeds, removed-body death throw and XP, tolerant numeric tag widths, golem/witch/bat mob records.
