// b90 lead: cross-track check of horse90 x spcopy90. The horse/pig sneak dismount (PlayerView.sneakOff) is mountEntity(null) -> setPlayerLocation from the world pass, so its S08 is
// answered in the client's next network tick (spcopy90 `answerFrom`), like every other world-pass S08.
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { createPlayerRider, moveRidingPlayer, finishVehicleTick } from "./vehicle-simulation.js";

const flatWorld = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };

test("the sneak dismount's S08 is answered from the next network tick, not this one", () => {
  const w = new EntityWorld(flatWorld(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.25, jump: 0.7, maxHealth: 53 } }], () => 0.5);
  const e = w.entities[0];
  Object.assign(e, { onGround: true, aiMoveSpeed: 0 });
  const rider = createPlayerRider();
  assert.ok(w.horseSeats.mount(e, rider));
  const state = { rider, horses: w.horseSeats, world: w.world, position: { x: rider.x, y: rider.y, z: rider.z }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0, survival: { health: 20, held: null }, screen: "playing" };
  const view = w.ai.player;
  const step = (sneak) => { moveRidingPlayer(state, { forward: 0, strafe: 0, sneak }); view.riding = !!rider.vehicle; w.tick(state.position, new Survival({})); finishVehicleTick(state); };
  for (let i = 0; i < 4; i++) step(false);
  assert.equal(view.branch, "riding");
  const net = view.netTicks;
  view.sneakOff({ x: rider.x, y: rider.y, z: rider.z });
  assert.equal(view.branch, "walk");
  assert.equal(view.hasMoved, false, "waiting for the C06");
  assert.equal(view.answerFrom, net + 1, "late: answered in the next network tick");
});
