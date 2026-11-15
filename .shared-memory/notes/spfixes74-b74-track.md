# Batch 74 spfixes74: single-player gaps (death throw, farmland, bonus torches, anvil targets)

## Summary
- Death throw (closed, single player): `src/death-throw.js` (new) gives `attackedAtOf` / `deathThrow`; `Survival.damage` (`src/survival.js`) stores `attackedAt`; `die()` in `src/main.js` clears the knock queue and sets the player's velocity to the onDeath motion; the dead-screen loop calls `deadBodyTick()` (`movePlayer` with idle input) so the body moves, and the camera follows it. Multiplayer is untouched (the server owns it).
- Farmland (found wrong): no change. Only `EntityLivingBase.updateFallState` calls `onFallenUpon`, so items, orbs and falling blocks never trample.
- Bonus chest torches (stale gap, one fix): orientation already existed in `src/bonus-world.js`; it used `world.solid` (collision), native uses normal cubes. It now calls `torchAddedMeta` (`src/torches.js`), so leaves and glass no longer orient a wall torch.
- Falling anvil targets (closed): `src/falling-hurt.js` (new) hurts items, orbs, boats, carts and hanging entities in the box; hooked from the `hurt` callback of `FallingBlocks` in `src/main.js`.
- Tests: `src/spfixes74-b74.test.js` (5 tests).

## Evidence
- Bytecode-read: `EntityPlayer.onDeath` (yz.a(ro)): motionY 0.10000000149011612; with a source, motionX = -cos((attackedAtYaw + rotationYaw) * PI / 180) * 0.1 and motionZ = -sin(...) * 0.1 (qh.b is cos, qh.a is sin); yOffset 0.1; size 0.2 x 0.2 (server only). `EntityLivingBase.attackEntityFrom` (sv.a(ro,F)): attackedAtYaw = 0 first; a fresh hit sets (float) atan2(dz, dx) deg - rotationYaw for a source entity, else (int)(Math.random() * 2) * 180. Items are dropped before the motion (dropAllItems, already ported).
- Bytecode-read: only `sv.a(DZ)V` (EntityLivingBase.updateFallState) calls `Block.onFallenUpon` (a search over every class in the jar found one call site, offset 212). `BlockFarmland.onFallenUpon`: not remote, nextFloat < fallDistance - 0.5, then a non-player needs mobGriefing. The port already had that rule (`farming.trample`).
- Bytecode-read: `BlockTorch.onBlockAdded` runs for `setBlock(torch, 0, 2)` (Chunk.func_150807_a); it uses `World.isBlockNormalCubeDefault`. `WorldGeneratorBonusChest` (arg) sets torches with metadata 0, flag 2.
- Bytecode-read: `EntityFallingBlock.fall` (xj.b(F)): every entity in `getEntitiesWithinAABBExcludingEntity`, damage min(floor(i * amount), max), source anvil for an anvil else fallingBlock. Per class (recalled from the 1.7.10 sources, partly the port's existing per-class rules): items and orbs health 5; boats and carts damage + 10 x amount, break above 40; item frame with an item drops it and stays, else hanging breaks; TNT, arrows, other falling blocks no effect. Port replay of the player and mob rows exists (`combat-tracker-reference.json`, executed).
- Executed: damage-fx-reference.json (batch 71): the client never sets attackedAtYaw, so the death camera tilt is a plain roll; the "camera death tilt follows attackedAtYaw" check is wrong, nothing to change.
- Recalled: the S12 velocity packet (`velocityChanged` set in `setBeenAttacked`) carries the server motion to the client player, packed as (int)(m * 8000) / 8000; the port applies that rounding.

## Verification
- `node --test src/spfixes74-b74.test.js` 5/5. Targeted: deathdrops-b48, gui-screens, falling-damage, falling, bonus-world, bonus-chest, hanging, player-knockback (63/63 with the new file); survival*, player-damage*, living-simulation-replay (29/29). `node --check` on main.js, death-throw.js, falling-hurt.js. `npm run build` ok.
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser shows the thrown body and camera in the dead screen (view drift, landing, third person). The camera does not bob there. The world still waits on the death screen except the body and particles (existing simplification).
- The attacker angle uses the position and yaw at death, not at the hit (differs only if the player turned or moved between a non-fatal hit and death).
- Multiplayer: the client player does not get the server's death motion (`healthHurt` carries none).
- A bonus chest torch that cannot stay is not placed; native drops a torch item there (rare).
- Frames, paintings and vehicles hit by an anvil use the existing per-class code; boats' and carts' break drops go through `vehicleDrop`-style spawn. The `anvil` source string is passed to `minecarts.attack` as `source`.
