# Batch 61 mpanimals: feeding, breeding, shearing, milking and saddling animals over multiplayer

## Summary
- `src/multiplayer/animal-use.js` (new): `serverAnimalUse` runs the single-player rules in the order of `player-edit-simulation.js` (saddle, wolf / ocelot hooks, mooshroom bowl / shears, sheep shears, cow milk via `milkCow`, `feed`, dye). `predictAnimalUse` is the client's own run of the same click on the copy's stand-in record.
- `src/multiplayer/server-mobs.js`: `interact(p, wireId, claim)` (reach 6 blocks like the attack), held stack left at size <= 0 is emptied, the breeder is stored on the fed animal (`e.breeder`), `spawnBaby` is wrapped so the breeder is credited with `breedCow` through `sim.achievements` (the existing `watchMobs` wrapper), `mobState` carries `saddled` for pigs.
- `src/multiplayer/simulation.js`: `queueAnimUse` and one branch in the action loop. A handled click the client did not predict makes the following `edit place` / `use` of that client (within 2 ticks) be dropped, so food is not also eaten. A prediction the server refused (`claim` true) marks the held slot unseen, so `ServerItems.settle` sends the real slot.
- `server/server.js` route, `src/multiplayer/client.js` `animUse(mob, claim)`, `src/main.js` hook in `edit()` (predict, send, return only when handled; otherwise the normal edit and use go on).
- `src/multiplayer/remote-mobs.js`: status 10 sets the sheep's `eatTimer` 40 (graze), status 18 marks the copy in love (600), both count down in `tick`; `saddled` state.
- `src/entities.js`: `BREED_ITEM` exported, `mobStatus` in the AI dependencies. `src/ai.js`: EatGrass.startExecuting sends status 10.
- Wire (prefix anim): in `animUse` { mob, claim }. Status 10 reuses the batch 60 `mobStatus` packet. PROTOCOL not bumped.
- `src/mpanimals-b61.test.js`: 11 tests.

## Evidence
- Recalled / inherited (not re-read from bytecode this batch): EntityPlayer.interactWith order (interactFirst, then the item's itemInteractionForEntity; the same code runs on the client), EntityAnimal.interact + func_146082_f (inLove 600, status 18, breeder), EntityAIMate.spawnBaby (breeder or partner's breeder gets the achievement, cows only), EntitySheep.interact, EntityCow.interact, EntitySheep status 10 (sheepTimer 40). The rule functions themselves (`feed`, `shear`, `mooshroomInteract`, `milkCow`, `saddleUse`, `dye`) come from earlier batches with executed references (leads2, mooshroom-golem, pig-saddle).
- Executed (node): the 11 tests drive a real `DedicatedSimulation` with a survival player: feeding, rejection of calves / far mobs, a full breed to a calf with the award event, shearing, lamb refusal, dye, milk (survival and creative), saddle and its copy, bowl and shears on a mooshroom, slot resend, prediction versus server on the held stack for 7 cases, status 10 / 18 on the copy.
- Found: the baby, the XP orbs (`spawnLoot`) and the love timer already worked on the server through the AI; only the player's click was missing. The `breedCow` wrapper already existed but credited nobody on the server (`attacker` is null in AI ticks); it now has the breeder.
- Found in the port (not changed): single-player `shear` returns true after shearing; native EntitySheep.interact falls through to EntityAnimal.interact and returns false, which only matters for whether the click also starts an item use (shears have none).

## Verification
- `node --test src/mpanimals-b61.test.js`: 11 pass.
- `node --test` on mp*, multiplayer*, dedicated*, breed*, shear*, mooshroom*, saddle*, bucket*, achievements*, entity-tracker*, sheep*, animal*, eat*, ai*, entities*: 536 pass, 0 fail.
- `node --check` on every touched file. `npm run build`: ok. Full npm test not run (batch rule). No browser checks.
- main.js scope check: `predictAnimalUse` is imported at module level; `survival`, `sounds`, `renderHotbar`, `aimedRemoteMob`, `multiplayer` are module-level names already used in `edit()`.

## Follow-ups
- Not done: leads (S1B attach, knots), riding a saddled pig (mpvehicles), taming (status 6 / 7): `serverAnimalUse` already calls `wolfInteract` / `ocelotInteract` if those mobs are in `SUPPORTED`, but their status 6 / 7 and `mobStatus` calls are not wired; sheep eating grass changes a block on the server but the clients get no level event 2001 (`drainMobEvents` is not given `eatGrass`) and a block update only through the normal change path (not checked).
- The stat `animalsBred` is not kept. The copy's `love` is a guess (only status 18 and the client's own feed set it); a wrong guess is corrected by `animResend` via the `claim` flag.
- A mooshroom sheared by a player shows one tick of the death pose before the destroy packet (health 0 in `mobState`).
- Browser only: the shear / leather sounds play twice (local prediction plus S29, as natively), the graze head animation, the hotbar redraw after a predicted use.
- Merge risks: `mobState` and `remote-mobs.js` `state()` (mpvehicles may add a saddle / rider flag there; `saddled` is the same key), the action loop in `simulation.js`, the route list in `server/server.js`, the `edit()` line in `main.js`.
