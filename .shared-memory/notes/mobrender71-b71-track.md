# Batch 71 mobrender71: render gaps (shadows, mob heads, skull skins, jeb_)

## Summary
- `src/shadows.js`: `SHADOWS.slime`, `magma_cube` (0.25) and `falling_block` (0.5). `src/main.js` `shadowCasters`: falling-block casters (posY = box bottom + 0.49, height 0) and slime height `0.6 * size`.
- `src/mob-equipment-renderer.js`: skull in a mob's helmet slot is drawn (ModelSkeletonHead box at scale 1.0625 on the head frame, as the player's). Gear key carries the skin that would be drawn.
- `src/mob-equipment.js` (`skullFields`), `mob-equipment-live.js`, `java-mobs.js`: a mob helmet keeps `skullOwner` / `skullRaw` through save, `/summon` and the native/live id maps.
- `src/skull-skins.js` (new `skinBook`): profile name -> skin texture from the signed-in player's skin (`main.js`) and multiplayer players (`multiplayer/presence.js` `skinOf`). Used by `skull-renderer.js` (block), `player-renderer.js` (worn) and the mob head. No match: Steve.
- `src/sheep.js` `jebFleece`, `sheepFurTint`; `src/mob-renderer.js` uses it. Name from `customName`.
- Docs: `polish.md`, `sheep.md`, `slime.md` (shadow line only), `shadows.md`, all dated Batch 71.
- Test: `src/mobrender-b71.test.js` (6 tests).

## Evidence
- Bytecode-read (javap on the unchanged jar): `bnn` registers `bot` (RenderSlime) with 0.25F and `boe` (RenderMagmaCube) with 0.25F; neither overrides `doRender`, `bok` never writes `d`. So the listed "0.25 * size per frame" formula is wrong for 1.7.10 (found wrong). Size matters only via `getShadowSize` = height / 2.
- Bytecode-read: `bnq` (RenderFallingBlock) `d = 0.5F`, opaque default 1; `xj.Y()` returns 0.
- Bytecode-read: `boq.a(wp, int, float)` jeb_ formula (name test, `aa / 25 + entityId`, modulo bp.length, blend). `bnw.a(sw, float)` skull branch incl. `SkullOwner` compound or non-blank string. `bms.a(...)` binds profile SKIN else Steve. Only `bnw`, `bop`, `bmk` reference `bms`, so held and dropped heads are flat icons natively (item part of gap 3: nothing to draw).
- Recalled / port choice: matching a profile to a skin by name (native uses the textures property through the session service; no network here).
- Not executed: no Java probe. Render classes need GL, so only bytecode was read.

## Verification
- `node --test src/mobrender-b71.test.js`: 6 pass.
- `node --test src/shadows.test.js src/sheep.test.js src/mob-equipment.test.js src/skull.test.js src/player-renderer.test.js src/slime.test.js src/accounts.test.js`: 81 pass.
- `node --test src/mob-gear-nbt.test.js src/zero-stacks.test.js src/babyrender-b64.test.js`: 52 pass. `src/region-export.test.js src/region-import.test.js`: 11 pass.
- `node --check` on every touched JS file; new `main.js` names (`skinBook`, `isSlimeLike`, `slimeHeight`) are imported at module scope.
- Full npm test not run (batch rule). Build: see the final report.

## Follow-ups
- Only a browser could show: the head's seat on a zombie or skeleton, a skin on a block/worn head, the swap when a skin loads later, the falling-block and slime shadow look, the jeb_ colour cycle speed.
- Remote (dedicated-server) mobs, players and vehicles still cast no shadows; remote mobs with `customName` jeb_ depend on the server sending the name.
- Skins by name only: a SkullOwner whose player is not in the game stays Steve; the profile textures property is not decoded.
