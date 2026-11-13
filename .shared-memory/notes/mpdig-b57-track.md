# Batch 57 mpdig: multiplayer dig timer, crack packets, item in use

Branch `batch57-mpdig` (from 21c490724). Labels: executed = run; bytecode-read = read from the 1.7.10 jar; recalled = from memory of the source, not checked.

## Summary
- `src/multiplayer/simulation.js`: new `gameMode` option ('creative' default, so the milestone behaves as before; 'survival' runs the timer). Each player has a `createServerDig` (the b53/b54 ItemInWorldManager model). New `queueDig(id, status)` and `queueUse(id, active)` queue C07 status 0/1/2 and item-in-use start/stop, handled in the network tick after the player's own update (dig tick first, as natively). The server aims the ray itself (no client coordinate is trusted) and uses the same click gate as `edit`. Survival: status 0 starts the timer (an instant block breaks), status 2 breaks at `rate * (ticks + 1) >= 0.7F`, else resends the block and waits for damage 1, status 1 is `cancelDestroyingBlock` (with a resend if the cell is not air). `edit {place:false}` is refused for a Survival player, so no client can break faster than the timer. A Creative player breaks at once on status 0 (status 1 and 2 do nothing).
- Crack packets: the timer's `crack` callback goes to `DedicatedSimulation.crack`, which queues `{id, x, y, z, stage}` for every other player under 32 blocks (squared distance from their feet below 1024). `server/server.js` sends them per player as `{type:'crack', cracks}` after the tick (and routes `dig` and `use` messages). `DedicatedClient` has `onCrack`, `dig(status)` and `use(active)`.
- Client: `main.js` draws received cracks with the existing `scene.effects.mobCrack(id, cell, stage)` (one overlay per breaker id, removed after 400 ticks without update by the existing expiry); `effects.js` now also removes the overlay for stage 10 and above (a native stage outside 0-9 removes the entry). In multiplayer a use click sends `use(true)` and the use button release sends `use(false)`.
- Item in use: presence carries `using` (the flag is a boolean, as watcher 0 bit 4). The server sets it for a sword (block, until released), a bow with an arrow or in Creative (draw, until released), food when hungry (never Creative) and milk (32 ticks); a changed held item clears it. `presence.js` `useFlags` turns it into `blocking` / `aimedBow` from the held stack, and `player-renderer.js` `bipedPose` gets `aimedBow` (ModelBiped.aimedBow with f6 = f7 = 0).
- Test: `src/mp-dig-b57.test.js` (8 tests).

## Evidence
- Bytecode-read: `WorldManager` (`mp.b(IIIII)`): sends S25 (`ge`) to every player in the same world whose entity id differs from the breaker's and whose squared distance from `posX/Y/Z` to the cell is below 1024.0.
- Executed: the timer model is the one replayed by `dig-finish-b53` and `dig-abort-b54` (1741 records, still passing); the new test replays the multiplayer routing against it.
- Recalled (not checked): `RenderGlobal.destroyBlockPartially` removing entries outside stages 0-9 and after 400 ticks; `ModelBiped.aimedBow` constants; `EntityPlayer.clearItemInUse` on a held-stack change; third-person pose reading `EnumAction` from the held stack.

## Verification
- `node --test src/mp-dig-b57.test.js`: 8 pass.
- `node --test` over multiplayer, multiplayer-refusal, dedicated-beacon, accounts, held-pose, entity-fire-renderer, dig-finish-b53, dig-abort-b54, client-screens, server-handlers*, player-renderer*: 80 pass. Player-renderer, vehicle-simulation and every test that mentions `main.js`: 429 pass. `npm run build` passes. Full `npm test` not run (batch rule).

## Follow-ups
- The browser client does not mine in Survival over the connection yet (the dedicated server is Creative; the milestone client sends `edit` per click). The `dig(status)` client call exists but is unused: a Survival client needs local dig progress to send status 2, which touches client prediction in `main.js`.
- Eating and drinking complete without food, saturation or potion effects; the dedicated world has no item entities, so Survival breaks drop nothing and wear no tool.
- No eating crumbs or `random.eat` for remote players; the digger's swing is only set at the start of a dig.
- The server ray cannot select a block a client could (single player uses the scene aim); no multiplayer WebSocket test of the `crack`/`use` messages beyond the simulation.
