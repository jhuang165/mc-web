# cmdexec83 (batch 83): running the command forms batch 82 could not

## Summary

`tools/probes/CmdExec83Probe.java` extends the CmdArgsProbe server double so the forms batch 82 could not run now execute. The double adds:

- A fresh pair of real EntityPlayerMP doubles per record: Alex at 0.5,64,0.5 and Steve at 10.25,70,-3.75.
- A real StatisticsFile and ContainerPlayer.
- A NetHandlerPlayServer whose setPlayerLocation moves the player.
- StatList and AchievementList initialised.
- World.blockExists exactly as its bytecode: y from 0 to 255, every chunk loaded.
- A pig for the riding setup, and World.collidingBoundingBoxes set so the dismount can run.

`tools/verify-cmd-exec.mjs` writes `public/research/cmd-exec-reference.json` (6 Tab rows, 97 run rows, 171 summon rows, nothing crashed). To regenerate it, run `MC_RESEARCH=<tools/research> node tools/verify-cmd-exec.mjs`, then `git checkout logs/latest.log`.

`src/cmd-exec-b83.test.js` replays the reference. The Tab rows go through `spTabComplete`. The run rows go through `createCommandRunner.run` with a two-player server host (forPlayer REDIRECT), and the test compares the error, the notifyAdmins calls, the sender's chat, the positions, the riding state, the inventory and the achievements. The summon rows go through the real `createCommandHost.summon`.

Port fixes:

| Area | Fix |
| --- | --- |
| /kill | `commands.kill.success` goes to the sender's chat (addChatMessage), not notifyAdmins. |
| /clear | The data value is parseIntWithMin(0), so "-1" is tooSmall. The match uses the original Item and getItemDamage: coal also takes charcoal, stone takes every stone damage, and rawDamage counts. The cursor stack is cleared too. The new shared `clearMatcher` (`command-host.js`) is used by the SP host, the server host (`server-broadcast.js`) and the client op (`player-op.js`). The server op now carries the original Item id (it used to carry a build id). |
| /tp | A riding player is dismounted first and the mount stays where it is. This is done in the SP `main.js` teleport (detachPlayerVehicle) and the server `teleport` (`sim.vehicles.dismount`). |
| /summon height check | y is bounded to ±30000000 (tooBig/tooSmall), like x and z. World.blockExists receives the (int) casts, which truncate: -1 becomes -0.5, which is row 0 and in the world. 256 is outOfWorld. |
| /setblock, /testforblock | y is bounded to ±30000000 before the outOfWorld check. |
| /achievement | Any first word other than "give" (case-insensitive) throws the usage error, after the stat and player checks. |
| /summon NBT (Entity.readFromNBT) | Fire is kept as the raw short, negatives too, on living mobs, Item, XPOrb, PrimedTnt, Boat and FireworksRocketEntity. That covers the b82 fireext82 PrimedTnt Fire gap. OnGround is kept on the same classes. FallDistance is kept on mobs, PrimedTnt and Boat. Air (0 when absent) is kept on mobs. On mobs these keys are no longer reported as ignored. |
| /summon EnderDragon, EnderCrystal with a data tag | These used to fail ("Unable to summon"); they now spawn. The crystal keeps health 5 and no CustomName, since EntityEnderCrystal is not an EntityLiving. |

Old tests updated because they encoded the gaps:

- `commands-extra.test.js`: "achievement take" is now the usage line; it used to be silent.
- `serverbroadcast-b58.test.js`: the clear op carries the original id 1.
- `summon2-b68.test.js`: summon x -129 truncates to -128, inside the End window, so the out-of-window case is now -130.

## Evidence

- **Executed** (`cmd-exec-reference.json`, every row): kill, tp, clear, debug stop, achievement, the height checks, the Tab lists, and each summonable class's writeToNBT after reading the tag.
- **Bytecode-read:**
  - `bu` passes `d2i` casts to `ahb.d(III)`, which returns false for y < 0 or y >= 256.
  - `ae.b` checks in this order: stat, then player, then `equalsIgnoreCase("give")`.
  - StatList.initCraftableStats (`pp.b`) iterates a HashSet of Item objects, which hash by identity. That makes the order of the stat.craftItem.* Tab entries vary between JVM runs. The test compares the set, and the order of the other entries only.
- **Executed findings not ported:**
  - Player-to-player /tp copies the target's yaw and pitch. The port moves the player but keeps its own rotation.
  - The Tab lists match apart from that craftItem order.

## Verification

Targeted only; no full `npm test` and no browser checks.

| Run | Result |
| --- | --- |
| `node --test --test-concurrency=1 src/cmd-exec-b83.test.js` | 4/4 pass |
| 32 command, summon and server files (cmd-args-b82, commands, commands-extra, serverbroadcast-b58, servercommands-b59, summon-coverage/reference, summon2-b68, mpsummon-b67, java-mobs, mpcmd80-82, …), first run | 330/332 pass |
| summon2-b68 and cmd-args-b82 after the summon2-b68 update | 12/12 pass |
| 19 neighbouring entity files (dragon-world, wolf/slime/magma worlds, spdispense77, nbtexport73, boats, xp-orbs-b71, generated-tnt, mpdragon-b64, …) | 227/227 pass |
| `npm run build` | ok |

The 2 failures in the first run of the 32 files:

- `summon2-b68` encoded floor where native truncates. That test is updated.
- A trial removal of a cmd-args-b82 skip, which was reverted. Its host stub's summon returns null.

## Follow-ups

- Player-to-player /tp rotation copy, on both the server and the client.
- Fire counters for FallingSand, minecarts, hanging entities, arrows, fireballs and eyes. Throwables keep only a positive Fire.
- Invulnerable and Dimension are still reported as ignored. Air is not applied to an untagged mob summon (native sets 0; this only matters in water).
- The 15 dedicated-server-only command rows (the ban, pardon, op, whitelist, kick, list, save and stop family) were not executed. They need a DedicatedServer double.
- **Browser-only checks:**
  - The SP /tp dismount (`main.js` detachPlayerVehicle).
  - The client /clear op on a live inventory with a cursor stack.
  - The dragon or crystal summoned with a tag, in the End scene.
