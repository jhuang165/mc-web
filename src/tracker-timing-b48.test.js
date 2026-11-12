// Batch 48: when a vehicle's tracker entry starts, the flags a push sets, and the far-boat untrack. The entry's reactions are the executed ones
// (tracker-vehicles-reference.json: boatPush / cartPush for isAirBorne and velocityChanged, boatFar for the untrack, boatGlide row 0 for the creation S12);
// that the port's boats and carts set the flags where 1.7.10 does is bytecode-read (sa.g(DDD) sets al, xl.g(sa) and sa.g(sa) call it, xi/xl.a(ro, float) call Q()).
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker } from "./object-tracker.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { recordBirth, takeBirth } from "./tracker-birth.js";

const player = { x: 0.5, y: 0, z: 0.5 };
function harness(kind) {
  const tracker = new ObjectTracker(10, () => 0.5), log = [];
  tracker.ctx.world = null; tracker.ctx.player = null;
  tracker.view.log = (p) => log.push(p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : [p.type]);
  const tick = (list) => { log.length = 0; tracker.serverTick({ [kind]: list }, player); tracker.clientTick(); return log.slice(); };
  return { tracker, tick };
}
const spawnBoat = (boats, born) => boats.spawnBoat({ x: 5.5, y: 0, z: 5.5 }, { seed: 1, born });
const spawnCart = (carts, born) => carts.spawnEmpty({ x: 5.5, y: 0.35, z: 5.5 }, { seed: 1, born });
const mob = (x, z) => ({ x, z, vx: 0, vz: 0 });

test("a boat pushed on its spawn tick sends the creation S12 and then the pushed motion (executed: boatGlide row 0); an unrecorded one sends one", () => {
  for (const born of [true, false]) {
    const boats = new Boats(), { tick } = harness("boat");
    const boat = spawnBoat(boats, born);
    boats.collide(boat, mob(6.5, 5.5)); // a mob beside it pushes it on the tick it was placed
    const sent = tick([boat]);
    const velocities = sent.filter((p) => p[0] === "velocity");
    assert.equal(velocities.length, born ? 2 : 1, JSON.stringify(sent));
    if (born) assert.deepEqual(velocities[0], ["velocity", 0, 0, 0]);
    assert.notDeepEqual(velocities.at(-1), ["velocity", 0, 0, 0]);
  }
});
test("a cart placed and pushed in the same tick does the same", () => {
  const carts = new Minecarts(), { tick } = harness("minecart");
  const cart = spawnCart(carts, true);
  carts.collide(cart, mob(5.5, 6.5));
  const velocities = tick([cart]).filter((p) => p[0] === "velocity");
  assert.equal(velocities.length, 2);
  assert.deepEqual(velocities[0], ["velocity", 0, 0, 0]);
});
test("the birth record is taken once, and saved vehicles are not recorded", () => {
  const boats = new Boats(), boat = spawnBoat(boats, true);
  assert.ok(takeBirth(boat)); assert.equal(takeBirth(boat), null);
  const loaded = Boats.fromJSON([{ x: 5.5, y: 0.3, z: 5.5, motion: [0.1, 0, 0] }]).carts[0];
  assert.equal(takeBirth(loaded), null);
  const { tick } = harness("boat");
  const velocities = tick([loaded]).filter((p) => p[0] === "velocity");
  assert.equal(velocities.length, 1); assert.equal(velocities[0][1], 800);
  assert.equal(takeBirth(recordBirth({})) !== null, true);
});

test("collisions set isAirBorne on both boats and carts (Entity.addVelocity), attacks set velocityChanged (setBeenAttacked)", () => {
  const boats = new Boats(), a = spawnBoat(boats, false), b = boats.spawnBoat({ x: 5.9, y: 0, z: 5.5 });
  boats.collide(a, b, true);
  assert.equal(a.airBorne, true); assert.equal(b.airBorne, true);
  const c = spawnBoat(boats, false); boats.collide(c, mob(5.5, 5.5)); assert.ok(!c.airBorne, "distance under 0.01: nothing happens");
  boats.attack(a, 1); assert.equal(a.velocityChanged, true);
  const carts = new Minecarts(), k = spawnCart(carts, false), k2 = carts.spawnEmpty({ x: 5.9, y: 0.35, z: 5.5 });
  carts.collide(k, mob(5.5, 6.5)); assert.equal(k.airBorne, true);
  Object.assign(k2, { airBorne: false });
  k.vx = 0.3; k2.slots ??= []; k.airBorne = false;
  carts.collide(k, k2); assert.equal(k.airBorne, true); assert.equal(k2.airBorne, true);
  carts.attack(k, 1); assert.equal(k.velocityChanged, true);
  const dead = spawnCart(carts, false); dead.dead = true; carts.attack(dead, 1); assert.ok(!dead.velocityChanged);
});

test("a push between two 3 tick beats reaches the player at once (executed: boatPush tick 4)", () => {
  for (const push of [true, false]) {
    const boats = new Boats(), { tick } = harness("boat"), boat = spawnBoat(boats, false);
    tick([boat]); tick([boat]); tick([boat]); tick([boat]); // entry ticks 0 .. 3
    if (push) boats.collide(boat, mob(6.5, 5.5));
    const sent = tick([boat]); // entry tick 4, 4 % 3 != 0
    assert.equal(sent.some((p) => p[0] === "velocity"), push, JSON.stringify(sent));
  }
  const boats = new Boats(), { tick } = harness("boat"), boat = spawnBoat(boats, false);
  for (let i = 0; i < 4; i++) tick([boat]);
  boats.attack(boat, 1); // velocityChanged on an off beat tick: the S12 goes out at once (executed: boatPush tick 8)
  assert.ok(tick([boat]).some((p) => p[0] === "velocity"));
  assert.equal(boat.velocityChanged, false);
});
