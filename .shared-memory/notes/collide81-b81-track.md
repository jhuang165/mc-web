# collide81 (batch 81)

## Summary
Fixed the float rounding of mining speed, item collision with fences, and the batch 80 swing leftovers for snow and slab placement.

Haste and Mining Fatigue (`mining.js` `miningState`, `enchantment-effects.js` `playerMiningState`, `status-effects.js`)
- The effects now scale the speed inside the `EntityPlayer.getBreakSpeed` float sequence: base strength, then Efficiency, then Haste `* (1 + (amp+1)*0.2F)`, then Fatigue `* (1 - (amp+1)*0.2F)`, then water `/5` and air `/5`.
- The progress is `f(f(speed / hardness) / (harvest ? 30 : 100))`. It no longer multiplies the finished progress.
- `StatusEffects.digSpeedMultiplier()` is replaced by `digAmplifiers()` (`{ haste, fatigue }`, -1 when absent). `enchantedMiningState` is removed: `playerMiningState` takes every modifier in a single `miningState` call.
- Hardness 0 no longer short-circuits to Infinity. `0/0` gives NaN, as native does.
  - Fatigue V: `5 * 0.2F` is exactly 1, so the speed is 0, and the progress is NaN on an instant block or 0 elsewhere. The block never breaks.
  - Fatigue VI and up: the speed is negative, so the progress is negative, or -Infinity on hardness 0.
- `server-dig.js` crack stage: Java's `(int)` cast. NaN gives 0, and values are clamped to the int range, so -Infinity gives -2147483648.
- `effects.js` `crack()`: no crack mesh for NaN or negative progress.

Fences (`world.js` `collisionBoxList`)
- A fence now gives the two arm boxes of `BlockFence.addCollisionBoxesToList` (`fenceCollisionBoxes(fenceMask)`, the same boxes the player already used).
- Items, particles, carts and projectiles that use `collisionBoxList` now fall into a fence corner's open quadrant.
- Walls and gates keep one box: they override only `getCollisionBoundingBoxFromPool`. Panes were already split.
- The `blockBoxes` and `moveEntity` structure is unchanged (mpperf81 owns it).

Placement entity checks (`block-placement-simulation.js`, new `src/placement-entities.js`)
- New hook `entities(box)` = `World.checkNoEntityCollision`. It is true for any entity that is not dead and has `preventEntitySpawning`:
  - living mobs, including a dying one until deathTime 20, plus bats, the dragon and the crystal;
  - minecarts and boats (`bb`);
  - falling blocks (a 0.98 box);
  - primed TNT.
- Items, orbs, arrows, thrown items and hanging entities never block.
- The test box is the union of the placed cell's `collisionBoxes`, in world coordinates. It runs for:
  - snow stacking, with the current layer box: a blocked stack falls through to ItemBlock, as for the player;
  - slab placement and merges;
  - the general ItemBlock path.
- The new refusal reason is `entity-collision`. A slab merge refused this way still swings: `clientUseResult`'s `slabMerges` row answers true first, as with `player-collision`.
- Wiring: `main.js` builds `placementEntityBlocker` over mobs, minecarts, boats, falling and primed, and passes `placement: { entities }` into the dispatch hooks. `multiplayer/simulation.js` passes the server's mobs, vehicles, falling and dispense.primed. Without the hook nothing is tested (old callers and stub worlds).

Slab merge side shift
- `ItemSlab.func_150946_a` always reads the cell offset by the clicked side. The plan now reads `target.adjacent` and the real clicked side, even when the clicked block is a one-layer snow or a vine.
- So a side click on a snow layer or vine beside a same-type slab merges that slab. The clicked snow or vine stays.
- With no merge, the ItemBlock fall-through needs a replaceable cell `p` (otherwise `occupied`) and plans a fresh half on side 1 for a replaced snow layer.

## Evidence
- Executed: new `tools/probes/MiningEffectsProbe.java`, run with `node tools/verify-mining-effects.mjs`, on DigFinishProbe's EntityPlayerMP double. It writes `public/research/mining-effects-reference.json`, 9,675 rows:
  - 15 blocks x 9 tools x Efficiency 0 or 3;
  - 5 environments: dry ground, wet ground, wet with Aqua Affinity, dry airborne, wet airborne;
  - Haste and Fatigue pairs, including amplifiers 4, 5, 9, 127 and 255.
  - Each row has `p.a(block, p.a(block))` (speed) and `block.a(p, world, x, y, z)` (progress), using real PotionEffect objects in `sv.f`.
  - The old port missed 3,188 rows. The new port matches every row's progress, and the speed wherever the port's hardness is finite.
- Bytecode-read (`javap -c -p` on minecraft-1.7.10.jar):
  - `yz.a(aji, boolean)` (getBreakSpeed order);
  - `aji.a(yz, ahb, III)` (relative hardness);
  - `akz` addCollisionBoxesToList (fence arms);
  - `aoi`/`ala` (only `getCollisionBoundingBoxFromPool`);
  - `aoa` addCollisionBoxesToList;
  - `ahb.a(azt, sa)` (checkNoEntityCollision: `!K && k && != exclude`);
  - every `putfield sa.k` site: `sv`, `wz`, `xi`, `xj`, `xl`, `xw`;
  - `aeg.a` and the private `func_150946_a` (offset cell from the clicked cell);
  - `aec.a` (snow).
- Port-read:
  - the `entity-collision` swing (the `clientUseResult` order in `player-edit-simulation.js`);
  - the dying-mob rule through `pushable` (`entities.js`);
  - falling-block and TNT box sizes from `falling.js` and `explosion.js`.

## Verification
- `node --test src/collide81-b81.test.js`: 6 tests, 6 pass.
  - Mining reference replay of more than 8,000 mapped rows, and the Fatigue V/VI NaN and -Infinity cases with server cracks `[0, -2147483648]`.
  - Fence corner: an item lands in the open quadrant, an item over the post rests at 11.5, a wall gives one box, and a closed gate gives `[1.5]`.
  - Mob and cart refusals; dead, touching, dying and bat cases.
  - Snow layer box inside versus on top.
  - Slab merge beside a one-layer snow and a vine, plus the plain fall-through.
- Without the fixes, the mining replay fails on 3,188 of 9,675 rows and the fence test fails 1 of 3.
- Targeted neighbours at `--test-concurrency=2`:
  - First set, 46 files (mining, enchantment, dig, placement, swing, fence, item, collision, snow, status-effect, projectile and block-click tests): 444 tests, 443 pass. The failure: `block-placement-simulation.test.js` used a stub world without `solid()`. Fixed: the entity check now runs only when a hook is given. Rerun with collide81: 13 of 13 pass.
  - Second set, 26 files (main.js source-match, projectile and fx tests): 316 tests, 315 pass. The failure: `player-throw-replay.test.js` compiles main.js's `edit` and lacked a `placementEntities` binding. A `null` binding was added (test-only, no gap encoded). Rerun: 2 of 2 pass.
  - `block-actions-replay` and `player-actions`: 8 of 8 pass.
- `npm run build`: ok. No full npm test. No browser checks.

## Follow-ups
- Browser-only:
  - no crack overlay and no break at Fatigue V and above;
  - items settling into a fence corner on screen;
  - placement refused next to a mob or cart, with the slab merge swing;
  - the HUD mining meter (`aria` text may read NaN at Fatigue V; not checked).
- The multiplayer client prediction (`dryPlace` in `right-click-swing.js`) does not test entities. The server refuses and the client corrects.
- The native client crack stage `(int)(d * 10) - 1` at progress 0, and the NaN or negative stages in the single-player meter, were not probed.
- Entity boxes for the check come from the port's mob sizes and cart `bb`. Rider and riding offsets were not compared with native.
