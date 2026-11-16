# Batch 77 mpvelocity77: S12 to the player himself, riders that follow their mount, the cape bit

## Summary
- New `server-velocity.js`: a landed hit (any `hurtSounds` entry drained in `server-survival.takeHurt`, drowning excluded) stamps `p.velHit`; `presence()` then puts `vel` (clamped +-3.9, truncated to 1/8000) on that player's row for that tick. `ServerPlayerTracker.rowsFor` drops `vel` from every row but the owner's. main.js `applyMultiplayerTick` sets the client `velocity` from it (`ownVelocity`). Covers mob, player, arrow, explosion, fall, fire hits and the death throw (the throw is set in `die()` in the same tick, after the stamp, so the S12 carries the thrown motion).
- Remote rider copies: `client-ride-seat.js` `mountSeat(key, {vehicles, mobs})` gives the rider's feet from the mount's own client copy (boat 0.4 along yaw, cart, pig, horse via `copySeat`). `RemotePlayers.sync` replaces a rider row's position with that seat, and the new `followMounts()` (called in main.js each client tick after the mob and vehicle ticks) re-seats the copy after the mount moved. Generic for any key; an unknown mount falls back to the row.
- Cape bit: the port already carries `hideCape` on the wire (cape-wire.js, C15 showCape). Added to `watcherSig`, so a change forces the off-beat send like `DataWatcher.hasChanges()`.
- Tests: `src/mpvelocity77-b77.test.js` (8): real DedicatedSimulation ticks through `playerTracker.messageFor`.

## Evidence
- Bytecode-read (javap -c -p, 1.7.10 jar): `my.a(List)` tail: `if (entity.sa.H) { b(new hy(entity)); entity.H = false; }`; `my.b(ft)` sends to the tracking players and, when the entity is `mw` (EntityPlayerMP), to `mw.a` (its own NetHandler). `hy(int,double,double,double)` clamps to 3.9 (ldc2_w 3.9) and stores ints. `*8000` and client `/8000` and "drown skips setBeenAttacked" are recalled from earlier notes (b75 server-death-throw.js), not re-read here.
- Port-read: the server integrates the player from input (`movePlayer`), the client only follows the row (`applyMultiplayerTick`). `bll.e` (b76 note): a remote player copy moves nothing from its velocity.
- Port-read: rider seat formulas are the single-player ones (vehicle-seat.js, horse-copy.js, boats.js seat).

## Verification
- `node --test src/mpvelocity77-b77.test.js` 8 pass; mpplayerfx75, mptrack74, mpwatched76, mpclicks76, streamfix73, mpriders73, mptrackers71 together 50 pass. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Deviation: the port client has no own physics, so S12 only sets its `velocity` (bob, cape); the knockback itself is already in the position the server integrates. True client-side motion would need client prediction.
- Explosion knockback natively also rides S27 (client adds the push); here it is the same server motion, so S12 carries it. Not re-read.
- The S12 value is the server `p.velocity` after the tick's move, as natively; not executed against a probe.
- `followMounts` and the seat are untested in a browser (rules); the seat y for the horse uses `copySeat` as the single-player rider does.
- Rider rows are still live on the wire (tracker keeps them); only the client now ignores their position when the mount copy is known.
