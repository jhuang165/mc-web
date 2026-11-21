# entnbt90 (batch 90): arrows and rockets cross portals, same-dimension arrivals join the live lists

## Summary
This follows the entnbt89 follow-ups. It is not full parity; the open items are listed at the end.
- **Arrows and rockets cross portals (item 2): fixed.**
  - `entity-portal.js`: `SIZES` and `POS_Y` gain `arrow` (0.5 x 0.5) and `rocket` (0.25 x 0.25), both with yOffset 0. `EntityPortals.step` takes two options: `counted` (the entity's own update already ran sa.C's countdown, so the walk syncs `timeUntilPortal` from `portalCooldown` and does not count again) and `noCollide`. `entityDeparture` hands arrows and rockets their yaw and pitch (degrees).
  - `dimensions.js`: `PortalState.tick` takes `countdown` (default true).
  - `bow.js`: `Arrows.step` records `groundAtStart`. `serializeOne` and `fromRecord` are split out of `serialize` and `load`. `fireworks-live.js` gets the same `serializeOne` and `fromRecord`.
  - `dimension-live.js`: `tickEntities` also walks `arrows.list` and `rockets.rockets`. `deliver` writes `inbox.arrows` and `inbox.rockets` (new position, motion and rotation; a rocket's previous position and angles are its new ones). `deliverArrivals` appends them to `record.arrows` and `record.rockets.rockets`. `main.js` passes `arrows` and `rockets` to `tickEntities`.
  - The record is the entity's own save, so the copy keeps damage, pickup, life (ticksInGround), inTile, inData, shake, xTile/yTile/zTile and inGround for arrows, and Life, LifeTime and the FireworksItem for rockets. The shooter is not saved natively either (zc.b), so the copy has none. PortalCooldown is 300, Dimension is removed (as for the other kinds).
  - An arrow that started the update in the ground touches no portal (zc.h returns before I()), but its countdown still runs.
- **Same-dimension arrival (item 1): fixed in the single-player game.** `sa.b(I)` ends with `dst.spawnEntityInWorld(copy)` for every destination, so a copy that lands in the dimension the player is in is live at once. `DimensionLive.deliver` now calls `host.arriveLive(kind, record)` for each record, and for each Teleporter write (`"write"`). A record the host declines still goes to the `late` inbox. `main.js arriveLive`:
  - mob: `mobs.restore`, push, `nextId++` (the /summon path);
  - item: `items.load([record])`, with the old list put back in front (`load` joins the new item itself);
  - orb: `new ExperienceOrbs([record])`, then push and `joined`;
  - arrow and rocket: `fromRecord`, push and `joined`;
  - boat and cart: a one-record `fromJSON` container, whose entity gets a new id in the live list and joins it;
  - write: `world.set(x, y, z, id, true, meta)`.
- **Item 3 (further NBT kinds): not done.** I did not audit more kinds this batch. The entnbt87-89 notes cover mobs, items, orbs, boats, carts, hanging entities, TNT, falling blocks, arrows, throwables, potions, fireballs, skulls, eyes and rockets.

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - `zc.h`: `sa.h` first; the in-ground branch returns (offsets 265-338 and 363) before the closing `I()` at offset 2119, which every other path reaches after setPosition.
  - `sa.b(I)`: removeEntity, `oi.a(...)`, createEntityByName(`sg.b(this)`), `a(sa, true)` (copyDataFrom), then `mt.d(copy)` at offset 229. That call follows the `j == 1 && i == 1` block and is reached by both paths. The end of the method sets `K = true` and runs the world-reset calls.
  - From entnbt89: `zf.h` runs `sa.h` and `moveEntity`; `zc` and `zf` do not override `sa.C`, `sa.ah` (setInPortal) or travelToDimension; `sg` registers both classes.
- **Executed:** none. A real travelToDimension needs a three-world MinecraftServer that the probe's double lacks (as in entnbt89).
- **Port-read:** `dimension-live.js` deliver, deliverArrivals and tickEntities; `bow.js` and `fireworks-live.js` save and load; `main.js` openWorld's list loads and the /summon mob path.

## Verification
- `node --test --test-concurrency=2 src/entnbt90-b90.test.js`: 6 pass. With the source changes stashed, 5 of the 6 fail (the cooldown test passes either way, since it checks that no second count happens).
- Targeted neighbours: 119 test files (every test importing or naming entity-portal, dimension-live, dimensions, bow, fireworks-live, away-entities, away-world, portalArrivals, storedRecord or PortalState), `--test-concurrency=2`: 1099 pass, 0 fail. No old test changed.
- `npm run build` and the full `npm test` were not run (no imports changed; `node --check src/main.js` passes).

## Found wrong in the batch 89 list
- Nothing found wrong. The list said arrows and rockets "do not cross portals", which was true of the port; natively they do.

## Follow-ups
- The away run (`away-entities.js`) does not move arrows or rockets between dimensions, and the dedicated server (`host.remote()`) does not either (its portal walk is skipped on the client).
- The live arrival of a cart or boat uses a one-record container; a rider is dropped (as the portal already does). Neither case is reachable without a mismatched Dimension tag.
- **Browser-only, not checked:** an arrow flying into a portal and appearing in the Nether; a rocket doing the same; a summoned End mob (Dimension 0) through the exit portal appearing on the platform at once; `world.set` for the platform without a remesh.
- Other NBT round trips (item 3) remain unaudited.
