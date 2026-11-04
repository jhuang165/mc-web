import test from "node:test";
import assert from "node:assert/strict";
import { Projectiles } from "./projectiles.js";
import { impactEnderPearl } from "./ender-pearl.js";
import { projectileItemId } from "./projectile-renderer.js";

const rand = (seed = 3) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const worldWith = cells => ({
  get: (x, y, z) => cells[[x, y, z]] ?? (y < 10 && y >= 0 ? 3 : 0),
  solid(x, y, z) { const id = this.get(x, y, z); return id !== 0 && id !== 10 && id !== 20 && !(id >= 31 && id <= 39); },
});

function wireImpact(projectiles, trace, owner) {
  return ({ pearl, world, hit }) => impactEnderPearl(pearl, { world, owner, hit }, {
    hit: target => trace.push(["hit", target]),
    particle: p => trace.push(["portal", p]),
    dismount: () => trace.push(["dismount"]),
    teleport: (_owner, x, y, z) => trace.push(["teleport", x, y, z]),
    damage: (_owner, hit) => { trace.push(["damage", hit]); return true; },
  });
}

test("real pearl throw flies into a block and runs hit/portal/teleport/damage hooks synchronously", () => {
  const world = worldWith({ [[5, 11, 4]]: 3 }), projectiles = new Projectiles(rand());
  const pearl = projectiles.throwEnderPearl({ x: 5, y: 10, z: 6 }, 0, 0);
  const owner = { kind: "playerMP", connected: true, world, riding: true, fallDistance: 18 }, trace = [];
  assert.equal(pearl.kind, "enderPearl");
  assert.equal(pearl.owner, "player");
  assert.equal(pearl.random, pearl.rand);
  projectiles.tick(world, [], () => assert.fail("block impact has no entity hit"), wireImpact(projectiles, trace, owner));
  assert.deepEqual(trace.map(x => x[0]), ["portal", ...Array(31).fill("portal"), "dismount", "teleport", "damage"]);
  assert.deepEqual(trace.at(-2), ["teleport", pearl.x, pearl.y, pearl.z]);
  assert.deepEqual(trace.at(-1), ["damage", { source: "fall", amount: 5 }]);
  assert.equal(owner.fallDistance, 0);
  assert.equal(projectiles.balls.length, 0);
});

test("real entity ray impact passes the target once before portal particles", () => {
  const world = worldWith({}), projectiles = new Projectiles(rand());
  const pearl = projectiles.throwEnderPearl({ x: 5, y: 10, z: 6 }, 0, 0), target = { mobId: "target" };
  const owner = { kind: "playerMP", connected: true, world, riding: false, fallDistance: 0 }, trace = [];
  const targets = [{ ref: target, box: [4.5, 11, 4.8, 5.5, 12, 5.2] }];
  projectiles.tick(world, targets, () => assert.fail("pearl hit is dispatched by pearl hook"), wireImpact(projectiles, trace, owner));
  assert.equal(trace[0][0], "hit");
  assert.equal(trace[0][1], target);
  assert.equal(trace.filter(x => x[0] === "portal").length, 32);
  assert.equal(trace.at(33)[0], "teleport");
  assert.equal(trace.at(34)[0], "damage");
});

test("pearl collisions require the synchronous impact adapter and saves retain kind plus local owner token", () => {
  const world = worldWith({ [[5, 11, 4]]: 3 }), projectiles = new Projectiles(rand(4));
  projectiles.throwEnderPearl({ x: 5, y: 10, z: 6 }, 0, 0);
  assert.throws(() => projectiles.tick(world), /requires a synchronous adapter hook/);
  const saved = JSON.parse(JSON.stringify(projectiles.serialize()));
  assert.equal(saved[0].kind, "enderPearl");
  assert.equal(saved[0].owner, "player");
  const restored = new Projectiles(rand(9)); restored.load(saved);
  assert.equal(restored.balls[0].kind, "enderPearl");
  assert.equal(restored.balls[0].owner, "player");
  assert.equal(restored.balls[0].random, restored.balls[0].rand);
  const invalid = new Projectiles(rand(1)); invalid.load([{ ...saved[0], owner: "other" }]);
  assert.equal(invalid.balls.length, 0);
  invalid.load([{ ...saved[0], kind: "misspelled", owner: "player" }]);
  assert.equal(invalid.balls.length, 0);
});

test("renderer selects the ender pearl item icon rather than the snowball or egg icon", () => {
  assert.equal(projectileItemId("enderPearl"), 378);
  assert.equal(projectileItemId("snowball"), 312);
  assert.equal(projectileItemId("egg"), 316);
  assert.throws(() => projectileItemId("enderPearlTypo"), /Unsupported projectile render kind/);
});
