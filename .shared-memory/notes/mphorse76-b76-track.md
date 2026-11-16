# Batch 76 mphorse76: horses on the dedicated server

## Summary
- `src/multiplayer/server-horses.js` (new, `ServerHorses`, held as `ServerVehicles.horses`): reuses the single-player horse code. A right click's `mount` action seats the player (`horseSeats.mount`) with the same `p.mount = { key: 'm<id>', mob, rider }` record the saddled pig uses, so presence, sneak dismount, death/unload checks, seat copy and the mob packets are the existing paths. Steering is `horseRideThink` fed by the rider yaw/forward/strafe that `ServerVehicles.riderInput` already sets; unsaddled wild horses are mounted too and the existing `RunAround` task rolls temper (+5), taming (nextInt(100) < temper) and throws the rider (`horseSeats.dismount` spot, executed in b55).
- Jump: new wire `horseJump { power }` (C0B action 6) -> `horseJump` (wi.w); without such a message the server charges the bar from the held jump key (`horseSeats.charge`).
- Inventory: new wire `horseInventory` (C0B action 7) and the right click's own "gui" action (saddle in hand, horse armour, sneak on a tame horse) open an S2D window `kind: 'horse'` (`ServerContainers.openHorse`, `HorseContainer` over the horse's gear stacks). The window closes at 8 blocks or when the horse dies/leaves (`usable`). Saddle/armour/chest slot flags follow the stacks (`syncGear`) and reach other players through the existing mob state.
- `horseInteract` now gets `open` + `horses` from `server-use-entity.js`, so the b75 quick equip (saddle straight onto the horse) is replaced by the window; `mpusesweep-b75.test.js` updated (and the foal randomness it had hidden fixed).
- Smaller: `server-stats.js` counts distance on a horse as `stat.horseOneCm` (it counted every mob as a pig); a horse tamed by riding gets the tamer's name as owner (`stamp`) instead of the stand-in "player".
- Client: `client.js` `horseJump(power)`/`horseInventory()` senders, `client-containers.js` builds the horse window, `main.js` no longer closes a server horse window for lacking a local horse mob.
- Hooks: `simulation.js` (`horseJump`, `horseInventory`), `server/server.js` routes, `server-dimensions.js` ENTRY_POINTS, `server-idle.js` ALWAYS.

## Evidence
- Bytecode-read (`nh.a(jj)`, NetHandlerPlayServer.processEntityAction): action 6 calls `wi.w(param)` and action 7 `wi.g(player)` when the ridden entity is an EntityHorse, with no further check. `wi.w`: only when `cu()` (saddled): negative -> 0, else sets the rear flag; power 1.0 at >= 90, else 0.4 + 0.4*p/90 (matches `horse.js jumpPower`). `wi.g`: server world, rider null or the player, `cc()` (tame), opens the AnimalChest screen.
- Executed (earlier tracks, reused unchanged): interaction rows (280), ride rows, run-around and buck records (b45, b47h, b55 `horse-rear-reference.json`).
- Port-read: jump key counter (`heldJumpPower`) is still the recalled EntityPlayerSP formula; ContainerHorseInventory slots are the existing `HorseContainer` (b45 gear probe).

## Verification
- `node --test src/mphorse76-b76.test.js`: 12 pass (mount/dismount, steering walk, jump wire and key-charge, C0B 7 window + client build, saddle via window clicks, reach close, wild horse throw, owner name, horse stat).
- Related: mpriding2-b62, mpusesweep-b75, horse*.test.js, mpcontainers*, mpstats*, mpvehicle*: all pass (340 tests). No full npm test, no browser.

## Follow-ups
- Client still lacks: sending `horseJump`/`horseInventory` (EntityPlayerSP's release/inventory key while riding; the server falls back to the held jump key for the jump only), drawing a ridden horse's rider pose and the jump bar from server state, the horse preview in the window (needs the mob), the saddle/armour slot background for armour-capable types is built but untested on a real connection.
- Fall damage of a ridden horse to the rider, rider pitch -> horse pitch, and re-seating after a rejoin are not ported to the server. Horses saved with a rider are not restored as mounted.
- The wild-horse taming roll uses the port's random streams (not draw-for-draw with a native server).
