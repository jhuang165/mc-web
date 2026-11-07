# Deaths track, batch 19

## Summary
- `src/combat-tracker.js` ports CombatTracker (`rn`) and CombatEntry (`rm`): entries, the 100/300-tick window, the fall description (ladder, vines, water, generic), `func_94550_c` (fighting entity), `CombatTracker.i()` (fall entry, distance above 5), the revenge target (`func_94060_bK`) and the `func_151521_b` message as `{ key, args }`, plus the DamageSource classification of `Survival.damage` calls (plain, mob, player, arrow, fireball, explosion, indirectMagic).
- `src/death-messages.js` formats the component through `translate`. `DEATH_TEXT` and the new `FELL_TEXT` are the full en_US `death.attack.*` and `death.fell.*` tables (pinned by test); `lang-hooks.js` overlays both. The item argument prints as `[Name]` (native). `main.js` `die()` prints `trackerMessage(survival.combat, ...)`.
- Hooks: `Survival.damage` records entries after the health update (`dealt != 0`) and sets the revenge target; `Survival.tick` expires it; `player-environment.js` samples the fall site and distance; `bow.js` passes `{ self: true }` for the player's own arrow (a 6th `via` parameter).
- Port behaviour changes: melee mob deaths, falls, drowning, burning, lava, cactus, lightning, wither and magic now print a message (they printed nothing); a fall of 5 blocks or less prints "hit the ground too hard"; `.player` forms follow the revenge target for 100 ticks.

## Native evidence
Probed (executed on unchanged classes, `tools/probes/CombatTrackerProbe.java`, `tools/verify-combat-tracker.mjs`, `public/research/combat-tracker-reference.json`, 360 records): entry creation and top-ups, the lethal-hit clearing of earlier entries (so `death.fell.assist/killer/finish` can only show in non-fatal previews), window lengths, fall distance threshold 5 and the fall suffixes, fighter selection (third rule, ties), `.player` through the revenge target and its 100-tick expiry (native `sv.C`), the `[Name]` item brackets, ownerless fireball (`onFire`) and ownerless arrow, own arrow.
Bytecode-read only: the 20-tick sweep, `ticksExisted` increment order, the dead branch of `rn.i()`, `death.fell.finish` unreachability, player `.item` text (probe's second player holds no visible item), thorns and thrown kinds (probe `thorns:*` printed `death.attack.mob`; overload unconfirmed), `fallingBlock`, ownerless `indirectMagic` (prints raw key `entity.ThrownPotion.name`).

## Tests
`src/combat-tracker.test.js` (4 tests) replays about 300 scenarios (every hit's accepted flag, entry count and preview text, plus the death message) through `Survival`; `src/death-messages.test.js` and `src/player-damage.test.js` updated (falls no longer null, `[Sting]`). `npm test` and `npm run build` results are in the final report. Regenerate with `MC_RESEARCH=<dir> node tools/verify-combat-tracker.mjs`. `PlayerDamageProbe.main` is now `init()` plus a thin main.

## Remaining gaps
- No PvP, so the attacking-player (`aR`) path is not modelled; no thorns damage to the player; `fallingBlock` is never produced.
- Tamed-wolf owner revenge, mob held-item names beyond `equipment[0].displayName`, and team-formatted attacker names are not modelled.
- Vehicle and ender-pearl falls do not sample the fall site or distance (they read "hit the ground too hard").
- Player `.item` text, thorns and thrown kinds, and ownerless `indirectMagic` are bytecode-read, not executed.

## Proposed remaining-gaps lines
- Death messages (CombatTracker): ported and probed against the unchanged classes (entries, windows, fall texts, fighter, revenge, `.player`, `.item` in brackets; [combat.md](combat.md#combat-tracker-and-death-messages)); remaining: PvP attacker, thorns and thrown damage to the player, falling blocks, tamed-wolf revenge, vehicle and pearl fall sites, player `.item` (bytecode-read).
