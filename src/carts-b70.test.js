// Batch 70 carts70: the entity half of TileEntityHopper.func_145893_b and the client copy interpolation of EntityMinecart
// (public/research/carts-b70-reference.json, tools/verify-carts-b70.mjs, tools/probes/CartsB70Probe.java, executed on the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartInventoryAt, cartInCell } from "./cart-inventory.js";
import { containerAt, pushOne, suckFromInventory } from "./inventory-transfer.js";
import { updateHopper, newHopperTile } from "./hopper.js";
import { RemoteVehicles, cartSetPositionAndRotation2, cartClientStep } from "./multiplayer/remote-vehicles.js";
import { Minecarts } from "./minecarts.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/carts-b70-reference.json", import.meta.url), "utf8"));
const TYPE = { chest: 1, hopper: 5, rideable: 0, furnace: 2 };
const maxStack = () => 64;

test("lookup cases replay the native entity search", () => {
  for (const c of ref.cases.filter((x) => x.kind === "lookup")) {
    const carts = c.kinds.map((k, i) => ({ id: i + 1, type: TYPE[k] ?? 4, bb: c.boxes[i], dead: c.dead.includes(i), slots: Array(k === "hopper" ? 5 : 27).fill(null), unmapped: [] }));
    // World.rand.nextInt(size) of the probe's Random(2) is 1 for two carts.
    const inv = cartInventoryAt(carts, ...c.cell, (n) => (n === 2 ? 1 : 0));
    assert.equal(inv ? carts.indexOf(inv.cart) : null, c.found, c.name);
  }
});

test("cartInCell is strict on every axis", () => {
  const cart = { type: 1, bb: [5, 64, 5, 6, 65, 6] };
  assert.ok(cartInCell(cart, 5, 64, 5));
  assert.ok(!cartInCell(cart, 6, 64, 5) && !cartInCell(cart, 5, 65, 5) && !cartInCell(cart, 5, 63, 5));
});

function host(carts) {
  const world = { get: () => 0, getMeta: () => 0 };
  return { world, chests: () => ({}), furnaces: () => ({}), dispensers: () => ({}), hoppers: () => ({}), maxStack, items: () => [], cartAt: (x, y, z) => cartInventoryAt(carts, x, y, z), changed() {} };
}
const chestCart = (y = 64) => ({ id: 7, type: 1, bb: [5.01, y + 0.05, 5.01, 5.99, y + 0.75, 5.99], slots: Array(27).fill(null), unmapped: [] });

test("containerAt finds a chest cart in an air cell and none without carts", () => {
  const cart = chestCart();
  assert.equal(containerAt(host([cart]), 5, 64, 5).cart, cart);
  assert.equal(containerAt(host([]), 5, 64, 5), null);
  assert.equal(containerAt({ ...host([cart]), cartAt: undefined }, 5, 64, 5), null);
});

test("a hopper pulls from a chest cart in the cell above it, one item per transfer", () => {
  const above = chestCart(66); above.slots[0] = { id: 4, count: 5, damage: 0 };
  const tile = newHopperTile();
  assert.ok(updateHopper(host([above]), tile, 5, 65, 5, 0));
  assert.equal(above.slots[0].count, 4);
  assert.equal(tile.items[0].count, 1);
});

test("a hopper facing down pushes into a chest cart below it", () => {
  const cart = chestCart(64), tile = newHopperTile();
  tile.items[0] = { id: 4, count: 3, damage: 0 };
  assert.ok(updateHopper(host([cart]), tile, 5, 65, 5, 0));
  assert.equal(tile.items[0].count, 2);
  assert.equal(cart.slots[0].count, 1);
});

test("an unmapped slot of a cart takes no insertion", () => {
  const cart = chestCart(); cart.unmapped[0] = { id: 9999, count: 1, damage: 0 };
  const inv = cartInventoryAt([cart], 5, 64, 5);
  const src = { size: 1, key: "", keys: [], sides: null, get: () => ({ id: 4, count: 1, damage: 0 }), set() {}, valid: () => true };
  assert.ok(pushOne(src, inv, 1, maxStack));
  assert.equal(cart.slots[0], null);
  assert.equal(cart.slots[1].count, 1);
});

test("a pull from a cart's inventory empties slots like a chest", () => {
  const above = chestCart(); above.slots[0] = { id: 4, count: 1, damage: 0 };
  const mine = { size: 5, key: "", keys: [], sides: null, items: Array(5).fill(null), get(i) { return this.items[i]; }, set(i, s) { this.items[i] = s; }, valid: () => true };
  assert.ok(suckFromInventory(mine, cartInventoryAt([above], 5, 64, 5), maxStack));
  assert.equal(above.slots[0], null);
  assert.equal(mine.items[0].count, 1);
});

test("client cart interpolation replays setPositionAndRotation2 and onUpdate", () => {
  const minecarts = new Minecarts();
  for (const c of ref.cases.filter((x) => x.kind === "interp")) {
    const v = minecarts.spawnCart(0, { x: c.start[0], y: c.start[1], z: c.start[2], items: [] });
    minecarts.setPosition(v, ...c.start);
    Object.assign(v, { yaw: c.yaw, pitch: c.pitch });
    const copy = { v, turn: 0 };
    for (let t = 0; t < c.ticks.length; t++) {
      for (const p of c.packets) if (p[0] === t) cartSetPositionAndRotation2(copy, { x: p[1], y: p[2], z: p[3], yaw: p[4], pitch: p[5] });
      cartClientStep(copy, (cv, x, y, z) => minecarts.setPosition(cv, x, y, z));
      const [x, y, z, yaw, pitch] = c.ticks[t];
      assert.ok(Math.abs(v.x - x) < 1e-9 && Math.abs(v.posY - y) < 1e-9 && Math.abs(v.z - z) < 1e-9, `${c.name} tick ${t} position`);
      assert.ok(Math.abs(v.yaw - yaw) < 1e-4 && Math.abs(v.pitch - pitch) < 1e-4, `${c.name} tick ${t} rotation`);
    }
  }
});

test("RemoteVehicles moves a cart copy over five ticks, boats still snap", () => {
  const rv = new RemoteVehicles({});
  const msg = (x) => ({ set: [{ v: "c1", t: 0, x, y: 64, z: 0, yaw: 0, pitch: 0 }, { v: "b1", x, y: 64, z: 0, yaw: 0, pitch: 0 }] });
  rv.apply(msg(0));
  for (let i = 0; i < 4; i++) rv.tick();
  rv.apply(msg(10));
  const cart = rv.copies.get("c1").v, boat = rv.copies.get("b1").v;
  rv.tick();
  assert.equal(boat.x, 10, "boats keep snapping");
  assert.ok(Math.abs(cart.x - 2) < 1e-9, "first step is 1/5 of the way");
  for (let i = 0; i < 4; i++) rv.tick();
  assert.ok(Math.abs(cart.x - 10) < 1e-9, "arrives after five steps");
});
