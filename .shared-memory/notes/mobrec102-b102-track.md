# mobrec102 (batch 102): golem gate on the real EntityWorld, player hurt-window order, Math.random draw

Branch batch102-mobrec102 from main 5b89c24c3 (0.130.0). No new probe: the b101 records (public/research/village-gate-b101-reference.json) are the executed evidence.

## Summary (file by file)
- `src/village-host.js` (fix): `hasSolidTop` is World.doesBlockHaveSolidTopSurface (`solidTopSurface`, doors-panes.js), not `world.solid` (collision solidity). On a real world a door counted as a floor, so the golem spawn box search found `py 2` on top of the door grid and spawned at tick 428 (y 2) where the native record finds no spot until tick 2285.
- `src/survival.js`, `src/entities.js`, `src/main.js` (one line): `Survival.deferCounters` (set by main.js outside multiplayer): the player's protection / hurtTicks / hurtTime countdown (`countDown()`) runs at the player's turn in `EntityWorld.tickMobs` (both the in-loop turn and the after-loop fallback) instead of the start of `Survival.tick`; an unrun walk settles it at the next `tick`. Default off: every older caller and replay is unchanged.
- `src/mobrec102-b102.test.js`: 25 tests (20 real-world golem records, 5 counter tests).

## Evidence
- Executed: the 20 b101 gate records replayed through a real `EntityWorld` + real `World` (real chunks, door blocks with real meta, real stone floor/fills/pillars, real entity sizes, `spawnIronGolem` pushing onto `ew.entities`, the golem in a loaded chunk, health 100, not player-created): spawns, nextInt(7000)==0 ticks, every nextInt(16)/(6) search draw and the 500-tick village digests equal. Real roof blocks (stone at y+8 over x 40..49) feed the real heightmap `canSeeSky`. Exception, a probe artifact: the probe's `World.i` (canBlockSeeTheSky) is a roof rectangle and ignores blocks, so the `fill` records (stone over the doors) keep that hook; with the real heightmap a full stone layer shades every door and no village forms.
- Bytecode-read: `ahb.a(ahl,x,y,z)` = opaque normal cube, upside-down stair (meta&4), top slab (meta&8), hopper, full snow layer; `solidTopSurface` matches (plus the executed redstone block / end portal frame extras). `vz.a(int)` pops the result of `ahb.d(entity)`: numGolems rises even if the chunk refused it; the port's `spawnGolem` does the same.
- Bytecode-read (item 2): `mw.h()` (EntityPlayerMP.onUpdate) holds `--bU` and `--hurtResistantTime` and runs in the world walk at the player's list place; `mw.i()` (onUpdateEntity: super.onUpdate, effects, food) is called only from `nh.a(jd)` (processPlayer, the movement packet), and `MinecraftServer.v()` runs the worlds first and `mn.a()` (network tick) after. So natively per tick: [network: movement, effects/poison/food, fall] then [walk: decrement, mobs, potions after the player]. The probe (decrement before its throwable loop, effects after the mobs) has that order; the b100 harness matches the probe. The live loop used [decrement, effects, walk], so a poison hit of tick n made a mob or potion in the walk see the full window (20) where native sees 19, and a splash on a poison tick was blocked where native lets it hit. Fixed by moving the decrement to the player's turn (above). Potion position after the player is unchanged: the potion hit has always followed the decrement in both.
- Port-read (item 3): the player's attacker-less hit draws `(int)(Math.random()*2)*180` natively (sv.a, unused value). The port's `Survival.damage` draws no Math.random for it (`attackedAtOf(..., Math.random, ...)` is the only draw and it is used for attacked-at yaw). Unseeded and unused, so no live effect; the b101 replay takes `mathRandom` values by tick so the 8/10 fewer draws never mattered. No change; no replay depends on it.
- Item 4: already recorded, nothing invented: cave spider poison by difficulty (b38-cave-spider-night-d1/d2/d3), silverfish (448 records in silverfish-reference.json including call-for-help and block cases), slime/magma (slime-reference.json, magma-pigman-reference.json).

## Verification
- `node --test --test-concurrency=2 src/mobrec102-b102.test.js`: 25 pass.
- Fails without the fix: with village-host.js at HEAD 7 fail (the records whose search reaches a door top: ctrl, vill20-golem1, edge-in, ...); with survival.js and entities.js at HEAD 3 fail (the counter tests).
- Targeted: 46 files (village*, villager*, mobrec100-102, survival*, mpvillage-b66, witch*, zombie-villager*, damage-fx, hurt-drops-b49, enderman-wolf-b4*, mphealth*): 588 tests, 588 pass. No full npm test, no build (no new imports reach `node:`; village-host.js now imports doors-panes.js, already browser-loaded), no browser.

## Found wrong in the batch 101 list
- "The golem gate replays with no divergence": true only on the fake world; the host's `hasSolidTop` was wrong on a real world (above).
- Survival.tick's comment named onUpdateEntity for the decrement; natively it is onUpdate (mw.h), in the walk.

## Follow-ups
- `main.js` line (`survival.deferCounters`) and the live order are code-read only; the multiplayer client keeps the old order (the dedicated server has its own player tick). No executed record exists for a poison tick coinciding with a splash on a real world list (the probe player is outside the list), so the order is bytecode-read.
- Fall damage and other landing hits: whether landPlayer runs before the walk is not re-checked.
- Browser-only: none seen.
