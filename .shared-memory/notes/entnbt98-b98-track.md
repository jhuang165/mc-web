# entnbt98 (batch 98): generic entity NBT, player XP, NaN food/health, ability speeds

## Summary
- `tools/probes/Entnbt98Probe.java` (generic entities: 20 ids x 48 Fire/Air/PortalCooldown/Invulnerable/Dimension tags, written and after an `sg.a` reload) and `Entnbt98PlayerProbe.java` (exhaustion/saturation NaN and infinity rows) feed `tools/verify-entnbt98.mjs` -> `public/research/entnbt98-reference.json` (960 entity rows, 5 player rows). Item 1: every id matched except one real gap, fixed below.
- `src/entity-base-nbt.js`, `src/region-export.js`: `Invulnerable` now survives the projectile import, the browser save (`keptBaseSave/Restore`) and the export of arrows, throwables, eyes and rockets (it was lost for every projectile; boats, carts, TNT, orbs, mobs and falling blocks were already right).
- `src/experience.js`: XpLevel (any int), XpP (any float incl. negative, above 1, NaN, infinity; infinity/NaN saved as JSON strings) and XpTotal (any int, negative too) are kept as loaded and written back; `add` no longer clamps the total at 1e6 (int wrap like native), a NaN bar stays NaN and an over-1 bar levels up with a 1e6 loop guard.
- `src/survival.js`, `src/player-nbt.js` (`rawFloat`, `jsonFloat`), `src/region-export.js`: NaN health (HealF NaN, Health written 0s via `|0`), NaN/infinite saturation and exhaustion are kept, saved as JSON strings and exported.
- `src/player-movement.js`, `src/player-physics.js`, `src/main.js` (one import edit and one line, code-read only): `setAbilitySpeeds(record.abilitySpeeds)`; loaded walkSpeed scales ground acceleration and the sprint/Speed products, flySpeed replaces the 0.05 flying acceleration. FOV ratio is movement speed over walkSpeed, so it is unchanged (1.15 sprinting).
- `src/world-import.js`: `playerState` and `abilitySpeeds` added to RUNTIME_FIELDS with sanitizers. Found wrong: `importBlockworldData` (used by both the Blockworld JSON and the Java folder import) filtered the record through that whitelist, so the batch 96/97 loaded Motion and the batch 97 fly/walk speeds never reached a launched world.
- Test `src/entnbt98-b98.test.js` (24 tests).

## Evidence
- Executed: 960 entity rows (Zombie, Cow, Creeper, Pig, Skeleton, Boat, MinecartRideable, MinecartChest, PrimedTnt, FallingSand, Arrow, XPOrb, Snowball, ThrownEnderpearl, ThrownExpBottle, ThrownPotion, EyeOfEnderSignal, FireworksRocketEntity, ItemFrame, Painting): Fire/Air are `getShort` of any numeric tag (int 70000 -> 4464, 5.7f -> 5, byte ok, string -> 0), Invulnerable `getBoolean` = low byte != 0 (256 -> 0, 2b/-1b -> 1, 0.5f -> 0), Dimension and PortalCooldown `getInteger` (long 5L -> 5, float truncates, string 0), all identical on every id and unchanged by the reload. Saved values of the executed player edits: XpP/XpLevel/XpTotal raw (entnbt97 rows), HealF NaN -> `HealF=NaNf;Health=0s`, saturation/exhaustion NaN and +-infinity kept, HealF -infinity reads 0.
- Bytecode-read: `yz.e` (EntityPlayer.onLivingUpdate) sets the movementSpeed base from `yw.b()` (walkSpeed) every tick on the server (`ahb.E` false); `yz` flying move uses `yw.a()` (flySpeed).
- Port-read: `importBlockworldData` (main.js) and `importedRuntime`; `region-import.js` sets `playerState` and `abilitySpeeds`.
- Not executed: ticking the mobs (the probe world has no provider, NPE), hanging entities with the summon probe (need a wall tile; entnbt88/92 cover them).

## Verification
- `node --test --test-concurrency=2 src/entnbt98-b98.test.js`: 24 pass, 0 fail.
- Fails-without-the-fix: checked with the eight changed src files reverted: the test file does not load (missing exports), 0 pass.
- Related run: `node --test --test-concurrency=2` over the 167 test files importing the edited modules (excluding entnbt98): 1896 tests, 1896 pass, 0 fail. `src/entnbt98-b98.test.js`: 24 pass.
- `npm run build`: ok (run once, built in 6.1 s).

## Found wrong in the batch 97 list
- Batch 97 "playerState is not in the whitelist" confirmed as a real loss, not a format note: Motion and ability speeds were dropped on every real import.
- Generic entity Fire, Air, PortalCooldown, Invulnerable and Dimension: already native except projectile Invulnerable.

## Follow-ups
- Deliberate divergences: a non-finite walkSpeed/flySpeed is ignored (native NaN would poison the position); an infinite HealF now clamps like native (-inf 0, +inf the maximum); the port's saturation of -infinity or NaN follows Java's comparisons but the dedicated server was not checked.
- F3 still prints the default 0.1/0.05 speeds (`main.js` passes constants); the XP bar width with a NaN or negative XpP is not clamped in `main.js` (browser-only, not viewed).
- Not browser-checked: movement feel at changed speeds, the XP HUD at level -3 or 2147483647.
