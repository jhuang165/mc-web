# Batch 73 skins73: offline skin and exact parseUserSkin

## Summary
- `src/skin.js`: `userSkinPixels(rgba, w, h)` ports ImageBufferDownload.parseUserSkin exactly (draw at 0,0 into a transparent 64 x 32 ARGB buffer, then setAreaOpaque head base and body/limbs, setAreaTransparent hat unless a pixel is below alpha 128), including Java2D's premultiply/divide colour change on partial alpha (`mul8`/`div8`) and loss of colour at alpha 0. `normalizeSkinPixels` now calls it. New `skinPngError` (stored skin: 64 x 32 PNG, at most 16 KB).
- `src/sp-skin.js` (new): `SpSkinStore` (localStorage `blockworld.skin`), `applyLocalSkin`, `skinTexture`, `chooseSkinFile` (cleans the file up through `skinCanvas`/`canvasPng`; 64 x 32 and 64 x 64 accepted, as in the account screen).
- `src/menus.js`: "Skin File..." and "No Skin" in Chat Settings, in the empty slot right of Chat Width (beside the cape buttons). 1.7.10 has no skin screen: the skin is the account's profile texture and an offline player is Steve, so this is a port addition, like the cape buttons.
- `src/first-person.js`: `setSkin(texture)`; the bare arm now wears the body's skin (it was always Steve, also online).
- `src/main.js` (3 short hooks + import/store/ctx): offline `applyLocalSkin`, offline `playerRenderer.name = PLAYER_NAME` (so SkullOwner heads of the own name and deadmau5 ears work offline), `firstPerson.setSkin(...)`. The existing `skinBook` source already serves heads named after the local player once `hasSkin` and `name` are set.
- `tools/probes/SkinParseProbe.java`, `tools/verify-skin-parse.mjs`, `public/research/skin-parse-reference.json`, `src/skins73-b73.test.js`.

## Evidence
- Executed: the unchanged ImageBufferDownload (`bmc.a(BufferedImage)`) headless on 13 images plus null (opaque, random alpha, hat edge cases at alpha 127/128/0, fully transparent, head transparent, alpha ramp, 64 x 64, 32 x 32, 96 x 48). Output is always 64 x 32 TYPE_INT_ARGB. The JS replay matches all 13 pixel for pixel. Finding: partial alpha colours move (e.g. alpha 1 colour 0x9902fe becomes 0xff00ff once forced opaque); the old port kept the colours.
- Bytecode-read: bmc area loops (x outer 0..x2, y inner), thresholds `alpha >> 24 & 255 < 128`, `& 0xffffff` / `| 0xff000000`.
- Item 3 (multiplayer): the account upload goes `skinCanvas` (cleanup) then `canvasPng`, and every client re-runs `skinCanvas` on each downloaded skin (`presence.js`), as native runs ImageBufferDownload per client. So the cleanup was already applied; only the arithmetic was off and is now exact. The server only checks 64 x 32 and size (native servers hold no skins), so a hand-made upload is cleaned by each viewer.
- Item 4 (Steve): no Alex or slim model in `src` or `server` (test scans source). Native default is Steve for every skinless player (recalled; Alex is 1.8).
- Recalled: first-person arm binds the player's skin (RenderPlayer.renderFirstPersonArm).

## Verification
- `node --test src/skins73-b73.test.js src/spcapes72-b72.test.js src/mpcapes-b71.test.js src/chat-options.test.js src/menu-screens.test.js src/hand-models.test.js src/accounts.test.js src/gui-screens.test.js`: 70 pass, 0 fail.
- `npm run build` ok. `node --check` on touched files ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Browser only: the file pickers, the button slot in Chat Settings, the texture on the body, arm and heads. The browser decodes through a canvas (premultiplied), so colours of partly transparent pixels can differ by a step from native before `userSkinPixels` applies the Java rounding; fixed by decoding the PNG bytes without a canvas (not done).
- Native draws any image size at 0,0 (`userSkinPixels` does too); the browser path still rejects sizes other than 64 x 32 and 64 x 64.
- Skin for other offline players or mobs named like players: none.
