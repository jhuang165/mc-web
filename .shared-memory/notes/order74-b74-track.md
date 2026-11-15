# Batch 74 order74: orbs in the pickup pass, immediate rider falls, straight-alpha skin decode

## Summary
- `src/experience.js`: `coolDown()`, `pickupCandidates(feet, w, h)`, `takeOne(orb, feet)` (null when refused); `collect` is built from them (same result).
- `src/pickup-order.js`: `collectPickups` takes an optional `orbs` and an `orbTaken(value)` hook; orbs join the item and arrow list in world list order. Exports unchanged.
- `src/entity-simulation.js` (`collectItemsAndArrows`): when the hooks carry `orbTaken`, orbs go through the pass; each orb's `random.orb` is played (hook `orbSound`) before its xp is added (level-up sound after).
- `src/living-simulation.js`: with `state.orbPass` only the xpCooldown count-down stays; the orb pickup is left to the pass.
- `src/main.js` (small): `orbPass` in the living state, `orbTaken` and `orbSound` hooks in `entityTick.hooks`.
- `src/vehicle-riders.js` + `src/entities.js` (one line): `passFall` calls the passenger's hidden `vehicleFall` (set by `EntityWorld.tickMobs` at the mob's first turn aboard) at once; the queue stays only for a mob that has not had a turn yet.
- New `src/png-decode.js` (`decodePng`, async, DecompressionStream for the zlib step; gray, RGB, palette, gray+alpha, RGBA, depths 1-16, Adam7, tRNS). `skin.js` `skinCanvas` decodes PNG bytes with it (no premultiply), then `normalizeSkinPixels`; the canvas path stays as a fallback when the decoder refuses.
- Test: `src/order74-b74.test.js` (20).

## Evidence
- Executed: the 13 native `ImageBufferDownload.parseUserSkin` inputs (skin-parse-reference.json). Each is written as a PNG (filters 0-4 rotated per row), decoded, compared byte for byte with the input, and fed to `userSkinPixels`; all equal the native output.
- Bytecode-read / recalled (earlier batches, riders72): `Entity.fall` hands the distance to `riddenByEntity` immediately inside the vehicle's `updateFallState`; so the deferred mob fall was wrong in ordering only.
- Bytecode-read / recalled: `EntityXPOrb.onCollideWithPlayer` plays `random.orb` then `addExperience`, and `EntityItem` plays the pop then `onItemPickup`; both run in the one `getEntitiesWithinAABBExcludingEntity` pass in list order (mobcells73's executed PickupOrderProbe covers the pass order and the orb cooldown; no new probe here, so the sound order itself is composed, not executed).
- Recalled: ImageIO keeps 16-bit samples' high byte in the 8-bit ARGB conversion (not executed; the skins in use are 8-bit RGBA).

## Verification
- `node --test src/order74-b74.test.js`: 20 pass.
- 39 related files (xp, experience, mobcells73, riders72, mpriders73, skins73, entity-simulation, living-simulation, pickup, entity-list, replay, boat, cart, skin): 501 pass, 0 fail.
- `node --check` on all `src/*.js`; identifiers in main.js hooks (`experience`, `playerTicks`, `sounds`, `renderVitals`, `saved`, `isWalked`, `entityTick`) are module scope there. `npm run build` once.
- Full npm test not run (batch rule).

## Follow-ups
- The normalised skin is still drawn through a canvas (putImageData then toBlob / CanvasTexture), which premultiplies partly transparent hat pixels again. Only hat pixels kept at alpha below 128 are affected; a pure-JS PNG encoder and a DataTexture would close it.
- The dedicated server's orb pickup (mppickup74) can pass `orbs` to `collectPickups` the same way.
- Only a browser could show the pickup sounds in order and the skin on the model.
