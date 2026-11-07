# Remaining 1.7.10 gaps

Verified against `src/`, the generated parity catalogues and the research docs on branch b11-catalogue. This list is not a parity claim: rows marked Partial elsewhere in the catalogues still need audits that are not listed here. Where a research doc contradicts the code (for example `slime.md` saying magma cubes are missing, `eye-of-ender.md` saying there is no End), the code and tests were treated as authoritative and the doc is stale.

## Done in batch 15

Boat and vehicle `Riding` chains in region export/import (`region-import.md`), whole Java save import into stored columns (`region-import.md`), dragon part hit boxes and the wither effect on mobs (`dragon.md`, `wither-boss.md`), in-place resource pack refresh, `.png.mcmeta` animation, pack sounds, HD chests and colormaps (`resource-packs.md`), per-position biome tint and per-column precipitation (`biome-colors.md`), villager trade items and iron golem details (`villager-trading-live.md`), languages and the unicode font (`languages.md`), and live tripwire temple traps (`scattered-features.md`). Each doc lists what is still open.

## Done in batch 14

The Resource Packs screen and pack loading (`resource-packs.md`), Super Secret Settings shaders and 3D Anaglyph (`post-shaders.md`), standable boats, mob passengers on boats and carts, the boat shadow (`boats.md`), hardcore mode and the in-browser Java save-folder import (`hardcore.md`), and the natural spawning cap, cadence, spawn point, witch hut lookup and portal pigmen fixes (`natural-spawning.md`). The rows below say what is still partial.

## Done in batch 13

Music, records and cave ambience (`music.md`), level.dat, player and stats import with paintings, item frames and minecarts in region import (`level-dat.md`), key rebinding, options.txt, F1/F3 and Max Framerate (`controls.md`), natural spawning through one SpawnerAnimals port with the 1.7.10 biome spawn lists (`natural-spawning.md`), /tellraw chat components, /achievement, /spreadplayers, /debug and /scoreboard (`commands-b13.md`), and the glazed-leaf fix: cutout materials write opaque alpha and the mip transparency flag checks only the first `levels + 1` texels (`render-settings.md`). The rows below say what is still partial.

## Done in batch 12

Book and Quill/Written Book (`books.md`), Pumpkin Pie, Enchanted Golden Apple and monster eggs 97:3-5 (`food-items.md`), Chat Settings, the Tab list and F2 (`chat-options.md`), Superflat and the bonus chest (`superflat.md`), and the spawner minecart with wider `/summon` coverage and `Riding` mounts (`spawner-cart.md`). The rows below say what is still partial.

## Done in batch 11

Statistics (`stats.md`), Graphics/Smooth Lighting/Clouds/Mipmap/Anisotropic settings (`render-settings.md`), void fog (`void-fog.md`), the Giant (`giant.md`) and rider save/portal/fall work (`mob-riding.md`) were merged after this list was written; their remaining limits are in those docs.

## Priority 1: visible, commonly hit

### Items and blocks
1. Book and Quill, Written Book and the book screen (items 386, 387; GuiScreenBook). Partial: items, recipe, cloning, tags, NBT and the edit/sign screen are in ([books.md](books.md)); the screen is bytecode-read, not probed; glyphs above code 126 use width 6 and the author is always "Player".
2. Pumpkin Pie (item 400). Done; see [food-items.md](food-items.md).
3. Enchanted Golden Apple (322:1). Done; see [food-items.md](food-items.md). 1.7.10 has no Overpowered achievement.
4. Mossy, cracked and chiseled monster eggs (97:3, 97:4, 97:5). Done; see [food-items.md](food-items.md).
5. Filled map and fireworks items are technical-only rows: see `item-parity-catalogue.md`.

### GUI and settings
6. Chat Settings screen (ScreenChatOptions): Partial. All nine options persist and apply, Show Cape is disabled (see `chat-options.md`). Since batch 13, /tellraw ClickEvents (open_url behind the Chat Links Prompt, run_command, suggest_command) produce clickable links ([commands-b13.md](commands-b13.md)); plain text is not auto-linked, as in vanilla 1.7.10.
7. Player list (Tab). Partial: native layout. It is shown while Open to LAN (native hides it for a lone host) or, as natively, when a list-slot scoreboard objective exists. With that objective it draws the score column and team-formatted name ([commands-b13.md](commands-b13.md)). There are no other players.
8. F2 screenshot. Partial: canvas-only PNG download with the native name and chat message; no HUD in the image. F1 hides the GUI ([controls.md](controls.md)).
9. Resource Packs screen and pack loading. Partial: GuiScreenResourcePacks lists, arrows, zip/folder packs in IndexedDB, options.txt `resourcePacks`, texture/sound/lang overrides through a service worker. Batch 15 adds the in-place refresh (no page reload; unhooked caches such as the sky clouds and title panorama still need one), `.png.mcmeta` animation for water/lava/portal/fire (probed against the original classes; no `interpolate` in 1.7.10), `sounds.json`, HD chest scaling, grass/foliage colormap overrides and a non-native delete control. Still open: animated or HD item icons, pack mcmeta on ordinary atlas tiles, compass/clock mcmeta, an unverified native loading overlay ([resource-packs.md](resource-packs.md)).
10. Key rebinding and options.txt. Partial: every KeyBinding can be rebound on the Controls screen, including mouse buttons, with conflict highlighting and Reset/Reset Keys. A native-format options.txt mirror is kept in localStorage. There is no options.txt import/export UI, the mapping from browser keys to LWJGL codes assumes a US layout, and browser-reserved shortcuts cannot all be captured ([controls.md](controls.md)).
11. Superflat world type and its customization screens. Partial: generator, presets, Customize/Presets screens and level.dat export are in ([superflat.md](superflat.md)); Add/Edit Layer are hidden as in 1.7.10; flat populate is bytecode-read, not replayed; a level.dat import keeps `generatorOptions` ([level-dat.md](level-dat.md)).
12. Bonus chest (WorldGeneratorBonusChest). Partial: contents and placement replayed against the jar ([superflat.md](superflat.md)); the port seeds its Random from the world seed where 1.7.10 uses an unseeded one.
13. Super Secret Settings shaders and 3D Anaglyph: Partial. The 22 post chains, the Options button cycle with its random sound, F4 deactivate and a red/cyan two-pass anaglyph are in ([post-shaders.md](post-shaders.md)); anaglyph colour conversion is applied to final pixels rather than at texture upload, and no pixel comparison was made. Max Framerate and Use VSync: Partial, because frames cannot exceed the display refresh rate ([controls.md](controls.md)).

### Audio
14. Music and music discs/jukebox record audio. Partial: MusicTicker with the seven MusicTypes (probe-replayed delays), the Music slider, pause/stop rules and positional records (volume 4, 64 blocks) are in ([music.md](music.md)). The 41 streams are not in Git; `npm run music:fetch` installs them locally, and without them music and records are silent. The paulscode falloff and channel limits are approximated.
15. Cave ambience (`ambient.cave.cave`). Done for the World mood sound, probe-replayed ([music.md](music.md)); 13 clips shipped. Approximate: World.C's light-check Random draws are not modelled.

## Priority 2: entities and AI
- Spawner minecart (MinecartSpawner): implemented, see `spawner-cart.md`; Java region import of carts is in (batch 13); `SpawnData` Riding chains (block spawner and cart) are probe-replayed since batch 16 (`spawn-data-reference.json`); the `onSpawnWithEgg` path of potentials entries is bytecode-read only.
- Natural spawning: Partial. Batch 13 ports SpawnerAnimals.findChunksForSpawning with every biome's spawn lists, caps, HashMap chunk order, group data, the 400-tick animal cadence, Peaceful/doMobSpawning and the Nether/fortress/End lists (`natural-spawning.md`; 3 seeded native replays match). Batch 14 closes four of the open items: the cap now uses the native 289 eligible chunks and counts every loaded mob, the 400-tick cadence runs from the saved total world time, the Nether and End use the Overworld spawn point (natively DerivedWorldInfo, so not a spawn point of their own), and the witch hut lookup ignores the biome slot. A fourth seeded replay ("wet-caves", 240 ticks, 19 bats) matches the jar. Still open: spawn points are drawn only in chunks the browser simulates (the ticking window, not all 225 non-edge chunks), so mobs cluster nearer the player; slimes, ocelots, horses and the Nether/End flow have no seeded `findChunksForSpawning` replay (slime size and horse foals roll on the unseeded entity Random); the total world time advances only while that world is played.
- Boats: standable and collidable (batch 14 native records), with the ItemBoat entity line of sight, mob passengers and the 0.5 shadow; remaining gaps in `boats.md`.
- Fireballs and thrown potions: both persist in browser saves (`fireballs`, `thrownPotions`) and in Java region export/import (`java-projectiles.js`, 31 native records in `projectile-nbt.md`). EntityFireball saves only `direction`, the tile fields and (large) `ExplosionPower`; acceleration, owner and any life counter are not native NBT, so an imported ball flies on its motion.
- Wither: batch 15 probes the wither effect on mobs, skull impact by difficulty and the shooter heal; open: target order is approximated, head particles are bytecode-read, and the model is approximate (`wither-boss.md`).
- Ender Dragon: batch 15 routes projectiles and explosions to the individual parts and uses the native wing-sound sequence; the model/hurt pass is still bytecode-derived and not replayed (`dragon.md`).
- Villager: Partial; see the entity catalogue gap text. Java region import and export of Profession, Riches, Age and Offers is verified against native NBT (`riding-nbt-reference.json`). Batch 15 villagers: trade items all map, golem sounds/retargeting/rose ported; remaining: visual-Random particles, +5 default reputation setter, distance-test path check.
- Riders: region chains are saved since batch 11; `/summon` with a `Riding` tag now mounts mob on mob; mobs on carts and boats are kept by pickup (carts), `/summon` and browser saves (batch 14); region export/import of those chains (boats and carts as `Riding` mounts, native replay in `riding-nbt-reference.json`) and chunk-streamed relinking are in (batch 15 interchange); a mounted player's own boat/cart and `SpawnData` Riding chains are open.

## Priority 3: commands
- Batch 13 implemented /tellraw (chat components with click/hover), /achievement, /spreadplayers, /debug and /scoreboard. See [commands-b13.md](commands-b13.md). No registered command reports itself unavailable now. What is still Partial:
  - The scoreboard criteria completion order (30 of 803 positions).
  - Stat criteria granularity: they follow the port's stat call sites.
  - belowName, friendlyfire and seeFriendlyInvisibles are stored only, because there is no other player.
  - /debug sections are browser tick phases.
- Selectors (@p/@a/@r) operate over the single local player only (`src/command-selector.js`).
- /summon covers 52 of the 57 EntityList registrations.
- mobGriefing is Partial; doMobSpawning gates the SpawnerAnimals port and, since batch 14, the live Overworld portal pigman (`BlockPortal.updateTick`, probe-replayed roll; the second entity on one probe spawn was a baby pigman's chicken jockey, now modelled: `EntityPigZombie.onSpawnWithEgg` keeps the child roll and the chicken roll and resets only the villager flag, probed over 80000 spawns in `pigman-jockey-reference.json`).

## Priority 4: world generation, structures, dimensions
- Nether Fortress: pieces are not in the structure NBT (`UNSUPPORTED_PIECE_IDS`); catalogued Partial.
- Desert/jungle temples and witch huts: Partial in `structure-parity-catalogue.md`. Batch 15: the jungle tripwire traps, lever puzzle and desert plate-and-TNT trap run live (tripwire probe-replayed, see `scattered-features.md`); the old "319 short" read-call gap was already closed. Open: shears disarm and random ticks unprobed, thrown projectiles do not trip strings, witch hut and structure NBT unchanged.
- Per-biome decoration audit: every biome row is Partial. Per-position grass, foliage and water tint and per-column rain/snow are ported ([biome colours](biome-colors.md)); decoration, fog edge cases and probes of the Fast-graphics overlay remain.
- Block behaviour audit: 39 blocks that were previously unmapped are mapped but their behaviour is audited only via the metadata catalogue.

## Priority 5: saves and interchange
- level.dat import: Done (batch 13, `level-dat.md`) through the Node CLI (`--save`, `--level`, `--player-file`, `--stats`): level.dat (WorldInfo, WorldType and generator options, game rules), the player (Data.Player, playerdata/players fallbacks) and stats/<uuid>.json import; painting, item frame and all minecart types in region import; thrown potions were already in. Batch 14 (hardcore track, `hardcore.md`): hardcore play, flying/SpawnForced/Sleeping on import and an in-browser Java save-folder picker (Import screen: showDirectoryPicker, else `webkitdirectory`) are in. Batch 15 (whole-save track, `region-import.md`): the browser import now takes every chunk of region/, DIM-1 and DIM1 as stored full columns with lazy per-region decoding, progress, and Java ZIP round-trip; the CLI is still area-only, imported TerrainPopulated=false chunks stay bare in the browser, portal/spreadplayers peeks ignore non-resident stored columns, and the list caps of `world-import.js` still bound the merged runtime. Still open: MapFeatures off (approximated) and the player's UUID.
- Stats and achievements export: already in since batch 11; the Java ZIP export writes `stats/<uuid>.json` under the offline UUID of "Player" ([stats.md](stats.md)).
- One local player. Other languages need `npm run lang:fetch` (batch 15, [languages](languages.md)); item and block names, signs, tooltips, the HUD and containers still use the English baked tables and the TTF font; no bidi reordering or Arabic shaping; glyph underline/strikethrough/italic are not drawn on unicode pages.

## Stale strings outside this track's scope
- Both resolved in batch 12: Multiplayer Settings opens Chat Settings, and the golden apple comment is fixed.

## Out of scope
- Multiplayer networking, Realms, server list and direct connect screens.
- Twitch integration and the snooper/usage reporting.
- Demo mode.
- The 16 dedicated-server-only commands (not registered by the native integrated server either).
