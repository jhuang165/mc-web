import { test } from "node:test";
import assert from "node:assert/strict";
import { World, WATER, LAVA, RED_FLOWER } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { BUCKET, WATER_BUCKET, LAVA_BUCKET, MILK_BUCKET } from "./buckets.js";
import { captureBucketTarget, copyBucketTarget, useHeldBucket, tracedBucketKind } from "./buckets-simulation.js";
import { capturePlayerAction, dispatchPlayerAction } from "./player-actions.js";

const STONE = 3, X = 40, Z = 40, FLOOR = 10;
function arena() {
  const w = new World("buckets-simulation");
  for (let x = X - 8; x < X + 8; x++)
    for (let z = Z - 8; z < Z + 8; z++) for (let y = 1; y < 30; y++) w.set(x, y, z, y <= FLOOR ? STONE : 0, false);
  return w;
}
const eyeRay = () => ({ origin: [X + 0.5, FLOOR + 2.62, Z + 0.5], dir: [0, -1, 0] });
function fixture(id, count = 1, mode = "survival", extra = []) {
  const world = arena(), survival = new Survival({ slots: [makeStack(id, count), ...extra] }, mode), calls = [];
  const state = {
    screen: "playing", heldTool: id, world, survival, position: { x: X + 0.5, y: FLOOR + 1, z: Z + 0.5 },
    velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false }, mobs: { entities: [] },
    yaw: 0, pitch: Math.PI / 2, eating: null, mining: null, mineCooldown: 0, mineHeld: false,
    items: { dropPlayer: (stack) => calls.push(["drop", stack.id, stack.count]) },
    fluids: { wash: (x, y, z, b) => calls.push(["wash", x, y, z, b]) },
  };
  const hooks = {
    destroyParticles: (...args) => calls.push(["particles", ...args]),
    sound: (...args) => calls.push(["sound", ...args]),
    updateBlock: (...args) => calls.push(["update", ...args]),
    resetEquipped: () => calls.push("reset"),
    renderHotbar: () => calls.push("hotbar"),
    markUnsaved: () => calls.push("dirty"),
    swing: () => calls.push("swing"),
  };
  return { world, survival, state, hooks, calls };
}

test("bucket targets are captured from the bucket's own fluid-aware trace as detached JSON", () => {
  const w = arena();
  w.set(X, FLOOR, Z, WATER, false);
  assert.equal(tracedBucketKind(MILK_BUCKET), null);
  assert.equal(captureBucketTarget(w, MILK_BUCKET, eyeRay()), null);
  assert.equal(captureBucketTarget(w, 3, eyeRay()), null);
  assert.deepEqual(captureBucketTarget(w, BUCKET, null), { ray: null, liquid: true, hit: null });
  const ray = eyeRay(), empty = captureBucketTarget(w, BUCKET, ray);
  ray.origin[0] = 99;
  // An empty bucket stops on the source; a filled one looks through it to the stone.
  assert.deepEqual(JSON.parse(JSON.stringify(empty)), {
    ray: { origin: [X + 0.5, FLOOR + 2.62, Z + 0.5], dir: [0, -1, 0] }, liquid: true, hit: { block: [X, FLOOR, Z], side: 1 },
  });
  assert.deepEqual(captureBucketTarget(w, WATER_BUCKET, eyeRay()).hit, { block: [X, FLOOR - 1, Z], side: 1 });
  // A NaN ray traces nothing, exactly like a missing ray.
  assert.deepEqual(captureBucketTarget(w, LAVA_BUCKET, { origin: [NaN, 0, 0], dir: [0, -1, 0] }), { ray: null, liquid: false, hit: null });
  for (const bad of [{}, { liquid: true, ray: null, hit: { block: [1, 2, 3], side: 1 } }, { liquid: true, ray: { origin: [0, 0], dir: [0, 0, 1] }, hit: null },
    { liquid: false, ray: eyeRay(), hit: { block: [1, 2, 3], side: 6 } }])
    assert.equal(copyBucketTarget(bad), undefined);
  assert.throws(() => capturePlayerAction({ place: true, heldTool: BUCKET, bucket: { liquid: "yes" } }), TypeError);
});

test("an empty bucket picks up the captured source with ordered hooks; a stack keeps the rest", () => {
  const f = fixture(BUCKET, 3);
  f.world.set(X, FLOOR, Z, WATER, false);
  const action = JSON.parse(JSON.stringify(capturePlayerAction({ place: true, heldTool: BUCKET,
    bucket: captureBucketTarget(f.world, BUCKET, eyeRay()) })));
  const result = dispatchPlayerAction(f.state, action, f.hooks);
  assert.deepEqual(result, { handled: true, branch: "use-bucket", bucket: "pick-liquid" });
  assert.equal(f.world.get(X, FLOOR, Z), 0);
  assert.equal(f.survival.count(BUCKET), 2);
  assert.equal(f.survival.count(WATER_BUCKET), 1);
  assert.deepEqual(f.calls, [["update", X, Z, FLOOR], "reset", "hotbar", "dirty"]);
});

test("a stale capture is consumed without touching the world, inventory or any block action", () => {
  const f = fixture(BUCKET, 1);
  f.world.set(X, FLOOR, Z, WATER, false);
  const action = capturePlayerAction({ place: true, heldTool: BUCKET, bucket: captureBucketTarget(f.world, BUCKET, eyeRay()) });
  f.world.set(X, FLOOR, Z, LAVA, false); // Same cell, now lava: still a hit, so still valid.
  assert.equal(dispatchPlayerAction(f.state, structuredClone(action), f.hooks).bucket, "pick-liquid");
  assert.equal(f.survival.inventory.held.id, LAVA_BUCKET);

  const g = fixture(BUCKET, 1);
  g.world.set(X, FLOOR, Z, WATER, false);
  const stale = capturePlayerAction({ place: true, heldTool: BUCKET, bucket: captureBucketTarget(g.world, BUCKET, eyeRay()) });
  g.world.set(X, FLOOR, Z, 0, false);
  g.world.set(X, FLOOR - 1, Z, WATER, false);
  assert.deepEqual(dispatchPlayerAction(g.state, stale, g.hooks),
    { handled: true, branch: "use-bucket", bucket: "stale-bucket-target", skipped: true });
  assert.equal(g.world.get(X, FLOOR - 1, Z), WATER);
  assert.equal(g.survival.inventory.held.id, BUCKET);
  assert.deepEqual(g.calls, []);

  // Malformed bucket data never reaches the edit helper.
  const bad = { ...stale, bucket: { liquid: true, ray: null, hit: { block: [1, 2, 3], side: 0 } } };
  assert.deepEqual(dispatchPlayerAction(g.state, bad, g.hooks), { handled: true, branch: "invalid-player-action", skipped: true });
  const missing = { ...stale };
  delete missing.bucket;
  assert.equal(dispatchPlayerAction(g.state, missing, g.hooks).branch, "invalid-player-action");
});

test("a water bucket replaces a flower: wash, particles and sound precede the cell update", () => {
  const f = fixture(WATER_BUCKET);
  f.world.set(X, FLOOR + 1, Z, RED_FLOWER, false, 4);
  // The filled trace ignores the flower (no collision box) and hits the stone's top face.
  const bucket = captureBucketTarget(f.world, WATER_BUCKET, eyeRay());
  assert.deepEqual(bucket.hit, { block: [X, FLOOR, Z], side: 1 });
  const result = useHeldBucket(f.state, { id: WATER_BUCKET, bucket }, f.hooks);
  assert.deepEqual(result, { branch: "place-liquid", cells: [[X, FLOOR + 1, Z]] });
  assert.equal(f.world.get(X, FLOOR + 1, Z), WATER);
  assert.equal(f.survival.inventory.held.id, BUCKET);
  assert.deepEqual(f.calls, [["wash", X, FLOOR + 1, Z, RED_FLOWER], ["particles", X, FLOOR + 1, Z, RED_FLOWER, 4],
    ["sound", false, RED_FLOWER], ["update", X, Z, FLOOR + 1], "reset", "hotbar", "dirty"]);

  // Creative keeps the filled bucket, so the equip animation is not reset.
  const c = fixture(LAVA_BUCKET, 1, "creative");
  assert.equal(useHeldBucket(c.state, { id: LAVA_BUCKET, bucket: captureBucketTarget(c.world, LAVA_BUCKET, eyeRay()) }, c.hooks).branch, "place-liquid");
  assert.equal(c.survival.inventory.held.id, LAVA_BUCKET);
  assert.deepEqual(c.calls, [["update", X, Z, FLOOR + 1], "hotbar", "dirty"]);
});

test("cows take an empty Survival bucket before the ray; milk starts the drink in any mode", () => {
  const f = fixture(BUCKET, 2, "survival", Array(35).fill(makeStack(3, 64)));
  f.world.set(X, FLOOR, Z, WATER, false);
  const cow = { entity: { type: "cow", health: 10 } };
  const bucket = captureBucketTarget(f.world, BUCKET, eyeRay());
  assert.equal(useHeldBucket(f.state, { id: BUCKET, aimedEntity: cow, bucket }, f.hooks).branch, "milk-cow");
  // The inventory is full, so the milk bucket is thrown; the source stays.
  assert.deepEqual(f.calls, [["drop", MILK_BUCKET, 1], "reset", "hotbar", "dirty"]);
  assert.equal(f.world.get(X, FLOOR, Z), WATER);

  const c = fixture(BUCKET, 1, "creative");
  c.world.set(X, FLOOR, Z, WATER, false);
  assert.equal(useHeldBucket(c.state, { id: BUCKET, aimedEntity: cow, bucket: captureBucketTarget(c.world, BUCKET, eyeRay()) }, c.hooks).branch, "pick-liquid");
  assert.equal(c.survival.inventory.held.id, BUCKET);

  const dead = fixture(BUCKET, 1);
  assert.equal(useHeldBucket(dead.state, { id: BUCKET, aimedEntity: { entity: { type: "cow", health: 0 } },
    bucket: { ray: null, liquid: true, hit: null } }, dead.hooks).branch, "no-eye-ray");
  assert.deepEqual(dead.calls, []);

  for (const mode of ["survival", "creative"]) {
    const m = fixture(MILK_BUCKET, 1, mode);
    m.state.eating = null;
    assert.deepEqual(useHeldBucket(m.state, { id: MILK_BUCKET }, m.hooks), { branch: "begin-drinking" });
    assert.deepEqual(m.state.eating, { id: MILK_BUCKET, ticks: 32, drink: true });
    m.state.eating = { id: 320, ticks: 5 };
    useHeldBucket(m.state, { id: MILK_BUCKET }, m.hooks);
    assert.deepEqual(m.state.eating, { id: 320, ticks: 5 });
    assert.deepEqual(m.calls, []);
  }
});
