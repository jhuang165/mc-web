# Batch 57 boatcollide: other entities and the rider's fall on the ridden boat copy

## Summary
- `src/object-tracker.js`: `ObjectClient.clientBlockers()` gives the ridden boat copy's move every other client entity's box: the tracker's own object copies (boats, minecarts, hanging entities, items, orbs, arrows, falling blocks; not itself) and the `hooks.clientTargets` entries that are not object copies (mob copies, dragon parts). The client player is left out. `Boats.tickBoat` already took such a list; the copy had passed `[]`.
- `src/object-tracker.js`: the copy's rider call (`EntityBoat.updateFallState` -> `Entity.fall`) now reaches `hooks.riderFall(distance, seat, world)`; `clientRiderFall` (new export) returns the sounds: `game.player.hurt.fall.small|big` then the block's step sound at volume x 0.5, pitch x 0.75, with the jump boost and the Creative skip. The seat is the previous tick's (where the rider stood).
- `src/main.js` (one import line change, one hook line): `objectTracker.hooks.riderFall` plays those sounds through `sounds.play`. The damage stays the server's (the live boat's `rider.fall` already deals it).
- `tools/probes/BoatCopyProbe.java`: new `ride2` records (25 `bx-*`), `FRider` stand-in. `tools/verify-boatcopy.mjs` writes them to the new `public/research/boat-collide-reference.json`; `boat-copy-reference.json` is unchanged.
- `src/boat-collide-b57.test.js`: replays all 25 records (31 tests).

## Evidence
- Executed (unchanged 1.7.10 `xi` EntityBoat on a remote world stand-in, other `xi`, `xm`, a player stand-in and `xk` in the world list; `sv.b` real fall): a boat, minecart, player or item ahead stops the copy at its box (x 5, 5.26, 5.45, 5.625); a box that only touches or misses (z 2.0, 2.01) does not; a boat or cart crossing in front stops it; a boat beside it, moving and within 0.2 blocks, leaves the copy's run identical to the solo run and the other boat's motion untouched (the neighbour push is server side, so the b56 `!remote` guard was right); landing from 4, 5, 6 and 9 blocks plays the fall sound (small up to 6 blocks fall damage 4, big from 9) and the step sound of the block under the feet (stone, sand, glass -> `step.stone`), 3 blocks and water play nothing, a fall onto a boat plays only the fall sound (air under the feet); `attackEntityFrom` is called once per landing and answers false.
- Bytecode-read: `ahb.a(Entity, AABB)` calls `other.getBoundingBox()` then `mover.getCollisionBox(other)` (the mover's, `aload_1`), and `EntityBoat.getCollisionBox(e)` is `e.boundingBox`, so every entity's box blocks a boat (EntityMinecart's `getCollisionBox` only returns a pushable other's box; it does not decide for a boat mover). `EntityPlayerSP.playSound` (`blk.a(String,F,F)`) calls `World.playSound(x, y - yOffset, z, name, v, p, false)`, which `WorldClient` plays; `EntityClientPlayerMP.attackEntityFrom` (`bjk.a(ro,F)`) is `iconst_0; ireturn`. `EntityPlayer.fall` returns for a flying-capable player (Creative) and adds a stat for distance >= 2.
- The probe world's `a(sa, azt)` is the MinecartProbe stand-in (not the real `ahb` code, which needs chunks); it matches the bytecode above. The fall sound is not heard on the client for copies of other entities (RenderGlobal.playSound is empty), only for the client player, so no other copy plays a sound.
- Recalled, not run: nothing in the code depends on it.

## Verification
- `node --test src/boat-collide-b57.test.js` 31 pass. Boat set (`boat-ride-b56`, `boat-copy-b54`, `boats`, `ride-copy-b51`, `ride-cart-b52`, `object-tracker*`, `vehicle-render-b48`, `vehicle-simulation`): 279 pass. `grep -lE "boats\.js|object-tracker\.js|boat" src/*.test.js | xargs node --test` 875 pass, 0 fail. `node --check src/main.js`, `npm run build` ok. `node tools/verify-boatcopy.mjs` writes 20 + 25 records. Full `npm test` not run (batch rule). Not browser-checked.

## Follow-ups
- Mob copies' boxes come from `clientTargets` (width and height from `mobs.size`); a horse copy or a mob copy in a mount state is not specially treated.
- The other entities are static at the copy's tick; the order of the entity walk (who moves first) is not replayed.
- The fall after a dismount (the client player on foot with the fall distance it had) and the Entity.fall of minecart riders on their copies were not probed. `hooks.riderFall` is bound only for boat copies.
- The rider's box in the world list is left out of the blockers (the executed rider never clamped the boat).
