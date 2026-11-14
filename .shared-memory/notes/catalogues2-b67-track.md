# Batch 67 catalogues2: refresh the entity, GUI, command and structure catalogues

## Summary
- `tools/build-content-catalogue.mjs` (entity table `E`): 33 entity rows rewritten (Item, XPOrb, Painting, ItemFrame, Arrow, Snowball, Fireball, SmallFireball, ThrownPotion, EyeOfEnderSignal, WitherSkull, FallingSand, FireworksRocketEntity, MinecartCommandBlock, Boat, six cart rows, MinecartSpawner, Skeleton, Giant, Zombie, Silverfish, CaveSpider, EnderDragon, WitherBoss, Witch, MushroomCow, VillagerGolem, Villager, SnowMan). Stale notes removed (no hanging import, "not saved, no /summon" for balls, no ball-versus-ball collisions, potions absent from region export, silverfish range scaling, carts not imported, villager NBT import). Server notes added where the dedicated server has the entity. The intro says every concrete registration is a `/summon` type (55 of 55).
- `tools/build-surface-catalogue.mjs`: GUI rows (GuiContainerCreative now 606 of 606; GuiMultiplayer, GuiConnecting, GuiDisconnected, GuiDownloadTerrain, GuiScreenBook, GuiMerchant, GuiSleepMP, GuiStats, GuiWinGame, GuiShareToLan, GuiPlayerInfo); command rows now import `SERVER_COMMANDS` and `SUMMONABLE`, so each row says whether the dedicated server has it and the `/summon` note is computed; structure rows for Village, Temple and Fortress.
- Regenerated `entity-`, `gui-`, `command-` and `structure-parity-catalogue.md` with both generators (no markdown was hand-edited). The other generated files came out unchanged.

## Evidence
All code reading (grep and reading `src/`, no executed probes; this is a docs track).
- Read in code: `region-import.js` imports Painting and ItemFrame (`hangingFromNbt`), carts (`cartFromNbt`), projectiles (`JAVA_PROJECTILES`); `region-export.js` writes fireballs, skulls, potions, arrows, hanging entities, TNT, orbs, falling blocks; `SUMMONABLE` has 55 keys and the only registrations missing are Mob and Monster (checked with a node one-liner against the table); `fireballs.js` `hitBall` (ball against ball); `ai.js` `closestVulnerablePlayer` scales by sneaking and invisibility and `entities.js` line 2890 uses it for the silverfish; `bow.js` has Power, Punch, Flame, crit trail and bubbles; `drop-renderer.js` has EntityPickupFX; `java-mobs.js` reads villager NBT; `SERVER_COMMANDS` has 24 names.
- Node check: `CREATIVE_TABS` counts equal the native per-tab totals and `SEARCH_ORDER.length` is 606 (the old "600 of 606" was stale).
- Recalled (not re-read): that native `GuiDisconnected` uses `gui.toMenu` for its button; that `EntityXPOrb` writes only Health, Age and Value; the village, piston, lightning and similar gaps copied from the batch 66 list in `remaining-gaps.md` are labelled as such in the follow-ups.
- Not re-audited this batch: the item, block, biome, gamerule, recipe and settings catalogues, and the entity rows not listed above (they keep their batch 19 and later text). Many linked research docs are still stale (`bows.md` Gaps, `silverfish.md`, `fireworks.md` Gaps, `eye-of-ender.md`); the catalogue notes now contradict them on purpose.

## Verification
- `node tools/build-content-catalogue.mjs` and `node tools/build-surface-catalogue.mjs` (both regenerate cleanly).
- `node --test src/catalogue-consistency.test.js`: 5 pass, 0 fail. `node --test src/content-catalogue.test.js`: 1 pass, 0 fail.
- Full npm test not run (batch rule). No build step needed for docs; `npm run build` not affected (no `src/` change).
- Nothing a browser could have shown is claimed.

## Follow-ups
Real gaps found, ranked by how visible they are to a player (all verified in code unless marked recalled):
1. **No paintings or item frames on the dedicated server.** Nothing under `src/multiplayer` handles hanging entities (grep), so a connected player cannot place or see them; world records from a server carry none.
2. **The server has no `/summon`, `/setblock`, `/testfor`, `/testforblock`, `/playsound`, `/setworldspawn`, `/spreadplayers`, `/debug`, and none of the operator commands (`op`, `kick`, `ban`, `whitelist`, `stop`, `save-all`).** `SERVER_COMMANDS` lists 24 names. Operators cannot spawn a mob or manage players from chat.
3. **Zombie sieges are missing** in single player and on the server (no siege code outside comments in `away-entities.js`). Villages are never attacked at night.
4. **Explosions do not release silverfish** from monster egg blocks (no silverfish path in the explosion code).
5. **Tab list ping is always 0** over a connection (`main.js` passes `ping: 0`), so the bars never show latency.
6. **The Multiplayer screen has no server list**, Direct Connect or Add Server; the Disconnected screen button reads Cancel (native label recalled as "Back to title screen").
7. **The default server world (generation 9) has no generated villages** (recalled from the batch 66 list; not re-checked). Villagers exist there only from saves or a fresh-world join.
8. **Fireworks:** the rocket moves with the particle mover, so block collisions are approximate (`firework-rocket.js`); the star's layered inventory tint has no non-test caller (`starTintComponents`).
9. **The giant is not a server mob kind** (only kind outside `SUPPORTED`, by design) and has no verified pathing reach in single player.
10. **Carried from batch 66 (recalled, not re-verified):** pistons do not move carts and boats or collide with block 130; lightning ignores boats, carts and projectiles; a golem snowball gives no knockback; thin End island tails are cut; a spawner cart has no `/summon` on the server.
11. **Doc cleanup for batch 68:** `bows.md`, `silverfish.md`, `fireworks.md`, `eye-of-ender.md`, `villages.md` still state gaps that the code closed. A docs track can retire them the same way.
12. Catalogue upkeep: the item, biome, gamerule, block-metadata and settings catalogues still carry the batch 19 audit label and were not re-read this batch.
