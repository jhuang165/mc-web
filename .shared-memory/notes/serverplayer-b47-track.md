# Batch 47 serverplayer track

Branch `batch47-serverplayer` (from 3250e20f5, release 0.75.0).

## Summary

- executed (new set `b47sp`, 19 records, `public/research/enderman-wolf-b47sp-reference.json`, probe ops `fly`/`ground`, the client position runs the C03 rule and the copy runs `mw.i`):
  block collision, sneak edge clamp, water/lava/web/ladder friction, flying x0.6, copy position/motion every tick. All 19 replay exactly (`src/serverplayer-b47.test.js`).
- bytecode-read: `NetHandlerPlayServer.processPlayer` puts the copy back after `mw.i` and then sets the client position on a moving packet, so the copy's moved position is discarded. Only motion, collision effects, the web flag and pushes persist. The copy rests at the last sent client position; the client sends when the squared move > 9.0E-4 or on the 21st call (`src/ai.js` PlayerView.update).
- bytecode-read, ported: `entities.js serverPlayerUpdate` moves a temp body through `moveEntityWithHeading` (stepHeight 0), revenge target clears on a dead/absent attacker or after 100 ticks (behaviour change vs b46).
- Pushes routed to `mobs.ai.player.motion`: dragon wing sweep (`living-simulation.js drainMobEvents`), cart and boat `pushEntity` (`structure-simulation.js pushAndDrain`). Unit tests cover both.
- Piston push: not routed. Entity.moveEntity on the copy would only zero motion on blocked axes at the copy's rest position, and the next C03 packet resets the position; no executed record. Left as a gap.
- Item 3 (mob copy velocity from the client's mob.applyEntityCollision(player)): bytecode-read, Entity.applyEntityCollision changes only `this`, so the client player's collide only gives the client-side mob copy a velocity. The server's mob is authoritative and its position packets overwrite the copy within a tick, so it is not visibly modelled. Not executed.
- b46mp replay: two replay-only hacks (`hurtByTime = clock + 1`, `sent = null`) because that older harness left ticksExisted 0 and y unrestored; b46mp/b45/b45cw/b44 dumps are unchanged.

## Verification

- `node --test src/serverplayer-b47.test.js`: 22 pass.
- Targeted set (mobpush, enderman-wolf, knockback, explosion, piston, minecart/carts/boats, witch, living-simulation, structure, entities, ai, dragon, survival, player-throws, legacy-ai, creeperwitch) via `ls ... | xargs node --test`: 905 tests, 905 pass, 0 fail.
- `npm run build`: ok. No full `npm test`, no browser run.

## Follow-ups (proposed gap lines)

- Server player copy: piston push motion zeroing, riding copy physics, elytra-less flying edge cases, and the mob client-copy velocity are not modelled.
- b46mp harness should be regenerated with ticksExisted and y restore so the replay hacks can go.
- Merge hotspot: `tools/verify-endermanwolf.mjs` record-count chain and the names-map condition (line ~68).
