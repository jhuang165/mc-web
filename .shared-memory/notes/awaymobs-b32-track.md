# awaymobs b32 track

## Summary
- Away run (Overworld spawn area while the player is in the Nether/End) now ticks mobs (no player, `ai.player.absent`, never despawn), arrows, thrown projectiles/potions, rockets, fireballs, hanging entities and carts (rideable, chest, furnace, TNT, spawner, hopper) for the 1200-tick gate. TNT explosions damage mobs, arrows, projectiles and hanging.
- Dispensers shoot arrow, egg, snowball, potion, fire charge, firework in the run. Fixed a live bug: redstone-runtime.js never forwarded fireball/firework to the dispense host.
- Files: src/ai.js (one guard line), src/main.js (difficulty host fn), src/away-plan.js, src/away-entities.js, src/away-world.js, src/dimension-live.js, src/redstone-runtime.js, src/away-mobs.test.js (new, 8 tests), src/away-entities.test.js.
- Native evidence: despawnEntity (sw.w) bytecode-read with javap, not executed.

## Verification
- npm test: 4879 tests; one failure on the first run (silverfish flaky, known baseline); a rerun reported no `not ok`. npm run build: ok.
- Browser check (cow/zombie pit, arrow dispenser, item frame): NOT run in this track.

## Follow-ups (proposed gap lines)
- Command blocks do not run while away (need a headless command host and a no-player selector).
- Ender pearls and ridden vehicles stay frozen in the away run; light is open-sky approximate with no block light.
- No probe confirms the 1200 counter (bytecode-read only).
- Not tested: spawner/hopper cart behaviour, TNT breaking a hanging entity, potion/fireball in flight.
