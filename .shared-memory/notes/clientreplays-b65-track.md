# Batch 65 clientreplays: old client-copy gaps (dragon search, fishing line, Java 7 effect order, client mob push)

## Summary
- `src/fishing-line.js` (new): RenderFish's line tip and 17-point curve in the bytecode's float/double order, with MathHelper's sin/cos table. `src/fishing-renderer.js` uses it.
  - First person: the hand vector turned by pitch and yaw, then by the swing offsets (Y by `sin(sqrt(swing)*pi)*0.5`, X by `-sin(...)*0.7`). The old code had no swing offsets. `main.js` passes `swing` (animation progress) in both `setFishing` calls.
  - Other views: the eye term is 0 for the local player and 0.12 (`getEyeHeight`) for another player. The old code added 1.62 for remote anglers and a 0.1875 sneak term (a later-version rule; 1.7.10 has none, the local body is already lowered by ySize).
  - Curve: it runs from the hook (i = 0) to the tip, `y = hook + (tipY - hookY - 0.25) * (f*f+f)*0.5 + 0.25`. The old curve ran from the tip with the 0.25 on the wrong end.
- `src/java7-hashmap.js` (new): Java 6/7 HashMap order for Integer keys (`Java7IntMap`, `java7Sync`). Not wired into the game: the game keeps the Java 8 order of batch 60.
- `src/client-push.js`: `CLIENT_PUSHES_PLAYER = false`; `main.js` no longer calls `pushClientPlayer` (see Evidence, item 4). The function stays for its b46 tests.
- `tools/verify-clientreplays.mjs`, `tools/probes/FishLineProbe.java`, `Java7Map.java`, `MobEffectsJava7Probe.java` (and a `J7` switch in `MobEffects2Probe.make`, default off, existing output unchanged), `public/research/clientreplays-reference.json`, `src/clientreplays-b65.test.js` (6 tests).

## Evidence
- Fishing line, executed in part: `FishLineProbe` transcribes `RenderFish.doRender` (javap of `bns`) statement by statement and runs the unchanged `azw` (Vec3 rotations), `qh` (MathHelper table, sqrt) and `EntityPlayer.getEyeHeight` (`yz.g` = 0.12). 96 cases (first person, local third person, remote third person). The GL and Tessellator calls are not run. Bytecode-read: `EntityOtherPlayerMP` sets yOffset 0 (`bll`), `EntityPlayer` yOffset 1.62, `renderYawOffset` fields `aN`/`aM`.
- Item 1 (dragon crystal search and living sound): already closed by batch 49 (executed `b49dc*` records, `dragon-client-b49.test.js`). The living sound is silent on the client: `RenderGlobal.playSound` (both overloads, `bma`) is a bare `return` and `xa.t()` is the growl name (bytecode-read, extracted into the reference). The remaining-gaps line was stale.
- Item 4 (client half of the mob push): found WRONG as a gap, and it exposes a wrong port rule. `EntityLivingBase.onLivingUpdate` (`sv.e`) reaches `collideWithNearbyEntities` (`sv.bo`) only inside `if (!world.isRemote)` (`ahb.E`); the "push" section is in the reference. So no client copy (mob or player) ever pushes. `Entity.addVelocity` (`sa.g(DDD)`) writes `isAirBorne` (`al`), not `velocityChanged` (`H`), and the tracker entry (`my`) sends S12 only for `H`; so the integrated server's push of its `EntityPlayerMP` does not reach the controlled player either. The b46 "client player is pushed" rule (bytecode-read in b46 without the isRemote guard) is therefore switched off. Bytecode-read, not executed (a client-world `onLivingUpdate` run was not built).
- Item 3 (Java 7 effect order): executed in the sense that the unchanged 1.7.10 `EntityLivingBase`/`PotionEffect` classes drive `Java7Map`, a subclass of `HashMap` that is a port of the OpenJDK 7u40 HashMap (recalled from source, not run from a JDK 7 jar; the JDK here is 19). 52 sequences (the b54 seeds). The JS port reproduces all 52 and differs from the Java 8 order in many of them (ids 16 to 23 swap buckets in pairs, new keys join the front, chains reverse on a resize).

## Verification
- `node tools/verify-clientreplays.mjs` (writes the reference; sections `fishline`, `push`, `effects7`, `dragonsound` can be run alone).
- `node --test src/clientreplays-b65.test.js`: 6/6. `src/dragon-client-b49.test.js` 5/5, `src/fishing.test.js` 13/13, `src/mpdragon-b64.test.js` 6/6, `src/mobpush-b46.test.js` 23/23, `src/piston-scene.test.js` 2/2.
- `node --check` on every touched source file; `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Lead decision: the Java 7 order is available but not used; the game stays on Java 8's order (the one the other executed probes ran on). Pick one if 1.7.10's own JVM era matters.
- Lead decision: the controlled player is no longer pushed by mobs (bytecode-read). If a browser or an executed client-world run shows otherwise, set `CLIENT_PUSHES_PLAYER = true`.
- Multiplayer: the own bobber's third-person line has no angler body (the player body is not ticked in multiplayer), so it falls back to the camera eye. Not changed (avoid `src/multiplayer/`).
- Only a browser could show the corrected line in the three views.
