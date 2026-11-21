# mobpackets90 (batch 90) track

Branch `batch90-mobpackets90` (from 0.118.0, 1d51974cf). Scope: items 1-4 of the mob-packet leftovers from batch 89. Items 5 (ambient) and 6 (mid-pass spawns) were not done. This is not full parity.

## Summary

1. **Re-added effect, no-op S20.** `addMobEffect` (src/mob-effects.js) counts each add of Speed (1), Slowness (2) and Health Boost (21) in `e.attrBumps[attribute]`. `SharedEntry.sendAttributes` (src/multiplayer/server-mob-entries.js) sends a row again when its bump count moved since the last gated pass, even if base, modifiers and value are unchanged. Regeneration and other effects without a watched modifier send nothing.
2. **S20 row order: left as is (premise wrong, see below).**
3. **Head S19 order.** src/entity-tracker.js `sendLocation` now holds the head packet and sends it after the S1C diffs and a new `sendAttributes()` hook (no-op in the base, S20 in `SharedEntry`), inside the gated branch, then the S12 of `velocityChanged`. The `SharedEntry.sendLocation` override is deleted (the base order now does its job). Native order in the gated branch: position, S1C, S20, head S19, S12.
4. **Wither movementSpeed.** `WITHER.speed` is `Math.fround(0.6)` (src/wither-rules.js), so the attribute and the S20 row carry 0.6000000238418579. The same constant feeds `ENTITY_TYPES.wither.movement`.

## Evidence

- **Bytecode-read:** `xc.aD()` sets movementSpeed with `ldc2_w 0.6000000238418579d`. `my.a(List)` calls private `my.b()` (S1C then S20 of `tq.b()`, then clear) at 974 and 1188; the head test (`ht`) starts at 1200; the velocityChanged S12 (`hy`) at 1277.
- **Bytecode-read:** `tq.d` is a `HashSet` of `tn` (ModifiableAttributeInstance) objects, and `tn` has no `hashCode` or `equals`. `tq.c()` (the spawn S20) also builds a HashSet of `tn`. The iteration order is therefore identity-hash order and differs between JVM runs.
- **Bytecode-read:** `in` (S1D) writes int, byte, byte, short only.
- **Executed (b89, public/research/mobpackets89-reference.json):** re-adding the same Speed dirties movementSpeed again.
- **Port-read:** the tracker's gated branch.

## Verification

- `node --test --test-concurrency=2 src/mobpackets90-b90.test.js`: 3 pass, 0 fail. With the four source files stashed: 3 fail.
- Neighbours: 75 files (every test naming entity-tracker, server-mob-entries, mob-effects, wither-rules, SharedMobTracker, mobpackets, mobPackets or addMobEffect), `--test-concurrency=2`: 917 pass, 0 fail.
- `npm run build` not run (no import changes beyond existing modules). No browser checks.

## Found wrong in the batch 89 list

- **S20 rows follow String.hashCode bucket order: wrong.** The set holds attribute instances (identity hash), not names. Native row order is not deterministic, so the port's fixed order is as valid as any. Nothing to match.
- **"Ambient byte in S1D": wrong for 1.7.10.** S1D has no ambient field. Ambient reaches clients only as data watcher index 8 (S1C), which copy-meta does not carry yet (still open).

## Follow-ups

- Ambient watcher 8 on copies (copy-meta.js).
- Mid-pass spawns other than skeleton arrows (dispenser, egg, other mobs) still first update a tick late.
- The knockback S12 in my probe test could not be exercised after the head (the port sends it from another path first); the order is by code reading only.
