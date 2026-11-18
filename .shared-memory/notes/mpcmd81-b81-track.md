# Batch 81 mpcmd81: server command blocks, round 2

## Summary
- **The success count is the run count.** commands.js has a new `count(text)`. It returns CommandHandler.executeCommand's `j`: one for each player an expanding selector matched (a username index with a count other than 1, so `@a`, or `@a[c=2]`), otherwise 1 or 0. `run()` is now `count() > 0`, so every existing caller and test sees the same boolean.
  - These now store `count()`: server blocks and carts (`runCommandLogic`), single-player blocks (command-block.js), single-player carts (command-cart.js) and the away runs and replay (away-commands.js).
  - The comparator reads the count unclamped, as `akb.g` returns `agp.g()`.
  - Single player has one player, so its values do not change.
- **A server block runs with nobody in its dimension, or nobody online.**
  - `runCommandLogic` no longer returns 0 without a nearby player. The summon and world-command hosts are now anchored on the block (`anchor`: its dimension and position).
  - The player-state base (`forPlayer` prototype, `playerName`) is the nearest player in the dimension, else any online player, else empty. With nobody online, selectors and names match nobody, and commands with no player target (setblock, time, say, summon...) still act.
- **Bug fixed (b80):** `/summon ~ ~1 ~` from a server block or cart resolved around the nearest player's position (`summonHost(sim, near)`). It now resolves around the block. Checked by reverting the line: the test fails with the pig at the player's 64.5.
- **Bug fixed (b63/b80):** `commandBlockSender` defined `playerName` read-only. The server redirect in commands.js `dispatch` (`Object.assign(sub, { playerName: who })`) then threw a TypeError. So `/gamemode`, `/give`, `/tp`, `/xp` and the like on any player other than the base player failed with `commands.generic.exception`. The property is now writable (command-block.js).
- **Nether and End command carts now run.** Their activator pass queued into the lane's own `ServerVehicles.cartCommands`, which nothing drained. The queue grew and the commands never ran. `drainCartCommands` (server-cart-commands.js, called from `ServerSocial.drain`) now runs them inside `dims.swap(lane)` with the lane's dimension.
- **MC|AdvCdm type 1 (carts) matches `nh`.** The order is:
  1. command blocks off: `advMode.notEnabled`
  2. not op level 2 or not Creative: `advMode.notAllowed`
  3. `getEntityByID` in the sender's own world (`dims.within`) must be a command cart, else nothing is said
  4. set the command, update watcher 24, reply `advMode.setCommand.success` with the command

  The 8-block reach is gone. A text over 32767 characters is still dropped silently: it cannot arrive natively, because C17's payload must be under 32767 bytes. `ServerSocial.setCartCommand` delivers the reply and still returns a boolean.

## Evidence
- **Bytecode-read** (`javap -c -p`, 1.7.10 jar):
  - `z.a(ac, String)` (CommandHandler.executeCommand): `j` is incremented after each `aa.b` in the `ad.c` loop and after the single call, and `j` is returned.
  - `nh` MC|AdvCdm: `MinecraftServer.ad()`, then `mw.a(2, "")` && `bE.d` (Creative), then type 0 `ahb.o(III)` instanceof `aox`, or type 1 `ahb.a(int)` instanceof `xn`, then `et.c(readableBytes)`, then `agp.a(String)`, `agp.e()` and `advMode.setCommand.success`. There is no distance check. An exception only logs "Couldn't set command block".
  - `iz` (C17): the payload length must be under 32767.
  - `agp.a(String)`: a plain set, no cut.
- **Port-read:**
  - The server Overworld is finite and always resident, and its LiveRedstone ticks every tick with or without players (simulation.js `tickWorldSystems`, server.js `setInterval`).
  - Nether and End lanes tick only with a player there (server-dimensions.js).
- **Native residency, from memory and the port's chunk-provider.js model; not re-read this batch:** `unloadChunksIfNotNearSpawn` keeps Overworld chunks whose centre is within 128 blocks of spawn. Other dimensions keep none. `tickUpdates` needs only the entry's own chunk (b0 = 0, redstone-live.js comment).
- **Executed:** none against the jar.

## Verification
- `node --test --test-concurrency=1`, batch 1: mpcmd81-b81 (new, 8 tests), mpcmd80-b80, mpvehicles3-b63, mplanes79-b79, command-block, command-selector, commands, commands-extra, command-tags, cmd-output-b50, cmd-texts-b51, cmd-tell-b53, cmd-chat-b56, chat-component-b52, chat-multi-b57, books, item-tags-b57, scoreboard and summon-coverage. 171 pass, 0 fail.
- Batch 2: away-commands, away-ride, away-shadow, furnace-cart-b49, mpfixes69-b69, mpsummon-b67, polish, summon2-b68, mpworldcmds-b68, servercommands-b59, mpcommands2-b60, mpadmin-b68, prediction5-b59, mpnether3-b63, mpmisc74-b74 and mpend-b63. 155 pass, 0 fail.
- No old test needed changing.
- The full `npm test` was not run. No browser checks were made.
- Browser-only:
  - the cart GUI's Done in multiplayer now shows the advMode chat line
  - a far cart can be edited
  - a comparator behind an `@a` block lights to the player count

## Follow-ups
- The Overworld residency gap: a server block outside the spawn area runs with no player near, where native would have unloaded its chunk. This is shared by all server redstone. A pending tick in a natively unloaded chunk would be saved and resume on reload; the port never unloads.
- `commandBlockSender.playerPosition` is the base host's position, not a redirect target's (`/spawnpoint other` from a server block reads the base player's block). This was not changed.
- The comparator count above 15 flows into the port's redstone as is. Native clamps at `getStrongestIndirectPower` (15); the port's wire, repeater and comparator path for inputs above 15 was not checked.
- MC|AdvCdm type 0 still cuts to 32767 characters, while type 1 drops an over-long text. Neither can arrive natively.
