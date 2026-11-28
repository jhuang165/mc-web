# spcopy102 (batch 102): dead-player audit under the ticking death screen, stats/achievements loading window

## Summary
Does not claim full parity.
- `src/survival.js` tick: drowning only while alive (`underwater && health > 0`); a corpse refills air to 300 and sets no `drowned` bubbles (EntityLivingBase.onEntityUpdate gates drowning on isEntityAlive).
- `src/redstone-runtime.js` + `src/main.js` (one token, line ~1834, code-read only): the player the pressure plates/tripwires see is `alive || listed`; `listed` = `mobs.ai.player.inWorld` (a health-0 player stays in loadedEntityList until deathTime 20, as the b91 mob collisions already model). Before: the dead player stopped triggering plates at once.
- `src/screen-pause.js`: `STATS_SCREENS`, `StatsLoad(50 ms)`, `gamePaused({statsLoading})`. main.js (code-read only, 3 tokens): import, `statsLoad`, `statsLoading:` in `running()`. Stats and achievements keep the world running for one tick (50 ms) after they show, then pause.
- `src/spcopy102-b102.test.js` (3 tests).

## Item 1 audit (already native, evidence)
- Mob targeting / attacks: `ai.js` PlayerView `alive` (health), `closestVulnerablePlayer` returns null when dead, attack/target tasks test `alive`/`heldAlive`; `inWorld` keeps collisions for 20 dead ticks, `lookGone` after deathTime 20 (b90/b91, Executed probes cited there). Port-read now.
- Damage: `survival.damage` refuses at health 0 (line ~822, 851); heal/regen/food heal gated on health > 0; starvation damage refused. Port-read.
- Items, arrows, orbs: `entity-simulation.js` collectItems/collectArrows/collectItemsAndArrows and `living-simulation.js` orb collect are all `health > 0`. Port-read (native EntityPlayer.onLivingUpdate collides only when health > 0, b101 note).
- Eating/use: `die()` clears `eating`; use-hold skipped while dead (b101). Dead rider: b97 startDeathRide/tickDeathRide.
- Mining: tickMining is `playing`-gated, `die()` clears `mining`.
- Found divergent and fixed: drowning/bubbles and plate triggering above. Bytecode of BlockBasePressurePlate was not re-read: Port-read, based on the b91 entity-list model.
- Food exhaustion/starvation counters still tick on a corpse; natively FoodStats.onUpdate also runs, damage is refused: same.

## Item 2
Bytecode-read in b101 (bei/bej `!loading`). Modelled as one tick wall time; the real window depends on the integrated server thread (1-2 ticks, not executed). Only reachable from the game menu in the port.

## Item 3 (Teleporter terrain on the worker): not done
Same verdict as b99-b101: needs a worker round trip inside the async step machine; not small.

## Verification
- `node --test --test-concurrency=2 src/spcopy102-b102.test.js src/spcopy101-b101.test.js src/spcopy100-b100.test.js`: 12 tests, all pass. With `survival.js` reverted the drowning test fails (2 pass, 1 fail).
- Related files importing survival/redstone-runtime/screen-pause: see lead reply for counts. No build (no new node: imports), no full npm test, no browser.

## Follow-ups
- Browser-only: stats/achievements one-tick run, plates under a corpse.
- Re-read BlockBasePressurePlate getEntitiesWithinAABB class for the corpse claim; Teleporter worker read.
