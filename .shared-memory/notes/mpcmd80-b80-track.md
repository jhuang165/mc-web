# Batch 80 mpcmd80: server command blocks, mob collect end point, server diamondsToYou

## Summary
- **Server command blocks.** `installServerCommandBlocks(sim, redstone, lane, dim)` (multiplayer/server-command-blocks.js) registers block 137 in the Overworld's redstone engine (simulation.js) and in the Nether's and the End's (server-nether.js).
  - `onNeighborBlockChange` works like `akb`: the powered state is metadata bit 0, written with flag 4, and a rising edge schedules a tick (tickRate 1).
  - `updateTick` runs the command through `sim.commandBlockRun`. ServerSocial installs that hook as `runCommandLogic`, which is now shared with the carts (server-cart-commands.js): the same `SERVER_COMMANDS` table, level 2 sender and `commandBlockOutput` admin line. It then calls `updateNeighbourForOutputSignal`.
  - The comparator reads `successCount`. With `enable-command-block` off the count is 0 and nothing runs.
  - Empty commands run for blocks (native `executeCommand`, so LastOutput gets `commands.generic.notFound`). Carts still skip them, as before.
- **S35 for command blocks.** tile-sync.js `describeCell` / `describeTiles` emit `{kind:'command', action:2, command, successCount, customName, lastOutput?, trackOutput}`, the `agp.a(dh)` field set. `applyTiles` applies the row as `agp.b(dh)` reads it: LastOutput, CustomName and TrackOutput are taken only when present, and a malformed LastOutput skips the row.
  - The tracked output (`agp.a(fj)`) marks the cell dirty through the existing watch24 `outputChanged` hook, so the client gets the new LastOutput in the same tick.
  - main.js passes `redstoneRuntime.commandBlocks` to the four `applyTiles` calls.
- **MC|AdvCdm type 0.** `ServerSocial.setBlockCommand` / `setBlockCommand` (server-command-blocks.js) handle the new `blockCmd` message (client.js `blockCommand`, server.js). main.js `openCommandBlock` sends it in multiplayer for a block; carts keep `vehCmd`.
  - The rules are bytecode-read from `nh`: `advMode.notEnabled` when command blocks are off; otherwise an op of level 2 or more in Creative, else `advMode.notAllowed`. The block is looked up in the player's own dimension and must be a command block, else nothing happens.
  - On success the command is set (cut to 32767 characters), the cell is marked dirty, and `advMode.setCommand.success` is sent with the command.
  - No new privilege path: the setter uses the existing `isOp` / `opLevel`, and the block runs only `SERVER_COMMANDS` at level 2 (op, deop, publish and the like stay refused).
- **Store upkeep.** `dropTiles` removes a command block record when the block changes. `/setblock ... {Command:...}` and `/testforblock` reach the server store through `commandTile` in server-worldcmds.js.
- **Mob collect end point.** drop-renderer.js exports `PLAYER_PICKUP_LIFT` = 1.12 and `MOB_PICKUP_LIFT` = -0.5, and `pickup(item, target, lift)` takes the lift. In multiplayer, main.js flies an S0D with a mob collector to the live remote mob copy (falling back to the row's `at`) with the mob lift. Single-player mob pickups (`mobs.itemPickedUp`) now fly too; the integrated server sends S0D natively.
- **Server diamondsToYou.**
  - The thrower check matched `sw.e`: there is no collector or owner check.
  - The lookup was wrong across dimensions and is fixed. `ahb.a(String)` walks the mob world's own player list, so `ServerMobs.thrownDiamond` now searches that lane's `views` rather than every online player. A Nether zombie that takes an Overworld player's diamond awards nothing.
- **Server gamerules for shared mob code (found while testing).** On the dedicated server, `gameRule()` (game-rules.js) had no source, so entities.js, fire.js, zombie-door.js, enderman-live.js, fireballs.js and the dragon / wither code always read the default rules. `/gamerule mobGriefing false`, `doMobLoot false` and `doFireTick false` did not reach them. `DedicatedSimulation.tick` now points the source at `ruleOn(this, name)` each tick. This is one line, with a wider effect than this track's scope; the lead should know.
- **Updated old test.** mplanes79-b79.test.js had a source check for `who = t.at ?? (t.by === ...`. The line is now `who = mobWho ?? t.at ?? (...)` and the regex was changed to match. It still checks that `at` is the fallback.

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - `akb`: neighbour change, updateTick and comparator.
  - `aox.m()`: S35 action 2 with the whole compound.
  - `aoy`: `e()` marks the block for update; `a(String)` sets the command and marks the tile dirty.
  - `agp`: `a(dh)` / `b(dh)` field sets and presence checks; `a(ahb)` gives 0 when remote or disabled; `a(fj)` only acts with TrackOutput on, stamping `[HH:mm:ss] `.
  - `nh`: MC|AdvCdm type 0 and type 1, with no distance check.
  - `mw.a(int,String)`: op level against the required level.
  - `bfh`: Done sends MC|AdvCdm and sets nothing locally.
  - `bjb.a(ij)`: random.orb for an orb, otherwise random.pop, through `playSoundAtEntity`; spawns `new blb(world, item, collector, -0.5f)`.
  - `blb`: the target is collector lastTickPos + (pos - lastTickPos) x partial + yOffs, eased by age/maxAge squared.
  - `sw.e`: diamond (`ade.i`) and `xk.j()` (Thrower `f`) not null, then `ahb.a(name)`, then `yz.a(pc.x)`. There is no collector check. It comes before setCurrentItemOrArmor, persistence, onItemPickup and setDead.
  - `ahb.a(String)`: iterates the world's `h` (playerEntities) by `b_()` name.
  - Pickup sound: `ahb.a(sa,String,F,F)` goes to `ahh.a(String,DDDFF)`, and `bma` (the client IWorldAccess, RenderGlobal) is an empty `return`. So the client's collect sound is silent, and the port's silent mob fly-in is right.
  - Mob yOffset: a scan of every class that writes `Field L:F` found the player classes (`yz`, `mw`), `xk` (item), `sq` (orb), `sv` (sets 0 in `setPositionAndRotation2`), `ss` (sets 0 in the constructor), other direct `sa` subclasses, a few client classes, and two mobs. The two mobs are `ym` (the slime, sets 0) and `ye` (the giant, yOffset x 6 of 0). Every mob keeps yOffset 0, so a mob's posY is its feet.
- **Port-read:** server.js loop order (tick, then social.drain); ServerDimensions `within` nesting; the remote mob `copies` shape; the success count of `commands.js run()` (a boolean, so 1 or 0).
- **Executed:** none against the jar. The port behaviour is covered by the tests below.

## Verification
- `node --test --test-concurrency=1` on mpcmd80-b80, mplanes79-b79, spswing79-b79, loot78-b78, mob-griefing, mob-equipment, mpvehicles3-b63, command-block, tile-sync, mpworldcmds-b68, mpcommands2-b60, mpadmin-b68, servercommands-b59, mpspawn73-b73, mpnether3-b63 and gate-item: 139 pass, 0 fail.
- mphealth-b60, mpsleep2-b67, mpsleep-b66, mppushgrid75-b75, serverbroadcast-b58, streamfix73-b73, mpclicks76-b76 and client-screens: 72 pass, 0 fail.
- mplightning-b66, mpexplosion78-b78, mpmobs-b59 and mpmobs2-b60: 31 pass, 0 fail.
- New in mpcmd80-b80.test.js (14 tests):
  - rising edge and comparator; command blocks disabled; S35 fields
  - commandBlockOutput; level 2 refusals; empty command
  - MC|AdvCdm accept and refuse; break and `/setblock`; client `agp.b(dh)` apply; a Nether block
  - diamond to an online, offline or unnamed thrower; the dimension of the lookup; mobGriefing false; the pickup lift
- The full `npm test` was not run (per the brief). `npm run build` was run once at the end.
- No browser checks were made. Browser-only:
  - the command block GUI in multiplayer: Done, the chat reply, reopening with the new command
  - the "Previous output" field filled by S35
  - the mob collect fly-in ending 0.5 below a mob's feet, in multiplayer and single-player
  - the remote mob copy following the item during the three-tick flight

## Follow-ups
- Success count is 1 or 0 (the result of `run()`), not native's count of selector matches.
- Native sends nothing for the flag 4 metadata write. The port's cell edit stream still sends it as a cell change, which is harmless.
- A command block runs only when a player is in its dimension, because the sender borrows the nearest player's host. This is inherited from carts; native runs with no player at all.
- The client's `dropTilesIn` does not sweep command block records; this was not checked.
- `akb.onBlockPlacedBy` (a named command block's CustomName) was not checked on server placement.
- The cart MC|AdvCdm path (`vehCmd`) keeps its 8-block reach check, which is the port's own (`nh` has none), and sends no advMode replies.
- The client-side cart and minecart command flows were not changed.
- The `gameRule()` source fix is now live for every server lane; other tracks' server tests that set `s.gameRules.*` should expect those rules to apply.
