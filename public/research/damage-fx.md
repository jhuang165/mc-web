# Damage effects, sounds and falling (0.42.0)

Evidence: `tools/probes/DamageFxProbe.java` + `tools/verify-damage-fx.mjs` -> `damage-fx-reference.json`, replayed by `src/damage-fx.test.js`.
Not full parity; the list below separates what is checked against the 1.7.10 bytecode from what is approximated.

## Native-verified (probe or bytecode sequence)
- Camera hurt roll `-sin(((hurtTime-p)/10)^4*PI)*14` through the MathHelper sin table, and the death roll `40 - 8000/(deathTime+p+200)`. The client never has an attack yaw, so the tilt is a pure roll (no direction).
- Fall points: `ceil(distance - 3 - (jump boost level))`; fall sound `game.{player|hostile|neutral}.hurt.fall.{big if >4|small}` at 1/1, then the landing block's step sound at volume*0.5, pitch*0.75 (none over air).
- Client status 2/3 hurt/die sound pitch `(r-r)*0.2+1`, no child bonus. Mobs therefore play it in addition to the server's own sound (two hurt sounds on a fresh hit); the player gets only the client one.
- Heart row: white blink container while `hurtResistantTime/3 %2 == 1 && >= 10`, low-health jiggle (health <= 4), Regeneration wave, Poison/Wither textures, Absorption hearts, hardcore row, hunger shake at saturation 0, Hunger-effect food texture, armour row lift when there are extra heart rows.
- Landing dust (event 2006) already matched.

## Approximated or not covered
- The client's `hurtResistantTime` is emulated from health changes (20 on a drop, 10 on a rise); the real one arrives with server packets.
- "Previous health" ghost hearts are never drawn: the client never sets prevHealth, so this follows 1.7.10 by omission.
- Mob red overlay, death tip-over and death particles were inspected and left as they were; they were not re-verified against the bytecode.
- Third-person tilt was not changed.
- The modern red screen vignette (`#damage-flash`) was removed; 1.7.10 has none.
- Browser check: hearts render and blink on a hit with no console errors (sound off with `?silent`); the camera roll and sounds are covered only by unit tests.
