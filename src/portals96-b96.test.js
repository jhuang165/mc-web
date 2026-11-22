// Batch 96 portals96: hopper cart TransferCooldown reads 0 when absent; a server cart's custom display tile survives a server save / restart and reaches the client copy.
// See .shared-memory/notes/portals96-b96-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { World, RAIL } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { vehicleState } from "./multiplayer/server-vehicles.js";
import { RemoteVehicles } from "./multiplayer/remote-vehicles.js";
import { Minecarts } from "./minecarts.js";
import { summonCart } from "./cart-summon.js";
import { cartFromNbt } from "./region-import.js";
import { setDisplayTile, setDisplayTileData, setDisplayTileOffset, displayTile, displayData, displayOffset } from "./cart-variants.js";
import { NBT } from "./nbt.js";

const tagOf = (obj) => new Map(Object.entries(obj));
const posList = (a, t = NBT.DOUBLE) => ({ type: NBT.LIST, elementType: t, items: a });
const tag = (type, value) => ({ type, value });

test("/summon MinecartHopper: TransferCooldown absent reads 0 (a tagless summon too), present keeps its value", () => {
  const carts = new Minecarts();
  assert.equal(summonCart(carts, 5, 1.5, 5, 1.5, new Map()).cart.cooldown, 0);
  assert.equal(summonCart(carts, 5, 1.5, 5, 1.5, null).cart.cooldown, 0);
  assert.equal(summonCart(carts, 5, 1.5, 5, 1.5, tagOf({ TransferCooldown: tag(NBT.INT, 7) })).cart.cooldown, 7);
  assert.equal(carts.spawnCart(5, { x: 1.5, y: 5, z: 1.5 }).cooldown, -1, "a fresh hopper cart (dispenser, item) keeps the constructor's -1");
});

test("a hopper cart in a structure / region NBT without TransferCooldown reads 0", () => {
  const base = { Pos: tag(NBT.LIST, posList([1.5, 5, 1.5])), Motion: tag(NBT.LIST, posList([0, 0, 0])), Rotation: tag(NBT.LIST, posList([0, 0], NBT.FLOAT)) };
  const rec = cartFromNbt(new Map(Object.entries(base).map(([k, v]) => [k, v])), 5);
  assert.equal(rec.cooldown, 0);
});

function fixture(saved = {}) {
  const world = new World("portals96");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 80; x++) world.put(x, 10, 70, RAIL, 1, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode: "creative", mobs: false });
}

test("server cart custom display: saved, restored after a restart, sent in the vehicles state and applied on the client copy", () => {
  const s = fixture(), cart = s.vehicles.spawnVehicle("minecart", 65.5, 10, 70.5);
  setDisplayTile(cart, 54); setDisplayTileData(cart, 2); setDisplayTileOffset(cart, 9);
  const plain = s.vehicles.spawnVehicle("minecart", 66.5, 10, 70.5);
  assert.equal(vehicleState(plain).dr, undefined, "no custom display: nothing extra on the wire");
  const state = JSON.parse(JSON.stringify(vehicleState(cart)));
  assert.deepEqual([state.dr, state.dof], [54 | (2 << 16), 9]);
  const remote = new RemoteVehicles(s.world);
  remote.apply({ set: [state, JSON.parse(JSON.stringify(vehicleState(plain)))], del: [] });
  const copy = remote.copies.get(state.v).v, plainCopy = remote.copies.get(`c${plain.id}`).v;
  assert.deepEqual([displayTile(copy), displayData(copy), displayOffset(copy)], [54, 2, 9]);
  assert.equal(plainCopy.dispOn ? 1 : 0, 0);
  // restart: the saved world carries the display and the second server holds it again
  const again = fixture(JSON.parse(JSON.stringify(s.save())));
  const back = again.vehicles.carts.carts.find((c) => Math.abs(c.x - 65.5) < 0.01);
  assert.deepEqual([displayTile(back), displayData(back), displayOffset(back)], [54, 2, 9]);
});
