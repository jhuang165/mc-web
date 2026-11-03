import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { solidBlock, CACTUS, FIRE, WEB } from "./world.js";
import { itemFromOriginal } from "./region-import.js";
import { PlayerInventory } from "./inventory.js";
import { Minecarts, CART_SLOTS, MINECART_ITEM, CHEST_ITEM, Y_OFFSET } from "./minecarts.js";

const f = Math.fround;
// public/research/minecart-reference.json: the unchanged EntityMinecartChest (tools/verify-minecarts.mjs).
const ref = JSON.parse(await readFile(new URL("../public/research/minecart-reference.json", import.meta.url)));
// Probe-only rail ids, so the replay does not depend on world.js exporting RAIL.
const RAIL = 9001, GOLDEN = 9002, rails = { [RAIL]: "rail", [GOLDEN]: "golden" };
// Original ids: stone 1, golden rail 27, web 30, fire 51, rail 66, cactus 81.
const internal = { 1: 3, 27: GOLDEN, 30: WEB, 51: FIRE, 66: RAIL, 81: CACTUS };
function probeWorld(cells, voidBelow) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 && !voidBelow ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)) };
}
// NbtProbe.number writes negative zero as "-0".
const num = (v) => (v === "-0" ? -0 : v);
// MinecartProbe.LOOT as a generation record (original ids, the book's StoredEnchantments).
const LOOT = [
  [0, 265, 0, 5], [1, 266, 0, 3], [2, 331, 0, 9], [3, 351, 4, 9], [5, 264, 0, 2], [6, 263, 0, 10], [8, 296, 0, 3], [9, 257, 0, 1],
  [11, 66, 0, 16], [12, 362, 0, 4], [13, 361, 0, 3], [15, 329, 0, 1], [17, 417, 0, 1], [20, 403, 0, 1, 16, 2], [21, 4, 0, 64], [26, 1, 0, 47],
].map(([slot, id, damage, count, ench, lvl]) => ({ slot, id, damage, count, ...(ench ? { stored: [{ id: ench, lvl }] } : {}) }));
// NBT probe tag -> { key: [type, value] } with lists as [type, elementType, items], as Minecarts.toNBT.
function plain(tag) {
  const value = (t) => (t.type === 10 ? Object.fromEntries(t.value.map(([k, v]) => [k, plain(v)])) : t.type === 9 ? t.value.items : num(t.value));
  if (tag.type === 9) return [9, tag.value.elementType, tag.value.items.map((i) => (tag.value.elementType === 10 ? Object.fromEntries(i.map(([k, v]) => [k, plain(v)])) : num(i)))];
  return [tag.type, value(tag)];
}

function replay(c) {
  const world = probeWorld(c.cells, c.void), carts = new Minecarts({ rails });
  const list = c.carts.map(([x, y, z, vx, vy, vz], i) => {
    const cart = carts.spawnChest({ x, y, z, items: c.loot && i === 0 ? LOOT : [], customName: i === 0 ? c.customName : null }, { seed: 1000 + i });
    assert.equal(cart.id, i + 1);
    [cart.vx, cart.vy, cart.vz] = [vx, vy, vz];
    return cart;
  });
  const player = c.player && { x: c.player[0], y: c.player[1], z: c.player[2], vx: 0, vz: 0 };
  if (player) player.bb = [player.x - 0.3, player.y, player.z - 0.3, player.x + 0.3, player.y + 1.8, player.z + 0.3];
  if (c.nbt) assert.deepEqual(carts.toNBT(list[0]), plain(c.nbt).at(-1), `${c.name} nbt`);
  let log = [];
  const attack = carts.attack.bind(carts);
  carts.attack = (cart, n, o = {}) => (log.push(`${o.source ?? (o.player ? "player" : "generic")}:${n.toFixed(1)}`), attack(cart, n, o));
  const hits = new Map(c.hits.map(([t, kind, n]) => [t, [kind, n]]));
  const drops = [];
  c.ticks.forEach(([states, events, items, push], t) => {
    const at = `${c.name} tick ${t}`;
    log = [];
    const hit = hits.get(t);
    if (hit) carts.attack(list[0], hit[1], hit[0] === "player" ? { player: true, creative: c.creative } : {});
    if (c.push)
      for (const cart of list)
        if (!cart.dead) {
          const [x, z] = carts.collide(cart, player);
          player.vx += x; player.vz += z;
        }
    carts.tick(world, { entities: c.blocker ? [player] : [] });
    states.forEach((s, i) => {
      const cart = list[i], [x, y, z, vx, vy, vz, onGround, yaw, pitch, dead, damage, rolling, rollingDir, inWeb, minY, fire, ...points] = s.map(num);
      // RenderMinecart's rail lookups at the position: the point under the cart and +-0.3 along it.
      const xyz = (p) => (p ? [p.x, p.y, p.z] : null);
      assert.deepEqual([carts.railPos(world, cart.x, cart.posY, cart.z), carts.railPosAhead(world, cart.x, cart.posY, cart.z, f(0.3)), carts.railPosAhead(world, cart.x, cart.posY, cart.z, -f(0.3))].map(xyz),
        points.map((p) => p && p.map(num)), `${at} cart ${i} rail points`);
      assert.deepEqual([cart.x, cart.posY, cart.z, cart.vx, cart.vy, cart.vz], [x, y, z, vx, vy, vz], `${at} cart ${i}`);
      assert.deepEqual([cart.onGround, cart.yaw, cart.pitch, cart.dead, cart.damage, cart.rolling, cart.rollingDir, cart.inWeb, cart.bb[1], cart.fire],
        [onGround, f(yaw), f(pitch), dead, f(damage), rolling, rollingDir, inWeb, minY, fire], `${at} cart ${i} state`);
      assert.equal(cart.y, cart.bb[1]);
      assert.equal(cart.posY, cart.bb[1] + Y_OFFSET);
    });
    assert.deepEqual(log.join(" "), events, `${at} events`);
    if (push) assert.deepEqual([player.vx, player.vz], push.map(num), `${at} push`);
    const out = carts.drain();
    assert.equal(out.length, items.length, `${at} drops`);
    items.forEach(([id, count, damage, x, y, z, vx, vy, vz, delay, tag], k) => {
      const d = out[k], mapped = itemFromOriginal(id, damage), where = `${at} drop ${k}`;
      if (mapped) assert.deepEqual([d.stack.id, d.stack.damage, d.original], [mapped.id, mapped.damage, null], where);
      else assert.deepEqual([d.stack, d.original.id, d.original.damage], [null, id, damage], where);
      const s = d.stack ?? d.original;
      assert.deepEqual([s.count, d.x, d.posY, d.z, d.delay], [count, x, y, z, delay], where);
      // entityDropItem motion is Math.random() in EntityItem's constructor; the spill's is the cart rand.
      if (delay === 0) assert.deepEqual(d.motion, [vx, vy, vz], where);
      else assert.equal(d.motion, null, where);
      // The book's StoredEnchantments; the named cart's minecart item carries display.Name.
      const t2 = tag ? plain(tag)[1] : {};
      assert.deepEqual(s.stored, t2.StoredEnchantments?.[2].map((e) => ({ id: e.id[1], lvl: e.lvl[1] })), where);
      assert.equal(s.name, t2.display?.[1].Name[1], where);
      drops.push(d);
    });
  });
  return { carts, list, drops };
}

test("Minecarts replays the original EntityMinecartChest tick for tick", () => {
  assert.equal(ref.cases.length, 34);
  let ticks = 0;
  for (const c of ref.cases) {
    const { carts, list } = replay(c);
    ticks += c.ticks.length;
    assert.deepEqual(carts.list, list.filter((k) => !k.dead), c.name);
  }
  assert.equal(ticks, 1213);
});

test('chest-cart items retain anvil tags through JSON and Java entity NBT',()=>{
 const carts=new Minecarts({rails});
 const tags={enchantments:[{id:16,lvl:3}],repairCost:8,displayName:'Cart sword',unbreakable:true};
 const cart=carts.spawnChest({x:0,y:1,z:0,items:[{slot:0,id:276,damage:4,count:1,...tags}]});
 const saved=carts.toJSON(),loaded=Minecarts.fromJSON(saved,{rails}),restored=loaded.list[0];
 assert.deepEqual(restored.slots[0],{id:115,count:1,damage:4,...tags});
 const item=loaded.toNBT(restored).Items[2][0];
 assert.equal(item.id[1],276);assert.equal(item.Damage[1],4);
 assert.deepEqual(item.tag[1],{
   ench:[9,10,[{id:[2,16],lvl:[2,3]}]],RepairCost:[3,8],display:[10,{Name:[8,'Cart sword']}],Unbreakable:[1,1],
 });
});

test("the replay covers breaking, spilling, creative hits, rails and pushes", () => {
  const byName = Object.fromEntries(ref.cases.map((c) => [c.name, c]));
  const ids = (name) => replay(byName[name]).drops.map((d) => d.stack?.id ?? d.original.id);
  const chest = itemFromOriginal(CHEST_ITEM).id;
  // Survival break: every stack spills (64 cobblestone in pieces), then the minecart and chest items.
  const fist = replay(byName["hits-fist"]);
  assert.ok(fist.list[0].dead);
  assert.equal(fist.drops.filter((d) => d.stack?.id === itemFromOriginal(4).id).reduce((n, d) => n + d.stack.count, 0), 64);
  assert.deepEqual(fist.drops.slice(-2).map((d) => [d.stack?.id ?? d.original.id, d.delay]), [[itemFromOriginal(MINECART_ITEM)?.id ?? MINECART_ITEM, 10], [chest, 10]]);
  // Creative without a name: contents only; named: the cart items too.
  assert.ok(!ids("hit-creative").includes(chest));
  assert.ok(ids("hit-creative-named").includes(chest));
  assert.ok(!replay(byName["hits-spaced"]).list[0].dead);
  // The cart climbs and descends the slope, turns the curves and the golden rail kicks it off the stone.
  assert.ok(Math.max(...byName["slope-up"].ticks.map((t) => t[0][0][1])) >= 1.5);
  assert.ok(byName["slope-up"].ticks.at(-1)[0][0][0] > 6);
  assert.ok(replay(byName["curve"]).list[0].z > 2);
  assert.ok(replay(byName["golden-kick"]).list[0].x > 1);
  const two = replay(byName["two-carts"]).list;
  assert.ok(two[1].x > 5);
});

test("a mineshaft chest cart opens as a 27-slot container and survives a save round trip", () => {
  const carts = new Minecarts({ rails, random: () => ({ nextFloat: () => 0.5, nextInt: () => 0, nextGaussian: () => 0 }) });
  const cart = carts.spawnChest({ x: 10.5, y: 64.5, z: -3.5, items: LOOT });
  const inv = carts.interact(cart);
  assert.equal(inv.size, CART_SLOTS);
  assert.equal(inv.title, "Minecart");
  assert.deepEqual(inv.getStack(0), { id: itemFromOriginal(265).id, count: 5, damage: 0 });
  // Unmapped original items stay hidden in their slot until the build maps them.
  const unmapped = LOOT.filter((it) => !itemFromOriginal(it.id, it.damage));
  for (const it of unmapped) assert.equal(inv.getStack(it.slot), null);
  assert.equal(cart.unmapped.filter(Boolean).length, unmapped.length);
  const container = carts.container(cart, new PlayerInventory());
  assert.equal(container.rows, 3);
  assert.equal(container.title, "Minecart");
  inv.setStack(4, { id: itemFromOriginal(264).id, count: 1, damage: 0 });
  cart.vx = 0.25;
  const json = JSON.parse(JSON.stringify(carts.toJSON()));
  const back = Minecarts.fromJSON(json, { rails }).list[0];
  assert.deepEqual([back.x, back.posY, back.z, back.vx], [10.5, 64.5, -3.5, 0.25]);
  assert.deepEqual(back.slots, cart.slots);
  assert.deepEqual(back.unmapped, cart.unmapped);
  // A placed stack over a hidden unmapped item moves that item to a free slot.
  const hidden = unmapped[0];
  if (hidden) {
    inv.setStack(hidden.slot, { id: itemFromOriginal(1).id, count: 1, damage: 0 });
    assert.equal(cart.unmapped[hidden.slot], null);
    assert.equal(cart.unmapped.filter(Boolean).length, unmapped.length);
  }
  // A named cart's container uses the name; a dead cart no longer opens.
  const named = carts.spawnChest({ x: 0.5, y: 0.5, z: 0.5, items: [], customName: "Loot" });
  assert.equal(carts.interact(named).title, "Loot");
  carts.attack(named, 5);
  assert.ok(named.dead);
  assert.equal(carts.interact(named), null);
  assert.ok(carts.usable(cart, { x: 12, y: 64, z: -3 }) && !carts.usable(cart, { x: 30, y: 64, z: -3 }));
});

test("the render pose follows the rail slope and wobbles after a hit", () => {
  const map = new Map([["0,0,0", [RAIL, 2]], ["-1,0,0", [RAIL, 1]], ["1,1,0", [RAIL, 1]]]);
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  const world = { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)) };
  const carts = new Minecarts({ rails, random: () => ({ nextFloat: () => 0.5, nextInt: () => 0, nextGaussian: () => 0 }) });
  const cart = carts.spawnChest({ x: 0.5, y: 1, z: 0.5, items: [] });
  const pose = carts.renderPose(world, cart, 1);
  // Ascending east (meta 2): the rail rises one block over one, atan(1/sqrt 2) * 73 degrees.
  assert.ok(Math.abs(Math.abs(pose.pitch) - f(Math.atan(Math.SQRT1_2) * 73)) < 1e-4, String(pose.pitch));
  assert.ok(Math.abs(pose.x - 0.5) < 0.003 && Math.abs(pose.z - 0.5) < 0.003);
  assert.equal(pose.roll, 0);
  carts.attack(cart, 1);
  const hit = carts.renderPose(world, cart, 0.5);
  assert.ok(hit.roll !== 0);
});

test("the ModelMinecart boxes land where scale(-1, -1, 1) and the part rotations put them", async () => {
  const THREE = await import("three");
  const { cartModel } = await import("./minecart-renderer.js");
  const model = cartModel(new THREE.MeshBasicMaterial());
  model.updateMatrixWorld(true);
  const bounds = model.children.map((part) => new THREE.Box3().setFromObject(part)).map((b) => [...b.min.toArray(), ...b.max.toArray()].map((v) => Math.round(v * 16 * 1000) / 1000 + 0));
  // Floor (rotX pi/2 about y 4): y -5..-3 after the flip; sides 8 high around y 4 -> -3..5; the
  // inner plate (rotation point 4.1, rotX -pi/2) inside the floor, 0.1 pixel under its top face.
  assert.deepEqual(bounds[0], [-10, -5, -8, 10, -3, 8]);
  // The flip mirrors x: the side at rotation point x -9 draws at +9.
  assert.deepEqual(bounds[1], [8, -3, -8, 10, 5, 8]);
  assert.deepEqual(bounds[2], [-10, -3, -8, -8, 5, 8]);
  assert.deepEqual(bounds[3], [-8, -3, -8, 8, 5, -6]);
  assert.deepEqual(bounds[4], [-8, -3, 6, 8, 5, 8]);
  assert.deepEqual(bounds[5], [-9, -4.1, -7, 9, -3.1, 7]);
});
