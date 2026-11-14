# Batch 64 entityprobes: stale gaps and player-drop flight

## Summary
- Gaps 1, 2, 3 and 4 of the brief were already closed by earlier batches; the list was stale. Nothing new was needed for them (evidence below).
- Gap 5 (spawned entities in flight): orbs, chicks and potions were already recorded per tick after spawn. Player-dropped items were not. New executed probe `tools/probes/EntityFlightProbe.java`, driver `tools/verify-entity-flight.mjs`, reference `public/research/entity-flight-reference.json` (17 records, 30-40 ticks each), replay `src/entityprobes-b64.test.js`.
- Port fix in `src/item-entities.js` `dropPlayer` (EntityPlayer.func_146097_a): the thrown direction uses the MathHelper sine table, the random kick uses `Math.sin/cos` with float draws, the scatter uses the table with float products and motionY 0.20000000298023224, and the spawn y is `posY - 0.30000001192092896 + 1.6200000047683716` (was exactly +1.32). `src/item-entities.test.js` got two exact-value updates.

## Evidence
- Executed: EntityFlightProbe runs the unchanged `yz.a(add, boolean, boolean)` on a player shell with `Random(seed)`, then walks the unchanged EntityItem. 17 records replay with 1e-9 tolerance (7 views thrown, 7 scattered, two wall hits, one floor-level drop). Before the fix every record failed at the spawn y, then at the motion.
- Gap 1 (egg hatch, exp-bottle orbs on a cart, boat or painting): executed in batch 47, `pthrow-egg-*-hatch`, `pthrow-expbottle-*` in `entity-list-reference.json`, replayed in `entity-list.test.js`.
- Gap 2 (pearl by a real EntityPlayerMP at a cart): executed in batch 47, `pthrow-pearl-mp-cart/boat/painting`.
- Gap 3 (piston pushes a mob): executed earlier. PistonLiveProbe has real EntityPig, cart and boat pushes (`live-pig-*` in `piston-live-reference.json`, TileEntityPiston offsets and motions), and `b48pp` (25) and `b49po` (12) EndermanWolf records push mobs with full updates.
- Gap 4 (`cart-cow-mount-ba`): fixed and replayed in batch 47 (`awaythrows-b47-track.md`).
- Bytecode-read: `func_146097_a` order of draws and the sin/cos split (javap of `yz`).
- Not probed: orb spawn motion (constructor uses Math.random, unseedable), block-drop spawns from an explosion, a witch's own potion launch in flight.

## Verification
- `node --test src/entityprobes-b64.test.js`: 18 pass.
- The 34 test files that import `ItemEntities` or call `dropPlayer`: 503 pass, 0 fail.
- Probe regenerated with `MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-entity-flight.mjs`.
- `npm run build`: see the final report. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Remove the five gap lines (egg/bottle/pearl-mp, piston mob, `cart-cow-mount-ba`, in-flight records) from `remaining-gaps.md`; the lead edits it.
- The server's drop (`multiplayer.dropHeld`) may use its own drop code; not checked against this record.
- Only a browser would show the drop's visible arc; the numbers are equal to native.
