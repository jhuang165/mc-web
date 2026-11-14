# Batch 70 mpclicks: use-entity reach from posY, boats blocked by hanging entities, End arrows, mapData over a socket

## Summary
- `src/multiplayer/use-entity-reach.js` (new): `useEntityInReach(world, p, {x, y, z, eye})`. Squared distance from the player's posY (`serverPosY`, a sleeper is minY + 0.2) to the target's posY; under 36, and under 9 when the eyes cannot see each other (rayTraceBlocks from posY + 1.62 to the target's posY + its eye height).
- `src/multiplayer/server-mobs.js` (`attack`, `interact`) and `server-vehicles.js` (`act`): use it. Mobs: y = mob posY, eye = `livingEyeHeight`. Boats and carts: the box centre is posY (yOffset = height / 2), eye height 0. The dragon keeps `dragonReach`. Removed the old eye-to-centre `REACH_SQ`.
- `src/piston-push.js`: a pushed boat is now also blocked by paintings, item frames and leash knots (`hangBoxes`). Carts are not.
- `src/mpclicks-b70.test.js` (4 tests): reach, boat vs painting (and a cart passing), End arrow via `/summon`, `mapData` through a real socket.

## Evidence
- Bytecode-read: `nh.a(ja)` (processUseEntity): d = `mw.f(target)` = `sa.f(sa)` (fields s, t, u = posX, posY, posZ of both, no eye offset); limit 36.0, 9.0 when `sv.p(sa)` (canEntityBeSeen) is false; `sv.p` = `ahb.a(Vec(posX, posY + g(), posZ), Vec(target posX, posY + target.g(), posZ))` is null. Strict `<`. `sa.g()` (getEyeHeight) is the base 0.
- Bytecode-read: `ahb.a(sa, azt)` (getCollidingBoundingBoxes) adds, for each entity in the grown box, `other.J()` (getBoundingBox) and `mover.h(other)` (getCollisionBox). `xi.h(sa)` (EntityBoat) returns `other.C` (its boundingBox) with no canBeCollidedWith test; `xi.J()` returns its own box. `ss.R()` (EntityHanging.canBeCollidedWith) is true; the hanging entity has a real box. So gap 2 was right: a boat's move collides with hanging entities. `sa.h` default returns null, so a cart (needs canBePushed, false for hanging) is not blocked.
- Bytecode-read: `ayi.a(byte[])` (MapData.updateMPMapData) clears the decoration map and puts `"icon-" + i`; the S34 icon payload carries (type << 4 | rotation, x, z) only. The `frame-<id>` key (`ayi.a(yz, add)`) exists only on the server's MapData and `maps.js` already uses it.
- Executed (by test, not a Java probe): End `/summon Arrow` with `xTile/yTile/zTile` and `inGround`: the arrow keeps the shifted tile, stays stuck on the block at the local cell, and drops when that block is removed.

## Verification
- `node --test src/mpclicks-b70.test.js`: 4 pass. One at a time: `mpvehiclehits-b67` 8, `mpvehicles-b61` 10, `mpvehicles3-b63` 13, `mpmobs-b59` 10, `mpmobs2-b60` 7, `mpanimals-b61` 11, `mpfixes69-b69` 9, `pistons5-b68` 12, `piston-live` 193, `mpmaps-b69` 16, `mppaintings-b68` 12, `mpsleep2-b67` 5: all pass.
- The boat test fails with `hangBoxes` removed (checked). `node --check` on every touched file. `npm run build` passes. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Gap 4 (frame ids on the `mapData` wire) is found wrong: native sends none and the client keys `icon-<i>`; the port already matches, and the renderer reads decoration values only. Nothing changed.
- Hanging entities are only blocking boats in piston pushes. Players or other movers colliding with a hanging box are not an `EntityBoat` case and are unchanged.
- The vehicle posY is taken as the box centre; a boat or cart's exact `yOffset - ySize` terms were not modelled.
- `server-pvp.js` `inReach` still measures from `p.position.y` (no sleeper posY); it already uses feet-to-feet and eye-to-eye.
- Only a browser would show: clicking a boat from a bed edge, a boat jamming against a painting on a live piston.
