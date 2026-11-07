# deaths2 (batch 20): death messages and damage sources, round 2

## Summary
Closed the five open items of the combat tracker. Thorns (both directions), falling blocks, tamed wolves, vehicle and pearl fall sites, and `.item` texts are now probed natively and ported. Never claim full parity.
- Thorns: the batch 19 `thorns:*` rows printed `death.attack.mob` only because the probe called `ro.a(sv)` (causeMobDamage). The real overload is `ro.a((sa) who)`; the text is `death.attack.thorns`. A mob's Thorns now hurt the player when the player hits it (`src/thorns-live.js`, hook in `entities.js attack()`); wolves, slimes, magma cubes, iron golems, ocelots and snow golems never trigger Thorns.
- Falling blocks: `src/falling-damage.js`, `falling.js` landing damage, `HurtEntities`/`FallHurtAmount`/`FallHurtMax` NBT, `survival.anvilDamage(amount, kind)`.
- Wolves: `Survival.damage` reports living attackers (`onRevenge`, wired in `ai.js`), so owners' wolves react to arrows, fireballs and thorns.
- Vehicle falls sample the cell under the rider and the rider's own fall distance (`vehicle-simulation.js`).

## Native evidence
Probed (executed on the unchanged 1.7.10 classes by `tools/probes/CombatTrackerProbe.java`, 532 records in `public/research/combat-tracker-reference.json`; output dir `deaths2-probe` under the research folder):
- thorns text and sources, no `.item` for thorns or mob, `.item` for player/arrow/fireball, renamed held player item, ownerless `thrown`/`indirectMagic` raw key `entity.ThrownPotion.name`, wolf, tamed wolf and custom names, ender pearl fall 0, rider own fall distance (R op), `EntityFallingBlock.fall` damage, caps, anvil vs fallingBlock source and the helmet rule.
Bytecode-read only: the three callers of EnchantmentHelper Thorns visitor (`yg.n`, `zc.h`, `yz.r`), `sv.ak` slot lists, that thorns damage is magic-flagged but not armour-bypassing, mob classes overriding `attackEntityAsMob`, the only writers of `Entity.fallDistance` (`C`, `a(double,boolean)`, `N`, `as`), native `damageItem` leaving a zero-size stack. Thorns durability cost is 3 on a hit and 1 on a miss (the brief's "2 or 3" was wrong).

## Tests
`npm test` 4059 pass, `npm run build` ok. `src/combat-tracker.test.js` replays the whole matrix (>= 400 replayable); `src/falling-damage.test.js` (6 tests) replays the fallingBlock records and covers landing damage, mob thorns, the revenge hook, vehicle fall sampling and `EntityWorld.attack` against a Thorns zombie.

## Remaining gaps
- No PvP, so a player attacker's held-item thorns on another player is not modelled.
- Thorns wear on mob equipment ignores Unbreaking and removes a broken stack instead of leaving the zero-size one.
- A helmet that breaks on the same anvil hit: native keeps its armour point for that hit, the port removes it first (at most 8 replay records skipped).
- Whether the rider's own `fallDistance` accrues while mounted is bytecode-read, not run in the live port.
- The `thrown` source and ownerless `indirectMagic` are reachable only via explicit sources (0 damage in game).
- Team-formatted names are not modelled.

## Proposed remaining-gaps lines
- Death messages: thorns, falling block, wolf, pearl and rider falls and `.item` texts are probed natively; open: PvP, Thorns wear with Unbreaking and the zero-size stack, broken-helmet anvil hit, team-formatted names.
