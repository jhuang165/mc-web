# Batch 79 riderpose79: local rider body yaw and the live horse preview

## Summary
- Local rider yaw: `localMountYaw` (client-rider-pose.js) gives the mount's interpolated renderYawOffset for the local player's mount: single player from `rider.vehicle.entity` (pig or horse; boats and carts have no `.entity`), multiplayer from the seat key via `mountBodyYaw`. main.js passes it as `mountYaw` to `playerRenderer.update` (third person and front view share that call) and to the paperdoll state. The inventory preview now also gets `riding`, so a rider is drawn seated and clamped there.
- Horse preview: `HorsePreviewView.attach` takes a live-mob getter; each frame `horseLook(h, mob)` supplies saddle, armour (the window's stacks win, as every slot change runs syncGear), chested, and age from the mob's `growingAge` (single player previously read `h.age`, which the record lacks, so a foal drew as an adult; multiplayer read a one-off snapshot). A changed coat (type:variant) rebuilds the rig. `windowHorseMob` finds the mob (sp record or mp copy).

## Evidence
- Bytecode-read (b78 note, boh.a(sv,DDDFF)): clamp only when `ridingEntity instanceof sv` (EntityLivingBase), so boats and carts are excluded. Not re-read this batch.
- Port-read: sp pig and horse mounts both set `rider.vehicle = { horse: true, entity }` (horse-live.js seats, shared by pig-saddle-live); boats and carts are plain vehicle objects.
- Not verified natively: whether the inventory preview in func_147046_a keeps isRiding drawn seated (it renders through RendererLivingEntity, so assumed yes; Port-read only).

## Verification
`node --test src/riderpose79-b79.test.js` 7 pass; with horse-preview, mphorseview78, inventory-player tests 24 pass (two source-regex assertions on the `attachHorsePreview(` call updated for the new argument). `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Visual check of seated paperdoll and live horse preview pending (rules forbid browsers).
- Single player pig riding: mount renderYawOffset is whatever the ridden mob's AI/steering sets; not audited.
