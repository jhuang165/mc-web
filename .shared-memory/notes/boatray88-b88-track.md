# boatray88 (batch 88): the server's ItemBoat ray, dead players in the boat check, crystal boxes, client boat copies

## Summary
- **The server's boat ray** (`src/multiplayer/server-vehicles.js` useHeld) now uses `boatRay` (moved to `src/boats.js`; `src/client-item-use.js` re-exports it). That is abj.a's own ray: MathHelper's sin / cos tables (`fishing-line.js` mhSin / mhCos) of the float rotation, f(180 - yaw·180/π) and f(-pitch·180/π) as the C05 / C06 carry them. Before, it used Math.sin / Math.cos in double.
  - The eye is posY + 1.62 - yOffset. `boatRay` takes yOffset as a new parameter: 1.62 on the client (EntityPlayer), 0 on the server (EntityPlayerMP).
  - The server passes the player's ySize, so the eye starts from posY (box bottom - ySize), not the box bottom.
- **A dead player** is listed in the server's boat check (`boatEntities`) through deathTime 20 and dropped from deathTime 21 (`playerListed`, `src/boat-place-entities.js`). Before, every other player was listed with no death test.
  - `src/multiplayer/server-survival.js` now counts `p.deathTime`: 0 at die(), +1 in tickDeath. Each is one new line.
- **Client falling-block copies:** not done (not cheap). See Follow-ups.
- **EntityEnderCrystal's box** is now [x-1, posY-1, z-1, x+1, posY+1, z+1]. `crystalBox` is defined once in `src/ender-crystal.js` (no imports), and `boat-place-entities.js` re-exports it. It is applied at:
  - `dragon-mobs.js` boxOf (the crystals query and `living`);
  - `placement-entities.js` (checkNoEntityCollision for block placement);
  - `entities.js`: the spawn checks' `sized`, `entityHit` (the crosshair ray) and the zombie reinforcement fit;
  - `projectiles.js` mobTargets (a crystal branch ahead of the mpperf fast paths);
  - `weather-simulation.js` strikeMobs (the lightning box);
  - `piston-live.js` (the moving block's entity list);
  - `main.js`: the single-player clientTargets, multiplayer mpCopyTargets and the falling-block hurt.
- **Crystal rules besides the box** (bytecode-read):
  - **Vehicles.** Carts no longer stop at crystals. Boats do, with the crystal box. Vehicles never push crystals.
    - This applies in `structure-simulation.js` (cartBlockers, the push loop), `piston-push.js` (crystals only in the boat-only blocker part) and `server-vehicles.js` (boxesOfMobs, the cart blockers, the push loop).
    - Native rule: EntityMinecart.getCollisionBox needs canBePushed, which wz doesn't override (false). EntityBoat.getCollisionBox returns any box. A crystal isn't living, so it has no collideWithNearbyEntities.
  - **Witch splash potions** skip crystals (`witch-potions.js`), because EntityPotion lists EntityLivingBase only.
  - **Pressure plates and tripwire** (`redstone-runtime.js`): crystals count only for the "all" plates and tripwire, with the crystal box. They never count for mob plates, and never as colliders, since a crystal never moves.
- **The client player on a floating boat** (lead request from spcopy88): the single-player client player now collides with its client world's boat copies, i.e. the copies the object tracker last moved (`objectTracker.vehicleTargets()`). Before, it collided with the live boats. Every other mover keeps the live boxes.
  - Code: `clientBoatBoxProvider` (`src/entity-collision.js`), the main.js setEntityBoxes line, and `clientPlayer: true` on movePlayer's body (`src/player-physics.js`, one new line).
  - In spcopy88's harness, the server copy's corrections drop from 167 to 5 in 200 ticks.
  - The remaining 5 are not a port bug as far as I can tell. The executed client EntityBoat (batch 47) coasts on its last S12 motion between the tracker's 60-tick moves, so the copy sat up to about 0.2 below the live boat here.
  - spcopy88's "still client boat" leaves that coast out. Native client and server have not been run together to confirm the count.
- New `tools/probes/BoatRayProbe.java` (extends BoatEntityProbe) and `tools/verify-boat-ray.mjs` → `public/research/boat-ray-reference.json` (116 records).
- No old test encoded a gap fixed here. None needed changes.

## Evidence
- **Executed:** BoatRayProbe runs the unchanged native ItemBoat.onItemRightClick on the BoatProbe map world. The player is a Rider with yOffset 0, as EntityPlayerMP. Each record holds rotation, posY, ySize, box bottom, trace start, item count and boat.
  - Four scenes, each stepped one float at a time (Math.nextUp) through a window where the hit changes:
    - x-edge: two water cells across x = 3, pitch 79.194954 / 79.19496;
    - z-edge: across z = 5, yaw -58.364872 / -58.36487;
    - miss-edge: the near edge of one cell, pitch 60.205082 miss / 60.205086 hit;
    - ysize-edge: as x-edge with ySize 0.3.
  - Each scene also has 25 coarse samples.
  - All 116 records match `boatRay(…, 0)` + `Boats.place`: count, boat and trace start (to 1e-9).
  - The old double ray gives another cell, or a miss, in each of the four windows.
  - With ySize 0.3, the box bottom is posY + 0.3 and the trace start is unchanged, so the ray starts at posY + 1.62.
- **Bytecode-read (javap -c -p, 1.7.10 jar):**
  - abj.a: the ray. qh.a / qh.b: the sin / cos tables.
  - mw.<init> and mw.e_ store 0.0F in L (yOffset).
  - sv.aF: ++aA (deathTime), B() (setDead) at 20. yz and mw don't override it. It is reached through mw.i() from nh.a(jd) processPlayer.
  - apx.a(sa, azt, List, sj) has no isDead test.
  - ahb.h's removal section: K → chunk removeEntity, list remove, onEntityRemoved. It runs in the next tick's world pass, ahead of that tick's packets. So a C08 in the tick setDead runs still sees the player, and the next tick's C08 doesn't.
  - bjb.a(fw), type 70: `new xj(world, x, y, z, aji.e(data & 65535), data >> 16)`, added through bjf.a(int, sa), so native clients do have falling-block copies from S0E until S13. xj.R() = !isDead, so they are collidable.
  - wz.<init>: setSize(2.0F, 2.0F), L = N / 2 = 1.0. setPosition: minY = posY - L + V. sa.b(DDDFF) setLocationAndAngles: posY = y + L, which matches the port's end-generator posY y + height + 1 (asl).
  - wz overrides g_, c, h, b(dh), a(dh), Y, R and a(ro, float), but not S (canBePushed), J (getBoundingBox), az (doesEntityNotTriggerPressurePlate) or a(xh) (onStruckByLightning).
  - xi.h(sa) = sa.C. xl.h(sa) = sa.S() ? sa.C : null.
  - zo onImpact lists sv.class.
  - amu.e: amv.a uses ahb.b(null, box), amv.b uses sv.class, amv.c uses yz.class. Each excludes sa.az().
  - aol lists sa.class. aof uses ahb.b(null, box) with sa.az.
  - xh.h: ahb.b(this, (x-3, y-3, z-3, x+3, y+6+3, z+3)) → sa.a(xh).
- **Port-read:**
  - The port's crystal `y` is posY in mobs, remote copies and the end generator.
  - The server's posY = position.y - motion.ySize, as in server-player-tracker.
  - The single-player object tracker's boat copies were executed against EntityTrackerEntry and the client EntityBoat in batch 47 (object-tracker-vehicles.test.js).
  - The multiplayer client's boat collision is unchanged (it never had the live boats).

## Verification
- `node --test --test-timeout=600000 src/boatray88-b88.test.js`: 9 pass, 0 fail.
  - The executed ray replay and its mutation check.
  - Server useHeld on both sides of each window.
  - The dead player at deathTime 20 and 21, through ServerSurvival die / tickDeath.
  - The crystal box at placement, dragon query, entityHit, mobTargets and lightning; the server's vehicles; source pins.
  - The client-copy provider, and the boat-standing run (live 167, copies 5).
- Neighbours: every test that imports one of the edited modules, or source-matches an edited line (174 files, including skins73-b73), run with `--test-concurrency=2`: 2375 / 2375 pass. After a final import move in boat-place-entities.js, boatray88-b88, boatcheck87-b87 and predict86-b86 were rerun: 145 / 145 pass.
- `npm run build`: built (only the usual chunk-size warning).
- The full `npm test` was not run, per the track rules.
- Browser-only (not checked; no browser checks per the track rules):
  - a multiplayer boat placed at a grazing angle landing where the client predicted;
  - a crystal's hover outline and arrow hits at its lower half;
  - standing on a floating boat in single player without rubber-banding;
  - lightning and anvils at crystals.

## Follow-ups
- **The multiplayer client's falling blocks.** Native clients get EntityFallingBlock copies from S0E type 70 and keep them until S13, and those copies count in the client's boat check. The port's server sends no falling-block rows at all.
  - Doing this needs new wire rows (tracker ids and allocation order), per-dimension lists, client parsing and stepping, and rendering. That is not cheap, and it touches the tracker (track88 / mpperf88).
  - The only effect on boats is a wrong client-side decrement that the server's S2F corrects. `clientEntityBoxes({ falling })` is ready for it.
- **Crystal sites in other tracks' files:**
  - `fireballs.js` / `mpperf79-fast.js` targets (blast88) still use feet boxes for crystals.
  - `server-mobs.js` gives crystals an eye height of 1.7, but native wz has no getEyeHeight override (Entity's 0).
  - /summon EnderCrystal: setLocationAndAngles adds yOffset 1 to the given y. The port's summon y convention for crystals has not been checked (entnbt88 / console88).
  - A crystal pushed by a piston (`piston-live.js`) moves through its mob moveEntity with the feet box; only the list box is fixed here.
- **Boat copies vs the live boat:** a native pair (client + integrated server) should be run to see how often a player on a floating boat is really corrected. Also, the multiplayer client collides with no boats while walking. Natively it would collide with its EntityBoat copies, i.e. RemoteVehicles.
- The lightning `hazard` call for a crystal (Entity.onStruckByLightning → dealFireDamage(5) → crystal explodes) isn't checked beyond the box. Neither is witch AI targeting.
