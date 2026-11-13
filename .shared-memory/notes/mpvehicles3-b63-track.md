# Batch 63 mpvehicles3: command block cart on the server, lead and knot rules, owner of untagged wolves, rider seat height

## Summary
- `src/multiplayer/server-owners.js` (new): `ownedBy`, `unkeyed`, `claim`, `stampLegacy`, `resolveOwner`. A server wolf or ocelot now carries `ownerName` beside `ownerUuid` (stamped at taming). An owner matches a player by resume key, by name (any case), or by the offline UUID of the name (what a legacy `Owner` name becomes on a Java import). A tamed animal with no key at all (tamed in a single-player save, `owner: "player"`) is stamped once: for the `legacyOwner` named by the server option (`options.legacyOwner` or `saved.legacyOwner`), else for the first player who is nearest or clicks it. Before, every nearest player counted as owner. `server-mobs.js`: `target`, `interact`, constructor use it. `simulation.js`: one line passes `legacyOwner`.
- `src/multiplayer/server-cart-commands.js` (new) plus hooks: the command block minecart (type 6) is placeable (`PLACEABLE_CARTS`, `spawnVehicle('command_minecart')`), its state carries `cmd` (watcher 23), the client copy keeps it (`remote-vehicles.js`). A powered activator rail queues a run (`cartHost.runCommand` into `ServerVehicles.cartCommands`); `ServerSocial.drain()` runs the queue through the real command runner with the cart as sender (`commandBlockSender`, its position, TrackOutput/LastOutput, output to the operators). Runs happen only when `enable-command-block` is on (`sim.commandBlocks`, option `commandBlocks`, default false as natively). `ServerSocial.setCartCommand` is MC|AdvCdm type 1: Creative operator within 8 blocks.
- Client: `client.js vehCommand`, `server.js` routes `vehCmd` to `social.setCartCommand`, `main.js openMpCommandCart` (GuiCommandBlock from the copy, Done sends `vehCmd`; opened on a right click on a command cart in Creative, the interact packet is still sent).
- Leads and knots: no code change (see Evidence). Tests pin it.
- Rider seat height: no code change (see Evidence). A test pins it.
- New wire message: `vehCmd {v, command}` (client to server). `vehicles` state gains `cmd` for type 6. Server option `commandBlocks`, `legacyOwner`.
- Tests: `src/mpvehicles3-b63.test.js` (13). Two assertions in `mpriding2-b62.test.js` and `mpvehicles-b61.test.js` now expect type 6 in `PLACEABLE_CARTS`.

## Evidence
- Bytecode-read (javap, jar SHA1 e80d9b3b):
  - `EntityLiving.interactFirst` (sw.c(yz)): the holder's click frees the lead; a lead in hand ties only if `bM()` (allowLeashing) holds, and `bM()` is `!isLeashed && !(this instanceof IMob)`. So a second lead on a mob that is already led (by a player or a knot) is refused natively and the click falls to the mob's own interact. The listed gap (native steals the lead) was wrong. The port already refused it; the server now has a test (lead kept, holder unchanged, also for a knot-held mob).
  - `EntityLeashKnot.interactFirst` (su.c(yz)): with a lead in hand, every mob leashed to the player moves to the knot; if nothing moved the knot dies (`B()`), and a Creative player also frees the mobs held by the knot without a drop. A re-take by clicking the mob is not native (same `bM()`); freeing is done by clicking the knot, which the server already did through the fence click (`leashFence` -> `knotInteract`). Gap (4) is native-correct as is; test added (lead drops after the knot dies).
  - `EntityMinecartCommandBlock.interactFirst` (xn.c): on the client it opens the GUI, then calls `EntityMinecart.interactFirst`, which does nothing: a command cart is not rideable. `onActivatorRailPass` (xn.a(IIIZ)): powered and `ticksExisted - lastRun >= 4` runs `CommandBlockLogic.func_145755_a`. `agp.a(World)` runs the command only if `MinecraftServer.ad()` (command blocks enabled) is true, else the success count is 0.
  - The item 422 places like any minecart (ItemMinecart), natively obtainable only with /give or /summon. The server has /give for operators.
- Recalled: the dedicated property `enable-command-block` defaults to false; MC|AdvCdm needs a Creative operator.
- Native rider position (bytecode-read earlier, `Boats.seat`/`Minecarts.updateRiderPosition` comments, mob-riding.js): `Entity.updateRiderPosition` is `ridden posY + getMountedYOffset + rider.getYOffset`; cart and boat `-0.3`, `EntityPlayer.getYOffset` is `yOffset - 0.5` (server yOffset 0), pig `height * 0.75`. The server already seats players exactly there and presence sends that feet y. The other player's copy draws feet at presence y (no extra yOffset). So gap (1) found already correct; the new test checks presence y for cart, boat and pig riders against the formula.
- Executed: only the node replays in `mpvehicles3-b63.test.js` (no new Java probe). Native 1.7.10 stores `OwnerUUID` (owner-links.js header, probed b21); `Owner` as a name is only read. The brief's wording ("stores Owner as the player name") describes the pre-UUID format.

## Verification
- `node --test src/mpvehicles3-b63.test.js`: 13 pass.
- `node --test` on mpvehicles-b61, mpdispense-b61, mpanimals-b61, serverbroadcast-b58, mpcommands2-b60, b62-lead: 57 pass. mpriding2-b62, mpsmall2-b62 and mine: 40 pass.
- `npm run build`: ok.
- `node --check` on every touched file. `main.js` hooks read `survival`, `multiplayer`, `gui`, `commandBlockScreen`, `resume`, `screen`, `mining`, `mineHeld` (all module scope, already used by `openCommandBlock`), `openMpCommandCart` (declared above `openContainer`).
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser could show: the command block screen opened on a command cart in multiplayer, and rider height in third person (the formula is tested, the drawn pose is not).
- `server.js` has no CLI flag or env for `commandBlocks` / `legacyOwner` yet (the constructor options exist). Wire `--enable-command-block` when an operator wants it.
- A command cart needs at least one player in the dimension to run (the runner needs a roster); it only ticks near players anyway. Command cart in the Nether is not placed (vehicles are Overworld only here; mpnether3 owns that).
- The server has no `/summon`, so a command cart is made from the /give item only.
- A single-player save loaded on the server without `legacyOwner` still gives the untagged wolf to the first nearest player.
