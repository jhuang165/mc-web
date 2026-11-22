// Batch 95 portals95: a real world load resets port-only mob transients and the item pickup delay; minecart custom display and negative Fuel survive save/load / portal records.
// See .shared-memory/notes/portals95-b95-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { ItemEntities } from "./item-entities.js";
import { Minecarts } from "./minecarts.js";
import { setDisplayTile, setDisplayTileData, setDisplayTileOffset, displayTile, displayData, displayOffset } from "./cart-variants.js";

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const pig = { id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, age: 777, idle: 33, revenge: 5, livingSoundTime: 40 };

test("a real world load starts port-only mob transients over; the default constructor (in-session rebuild) keeps them", () => {
  const live = new EntityWorld(air, [{ ...pig }], () => 0.5);
  assert.equal(live.entities[0].age, 777, "in-session rebuild keeps the saved ticks");
  assert.equal(live.entities[0].idle, 33);
  const loaded = new EntityWorld(air, [{ ...pig }], () => 0.5, undefined, { reload: true });
  const fresh = loaded.create("pig", 64.5, 5, 64.5);
  assert.equal(loaded.entities[0].age, fresh.age);
  assert.equal(loaded.entities[0].idle, fresh.idle);
  assert.equal(loaded.entities[0].health, 10, "saved state stays");
});

test("item load: reload zeroes the pickup delay and ignores the saved hover, in-session keeps both", () => {
  const rec = { stack: { id: 1, count: 1, damage: 0 }, x: 1.5, y: 5, z: 1.5, age: 100, delay: 30, hover: 1.25 };
  const a = new ItemEntities(); a.load([rec], (s) => s, 0);
  assert.equal(a.items[0].delay, 30);
  assert.equal(a.items[0].hover, 1.25);
  const b = new ItemEntities(); b.load([rec], (s) => s, 0, { reload: true });
  assert.equal(b.items[0].delay, 0);
  assert.notEqual(b.items[0].hover, 1.25);
  assert.equal(b.items[0].age, 100, "Age is NBT and stays");
});

test("a cart's custom display tile and a furnace cart's negative Fuel survive the save record", () => {
  const carts = new Minecarts({ rails: {} });
  const c = carts.spawnCart(2, { x: 0.5, y: 0.5, z: 0.5, fuel: -100 });
  setDisplayTile(c, 54); setDisplayTileData(c, 3); setDisplayTileOffset(c, 9);
  const back = Minecarts.fromJSON(JSON.parse(JSON.stringify(carts.toJSON())), { rails: {} });
  const r = back.list[0];
  assert.deepEqual([displayTile(r), displayData(r), displayOffset(r), r.dispOn], [54, 3, 9, 1]);
  assert.equal(r.fuel, -100);
});
