import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armorTypeOf, headItemMatrix, showsPumpkinBlur, PUMPKIN_BLOCK, SKULL_SCALE, PUMPKIN_SCALE } from "./wearable-heads.js";
import { PlayerInventory, PlayerContainer } from "./inventory.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/polish-reference.json", import.meta.url)));
const rec = (name) => ref.records.filter((r) => r.case === name);

test("head branch constants come from RenderPlayer bytecode", () => {
  const calls = rec("headBranch")[0].calls, by = (c) => calls.filter((x) => x.call === c);
  assert.deepEqual(by("glTranslatef")[0].ops, ["ldc 0.625", "fconst_0", "ldc -0.25", "fconst_0"]);
  assert.deepEqual(by("glRotatef")[0].ops, ["ldc 90.0", "fconst_0", "fconst_1", "fconst_0"]);
  assert.equal(PUMPKIN_SCALE, 0.625);
  assert.deepEqual(by("glScalef")[0].ops, ["fload4", "fload4", "fneg", "fload4", "fneg"]); // (f, -f, -f)
  assert.deepEqual(by("glScalef")[1].ops.slice(0, 1), ["ldc 1.0625"]);
  assert.equal(SKULL_SCALE, 1.0625);
  assert.equal(by("TileEntitySkullRenderer.func_152674_a").length, 1);
});

test("head item matrices", () => {
  const sk = headItemMatrix(2050).elements;
  assert.deepEqual([sk[0], sk[5], sk[10]], [1.0625, 1.0625, 1.0625]); // (1.0625, -1.0625, -1.0625) * (-1, -1, 1) * Ry(180)
  const pm = headItemMatrix(PUMPKIN_BLOCK).elements; // translate(0, -0.25, 0) Ry(90) scale(0.625, -0.625, -0.625)
  assert.ok(Math.abs(pm[13] + 0.25) < 1e-9);
  assert.ok(Math.abs(pm[2] - -0.625 * 1) < 1e-9 || Math.abs(pm[2] + 0.625) < 1e-9);
});

test("the helmet slot accepts a pumpkin and mob heads, other slots do not", () => {
  const inv = new PlayerInventory(ITEMS, [{ id: PUMPKIN_BLOCK, count: 4 }, { id: 2050, count: 1, damage: 3 }, { id: 4, count: 1 }]);
  const c = new PlayerContainer(inv, { craft: () => null }), helmet = c.slots[5], chest = c.slots[6];
  assert.equal(armorTypeOf(ITEMS, PUMPKIN_BLOCK), 0);
  assert.equal(armorTypeOf(ITEMS, 2050), 0);
  assert.equal(armorTypeOf(ITEMS, 4), undefined);
  assert.ok(helmet.valid({ id: PUMPKIN_BLOCK, count: 1 }) && helmet.valid({ id: 2050, count: 1, damage: 1 }));
  assert.ok(!chest.valid({ id: 2050, count: 1 }) && !helmet.valid({ id: 4, count: 1 }));
});

test("shift-click moves a head from the hotbar into the helmet slot, as Container.mergeItemStack does", () => {
  const inv = new PlayerInventory(ITEMS, []);
  inv.main[0] = { id: PUMPKIN_BLOCK, count: 3, damage: 0 };
  const c = new PlayerContainer(inv, { craft: () => null }), idx = c.slots.findIndex((s) => s.inventory === inv && s.index === 0 && s.type === undefined);
  c.transfer(idx);
  assert.equal(inv.armor[3]?.id, PUMPKIN_BLOCK);
  assert.equal(inv.armor[3].count, 3); // mergeItemStack ignores the slot limit for an empty slot (vanilla quirk, already in merge())
  assert.equal(inv.main[0], null);
});

test("the pumpkin blur shows only for a pumpkin in the first-person view", () => {
  assert.ok(showsPumpkinBlur({ id: PUMPKIN_BLOCK }, 0));
  assert.ok(!showsPumpkinBlur({ id: PUMPKIN_BLOCK }, 1));
  assert.ok(!showsPumpkinBlur({ id: 2050 }, 0) && !showsPumpkinBlur(null, 0));
});

test("saved heads reload into the helmet slot", () => {
  const inv = new PlayerInventory(ITEMS, [], [null, null, null, { id: 2050, count: 1, damage: 4 }]);
  assert.equal(inv.armor[3]?.id, 2050);
  assert.equal(inv.armor[3].damage, 4);
});

// ---- first-person map and item-frame map (bytecode-derived) ----
import * as THREE from "three";
import { MAP_HAND, FRAME_MAP_SHIFT, FRAME_MAP_SCALE, mapHandMatrices, frameMapMatrix, MAP_COLOR_Z, ICON_Z } from "./map-render.js";

const callsOf = (name, call) => rec(name)[0].calls.filter((c) => c.call === call);
const nums = (c) => c.ops.filter((o) => o.startsWith("ldc ") || o.startsWith("int ")).map((o) => +o.split(" ")[1]);

test("first-person map constants equal the ItemRenderer bytecode", () => {
  const rot = callsOf("mapFirstPerson", "glRotatef"), tr = callsOf("mapFirstPerson", "glTranslatef"), sc = callsOf("mapFirstPerson", "glScalef");
  assert.deepEqual(nums(rot[0]), [90]); assert.deepEqual(nums(rot[1]), [-85]);
  assert.deepEqual(nums(tr[2]), [-0.0, -0.6, 1.1]); // each arm: translate(-0.0, -0.6, 1.1 * l)
  assert.deepEqual([nums(rot[2])[0], nums(rot[3])[0], nums(rot[4])[0], nums(rot[5])[0]], [-45, -90, 59, -65]);
  assert.deepEqual(MAP_HAND.armOffset, [0, -0.6, 1.1]); assert.equal(MAP_HAND.armX, -45); assert.deepEqual(MAP_HAND.armZ, [-90, 59]); assert.equal(MAP_HAND.armY, -65);
  assert.deepEqual(nums(rot[6]), [20]); assert.deepEqual(nums(rot[7]), [20]); assert.deepEqual(nums(rot[8]), [80]);
  assert.deepEqual(MAP_HAND.swingRot, [-20, -20, -80]);
  assert.equal(nums(sc[1])[0], MAP_HAND.mapScale); assert.equal(nums(sc[2])[0], MAP_HAND.pixel);
  assert.deepEqual([nums(rot[9])[0], nums(rot[10])[0]], MAP_HAND.mapTurn);
  assert.deepEqual(nums(tr[3]), [-1, -1]);
  assert.ok(tr[1].ops.includes("ldc 1.2") && tr[1].ops.includes("ldc 0.04") && tr[1].ops.includes("ldc -0.9"));
  assert.equal(MAP_HAND.equipDrop, 1.2); assert.equal(MAP_HAND.lift, 0.04); assert.equal(MAP_HAND.forward, -0.9); assert.equal(MAP_HAND.scale, 0.8);
  const quad = callsOf("mapFirstPerson", "Tessellator.addVertexWithUV");
  assert.equal(quad.length, 4); assert.ok(quad[0].ops.includes("int 7") && quad[1].ops.filter((o) => o === "int 128").length === 2);
});

test("item frame map constants equal RenderItemFrame bytecode", () => {
  const tr = callsOf("frameMap", "glTranslatef");
  assert.deepEqual(tr.slice(4, 8).map(nums), [[-64, -87, -1.5], [-66.5, -84.5, -1.5], [-64, -82, -1.5], [-61.5, -84.5, -1.5]]);
  assert.deepEqual(FRAME_MAP_SHIFT, [[-64, -87, -1.5], [-66.5, -84.5, -1.5], [-64, -82, -1.5], [-61.5, -84.5, -1.5]]);
  assert.equal(nums(callsOf("frameMap", "glScalef")[0])[0], FRAME_MAP_SCALE);
  assert.deepEqual(callsOf("frameMap", "glTranslatef").slice(-1)[0].ops, ["fconst_0", "fconst_0", "ldc -1.0"]);
  // setItemRotation stores rotation % 4 (EntityItemFrame.c(int)): four 90 degree steps in 1.7.10.
  assert.deepEqual(callsOf("frameMap", "glTranslatef").slice(1, 4).map((c) => c.ops.join()), ["ldc -0.16,ldc -0.16,fconst_0", "fconst_0,ldc -0.32,fconst_0", "ldc 0.16,ldc -0.16,fconst_0"]);
});

test("map icon geometry constants equal MapItemRenderer bytecode", () => {
  assert.ok(callsOf("mapIcons", "Tessellator.addVertexWithUV")[0].ops.includes("ldc2 -0.009999999776482582"));
  assert.equal(MAP_COLOR_Z, -0.01); assert.equal(ICON_Z, -0.02);
  assert.deepEqual(nums(callsOf("mapIcons", "glScalef")[0]), [4, 4, 3]);
  assert.deepEqual(nums(callsOf("mapIcons", "glTranslatef")[1]), [-0.125, 0.125]);
});

test("at rest the held map lies below the view, top edge away, left edge on the left, facing up", () => {
  const m = mapHandMatrices({ bob: { x: 0, y: 0, rz: 0, rx: 0 }, progress: 0, equip: 1 }, 0), full = m.base.clone().multiply(m.map);
  const at = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(full), tl = at(0, 0), tr = at(128, 0), bl = at(0, 128);
  assert.ok(tl.x < tr.x && tl.z < bl.z); // top-left is left of top-right; the top edge is farther (more negative z)
  assert.ok(Math.abs(tr.x - tl.x - 0.76) < 1e-3); // 128 px * 0.015625 * 0.38
  const n = new THREE.Vector3(0, 0, -1).transformDirection(full);
  assert.ok(n.y > 0.9);
  // Looking straight down turns it to face the camera: the face normal approaches +z.
  const down = mapHandMatrices({ bob: { x: 0, y: 0, rz: 0, rx: 0 }, progress: 0, equip: 1 }, 90), nd = new THREE.Vector3(0, 0, -1).transformDirection(down.base.clone().multiply(down.map));
  assert.ok(nd.z > 0.9, JSON.stringify(nd));
  // the two arms hold opposite sides
  const a0 = new THREE.Vector3().applyMatrix4(m.base.clone().multiply(m.arms[0])), a1 = new THREE.Vector3().applyMatrix4(m.base.clone().multiply(m.arms[1]));
  assert.ok(a0.x < 0 && a1.x > 0);
});

test("a map in an item frame faces the wall's front and the four rotations differ", () => {
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const m = frameMapMatrix(r), n = new THREE.Vector3(0, 0, -1).transformDirection(m);
    assert.ok(n.z > 0.99, "faces +z of the frame's item frame");
    seen.add(new THREE.Vector3(0, 0, 0).applyMatrix4(m).toArray().join());
  }
  assert.equal(seen.size, 4);
});

// ---- item 4: /summon FireworksRocketEntity ----
import { NBT } from "./nbt.js";
import { summonFireworkRocket, FIREWORK_SUMMON } from "./firework-summon.js";
import { SUMMONABLE } from "./commands.js";
import { FireworkRockets } from "./fireworks-live.js";
import { Minecarts } from "./minecarts.js";
import { summonCart } from "./cart-summon.js";
import * as V from "./cart-variants.js";
import { runCommandCart, cartCommandPosition } from "./command-cart.js";

const T = (type, value) => ({ type, value });
const C = (obj) => new Map(Object.entries(obj));
const doubles = (...v) => T(NBT.LIST, { elementType: NBT.DOUBLE, items: v });
const rocketItem = (flight, explosions) => T(NBT.COMPOUND, C({ id: T(NBT.SHORT, 401), Count: T(NBT.BYTE, 1), Damage: T(NBT.SHORT, 0),
  tag: T(NBT.COMPOUND, C({ Fireworks: T(NBT.COMPOUND, C({ Flight: T(NBT.BYTE, flight), Explosions: T(NBT.LIST, { elementType: NBT.COMPOUND, items: explosions }) })) })) }));

test("/summon FireworksRocketEntity is registered", () => {
  assert.equal(SUMMONABLE.FireworksRocketEntity, FIREWORK_SUMMON);
});

test("firework summon matches the original zf(World) + readFromNBT records", () => {
  const records = rec("fireworkNbt"), by = (n) => records.find((r) => r.name === n);
  assert.equal(records.length, 9);
  const run = (tag) => { const rk = new FireworkRockets(); summonFireworkRocket(rk, 1, 2, 3, tag); return rk.rockets[0]; };
  const bare = run(new Map()), b = by("bare");
  assert.deepEqual([bare.life, bare.lifetime, bare.mx, bare.my, bare.mz], [b.life, b.lifetime, ...b.motion]);
  assert.equal(bare.stack, null);
  const life = run(C({ Life: T(NBT.INT, 5), LifeTime: T(NBT.INT, 17) })), l = by("life");
  assert.deepEqual([life.life, life.lifetime], [l.life, l.lifetime]);
  const neg = run(C({ Life: T(NBT.INT, -3), LifeTime: T(NBT.INT, -1) }));
  assert.deepEqual([neg.life, neg.lifetime], [by("negative").life, by("negative").lifetime]);
  const mo = run(C({ Motion: doubles(0.5, 0.25, -0.75) })), m = by("motion");
  assert.deepEqual([mo.mx, mo.my, mo.mz], m.motion);
  const clamp = run(C({ Motion: doubles(11, -12, 3) }));
  assert.deepEqual([clamp.mx, clamp.my, clamp.mz], by("motion-clamp").motion); // components above 10 reset to 0
});

test("firework summon item: kept for any valid stack, dropped for an unknown id", () => {
  const rk = new FireworkRockets();
  const ex = C({ Type: T(NBT.BYTE, 1), Colors: T(NBT.INT_ARRAY, Int32Array.from([16711680])), FadeColors: T(NBT.INT_ARRAY, Int32Array.from([255])), Flicker: T(NBT.BYTE, 1), Trail: T(NBT.BYTE, 0) });
  summonFireworkRocket(rk, 0, 0, 0, C({ LifeTime: T(NBT.INT, 30), FireworksItem: rocketItem(2, [ex]) }));
  const r = rk.rockets[0], item = by("item");
  function by(n) { return rec("fireworkNbt").find((x) => x.name === n); }
  assert.equal(r.lifetime, item.lifetime);
  assert.equal(r.stack.fireworks.flight, item.item.tag.Fireworks.Flight);
  assert.equal(r.stack.fireworks.explosions.length, 1);
  assert.deepEqual(r.stack.fireworks.explosions[0].colors, item.item.tag.Fireworks.Explosions[0].Colors);
  const bogus = C({ FireworksItem: T(NBT.COMPOUND, C({ id: T(NBT.SHORT, 9999), Count: T(NBT.BYTE, 1), Damage: T(NBT.SHORT, 0) })) });
  summonFireworkRocket(rk, 0, 0, 0, bogus);
  assert.equal(rk.rockets[1].stack, null);
  assert.equal(by("item-unknown-id").item, null);
});

test("a summoned bare rocket explodes on its first tick, a LifeTime one waits", () => {
  const rk = new FireworkRockets(), exploded = [];
  const world = { get: (x, y, z) => (y < 64 ? 3 : 0), getMeta: () => 0, solid: (x, y, z) => y < 64 };
  summonFireworkRocket(rk, 0, 70, 0, new Map());
  summonFireworkRocket(rk, 5, 70, 5, C({ LifeTime: T(NBT.INT, 3) }));
  rk.tick(world, { explode: (...a) => exploded.push(a) });
  assert.equal(exploded.length, 1); // life 1 > lifetime 0
  assert.equal(rk.rockets.length, 1);
  for (let t = 0; t < 2; t++) rk.tick(world, { explode: (...a) => exploded.push(a) });
  assert.equal(exploded.length, 1); // life 3 is not > 3 yet
  rk.tick(world, { explode: (...a) => exploded.push(a) });
  assert.equal(exploded.length, 2);
});

// ---- item 5: command block minecart ----
test("command cart activator delay matches xn.a(IIIZ) records", () => {
  for (const rc of rec("commandCartPass")) {
    const m = new Minecarts({}), cart = m.spawnCart(6, { x: 0.5, y: 64, z: 0.5, items: [] }), fired = [];
    const host = { runCommand: (c) => fired.push(c.age) };
    // first row: ticksExisted of the first call; the original field b starts at 0 as cart.lastRun does
    cart.age = rc.rows[0][0];
    for (const [age, , , did] of rc.rows) { cart.age = age; const before = fired.length; V.activatorPass(cart, rc.powered, host); assert.equal(fired.length - before, did, `${rc.name} age ${age}`); }
  }
});

test("command cart is not retriggered by an unpowered rail and keeps b across ticks", () => {
  const m = new Minecarts({}), cart = m.spawnCart(6, { x: 0, y: 64, z: 0, items: [] }), fired = [];
  cart.age = 10; V.activatorPass(cart, false, { runCommand: () => fired.push(1) });
  assert.equal(fired.length, 0);
  V.activatorPass(cart, true, { runCommand: () => fired.push(1) });
  cart.age = 13; V.activatorPass(cart, true, { runCommand: () => fired.push(1) });
  cart.age = 14; V.activatorPass(cart, true, { runCommand: () => fired.push(1) });
  assert.equal(fired.length, 2);
});

test("command cart NBT, summon tags and save/load", () => {
  const m = new Minecarts({});
  summonCart(m, 6, 1.5, 64, 2.5, C({ Command: T(NBT.STRING, "say hi"), SuccessCount: T(NBT.INT, 1), CustomName: T(NBT.STRING, "Rail"), TrackOutput: T(NBT.BYTE, 0) }));
  const cart = m.carts[0], ref = rec("commandCartNbt").find((r) => r.name === "command");
  assert.equal(cart.type, ref.type);
  assert.deepEqual({ ...cart.command }, { command: "say hi", successCount: 1, customName: "Rail", trackOutput: false, lastOutput: null });
  const nbt = V.variantNBT(cart);
  assert.deepEqual([nbt.Command[1], nbt.SuccessCount[1], nbt.CustomName[1], nbt.TrackOutput[1]], [ref.out.Command, ref.out.SuccessCount, ref.out.CustomName, ref.out.TrackOutput]);
  const bare = rec("commandCartNbt").find((r) => r.name === "bare");
  const fresh = new Minecarts({}).spawnCart(6, { x: 0, y: 0, z: 0, items: [] });
  assert.deepEqual([V.variantNBT(fresh).Command[1], V.variantNBT(fresh).CustomName[1], V.variantNBT(fresh).TrackOutput[1]], [bare.out.Command, bare.out.CustomName, bare.out.TrackOutput]);
  const back = Minecarts.fromJSON(JSON.parse(JSON.stringify(m.toJSON())), {});
  assert.deepEqual(back.carts[0].command, cart.command);
  assert.equal(back.carts[0].type, 6);
  // untrusted save data is sanitised
  const hostile = Minecarts.fromJSON({ version: 1, carts: [{ type: 6, x: 0, y: 0, z: 0, command: { command: 5, successCount: "x", customName: {}, trackOutput: 0 } }] }, {});
  assert.equal(hostile.carts[0].command.command, "");
  assert.equal(hostile.carts[0].command.customName, "@");
});

test("command cart sender position and the right-click GUI hook", async () => {
  assert.deepEqual(cartCommandPosition({ x: 2.7, posY: 64.2, z: -0.3 }), { x: 2, y: 64, z: -1 }); // floor(x), floor(y + 0.5), floor(z)
  const { useMinecart } = await import("./structure-simulation.js");
  const m = new Minecarts({}), cart = m.spawnCart(6, { x: 0, y: 0, z: 0, items: [] }), opened = [];
  const out = useMinecart({ minecarts: m, survival: {} }, { place: true, cart }, { openCommandCart: (c) => opened.push(c) });
  assert.equal(out.branch, "open-command-cart");
  assert.equal(opened[0], cart);
});

test("running a command cart records SuccessCount and output", () => {
  const m = new Minecarts({}), cart = m.spawnCart(6, { x: 0, y: 64, z: 0, items: [] });
  cart.command.command = "";
  const host = { rules: {}, cheats: true, print() {}, position: () => ({ x: 0, y: 0, z: 0 }), name: "P" };
  assert.equal(runCommandCart(cart, { host }), 0);
  assert.equal(cart.command.successCount, 0);
});
