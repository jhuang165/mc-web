# entnbt96 (batch 96) track note

## Summary
- `tools/probes/Entnbt96Probe.java`, `tools/verify-entnbt96.mjs`, `public/research/entnbt96-reference.json` (134 player rows, 46 potion rows): real EntityPlayerMP probe for effects, Motion, AttackTime, sleeping.
- `src/player-nbt.js`: `savedAttributeModifiers` (real potion modifiers, HashSet bucket order), `loadedMotion`, `savedMotion`.
- `src/region-export.js`: writes potion Modifiers for session effects (empty list only for sprint), exports server-copy Motion, awake SleepTimer.
- `src/status-effects.js`, `src/survival.js`: a `bare` effect (loaded from NBT without modifiers) gives no speed, strength or Health Boost until added again.
- `src/level-dat.js`: marks effects bare unless Attributes hold the potion modifier; imports Motion with the native 10.0 limit; awake SleepTimer kept, sleeper loads with 0.
- `src/region-import.js`, `src/bed.js`: carry the awake timer (100..109 after a wake) and motion into the launch record.
- `src/main.js` (2 lines, code-read only): save and restore `playerState.motion` from `mobs.ai.player.motion`.
- `src/entnbt96-b96.test.js`: 8 tests.

## Evidence
- Executed: loaded Speed stays 0.1 for the whole effect; session Speed is 0.14 (Modifiers `potion.moveSpeed 1`, 0.4, op 2); same for Strength and Health Boost; re-adding a loaded effect applies the modifier; all 46 potion modifier rows and combo ordering with held item and sprint; Motion kept up to 10 per component (above it that component is 0, NaN kept); AttackTime counts down; wakeUpPlayer(false) writes 100, wakeUpPlayer(true) writes 0; a Sleeping 1b load wakes at once with timer 0; knockback motion persists on the server player.
- Bytecode-read: players never set AttackTime; awake counting of SleepTimer in `yz.h`.
- Port-read: `main.js` save/launch lines; client-side effects of bare effects.

## Verification
- `node --test --test-concurrency=2 src/entnbt96-b96.test.js`: 8 pass, 0 fail.
- Fails without the fix: checked once with the seven src files reverted (the test file fails to load, 0 pass).
- Related set of 26 files (entnbt88-96, bed, level-dat, region-export/import, status-effects, mpsleep, spcopy, attributes2, mob-effects, offline87, others): 189 tests, 189 pass.
- `npm run build` once: ok. No browser checks. No old tests edited.

## Found wrong in the batch 95 list
- Lead suspicion confirmed in part: export wrote empty `Modifiers` for session effects (now real). Native never applies modifiers on load, so a loaded effect was wrongly active in the port.
- Sleeping-load import was already correct (wakes at once, timer 0).
- Player AttackTime export of 0 is native-consistent; no port state exists.

## Follow-ups
- NaN Motion is kept natively, 0 in the port. A negative awake SleepTimer is not imported.
- Browser-only unchecked: bare effect feel, knockback motion restore after reload.
