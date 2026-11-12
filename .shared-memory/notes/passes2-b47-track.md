# passes2 batch 47 track (branch batch47-passes2, from 3250e20f5)

## Summary
- Thrown potions (bytecode-read bod/RenderSnowball): overlay pass tinted by the liquid colour, then the white bottle (splash bit 16384); `projectile-renderer.js`.
- Mob-held items (bytecode-read bnw/bpb): `held-sprite.js` draws two-pass items (eggs, potions) for mobs; baby biped held frame translate(0,.625,0), rotate -20 about -X, scale .5 (`followChildHeld`).
- Witch (executed record bik.f in witch-reference.json for nose point [0,-2,0]; bytecode-read for held potion at the nose): nose pivot fixed, nose offsets now raw blocks (were /16), held potion uses heldItemMatrix origin "nose".
- Sword blocking (bytecode-read bly EnumAction.block, heldItemRight 3): first-person pose and third-person pose driven by a pose-only use state `{ticks:72000, block:true}`. Slowdown and halved damage are NOT ported.
- Item-frame compass: kept own canvas (drawCompassCell); pixels equal the native shared-cell upload (bytecode-read bnx/bqm). Not changed.
- DOM icons (bytecode-read RenderItem.renderItemIntoGUI): spawn egg and potion `.tinted-item` layers (base multiplied by tint, masked by base alpha, overlay stacked) equal the native two coloured alpha-blended passes. No mismatch found, no change.

## Verification
- `node --test src/creeperwitch-b45.test.js src/first-person-pose.test.js src/hanging.test.js src/held-pose.test.js src/item-passes.test.js src/mob-equipment.test.js src/player-edit-simulation.test.js src/player-item-use.test.js src/player-renderer.test.js src/projectiles.test.js src/witch.test.js`: 201 pass, 0 fail.
- `node --test src/passes2-b47.test.js`: 5 pass.
- `npm run build`: ok. No full `npm test`, no browser check, no new executed probe records (all new findings are bytecode-read except the witch nose point).

## Follow-ups (proposed gap lines)
- Sword blocking lacks the movement slowdown and the halved incoming damage (EntityPlayer.isBlocking).
- Item-frame compass: native extra updateAnimation easing on the shared cell is not modelled.
- Add a HeldPoseProbe executed record for first-person blocking and the witch held potion.
- Potion/egg held-in-hand visuals not verified in a browser.
