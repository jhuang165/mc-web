# Remaining 1.7.10 gaps

Verified against `src/`, the generated parity catalogues and the research docs on branch b11-catalogue. This list is not a parity claim: rows marked Partial elsewhere in the catalogues still need audits that are not listed here. Where a research doc contradicts the code (for example `slime.md` saying magma cubes are missing, `eye-of-ender.md` saying there is no End), the code and tests were treated as authoritative and the doc is stale.

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
6. Chat Settings screen (ScreenChatOptions): Partial. All nine options persist and apply, Show Cape is disabled; vanilla links need a ClickEvent producer (see `chat-options.md`).
7. Player list (Tab). Partial: native layout, shown only while Open to LAN (native hides it for a lone host); no other players or scoreboard.
8. F2 screenshot. Partial: canvas-only PNG download with the native name and chat message; no HUD in the image, no F1 toggle.
9. Resource Packs screen and pack loading. Missing.
10. Key rebinding: only smoothCamera is rebindable; key.chat and key.command are Partial. No `options.txt` persistence. See `settings-parity-catalogue.md`.
11. Superflat world type and its customization screens. Partial: generator, presets, Customize/Presets screens and level.dat export are in ([superflat.md](superflat.md)); Add/Edit Layer are hidden as in 1.7.10; flat populate is bytecode-read, not replayed; no level.dat import.
12. Bonus chest (WorldGeneratorBonusChest). Partial: contents and placement replayed against the jar ([superflat.md](superflat.md)); the port seeds its Random from the world seed where 1.7.10 uses an unseeded one.
13. Super Secret Settings shaders, Anaglyph and the framerate limit. Missing.

### Audio
14. Music and music discs/jukebox record audio. Missing; 473 sound files, none are music or records.
15. Cave ambience (ambient sound category rows). Missing.

## Priority 2: entities and AI
- Spawner minecart (MinecartSpawner): implemented, see `spawner-cart.md`; gaps are Java region import of carts and SpawnData Riding chains.
- Natural spawning: SpawnerAnimals runs as an adapted pass only; per-biome spawn lists are not applied (all 61 biome rows are Partial).
- Boats: not standable; see `boats.md`.
- Fireballs and thrown potions: fireballs are not saved; thrown potions are missing from region export.
- Wither: effect on mobs and wither skull behaviour listed in `entity-parity-catalogue.md` as Partial.
- Ender Dragon: model is bytecode-derived; remaining gaps in `dragon.md`.
- Villager: Partial; see the entity catalogue gap text.
- Riders: region chains are saved since batch 11; `/summon` with a `Riding` tag now mounts mob on mob; mobs on carts/boats are unsupported.

## Priority 3: commands
- Not available (reported as such): /achievement, /debug, /scoreboard, /spreadplayers, /tellraw.
- Selectors (@p/@a/@r) operate over the single local player only (`src/command-selector.js`).
- /summon covers 52 of the 57 EntityList registrations.
- doMobSpawning and mobGriefing gamerules are Partial.

## Priority 4: world generation, structures, dimensions
- Nether Fortress: pieces are not in the structure NBT (`UNSUPPORTED_PIECE_IDS`); catalogued Partial.
- Desert/jungle temples and witch huts: Partial in `structure-parity-catalogue.md`.
- Per-biome tint, weather and decoration audit: every biome row is Partial.
- Block behaviour audit: 39 blocks that were previously unmapped are mapped but their behaviour is audited only via the metadata catalogue.

## Priority 5: saves and interchange
- Batch 13 (`level-dat.md`): level.dat (WorldInfo, WorldType and generator options, game rules), the player (Data.Player, playerdata/players fallbacks) and stats/<uuid>.json import; painting, item frame and all minecart types in region import; thrown potions were already in. Still open: a whole-save import (one 8x8 area per import; the rest regenerates), MapFeatures off (approximated), hardcore play, flying/SpawnForced/Sleeping on import, the player's UUID, and an in-browser save-folder picker (the importer is the Node CLI plus the existing Import screen).
- Only one language; one local player.

## Stale strings outside this track's scope
- Both resolved in batch 12: Multiplayer Settings opens Chat Settings, and the golden apple comment is fixed.

## Out of scope
- Multiplayer networking, Realms, server list and direct connect screens.
- Twitch integration and the snooper/usage reporting.
- Demo mode.
- The 16 dedicated-server-only commands (not registered by the native integrated server either).
