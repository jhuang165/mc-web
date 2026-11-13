# Batch 57 crystalfire: crystal copy fire on the client block layer

## Summary
- `src/crystal-fire-layer.js` (new): `createCrystalFireLayer(host)` is the client block layer for `clientCrystalFire`. `get` reads the client view (predicted-cell overlay, `clientWorld()`), `set` records an overlay cell with token -57 and calls `Scene.showPredictedCells`, so the fire is drawn on the copy's tick. `reconcile` drops the entry once the real world holds the same block. If the real world already has fire and an older overlay entry (a predicted break) hides it, the entry is cleared and the cell is rebuilt with `scene.updateBlock`.
- `src/main.js`: layer built next to `clientWorld`; `mobs.crystalFire = (copy) => layer.tick(copy)` set at world load; the layer forgets its entries when the overlay is cleared. `client-prediction.js` is unchanged (its API only).
- `src/entity-tracker.js`, `src/entities.js`: `MobTracker.crystalFire` forwarder (like `beforePlayer`), and `newClient(type)` hands it to ender crystal copies as they spawn. Small edits, away from the spawn code.
- `src/crystal-fire-b57.test.js`: 3 tests (draw before real, real landing ends entry, predicted break re-lit, non-End nothing, hook only on crystals).

## Evidence
- Bytecode-read (from b56): `wz.h` has no isRemote guard. Not executed on a client world; no new probe (a client WorldProviderEnd probe was not built). The port's server crystal lights the real world first, so in the single-world port the overlay shows only where the client view differs from the real world (a predicted break of the fire, a refused or late real change).
- Recalled: native keeps the client fire until an S23 for that cell; the port ends it when the real world agrees.

## Verification
- `node --test src/crystal-fire-b57.test.js src/dragondeath-b56.test.js src/client-predict-b56.test.js src/instantbreak-b55.test.js src/entity-tracker*.test.js src/tracker-mounts*.test.js src/end.test.js`: 77/77. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- BlockFire client `onBlockAdded` / fire spread on the client world not read. Copies that spawned before the hook was set (none in practice) keep no hook.
- An overlay fire whose real cell never becomes fire stays until another prediction or world change.
