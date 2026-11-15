# Batch 74 mpcombat74: server sprint knockback and attacker slowdown, live crit target

## Summary
- `src/multiplayer/server-mobs.js attack`: passes `p.motion.sprinting ? 1 : 0` as extra knockback (was 0), then `attackerSlowdown` after a landed hit; the crit event carries the mob wire id.
- `src/multiplayer/server-attack-slowdown.js` (new): attacker velocity x/z * 0.6 and sprint off when `info.knockback > 0` (Knockback enchantment + sprint), the same lines `server-pvp.js` already had.
- `server-pvp.js`: only adds the victim id to the crit event. PvP already had the sprint push and slowdown (found already done).
- `server-crit-fx.js`: events carry `i` (mob wire id) or `pl` (player id). `client-crit-fx.js`: `applyCritFx(message, fx, live)` resolves the live mob or player copy on each of the 3 steps, falling back to the packet snapshot. `main.js`: one line passes the resolvers (`remoteMobs.copies` plus `factory.fxTarget`, `remotePlayers.entries.get(id).state`).
- Test: `src/mpcombat74-b74.test.js`.

## Evidence
- Recalled / code-read from the port (no new probe): native knockback and slowdown live in `attackTargetEntityWithCurrentItem` behind the landed hit, which is false on a client world, so the slowdown only happens on the server's player copy; the server copy's sprint flag is what `movePlayer` reads. The client's own motion stays authoritative (not changed). EntityCrit2FX tracking the live entity: from the b73 bytecode note.
- Mob-versus-player Knockback enchantment: already in `entities.js hitPlayer` (`mobKnockbackKick`, queued velocity), and the server drains it in `server-mobs.js knock`. Found already working; no change.

## Verification
- `node --test src/mpcombat74-b74.test.js` 4/4; with particles73-b73, pvp-b63, mpmobs-b59, mpmobs2-b60: 37 pass, 0 fail. `node --check` on touched files. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Whether the real client's sprint flag is cleared by the server's metadata (native sends the flag to the client) is not modelled; only a browser session could show a sprinting attacker slowing.
- Remote player crit follow uses motion 0 (no velocity on the player wire).
