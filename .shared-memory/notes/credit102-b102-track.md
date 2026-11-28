# Batch 102 credit102: deflected ball flight, fall messages, TNT placer (all closed native, no code change)

## Summary
- No source change. Added `src/credit102-b102.test.js` (3 tests).
- **Item 1:** a punched large ball, flown through the real `Fireballs.tick` (single player), skips the player for 25 ticks and then hits: 6 damage, "fireball" source whose entity is the player himself. No gap found.
- **Item 2:** closed native. The tracker (`combat-tracker.js`) is replayed by `combat-tracker.test.js` against 400+ executed records of the real `rn`/`rm`/`ro` classes (`public/research/combat-tracker-reference.json`, ladder/vine/water/fall-distance ops included). `rn.a()` site rule re-read: ladder/vines from the cell at (floor x, floor minY, floor z) when `sv.h_`, else water when `sa.M`. Server (`copyFall`) and single player (`landPlayer`) both sample site and `fallDistance` for the fall hit. Native samples them at every hit, the port only on falls; this is unobservable because only fall/outOfWorld entries use them (void entries are unbounded, and the pearl's 5.0 fall hit has fallDistance 0 natively and here).
- **Item 3:** closed native. Placer rules, bytecode-read in `aob` (BlockTNT), `agw.c()` and `xw`: chain TNT takes `explosion.getExplosivePlacedBy` (`aob.a(ahb,III,agw)`: `agw.c()`: null exploder -> null, `xw` -> its placer, living `sv` -> itself); redstone/fire/dispenser/player-destroy (`aob.b`) give null; flint and steel (only `ade.d`, not the fire charge) gives the player; a burning arrow gives `zc.c` when it is an `sv`. Port-read: `explosion-simulation.js` chain (`placer: attacker`), `server-mobs.js` explode placer (ev.source is only null, a living mob or a TNT: checked every `explode:` producer), `bow.js` / `server-dispense.js arrowCtx`, `simulation.js` flint branch, `main.js lightTnt`, `fire.js`/redstone/dispense with no placer.

## Evidence
- Executed: combat-tracker replay (existing). Test 3 executes `applyExplosion` with a chained TNT block: the primed entity's placer is the player, a skeleton, or null.
- Bytecode-read: rn.a(), aob, agw.c(), xw constructors.
- Not executed: no new real-class probe (needs a world).

## Verification
- `node --test --test-concurrency=2 src/credit102-b102.test.js src/credit101-b101.test.js src/combat-tracker.test.js src/blast88-b88.test.js src/fireballs-native.test.js`: see final reply counts. The new tests pass on unchanged code (nothing fixed, so no revert check). No build, no full npm test, no browser.

## Found wrong in the batch 101 list
- Nothing: the "no ball-flight test" follow-up was a test gap, the behaviour is native.

## Follow-ups
- Not enumerated: minecart TNT (exploder is the cart, so null placer natively) was read on the server only (`source: null`).
- Browser-only: nothing checked.
