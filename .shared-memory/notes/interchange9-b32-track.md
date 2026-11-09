# interchange9 (batch 32): foreign tick due-time run, tickUpdates cap probe, tick priority, horse chest damage

## Summary
- Native probe: `TileTicksProbe` now also runs the unchanged `WorldServer.tickUpdates` (`mt.a(boolean)`) once on a real TreeSet/HashSet (6 `tick` scenarios; the 24 earlier scenarios are byte-identical in `tile-ticks-reference.json`, now 30). All entries sit at y 300 so the unchanged `checkChunksExist` fails before any chunk read; every taken entry is removed without ticking and what is left shows the cap and order. Result: min(size, 1000) entries leave the tree per call in time, priority, creation order; the loop stops at the first entry not due; `tickUpdates(true)` ignores the times. Replayed by `tickUpdatesTake` (`src/tile-ticks.js`). Block ticking stays bytecode-read.
- Cap in the port: fluids, fire and redstone already capped at 1000 per tick; falling blocks now too (`falling.js` MAX_TICKS). Not modelled: the cap is shared natively (one TreeSet) but the port keeps separate lists, each with its own 1000. No existing replay changed.
- `ForeignTicks` (`src/tile-ticks.js`, hooked in `main.js` beside `falling.tick()`): foreign entries come due after `t` live ticks (air on the first), at most 1000 per tick in tree order; a taken entry whose cell is in the world and still holds the entry's block, with a port-ticked kind (fluid, fire, falling, redstone), is scheduled at delay 0 in that live list; every other taken entry is removed. Honest limit: the importer only keeps as foreign what the port cannot tick, so no real import produces an entry that takes the run path today; the visible effect is that due entries leave the record while playing (export already aged them away). The run path is unit-tested with synthetic envelopes. `foreignTicks` export behaviour is unchanged.
- Priority: `p` of fluid, fire and falling ticks is stored (envelope entry `p`, only when not 0, so records of a vanilla world are byte-identical), the live lists order by time, priority, creation and `saveTicks`/`readTicks` carry it, `tileTickRows` writes it. Away-world uses the same `save()`/`load()` envelopes; `p` is an optional extra key, so the format stays compatible.
- Horse chests: a registered item whose saved `Damage` the port has no variant for (stone 5, wool above 15, ...) now loads as the item at damage 0 with `rawDamage`, and `region-export.js` writes `rawDamage` back. Unregistered ids still clear the slot (native).
- Ticks beyond the low border: native would keep them, but only in the chunk that owns them; that chunk is not in an area import nor in the output save, so nothing we write can hold them. Left dropped; `report.ticks.outsideArea` counts them. `public/research/region-import.md` has a Batch 32 paragraph.

## Verification
- `npm test`: 4877 tests, 0 fail (4838 at batch 31 end plus this track's and earlier-merged ones; new here: tile-ticks 4, falling 1, horse-items-nbt 1). `npm run build` passes.
- `node tools/verify-tile-ticks.mjs` (MC_RESEARCH set): 30 scenarios, the first 24 unchanged.
- Browser (muted headless Chrome, `?silent`, port 5344): new world loads and runs 8 s with no page errors (one 404 console line for a resource, not investigated). The foreign path was not exercised in the browser; no save with foreign ticks was loaded live.

## Follow-ups (proposed gap lines)
- The 1000-per-tick cap is per port list, not shared across fluid, fire, falling and redstone as one TreeSet is natively.
- A live foreign entry can only run if the importer routes a ticked block as foreign (none known); a backlog above 1000 due foreign entries is taken 1000 per tick but ageForeignTicks on export still drops all due ones.
- Ticks beyond the low border of an area import are dropped (their owning chunk is not imported; native would keep them there).
- Order between kinds at equal time and priority is per list, not one tree.
- Horse chest stacks with an unmapped `Damage` show as damage 0 in game (the saved value is only written back while the stack object is untouched).
