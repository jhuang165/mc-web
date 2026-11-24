# console99 (batch 99) track note

Scope: `/netstat` accounting of a tracked mob's S1C / S20 / S0F / S04 packets, then the empty textures property. Claims are marked Executed, Bytecode-read or Port-read. No browser checks were run. No source file under `src/` changed: items 1 and 2 were already native (b89 mobpackets89, b90 console90, b92 console92); this track adds the executed evidence and a regression test.

## Summary (file by file)
- `tools/probes/Console99Probe.java`, `tools/verify-console99.mjs`, `public/research/console99-reference.json`: new probe on the real classes (zombie, horse, villager, wolf). Probe dir copy: `tools/research/console99-probe/`.
- `src/console99-b99.test.js`: 9 tests; each of the four mobs is driven through the dedicated server's tracker (a viewer, a mob entering the tracked set) and the rows go through `writePackets`.

## Evidence
- Executed (Console99Probe): S0F / whole S1C / whole watched S20: Zombie 54 / 35 / 69, EntityHorse 72 / 53 / 98 (jumpStrength is a third watched row), Villager 58 / 39 / 69, Wolf 66 / 47 / 69. Dirty set the constructor leaves (S20 of the first gated pass): Zombie and Villager movementSpeed only (41), Wolf maxHealth and movementSpeed (69), plain-constructed Horse the same two (69); after onSpawnWithEgg a horse's set is all three (98 without modifiers). Speed I: movementSpeed with one modifier, 66 (41 + 25), then the cleared set sends nothing. S1C of one changed entry: health (6, float) 11; age (12) int 11 for horse / villager / wolf, byte 8 for the zombie; an unchanged write marks nothing. S04 of an iron sword 14.
- Bytecode-read (`my.b(mw)`, EntityTrackerEntry.tryStartWachingThis): order is spawn, S1C whole (skipped only when the watcher is blank; never for a living entity), S20 of `tq.c()`, S12 only when the spawn is not an S0F, S1B vehicle, S1B leash, S04 for slots 0 to 4 that hold a stack, S0A (players), S1D per effect. `my.b()` sends S1C of the changed entries and S20 of the dirty set inside the gated branch (`ticks % freq == 0 || isAirBorne || hasChanges`), so a watcher change goes out on its own tick.
- Port-read, item 1: `watchSweep` (b92) counts a mob's changed-watcher S1C every tick, whether or not a position packet goes out; `SharedMobTracker.sendAttributes` (b89) counts the dirty S20 on the gated pass (first pass: `firstDirty`); both end up under S1C / S20 in `mobRecords`. Item 2: `startPackets` emits spawn, meta, attributes, then the rest, then equipment, then effects, which is the native order; sizes match the executed rows above. Both items: already native.
- Item 3 (empty textures property for a default-skin player): NOT provable offline and left open. A native offline-mode server builds the profile from the name with no properties (property count 0, which `profilePropertyBytes` already counts); whether Mojang's session server returns a signed `textures` property whose JSON has an empty `textures` object for an account with no custom skin is behaviour of a live service, with no jar or local class to execute. Counting it would be a guess.

## Verification
- `node --test --test-concurrency=2 src/console99-b99.test.js`: 9 pass, 0 fail. There is no code fix, so the fails-without-the-fix check does not apply (it would only fail if the counter or tracker regressed).
- `MC_RESEARCH=tools/research node tools/verify-console99.mjs`: 4 mob records.
- `npm run build` not run (no import changed).

## Found wrong in the batch 98 list
- Nothing: the b98 follow-up on mob counts was a request to check, and the check found the counts native.

## Follow-ups
- A horse built by `mobs.create` without a spawn path already carries rolled jump, so the port sends the three-row dirty set a native egg-spawned horse sends; a native horse made only by its constructor would send two (not a case the port reaches).
- Item 3 stays open (needs a captured real session-server response).
- Browser-only: nothing visible changes.
