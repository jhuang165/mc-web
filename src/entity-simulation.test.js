import { test } from "node:test";
import assert from "node:assert/strict";
import { tickEntitySimulation, tickPrimedTnt } from "./entity-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles } from "./projectiles.js";
import { Arrows } from "./bow.js";

test("entity tick preserves the live item, pickup, projectile, hatch, mob-event and arrow order", () => {
  const calls = [], world = {}, position = { x: 2, y: 10, z: 3 },
    event = { chicks: 1 }, picked = [{ item: "one" }, { item: "two" }],
    state = {
      world, position, width: 0.6, height: 1.8,
      items: {
        tick(w, maxStack) { assert.equal(w, world); assert.equal(maxStack({}), 64); calls.push("items.tick"); },
        collect(p, w, h, add) {
          assert.equal(p, position); assert.equal(w, 0.6); assert.equal(h, 1.8);
          calls.push("items.collect"); add({ id: 1, count: 1 }); return picked;
        },
      },
      primed: [],
      projectiles: {
        tick(w, targets, hit) { assert.equal(w, world); assert.deepEqual(targets, ["target"]); assert.equal(hit, projectileHit); calls.push("projectiles.tick"); },
        drain() { calls.push("projectiles.drain"); return [event]; },
      },
      mobs: {},
      arrows: {
        tick(w, options) { assert.equal(w, world); assert.equal(options.marker, "arrow options"); calls.push("arrows.tick"); },
        collect(box, survival) { assert.deepEqual(box, [1.7, 10, 2.7, 2.3, 11.8, 3.3]); assert.equal(survival, state.survival); calls.push("arrows.collect"); return true; },
      },
      survival: { health: 20, inventory: { add(stack) { calls.push("inventory.add"); return true; } } },
    };
  const projectileHit = () => {};
  tickEntitySimulation(state, {
    maxStack: () => 64,
    itemPicked: (item) => calls.push(`picked:${item.item}`),
    itemsCollected: (list) => { assert.equal(list, picked); calls.push("itemsCollected"); },
    projectileTargets: () => { calls.push("projectileTargets"); return ["target"]; },
    projectileHit,
    projectileEvent: (e) => { assert.equal(e, event); calls.push("hatch"); },
    handleEntityEvents: () => calls.push("mob events"),
    arrowOptions: () => { calls.push("arrow options"); return { marker: "arrow options" }; },
    arrowsCollected: () => calls.push("arrows collected"),
    flushArrows: () => calls.push("flush arrows"),
  });
  assert.deepEqual(calls, [
    "items.tick", "items.collect", "inventory.add", "picked:one", "picked:two", "itemsCollected",
    "projectileTargets", "projectiles.tick", "projectiles.drain", "hatch", "mob events",
    "arrow options", "arrows.tick", "arrows.collect", "arrows collected", "flush arrows",
  ]);
});

test("dead player skips both pickups while item motion, projectiles, mob events and arrow flush still run", () => {
  const calls = [], world = {},
    state = {
      world, position: { x: 0, y: 4, z: 0 }, width: 0.6, height: 1.8,
      items: { tick() { calls.push("items"); }, collect() { calls.push("item pickup"); return []; } },
      primed: [], projectiles: { tick() { calls.push("projectiles"); }, drain() { return []; } },
      mobs: null,
      arrows: { tick() { calls.push("arrows"); }, collect() { calls.push("arrow pickup"); return true; } },
      survival: { health: 0, inventory: { add() { throw new Error("dead player cannot pick up items"); } } },
    };
  tickEntitySimulation(state, { flushArrows: () => calls.push("flush") });
  assert.deepEqual(calls, ["items", "projectiles", "arrows", "flush"]);
});

test("primed TNT uses a snapshot, removes a spent fuse before explosion, and keeps observer order", () => {
  const world = {
    get: (x, y) => y < 0 ? 3 : 0,
    solid(x, y, z) { return this.get(x, y, z) !== 0; },
  };
  const first = { x: 1, y: 4, z: 1, vx: 0, vy: 0, vz: 0, fuse: 0, placer: "player" },
    second = { x: 3, y: 4, z: 1, vx: 0, vy: 0, vz: 0, fuse: 2, placer: null },
    addedDuringExplosion = { x: 5, y: 4, z: 1, vx: 0, vy: 0, vz: 0, fuse: 80, placer: null },
    primed = [first, second], calls = [];
  tickPrimedTnt(world, primed, {
    smoke: (x, y, z) => calls.push(["smoke", x, y, z]),
    explode: (x, y, z, power, context) => {
      calls.push(["explode", x, y, z, power, context]);
      assert.equal(primed.includes(first), false, "detonating TNT is removed before explosion callbacks");
      primed.push(addedDuringExplosion);
    },
  });
  assert.equal(calls[0][0], "explode");
  assert.equal(calls[0][4], 4);
  assert.equal(calls[0][5].exploder, first);
  assert.equal(calls[0][5].attacker, "player");
  assert.equal(calls[1][0], "smoke", "remaining snapshot entities smoke after the first explosion");
  assert.equal(primed.includes(first), false);
  assert.equal(primed.includes(second), true);
  assert.equal(primed.includes(addedDuringExplosion), true, "new TNT waits until the next tick");
  assert.equal(second.fuse, 1);
  assert.equal(addedDuringExplosion.fuse, 80);
});

test("the extracted segment advances real item and projectile systems before collecting an item", () => {
  const world = {
    get: (x, y) => y < 10 && y >= 0 ? 3 : 0,
    solid(x, y, z) { return this.get(x, y, z) !== 0; },
  };
  const items = new ItemEntities(() => 0.5),
    item = items.spawn({ id: 3, count: 2, damage: 0 }, 0, 10.125, 0, { motion: [0, 0, 0] }),
    projectiles = new Projectiles(() => 0.5), arrows = new Arrows(() => 0.5),
    inventory = { count: 0, add(stack) { this.count += stack.count; stack.count = 0; return true; } },
    state = {
      world, items, primed: [], projectiles, arrows, mobs: null,
      survival: { health: 20, creative: false, inventory },
      position: { x: 0, y: 10, z: 0 }, width: 0.6, height: 1.8,
    };
  const picked = [];
  tickEntitySimulation(state, { itemPicked: ({ item: got }) => picked.push(got) });
  assert.equal(item.ticks, 1, "EntityItem.onUpdate ran before player pickup");
  assert.equal(inventory.count, 2);
  assert.deepEqual(picked, [item]);
  assert.equal(items.items.length, 0);
  assert.equal(projectiles.balls.length, 0);
  assert.equal(arrows.list.length, 0);
});
