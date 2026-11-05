import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { solidBlock } from "./world.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS } from "./survival.js";
import { Minecarts, Y_OFFSET } from "./minecarts.js";
import * as V from "./cart-variants.js";

const f = Math.fround;
// public/research/carts-reference.json: the unchanged furnace, TNT and hopper carts (tools/verify-carts.mjs, tools/probes/CartsProbe.java).
const ref = JSON.parse(await readFile(new URL("../public/research/carts-reference.json", import.meta.url)));
const RAIL = 9001, ACTIVATOR = 9003, rails = { [RAIL]: "rail", [ACTIVATOR]: "activator" };
const internal = { 1: 3, 66: RAIL, 157: ACTIVATOR };
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)) };
}
const num = (v) => (v === "-0" ? -0 : v);
const TYPES = { furnace: 2, tnt: 3, hopper: 5 };
// NBT probe tag -> { key: [type, value] } as Minecarts.toNBT.
function plain(tag) {
  const value = (t) => (t.type === 10 ? Object.fromEntries(t.value.map(([k, v]) => [k, plain(v)])) : t.type === 9 ? t.value.items : num(t.value));
  if (tag.type === 9) return [9, tag.value.elementType, tag.value.items.map((i) => (tag.value.elementType === 10 ? Object.fromEntries(i.map(([k, v]) => [k, plain(v)])) : num(i)))];
  return [tag.type, value(tag)];
}
const nbtOf = (tag) => plain(tag).at(-1);
// The held stacks of the interact cases: original id/damage -> browser stack.
const heldStack = (id, damage, count) => (id ? { ...itemFromOriginal(id, damage), count } : null);

function replay(c) {
  const world = probeWorld(c.cells), carts = new Minecarts({ rails }), start = nbtOf(c.nbt);
  const cart = carts.spawnCart(TYPES[c.kind], { x: c.cart[0], y: c.cart[1], z: c.cart[2], items: [] }, { seed: 1000 });
  [cart.vx, cart.vy, cart.vz] = c.cart.slice(3);
  // The case's setup is read back from the native NBT written after it.
  if (c.kind === "furnace") Object.assign(cart, { fuel: start.Fuel[1], pushX: start.PushX[1], pushZ: start.PushZ[1], lit: start.Fuel[1] > 0 });
  if (c.kind === "tnt") cart.fuse = start.TNTFuse[1];
  if (c.kind === "hopper") {
    cart.cooldown = start.TransferCooldown[1];
    for (const it of start.Items[2]) carts.put(cart, it.Slot[1], { id: it.id[1], count: it.Count[1], damage: it.Damage[1] });
  }
  assert.deepEqual(carts.toNBT(cart), start, `${c.name} start nbt`);
  const entities = c.items.map(([x, y, z, id, count]) => ({ stack: { ...itemFromOriginal(id, 0), count }, x, y: y - 0.125, z, dead: false }));
  const explosions = [], particles = [];
  const host = {
    explode: (cart, x, y, z, power) => explosions.push([x, y, z, power]),
    particle: (name, x, y, z) => particles.push([name, x, y, z]),
    transfer: { world, items: () => entities.filter((e) => !e.dead), maxStack: (s) => ITEMS[s.id]?.stack ?? 64, chests: () => ({}), changed() {} },
  };
  const hits = new Map(c.hits.map(([t, source, n]) => [t, [source, n]])), uses = new Map(c.uses.map(([t, id, damage, count]) => [t, [id, damage, count]]));
  const player = c.player && { x: c.player[0], y: c.player[1], z: c.player[2] };
  const drops = [];
  c.ticks.forEach(([s, extra, boom, smoke, items, itemEnts, use], t) => {
    const at = `${c.name} tick ${t}`;
    explosions.length = particles.length = 0;
    const u = uses.get(t);
    let used = null;
    if (u) {
      const held = heldStack(...u);
      used = [1, 0];
      const branch = V.furnaceUse(cart, { held, creative: c.creative, take: () => { held.count--; }, position: player });
      assert.equal(branch, "fuel-furnace-minecart");
      used[1] = held ? Math.max(0, held.count) : 0;
    }
    const hit = hits.get(t);
    if (hit) carts.attack(cart, hit[1], { source: hit[0] === "generic" ? null : hit[0] });
    carts.tick(world, { entities: [], host });
    const [x, y, z, vx, vy, vz, onGround, yaw, pitch, dead, damage, rolling, rollingDir, inWeb, minY, fire] = s.map(num);
    assert.deepEqual([cart.x, cart.posY, cart.z, cart.vx, cart.vy, cart.vz], [x, y, z, vx, vy, vz], `${at} cart`);
    assert.deepEqual([cart.onGround, cart.yaw, cart.pitch, cart.dead, cart.damage, cart.rolling, cart.rollingDir, cart.inWeb, cart.bb[1], cart.fire],
      [onGround, f(yaw), f(pitch), dead, f(damage), rolling, rollingDir, inWeb, minY, fire], `${at} state`);
    assert.equal(cart.posY, cart.bb[1] + Y_OFFSET);
    if (c.kind === "furnace") assert.deepEqual([cart.fuel, cart.pushX, cart.pushZ, cart.lit ? 1 : 0], extra.map(num), `${at} furnace`);
    if (c.kind === "tnt") assert.deepEqual([cart.fuse], extra, `${at} fuse`);
    if (c.kind === "hopper") {
      const slots = cart.slots.map((st) => (st ? [itemFromOriginal(0, 0) ?? null, st.count, st.damage] : null));
      assert.deepEqual([cart.enabled ? 1 : 0, cart.cooldown], extra.slice(0, 2), `${at} hopper`);
      extra.slice(2).forEach((n, i) => {
        const st = cart.slots[i];
        assert.deepEqual(st ? [st.id, st.count, st.damage] : null, n && n[1] > 0 ? [itemFromOriginal(n[0], n[2]).id, n[1], itemFromOriginal(n[0], n[2]).damage] : null, `${at} slot ${i}`);
      });
      assert.equal(slots.length, 5);
    }
    assert.deepEqual(explosions, boom.map((e) => e.map(num)), `${at} explosions`);
    assert.deepEqual(particles, smoke.map(([name, ...p]) => [name, ...p.map(num)]), `${at} particles`);
    assert.deepEqual(entities.map((e) => [e.dead ? 0 : 1, e.stack.count, e.x, e.y + 0.125, e.z]), itemEnts, `${at} items`);
    if (use) assert.deepEqual(used, use, `${at} use`);
    const out = carts.drain();
    assert.equal(out.length, items.length, `${at} drops`);
    items.forEach(([id, count, damage, dx, dy, dz, vx2, vy2, vz2, delay], k) => {
      const d = out[k], mapped = itemFromOriginal(id, damage), where = `${at} drop ${k}`, st = d.stack ?? d.original;
      if (mapped) assert.deepEqual([d.stack.id, d.original], [mapped.id, null], where);
      else assert.deepEqual([d.stack, d.original.id], [null, id], where);
      assert.deepEqual([st.count, d.x, d.posY, d.z, d.delay], [count, dx, dy, dz, delay], where);
      if (delay === 0) assert.deepEqual(d.motion, [vx2, vy2, vz2], where);
      drops.push(d);
    });
  });
  // A spilled native slot keeps a size-0 stack (written as Count 0); the port empties the slot.
  const end = nbtOf(c.nbtEnd);
  if (end.Items) { end.Items[2] = end.Items[2].filter((i) => i.Count[1] > 0); end.Items[1] = end.Items[2].length ? 10 : 0; }
  assert.deepEqual(carts.toNBT(cart), end, `${c.name} end nbt`);
  return { carts, cart };
}

test("Furnace, TNT and hopper carts replay the original carts tick for tick", () => {
  assert.equal(ref.cases.length, 30);
  let ticks = 0;
  for (const c of ref.cases) { replay(c); ticks += c.ticks.length; }
  assert.equal(ticks, 844);
});

test("native facts the reference pins", () => {
  const by = Object.fromEntries(ref.cases.map((c) => [c.name, c]));
  const boom = (c) => c.ticks.flatMap((t) => t[2]);
  // Fuse 80 from the activator rail; power 4 + rand * 1.5 * speed at the clamp; fire and explosion kills explode at rest (power 4).
  assert.equal(boom(by["tnt-activator"]).length, 1);
  assert.equal(boom(by["tnt-activator-off"]).length, 0);
  assert.equal(boom(by["tnt-kill-slow"]).length, 0);
  assert.deepEqual(["tnt-kill-fire", "tnt-kill-lava", "tnt-kill-explosion"].map((n) => boom(by[n])[0][3]), [4, 4, 4]);
  assert.equal(boom(by["tnt-fall-low"]).length, 0);
  assert.equal(boom(by["tnt-fall-high"]).length, 1);
  const drops = (n) => by[n].ticks.flatMap((t) => t[4]).map((i) => i[0]);
  assert.deepEqual([drops("furnace-kill"), drops("furnace-kill-explosion"), drops("tnt-kill-explosion"), drops("tnt-kill-fire")], [[328, 61], [328], [328], [328, 46]]);
  assert.ok(drops("hopper-kill").includes(154));
  // The JS item table and recipes.
  assert.deepEqual(V.CART_ORIGINAL_ITEMS, { 343: 2090, 407: 2091, 408: 2092, 422: 2093 });
  assert.deepEqual([2090, 2091, 2092, 2093].map((id) => ITEMS[id].minecartType), [2, 3, 5, 6]);
});

test("furnace, TNT and hopper carts save through JSON and region NBT", () => {
  const carts = new Minecarts({ rails });
  carts.spawnCart(2, { x: 0.5, y: 0.5, z: 0.5, fuel: 1234, pushX: 0.5, pushZ: -0.25 });
  carts.spawnCart(3, { x: 2.5, y: 0.5, z: 0.5, fuse: 33 });
  carts.spawnCart(5, { x: 4.5, y: 0.5, z: 0.5, cooldown: 2, items: [{ slot: 4, id: 265, damage: 0, count: 7 }, { slot: 5, id: 265, damage: 0, count: 1 }] });
  const back = Minecarts.fromJSON(JSON.parse(JSON.stringify(carts.toJSON())), { rails });
  assert.deepEqual(back.list.map((c) => c.type), [2, 3, 5]);
  assert.deepEqual([back.list[0].fuel, back.list[0].pushX, back.list[0].pushZ, back.list[1].fuse, back.list[2].cooldown], [1234, 0.5, -0.25, 33, 2]);
  assert.equal(back.list[2].slots.length, 5);
  assert.equal(back.list[2].slots[4].count, 7);
  assert.equal(back.list[2].slots.filter(Boolean).length, 1, "slot 5 does not exist on a hopper cart");
  assert.deepEqual(back.toNBT(back.list[1]).TNTFuse, [3, 33]);
  assert.equal(back.toNBT(back.list[0]).Items, undefined);
});
