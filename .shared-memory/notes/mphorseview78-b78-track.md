# Batch 78 mphorseview78: remote riders and the horse window preview

## Summary
- Rider pose: already native. `bipedPose` riding branch (arms -PI/5, legs -2PI/5, y +-PI/10) is shared by the local player (`riding: !!rider.vehicle || !!mpRiding`) and remote copies (`presence.js` passes `riding: !!p.riding`); seat offset is `mountSeat` (b77, getYOffset -0.5). Gap found and fixed: a rider on a living mount (pig, horse) was drawn with its own renderYawOffset. New `multiplayer/client-rider-pose.js` (`riderYaws`, `ridingPose`, `mountBodyYaw`); `PlayerRenderer.update` takes `mountYaw`; `RemotePlayers` takes `mountYawOf` (main.js passes it, 2 lines).
- Horse window: the multiplayer window already goes through `attachHorsePreview` with the same layout (anchor 51,60, scale 17, look 51,25). Gap fixed: the wire horse state had no variant, armour, saddle or age, so the preview drew a default horse. `previewHorse` takes them from the copy's stand-in (`buildWindow` got a `mobs` option, main.js passes `remoteMobs`).
- Rider rows: documented, server unchanged (below).

## Evidence
- Bytecode-read: `boh.a(sv,DDDFF)` (RendererLivingEntity.doRender): if `sv.am()` (isRiding) and `ridingEntity instanceof sv`: f5 = wrapAngle(headYaw - interp(mount.aN prev, aM)) clamped +-85, body = head - f5, plus f5*0.2 when f5*f5 > 2500. Boats and carts are not `sv`, so no clamp.
- Bytecode-read: `my.a(List)` (EntityTrackerEntry.updateTrackedEntities) with `ridingEntity != null` (offset 1023 branch): sends only S16 look when yaw/pitch differ by >= 4 (`hi(id, yaw, pitch)`), re-syncs the stored encoded position (d/e/f) without a packet, sends S19 head when changed; no S14/S18/S21 position packet. S1B(0) attach every 60 ticks while riding (offset 94-151).
- Port-read: single player draws its own pose through the same `playerRenderer.update(... riding ...)` call; `ServerPlayerTracker` already mirrors the riding branch (`ridingEntity`, b76).
- Port-read: horse-preview.js layout equals the b-note bft.a values (existing horse-preview.test.js).

## Verification
`node --test src/mphorseview78-b78.test.js` 9 pass; with horse-preview, mphorse76, mpvelocity77, mphorseclient77 tests 44 pass. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Rider rows: the players row of a rider still carries live x/y/z every tick. Natively no position packet exists for a rider, but the port client ignores the row's position whenever the mount copy is known (b77 `mountSeat`), and uses it as the fallback when the mount is not tracked (natively that case cannot occur: the S1B attach would not resolve). Redundant, not wrong; left alone (server-player-tracker rows are shared with other tracks).
- The local player's own body yaw while riding a pig/horse (single player and multiplayer self) still uses its own renderYawOffset; the same clamp applies natively. Needs the mount's body yaw in main.js (not done, shared file).
- Preview is untested visually (rules); the copy's look is read once when the window opens, later variant changes while open are not refreshed.
