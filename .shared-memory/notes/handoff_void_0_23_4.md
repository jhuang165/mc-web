# 0.23.4 reachable void (2026-11-01)

- `World.get` returns 0 (air) below y 0, matching World.getBlock; `World.put` accepts the y 0 layer. Survival bedrock is still refused by main.js mining; Creative may break the floor (the "except the world floor" guard is gone).
- main.js: no safety teleport below y 1 (the high one above height+40 stays, a port limit); `die()` runs for Creative too (only the void hurts Creative); respawn keeps `survival.mode`.
- entities.js: mobs take `hazard(e, 4, "outOfWorld")` under y −64 in Entity.onEntityUpdate order (after fire, before inWall); the old instant death at y < 0 is gone; saves load mobs down to −64.
- world.js `spawn()` (Java branch) needs solid ground under the cell, so a spawn column dug through the floor is skipped.
- Lighting already clamps y < 0 to y 0 (as getSkyBlockTypeBrightness); y 0 bottom faces now mesh, as natively.

Tests: npm test 732/732, build OK; new tests in entities.test.js (mob void), world.test.js (floor edit, void spawn), world-chunks.test.js updated. Live check on localhost:5179 with AudioContext blocked in the tab: Creative fell through a dug floor, 4 damage per 10 ticks from y −65, death at −182, "Player fell out of the world", respawn Creative on solid ground. Temp world deleted afterwards.

Open: void fog/sky darkening below y 0 is not ported; Survival can reach the void only through an existing hole; fluids/falling blocks into a floor hole are not separately checked.
