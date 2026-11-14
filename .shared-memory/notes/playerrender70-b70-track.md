# Batch 70 playerrender70: player cape and deadmau5 ears

## Summary
- `src/cape.js` (new): cape and ears maths: chasing position step, cameraYaw and walked-distance steps, `capeAngles` (RenderPlayer's three rotations), `earTransform`, visibility rules, box constants.
- `src/player-renderer.js`: `PlayerBody.cape` state (ticked in `tick`, optional `motion` for the locally simulated player); `PlayerRenderer` builds two ear meshes (skin material) and a cloak group; `setCape(texture)` adds the cloak; `update` places ears and cloak (`name`, `hasSkin`, `hideCape` options).
- `src/multiplayer/presence.js`: `applySkin` sets `renderer.hasSkin`; remote renderers get `name`; `p.hideCape` is honoured if the wire ever carries it.
- `src/main.js` (small hooks): `motion` passed to the two local `playerBody.tick` calls; `playerRenderer.name = self.name`.
- Probe: `tools/probes/CapeChaseProbe.java`, `tools/verify-cape.mjs` -> `public/research/cape-reference.json`; test `src/cape-b70.test.js`. Doc `public/research/cape-ears.md`; Show Cape catalogue row and texts updated (settings catalogue regenerated).

## Evidence
- Executed: the unchanged EntityPlayerSP run through the real `EntityPlayer.onUpdate`: chasing position (including the >10 snaps in each axis and sign), cameraYaw and distanceWalkedModified over a walking run. The test replays them exactly.
- Bytecode-read: RenderPlayer.renderSpecials ears and cape (angles, translations, scale, conditions), ModelBiped cloak and ears boxes, `blg.n()/o()`, `getHideCape` (metadata 16 bit 1, set by EntityPlayerMP from `!showCape` in C15), EntityOtherPlayerMP (no moveEntity, motion 0, so cameraYaw 0 and walked 0 for remote players), Entity.moveEntity's `* 0.6` walked step.
- Not executed: RenderPlayer itself (draws through GL). The test cross-checks `capeAngles` against an independent double-precision version of the bytecode formulas, not against the original renderer.
- Recalled/approximated: for the local player the port feeds `velocity` (single player: the motion vector; multiplayer: position delta) as motion; the sneak-on-ground freeze of the walked distance uses `walkFrozen`.

## Verification
- `node --test src/cape-b70.test.js` 5 pass; `src/player-renderer.test.js src/mpinvis-b65.test.js src/mpeating-b58.test.js src/mp-dig-b57.test.js src/babyrender-b64.test.js src/heldrender-b63.test.js src/models.test.js src/player-throw-replay.test.js` plus the cape test: 91 pass; `src/catalogue-consistency.test.js src/content-catalogue.test.js src/chat-options.test.js src/menu-screens.test.js`: 19 pass.
- Full npm test not run (batch rule). No browser check (rule); only a browser would show the cloak and ears drawing correctly (orientation, mirrored UVs, z-fighting).

## Follow-ups
- No cape source: accounts carry skins only. Needs a cape upload (server/accounts.js, simulation wire `cape` hash, account-api, profile screen) and a `hideCape` wire flag from the client's Show Cape setting; then enable the Show Cape button. `PlayerRenderer.setCape(texture)` is ready.
- Ears need a loaded skin texture; the local player's own skin is applied through `applySkin` in multiplayer only.
