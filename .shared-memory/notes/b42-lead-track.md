# Batch 42 lead (claude, 2026-11-10)

Eight Sonnet tracks ran in `../wt42-<name>` on `batch42-<name>`, all cut from a41fdcff3 (0.70.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch42-lead`. Each track has its own note, `<name>-b42-track.md`. The gun side runs separately and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Merges (in merge order)
- **tilesync** (723f79cfb):
  - `ContainerResidency.reach` hydrates an evicted column's saved containers before a ring hopper, dropper or hopper cart reads them. `containerAt` returns null while that read is pending, instead of making an empty tile that the next save writes over the stored one.
  - Chunk resend carries the S33/S35 tile descriptions (`tile-sync.js`, `TileDescriptionProbe`, `tile-description-reference.json`).
  - `StreamingPopulation.requestCell`: the first loot lookup in an unbuilt cell waits for the generation worker instead of a build of about 0.8 s on the main thread.
- **zombiewander** (6aff8e29c): the seed 4109 turn was a harness gap. `fireballs-replay.js` had no `brightnessLevel`, while the probe world is light 15 everywhere, so the wander target differed. `ZombieWanderProbe` adds 18 records that replay exactly. No AI change.
- **globalids** (535f71da6):
  - `entity-ids.js`: one `Entity.nextEntityID` shared by mobs, carts, boats, hanging entities and XP orbs in every dimension (`EntityIdProbe`). The away run starts above the page counter (`plan.idBase`).
  - `/xp` runs on the away shadow player.
  - Away run tick n sees total time T0 + n + 1.
- **renderexec** (3671ac578):
  - `ItemRenderProbe` with a stub GL11: executed `renderBlockAsItem` for 397 items (chests excluded).
  - `ITEM_BOXES` and `itemBoxUv` face crops; beacon base y 0; the anvil item always uses facing 0.
  - `RenderTypes2PosProbe`: 320 fixtures at other positions.
  - `lighting.js` `cellPacked` clamps y as `getSkyBlockTypeBrightness` does, which fixed slabs and stairs at y 0 and 255. `render-types-pos-reference.json` was regenerated.
- **entityorder** (726c05ff5):
  - `EntityWorld.tickMobs` walks mobs and fireballs in insertion order (`orderStamp`, `withBalls`, `Fireballs.tickOne`). 17 `fb42-` records replay exactly.
  - Ghast balls at mobs are recorded; the port already matched.
  - A snowball does 3 damage to a blaze, and a mob thrower becomes the damage source.
  - The blaze crackle plays at +0.5.
  - **Conflict:** zombiewander had also written `fireballs-b42-reference.json`, an add/add on the same file. The lead moved zombiewander's copy to `fireballs-wander4109-reference.json` and updated `zombie-wander.test.js`, `pathfinding.md` and its note.
- **endermanwolf** (6635aebd0): `EndermanWolfProbe` gives 58 records against a real EntityPlayerMP.
  - Enderman stare teleport only within 4 blocks (squared 16, bytecode-read).
  - A mob attacker becomes the enderman's target.
  - A creative player who hits an enderman is its target for that tick only.
  - Wolves already matched inside the compared windows.
- **iconedges** (6341005a7):
  - The terrain atlas uses the executed Stitcher layout (`StitcherProbe`, `atlas-layout.js`; 512x256, 349 sprites, 0.01 px inset). Every consumer reads through `tileOrigin`, `tileRect` and `tileAtUv`.
  - Cube icons use GL pixel-centre edges (`icon-cube.js`, `IconEdgeProbe` derived model).
  - **Conflict:** `block-textures.js` `beaconIcon`. The lead kept renderexec's executed `BEACON_ITEM_BOXES` on iconedges' `tileOrigin`.
- **trackeritems** (c74e2ceb0):
  - `object-tracker.js` tracks items, orbs, arrows, the five thrown kinds, falling blocks and TNT (`TrackerItemsProbe`, `tracker-items-reference.json`).
  - Renderers and shadows draw a stable per-entity view at the client position. Game logic stays on the server entity.
- **Lead fix**: `player-throw-replay.test.js` binds `objectViews` and `objectTracker`, because the extracted `flushArrows` calls them.

## Verification (batch42-lead before the release commit)
- `npm test`, run once after all eight merges: 5496 of 5497 passed. The one failure was the player-throw replay `objectViews is not defined`, fixed above. That file then passed 2/2.
- `npm run build`: ok (5.3 s). Bridge unittest: OK. `git diff --check main`: clean.
- Focused runs after the conflict merges passed:
  - zombie-wander, fireballs b42/b41/native and legacy-ai: 115.
  - enderman-wolf-b42, enderman, enderman-live, wolf and village-fight-b41: 144.
  - icon-cube, atlas, block-textures, item-render, gate-item and icon-exact: 33.
- Muted headless Chrome smoke (vite :5342; output in `artifacts/b42-lead/`):
  - Load took 1.9 to 2.0 s. There were no long tasks after load in one run and one 53 ms task in the other.
  - 160 ticks per 8 s in the Overworld and the Nether.
  - Screenshots of the ground, inventory, Nether portal and held items show correct tiles on the Stitcher atlas.
  - Spawned drops fall and are picked up, and arrows fly.
  - Away trip (`away.mjs`): 357 of 357 ticks ran. The pig, the item and three orbs were delivered once each, with no duplicate ids, and the orbs share the mob id counter.
  - The only console errors were the known static 404 and a localStorage message from the final about:blank page.

## Remaining gaps (new or confirmed this batch)
- Tracker:
  - Object metadata (stack, crit, fuse) is read from live entities.
  - There are no client-side arrow or thrown hits.
  - Fireworks, eyes of ender, fishing hooks and mob potions draw at live positions.
  - Items and orbs set no `velocityChanged` on knock.
  - `falling.js` uses step height 0.5 where Java uses 0.
  - Mounts, riders and leash holders are still live.
  - The tracker HashSet order by id is not modelled.
- Mobs:
  - Enderman and wolf wander draws (`Entity.rand` i180/i120/f/f) are not made by the port, so the replay compares only 2843 of 11270 ticks.
  - Idle spiders, pigmen and blazes wander differently on some seeds. This is probably the same light harness gap that zombiewander found.
  - A silverfish dies at tick 0 on seeds 4213, 4214, 4222 and 4226.
  - A golem next to a blaze does not attack it on tick 9.
  - Arrows, items, orbs, TNT and falling blocks keep their own lists, not one entity list.
- Render:
  - Icons for thin blocks (wood slab, plates, buttons, carpet, trapdoor, farmland) are full cubes, and the dragon egg icon is flat.
  - Item ids that map to blocks draw cubes in the hand.
  - The item atlas is unused, and flat icons keep 4x4 coverage.
  - The chest family is not executed.
- Ring and tiles:
  - Resends of 1 to 63 cells carry no tile descriptions, and there are no sign or skull edit messages.
  - A hopper above a loading evicted column picks up items for that tick.
- Away:
  - A shadow kill applies on return.
  - Ridden mobs and entities outside the 32-block rule are frozen.
  - The wall stamp is `ran * 50`.
