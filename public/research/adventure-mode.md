# Adventure mode and Open to LAN (1.7.10)

Evidence: `tools/verify-adventure.mjs` runs `tools/probes/AdventureProbe.java` against the unchanged 1.7.10 client
(SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6). It also asserts the bytecode of every method listed below. It writes
`adventure-reference.json` and the generated table `src/adventure-data.js`, and `src/adventure.test.js` replays it.

## Adventure (WorldSettings.GameType.ADVENTURE, id 2)

- `GameType.configurePlayerCapabilities` sets `allowEdit = !isAdventure`. Damage, flight and instabuild stay as in
  survival.
- `EntityPlayer.isCurrentToolAdventureModeExempt(x, y, z)` returns
  `allowEdit || material != air && (material.isAdventureModeExempt || held != null && (held.canHarvestBlock(block) || held.getStrVsBlock(block) > 1))`.
  - The probe reads these answers for all 171 registered blocks with 29 held items: every tool tier, shears, plus the
    controls stick, cobblestone and cocoa beans.
  - 50 blocks have an exempt material, among them plants, torches, rails, redstone parts, cake and snow layers.
  - Metadata is not consulted.
- The gate sits in four places:
  - `PlayerControllerMP.clickBlock` and `ItemInWorldManager.onBlockClicked` return at once. That means no fire
    punch-out, no `onBlockClicked` and no digging.
  - `onPlayerDestroyBlock` and `tryHarvestBlock` return false.
- `Minecraft.sendClickBlockToController` draws the hit particles and swings the arm only when the block is exempt. The
  first click still swings. Holding the button on a non-exempt block does nothing more.
- `EntityPlayer.canPlayerEdit` is `allowEdit || held != null && held.canEditBlocks()`. `Item.canItemEditBlocks` is
  `return true` for every item, so with an item in hand an adventure player still places blocks and uses buckets,
  flint and steel, bone meal and the rest. Using blocks (chests, doors, levers) is not gated. The `CanDestroy` and
  `CanPlaceOn` tags are 1.8.
- How to reach it: `/gamemode 2|a|adventure` and `/defaultgamemode`, as natively. The Create World screen still cycles
  only Survival, Hardcore and Creative.
- Saves:
  - The world list shows "Adventure Mode".
  - Java export writes `GameType` and `playerGameType` 2 and `abilities.mayBuild` 0.

## Open to LAN (GuiShareToLan, IntegratedServer.shareToLAN)

- The screen:
  - Layout follows `bdz.initGui`: Start LAN World and Cancel at `height - 28`; Game Mode and Allow Cheats at y 100.
  - The title is at y 50 and "Settings for Other Players" at y 82.
  - The game mode cycles survival → creative → adventure. Each opening starts at Survival / OFF.
- `shareToLAN(gameType, cheats)`:
  - Natively it opens an endpoint on a free port and starts the LAN ping.
  - It then sets the game type for players who join (`oi.a(ahk)`; the host keeps its own mode) and
    `commandsAllowedForAll` (`oi.c(boolean)`), and returns the port.
  - `/publish` calls it with (SURVIVAL, false), so it overwrites both settings.
- Effects kept in the browser (`src/lan.js`):
  - Commands work for the host for the rest of the session when Allow Cheats was ON.
  - `Minecraft.isGamePaused` is false once the server is public, so the world keeps ticking behind the game menu.
  - The game menu's Open to LAN button is disabled while the server is public.
  - The chat shows `commands.publish.started`.
  - Nothing is saved, and leaving the world ends the LAN session.
- Deviations:
  - A web page cannot listen on a port or broadcast on the local network, so no other device can join.
  - A grey chat line says so.
  - The port shown is 25564, the fallback that `shareToLAN` itself uses when the free-port lookup fails.
