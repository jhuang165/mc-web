# mpobjects99 (batch 99): golem rose status always sent; server villager and End snapshot pinned

## Summary
- **`src/village-ai.js`**: new `setHoldingRose(ew, golem, on)` (EntityIronGolem.setHoldingRose, `wt.a(boolean)`): sets `holdRose` 400 or 0 and calls `ew.golemRoseSet?.(golem)`. Used by LookAtVillager start and reset and by FollowGolem's take. Single player is unchanged (no hook).
- **`src/multiplayer/server-golems.js`**: `mobs.golemRoseSet` marks the golem; `golemTailTick` sends state 11 for a marked golem as well as for a counter that is not the previous value minus one. Before, an offer that ended with the counter already 0 (the 400 ticks ran out, then the reset) or a take at holdRose 1 sent nothing, but native `wt.a(false)` always sends 11, and the client copy then raises its arm for another 400 ticks.
- **`src/mpobjects99-b99.test.js`** (4 tests).

## Evidence
- Item 1, Port-read: the server runs the same `EntityWorld` / `villager.js` / `village-ai.js`: `server-trade.js` calls `villagerInteract`, `ServerMobs.target` hands the customer's `PlayerView` (eyeHeight 1.62) to the AI, `spawnVillagerChild` is the one used by `giveBirth` and the spawn egg. No server copy exists; pinned by two tests (look timer 1..79 on the connected player's view; child bonus modifier, yaw 0, age -24000). Already native, no code change.
- Item 2, Port-read: the End lane is the same `snapshotFor` with `n.world` and `n.redstone` of the End; new test checks `columnsFor` receives the End world and the lit set is the End's. Already native; passes without any fix.
- Item 3, Bytecode-read (`javap` on `vj` FollowGolem, `ux` LookAtVillager, `wt` golem, `ahb.a(Class,azt,sa)`): FollowGolem (first golem within 6/2/6 with holdRoseTick > 0, nextInt(320) on the villager's rand, move at 0.5 when the counter equals the delay, take at distance squared < 4) and LookAtVillager (daylight, nextInt(8000), nearest villager, ties to the later one via `dcmpl`/`ifle`) match the port. `wt.a(boolean)` sends state 11 on every call: the divergence fixed above. Iron golem tracker, snowball S0E 61 and rows were executed in b92/b93; not redone.

## Verification
- `node --test --test-concurrency=2 src/mpobjects99-b99.test.js`: 4 pass; with the two source files reverted, the rose test fails (3 pass, 1 fail).
- Neighbours (mpgolems-b66, iron-golem, village-ai, village-live, village-fight-b31/35/39, mobrec98, mpvillage-b66, mptrade-b66, mpobjects97/98, mooshroom-golem, the new file): 144 pass, 0 fail. No full suite, no build (no import changes), no browser.

## Found wrong in the batch 98 list
- None. The b98 note's "End snapshot not pinned" is now pinned.

## Follow-ups
- Not executed: the golem rose statuses against a real `EntityTracker` (Bytecode-read only). Browser-only: the arm staying raised for the extra 400 ticks after an offer ends.
