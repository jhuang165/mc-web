# Bosses b15 track (branch b15-bosses, from main 01887b4)

Owner: claude-b15-bosses.

Changed
- Dragon: projectiles (arrows, thrown balls, pearls, fireballs, skulls) hit the seven part boxes (`src/dragon-parts.js`, `mobTargets`, `aimPart`) and route through attackEntityFromPart; explosions test every part (`explosion-simulation.js`, probe `explosionParts`, 28 records); wing sound uses `wingFlapPitch` (native float/Random order, bytecode-read).
- Wither: `Potion.wither` ticks on all non-player mobs (`mob-effects.js`), skull on mobs by difficulty and shooter heal probed (`WitherBossProbe` skullMob, witherDot), target order via `nativeOrder` with undead excluded, head particles added (bytecode-read).
- Shared-file edits kept small: `entities.js` (one tickMobEffects call), `projectiles.js`, `bow.js`, `fireballs.js`.

Evidence: dragon-reference.json (197 records), wither-boss-reference.json regenerated.

Remaining: ModelDragon geometry/hurt pass not replayed; dragon projectile part sweep order not probed; target order and head particles not replayed from Java; spawn snow is a native server no-op; no browser check done. Not full parity.
