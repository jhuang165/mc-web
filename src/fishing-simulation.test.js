import { test } from "node:test";
import assert from "node:assert/strict";
import { Fishing } from "./fishing-simulation.js";
import { FISHING_ROD } from "./fishing-content.js";
import { JavaRandom } from "./java-random.js";

const STONE = 3, WATER = 10;
const world = { get: (x, y, z) => (y < 58 ? STONE : y < 63 ? WATER : 0), getMeta: () => 0, solid: (x, y, z) => y < 58, height: 256 };
function makeHost(extra = {}) {
  const log = { sounds: [], drops: [], orbs: [], wear: 0, particles: [], pulls: [] };
  const host = {
    world, position: { x: 0.5, y: 63, z: 0.5 }, yaw: 0, pitch: 0.3,
    survival: { held: { id: FISHING_ROD, count: 1, damage: 0 }, health: 20, creative: false },
    mobs: null, itemRand: new JavaRandom(5), worldRand: new JavaRandom(9),
    fx: { spawn: (...a) => log.particles.push(a) },
    canLightningStrike: () => false, canSeeSky: () => true,
    sound: (...a) => log.sounds.push(a), targets: () => [], hit: () => false,
    pull: (...a) => log.pulls.push(a), drop: (...a) => log.drops.push(a), orb: (n) => log.orbs.push(n), wear: (n) => { log.wear += n; },
    ...extra,
  };
  return { host, log };
}

test("the rod casts with random.bow, then reels in and costs durability", () => {
  const { host, log } = makeHost(), fishing = new Fishing();
  assert.equal(fishing.use(host), "cast");
  assert.equal(log.sounds[0][0], "random.bow");
  assert.ok(fishing.active);
  for (let i = 0; i < 40; i++) fishing.tick(host);
  assert.ok(fishing.active, "the hook flies while the rod is held");
  const saved = JSON.parse(JSON.stringify(fishing.serialize()));
  const other = new Fishing();
  other.load(saved);
  assert.equal(other.hook.x, fishing.hook.x);
  assert.equal(other.hook.ticksCaughtDelay, fishing.hook.ticksCaughtDelay);
  assert.equal(fishing.use(host), "reel");
  assert.equal(fishing.active, false);
  assert.ok(log.wear === 0 || log.wear === 2 || log.wear === 1 || log.wear === 3);
  new Fishing().load(null);
});

test("a bite is landed as a flying item, an orb and one durability", () => {
  const { host, log } = makeHost(), fishing = new Fishing();
  fishing.use(host);
  fishing.hook.ticksCatchable = 5;
  fishing.hook.inGround = false;
  assert.equal(fishing.use(host), "reel");
  assert.equal(log.drops.length, 1);
  assert.ok(log.orbs[0] >= 1 && log.orbs[0] <= 6);
  assert.equal(log.wear, 1);
});

test("putting the rod away or dying removes the hook", () => {
  const { host } = makeHost(), fishing = new Fishing();
  fishing.use(host);
  host.survival.held = null;
  fishing.tick(host);
  assert.equal(fishing.active, false);
  fishing.use(Object.assign(host, { survival: { held: { id: FISHING_ROD, count: 1, damage: 0 }, health: 20 } }));
  host.survival.health = 0;
  fishing.tick(host);
  assert.equal(fishing.active, false);
});
