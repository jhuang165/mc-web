# Remaining 1.7.10 gaps

Verified against `src/`, the generated parity catalogues and the research docs on branch b11-catalogue. This list is not a parity claim: rows marked Partial elsewhere in the catalogues still need audits that are not listed here. Where a research doc contradicts the code (for example `slime.md` saying magma cubes are missing, `eye-of-ender.md` saying there is no End), the code and tests were treated as authoritative and the doc is stale.

## Done in batch 11

Statistics (`stats.md`), Graphics/Smooth Lighting/Clouds/Mipmap/Anisotropic settings (`render-settings.md`), void fog (`void-fog.md`), the Giant (`giant.md`) and rider save/portal/fall work (`mob-riding.md`) were merged after this list was written; their remaining limits are in those docs.

## Priority 1: visible, commonly hit

### Items and blocks
1. Book and Quill, Written Book and the book screen (items 386, 387; GuiScreenBook). Missing.
2. Pumpkin Pie (item 400). Done; see [food-items.md](food-items.md).
3. Enchanted Golden Apple (322:1). Done; see [food-items.md](food-items.md). 1.7.10 has no Overpowered achievement.
4. Mossy, cracked and chiseled monster eggs (97:3, 97:4, 97:5). Done; see [food-items.md](food-items.md).
5. Filled map and fireworks items are technical-only rows: see `item-parity-catalogue.md`.

### GUI and settings
6. Chat Settings screen (ScreenChatOptions): chat visibility, chat colours and web links. Missing. Opacity, scale and width are Partial.
7. Player list (Tab). Missing.
8. F2 screenshot. Missing.
9. Resource Packs screen and pack loading. Missing.
10. Key rebinding: only smoothCamera is rebindable; key.chat and key.command are Partial. No `options.txt` persistence. See `settings-parity-catalogue.md`.
11. Superflat world type and its customization screens. Missing.
12. Bonus chest (WorldGeneratorBonusChest). Missing.
13. Super Secret Settings shaders, Anaglyph and the framerate limit. Missing.

### Audio
14. Music and music discs/jukebox record audio. Missing; 473 sound files, none are music or records.
15. Cave ambience (ambient sound category rows). Missing.

## Priority 2: entities and AI
- Spawner minecart (MinecartSpawner). Missing.
- Natural spawning: SpawnerAnimals runs as an adapted pass only; per-biome spawn lists are not applied (all 61 biome rows are Partial).
- Boats: not standable; see `boats.md`.
- Fireballs and thrown potions: fireballs are not saved; thrown potions are missing from region export.
- Wither: effect on mobs and wither skull behaviour listed in `entity-parity-catalogue.md` as Partial.
- Ender Dragon: model is bytecode-derived; remaining gaps in `dragon.md`.
- Villager: Partial; see the entity catalogue gap text.
- Riders: region chains are saved since batch 11; `/summon` with a `Riding` tag still spawns unmounted.

## Priority 3: commands
- Not available (reported as such): /achievement, /debug, /scoreboard, /spreadplayers, /tellraw.
- Selectors (@p/@a/@r) operate over the single local player only (`src/command-selector.js`).
- /summon covers 36 of the 57 EntityList registrations.
- doMobSpawning and mobGriefing gamerules are Partial.

## Priority 4: world generation, structures, dimensions
- Nether Fortress: pieces are not in the structure NBT (`UNSUPPORTED_PIECE_IDS`); catalogued Partial.
- Desert/jungle temples and witch huts: Partial in `structure-parity-catalogue.md`.
- Per-biome tint, weather and decoration audit: every biome row is Partial.
- Block behaviour audit: 39 blocks that were previously unmapped are mapped but their behaviour is audited only via the metadata catalogue.

## Priority 5: saves and interchange
- Hanging-entity import and thrown-potion region import/export.
- level.dat and playerdata import.
- Statistics and achievement export (depends on the statistics batch).
- Only one language; one local player.

## Stale strings outside this track's scope
- `src/menus.js` `UNAVAILABLE.multiplayerSettings` says "no chat", which is no longer true.
- (fixed) the `src/armor-enchantments.js` golden apple comment.

## Out of scope
- Multiplayer networking, Realms, server list and direct connect screens.
- Twitch integration and the snooper/usage reporting.
- Demo mode.
- The 16 dedicated-server-only commands (not registered by the native integrated server either).
