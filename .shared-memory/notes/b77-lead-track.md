# Batch 77 lead: merges, joins and release 0.106.0

## Merged (git log --first-parent on batch77-lead)
- mpvelocity77, mphorseclient77, spdispense77, mpknots77, mphorserules77, fallingblock77, spcauldron77, mpperf77, spsounds77, worldflags77.
- Conflicts joined:
  - `src/main.js` multiplayer tick line (mphorseclient77's `MpHorseRider.tick` and mpvelocity77's `remotePlayers.followMounts()`): both kept.
  - `src/main.js` multiplayer right click (mphorseclient77's `predictAnimalUse(..., { selfId, sneak })` and mpknots77's cauldron no-use rule): both kept.
  - `src/multiplayer/server-horses.js` `input` (mphorseclient77's wire-jump return and `wasJump`, mphorserules77's pitch copy): the pitch copy runs first, then the wire-jump return.
  - `src/player-edit-simulation.js` eat/block lines: spcauldron77's general `!usesBlock` (bytecode table) replaces mpknots77's cauldron-only checks; `player-edit-simulation.test.js` keeps mpknots77's stricter level-0 cauldron armour assertion (passes).
  - `src/multiplayer/simulation.js`: mpvelocity77's `velocityField` in the player row and worldflags77's `hardcore` snapshot field, both kept.
- Overlap tests after each join: horse/velocity 32/32 and 42/42, falling 25/25, player-edit/cauldron/knots/useorder 61/61, sounds/worldflags/gui/tabcomplete/velocity 74/74.

## Lead checks
- spcauldron77's swing change contradicts the brief: Minecraft.rightClickMouse (`bao.am`) does not swing on the entity branch; the track followed the bytecode. Kept.
- spcauldron77 lets a swallowed click still reach block placement: the client sends C08 regardless and the server's `activateBlockOrUseItem` places when its own `onBlockActivated` declines (fence without leashed mobs). Only the client-side `useItemRightClick` is skipped. Consistent with native.
- mpperf77's villager box-first: native `selectEntitiesWithinAABB` tests the box before the selector's `canSee`, so the old order was the port's own; state hashes identical.

## Verification
One full `npm test` on 6163bcc04: 8825 tests, 8825 pass. `npm run build` ok; bridge tests ok. No browser checks (by request).

## Browser-only (not verified)
Horse jump bar and hearts, the horse window, remote rider seats, owner knockback motion, dispensed armour on mobs, the hardcore hearts on a server, the LAN row order.

## Open
See "Still open from batch 77" in `public/research/remaining-gaps.md` and the ten `*-b77-track.md` notes.
