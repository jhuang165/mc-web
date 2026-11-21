# spcopy91 (batch 91): readers of the single-player server copy honour `left`

## Summary
Works through "the copy: `ai.player` readers without the `left` gate" and the multi-tick portal trip. Does not claim full parity.

- `ai.js PlayerView.alive` is now a getter (`_alive && !left`): every reader that tests `p.alive` (spawn blocking, mob pushes, slime touch, silverfish, ghast, legacy mobs, enderman, ocelot avoid, village notes, fireballs, pistons via `copy.alive !== false`) sees a copy that left as not in the world. `update()` returns early while left, and left is cleared before it runs on a failed trip, so no respawn-style reset happens.
- Added `left` gates: `NearestAttackable` player target and `despawnEntity` (ai.js), wolf and ocelot `m.owner()` (getPlayerEntityByName searches this world only), villager customer task and LookAtTradePlayer, `leashHolder` (lead stays on, as the away run), `siegePlayers`, the copy-motion pushes of explosions, carts/boats and the dragon sweep.
- main.js: the spawner player list (`feet`) and the beacon player list are empty while `dims.busy` (the portal tick itself, which runs before `left` is set at the end of the tick).

## The multi-tick trip
Port-read: the old world ticks only from the portal tick until `openWorld` sets `screen = "home"` (tick returns); after that nothing ticks until `launch`. The new world's first tick does the arrival (`arriveFrom`, setLocation) in one tick, as natively. So the only extra ticks that change the copy are the old world's ticks with the copy gone, now handled by the gates above. The loading screen is untouched (no change to openWorld/launch). The death screen keeps the dead copy in the world natively (closestPlayer has no alive test, closestVulnerable does); the port already matches that.

## Evidence
- Bytecode-read (b89): oi.a(mw,int) removes the player from the old WorldServer first.
- Port-read: all reader sites above. Not executed natively.

## Verification
- `node --test src/spcopy91-b91.test.js`: 4/4. With the `ai.js` change stashed: 2 fail (checked).
- Targeted run of tests naming wolf/ocelot/villager/leash/PlayerView/spcopy88-90/village-fight: see lead reply.

## Follow-ups
- Readers that fire only from player events (hits, clicks, `callReinforcement`, `leashFence`) are unreachable while left and stay ungated.
- The away-run stand-in (`absent`) still returns a far player for wolf owner/leash behaviour; unchanged.
- Browser-only: nothing visible expected.
