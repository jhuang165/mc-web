import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import {
  ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE, SPAWN_EGGS, eggOf, eggColor, eggSpawnPoint, eggWaterPoint, eggYaw, wrapAngleTo180, xpSplit,
  expBottleOrbs, EXP_BOTTLE,
} from "./spawn-eggs.js";
import { eggMobType, useEggOnBlock, useFireCharge } from "./spawn-egg-use.js";
import { WitchPotions } from "./witch-potions.js";
import { ITEMS, RECIPES, SHAPELESS } from "./survival.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { stackName, nativeName } from "./item-names.js";
import { stackHasEffect } from "./armor-enchantments.js";
import { SUMMONABLE } from "./commands.js";

const ref = JSON.parse(await readFile(new URL("../public/research/spawn-eggs-reference.json", import.meta.url)));

test("probe record counts", () => {
  assert.equal(ref.eggs.length, 24);
  assert.equal(ref.expImpact.length, 400);
  assert.equal(ref.expLaunch.length, 18);
  assert.equal(ref.use.length, 216);
  assert.equal(ref.fire.length, 36);
});

test("egg table, colours and names match EntityList.entityEggs", () => {
  assert.equal(SPAWN_EGGS.length, ref.eggs.length);
  for (const r of ref.eggs) {
    const e = eggOf(r.id);
    assert.equal(e.entity, r.entity);
    assert.equal(eggColor(r.id, 0), r.pass0);
    assert.equal(eggColor(r.id, 1), r.pass1);
    assert.equal(e.primary, r.primary);
    assert.equal(e.secondary, r.secondary);
    assert.equal(stackName({ id: ITEM_SPAWN_EGG, damage: r.id }, ITEMS), r.name);
    assert.equal(nativeName(383, r.id), r.name);
  }
  for (const r of ref.noEgg) { assert.equal(eggOf(r.damage), null); assert.equal(eggColor(r.damage, 0), r.pass0); assert.equal(eggColor(r.damage, 1), r.pass1); }
});

test("item ids and properties", () => {
  assert.deepEqual([ORIGINAL_ITEMS[383], ORIGINAL_ITEMS[384], ORIGINAL_ITEMS[385]], [1950, 1951, 1952]);
  assert.equal(ITEMS[ITEM_SPAWN_EGG].stack, ref.items.egg.maxStack);
  assert.equal(ITEMS[ITEM_EXP_BOTTLE].stack, ref.items.bottle.maxStack);
  assert.equal(ITEMS[ITEM_FIRE_CHARGE].stack, ref.items.charge.maxStack);
  assert.equal(ITEMS[ITEM_EXP_BOTTLE].name, "Bottle o' Enchanting");
  assert.equal(ITEMS[ITEM_FIRE_CHARGE].name, "Fire Charge");
  assert.equal(stackHasEffect({ id: ITEM_EXP_BOTTLE }, ITEMS[ITEM_EXP_BOTTLE]), ref.items.bottle.hasEffect);
  assert.equal(stackHasEffect({ id: ITEM_FIRE_CHARGE }, ITEMS[ITEM_FIRE_CHARGE]), false);
  assert.equal(ref.items.egg.multiplePasses, true);
});

test("placement offsets per side, fence and water", () => {
  for (const u of ref.use.filter((r) => !r.remote && r.spawned?.length && r.damage === 90)) {
    const at = eggSpawnPoint([5, 0, 5], u.side, false), fence = eggSpawnPoint([9, 0, 9], u.side, true), want = u.spawned[0];
    const mine = u.fence ? fence : at;
    assert.deepEqual([mine.x, mine.y, mine.z], [want.x, want.y, want.z], `side ${u.side} fence ${u.fence}`);
  }
  for (const w of ref.water.filter((r) => r.spawned)) assert.deepEqual(eggWaterPoint([3, -1, 3]), { x: w.spawned.x, y: w.spawned.y, z: w.spawned.z });
});

test("egg yaw is wrapAngleTo180(nextFloat() * 360)", () => {
  assert.equal(wrapAngleTo180(190), -170);
  assert.equal(wrapAngleTo180(179), 179);
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) { const y = eggYaw(r); assert.ok(y >= -180 && y < 180); }
  for (const u of ref.use.filter((r) => r.spawned?.length)) assert.ok(u.spawned[0].yaw >= -180 && u.spawned[0].yaw < 180);
});

test("custom names and consumption in the use records", () => {
  assert.equal(ref.named.find((r) => !r.named).spawned.customName, "");
  assert.equal(ref.named.find((r) => r.named).spawned.customName, "Bob");
  for (const u of ref.use.filter((r) => !r.remote && r.damage === 90)) assert.equal(u.count, u.creative ? 3 : 2);
  for (const u of ref.use.filter((r) => r.remote)) assert.equal(u.count, 3);
});

test("which eggs this build can spawn follows /summon", () => {
  for (const e of SPAWN_EGGS) {
    const type = eggMobType(e.damage);
    assert.equal(!!type, !!SUMMONABLE[e.entity], e.entity);
  }
  assert.equal(eggMobType(53), null);
  for (const name of ["Pig", "Cow", "Sheep", "Chicken", "Creeper", "Villager", "Wolf", "Bat", "Squid"]) assert.ok(SPAWN_EGGS.some((e) => e.entity === name && eggMobType(e.damage)), name);
});

function stubState({ creative = false, count = 3, id = ITEM_SPAWN_EGG, damage = 90, displayName } = {}) {
  const spawned = [];
  const stack = { id, count, damage, ...(displayName ? { displayName } : {}) };
  const inv = { current: 0, decr(i, n) { stack.count -= n; } };
  return {
    stack, spawned,
    state: {
      survival: { creative, held: stack, inventory: inv },
      world: { get: () => 1, height: 256, inside: () => true },
      mobs: { spawnNatural: (type, x, y, z) => { const e = { type, x, y, z }; spawned.push(e); return e; } },
    },
  };
}
test("useEggOnBlock spawns beside the face, spends outside Creative, names the mob", () => {
  const a = stubState({ displayName: "Bob" });
  assert.equal(useEggOnBlock(a.state, { block: [5, 0, 5], adjacent: [6, 0, 5] }, { random: () => 0.5 }), true);
  assert.equal(a.spawned[0].type, "pig");
  assert.deepEqual([a.spawned[0].x, a.spawned[0].y, a.spawned[0].z], [6.5, 0, 5.5]);
  assert.equal(a.spawned[0].customName, "Bob");
  assert.equal(a.spawned[0].rotationYawHead, -180);
  assert.equal(a.stack.count, 2);
  const c = stubState({ creative: true });
  useEggOnBlock(c.state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, {});
  assert.equal(c.stack.count, 3);
  assert.equal(c.spawned.length, 1);
  const ghast = stubState({ damage: 56 });
  assert.equal(useEggOnBlock(ghast.state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, {}), true);
  assert.equal(ghast.spawned.length, 0);
  assert.equal(ghast.stack.count, 3);
});

test("fire charge: fire beside the face, sound, consumed even when blocked, kept in Creative", () => {
  const calls = [];
  const fireState = (air, creative) => {
    const s = stubState({ id: ITEM_FIRE_CHARGE, creative, damage: 0 });
    s.state.world = { get: () => (air ? 0 : 1), height: 256, inside: () => true };
    s.state.fire = { ignite: (...q) => calls.push(["ignite", ...q]), drain: () => [] };
    return s;
  };
  const sound = [];
  const hooks = { random: () => 0.5, playSound: (n, o) => sound.push([n, o]) };
  const a = fireState(true, false);
  assert.equal(useFireCharge(a.state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, hooks), true);
  assert.deepEqual(calls[0], ["ignite", 5, 1, 5]);
  assert.equal(sound[0][0], "fire.ignite");
  assert.equal(sound[0][1].pitch, 0.5 * 0.4 + 0.8);
  assert.equal(a.stack.count, 2);
  const b = fireState(false, false);
  useFireCharge(b.state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, hooks);
  assert.equal(calls.length, 1);
  assert.equal(b.stack.count, 2);
  const c = fireState(true, true);
  useFireCharge(c.state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, hooks);
  assert.equal(c.stack.count, 3);
  for (const r of ref.fire.filter((x) => !x.remote && x.side === 1 && !x.blockedTarget)) assert.ok(r.events.some((e) => e.startsWith("sound|fire.ignite|5.5,1.5,5.5|1.0|")));
});

test("fire charge recipe: blaze powder, coal or charcoal, gunpowder -> 3", () => {
  const rs = SHAPELESS.filter((r) => r.output === ITEM_FIRE_CHARGE);
  assert.equal(rs.length, 2);
  for (const r of rs) {
    assert.equal(r.count, 3);
    assert.equal(r.ingredients.length, 3);
  }
  assert.deepEqual(rs.map((r) => r.ingredients.map((i) => i.id).join()), ["388,301,330", "388,308,330"]);
  assert.ok(RECIPES);
});

test("EntityExpBottle constants", () => {
  const c = ref.expConstants;
  assert.equal(EXP_BOTTLE.velocity, c.velocity);
  assert.equal(EXP_BOTTLE.pitchOffset, c.pitchOffset);
  assert.ok(Math.abs(EXP_BOTTLE.gravity - c.gravity) < 1e-7);
  assert.ok(Math.abs(EXP_BOTTLE.width - c.width) < 1e-7);
});

test("getXPSplit table", () => {
  for (const [n, part] of ref.xpSplit.pairs) assert.equal(xpSplit(n), part, `n=${n}`);
});

test("onImpact: 400 seeded impacts give the same orbs and the 2002 position", () => {
  for (const r of ref.expImpact) {
    const orbs = expBottleOrbs(new JavaRandom(r.seed));
    assert.deepEqual(orbs, r.orbs, `seed ${r.seed}`);
    const total = orbs.reduce((a, b) => a + b, 0);
    assert.ok(total >= 3 && total <= 11);
    const aux = `aux|2002|${Math.round(r.pos[0])},${Math.round(r.pos[1])},${Math.round(r.pos[2])}|0`;
    assert.equal(r.aux[0], aux);
    assert.equal(r.aux.filter((e) => e.startsWith("spawn|sq")).length, orbs.length);
  }
  assert.deepEqual(ref.expImpactRemote.events, []);
});

test("launch replays: throwFromPlayer reproduces the seeded EntityThrowable constructor", () => {
  for (const r of ref.expLaunch) {
    const potions = new WitchPotions({ entities: [], events: [] }, () => r.seed / 2 ** 48);
    potions.projectiles.random = () => r.seed / 2 ** 48;
    const yaw = ((180 - r.yaw) * Math.PI) / 180, pitch = (-r.pitch * Math.PI) / 180;
    const ball = potions.throwFromPlayer({ x: r.feet[0], y: r.feet[1], z: r.feet[2] }, yaw, pitch, 0, "expBottle", 0.7);
    assert.equal(ball.kind, "expBottle");
    for (const [k, v] of [["x", r.x], ["y", r.y], ["z", r.z]]) assert.ok(Math.abs(ball[k] - v) < 1e-4, `${k} seed ${r.seed}`);
    // The port keeps the potion launch's float rounding; the replayed constructor differs from it by up to ~5e-5 per component.
    for (const [k, v] of [["mx", r.mx], ["my", r.my], ["mz", r.mz]]) assert.ok(Math.abs(ball[k] - v) < 1e-4, `${k} seed ${r.seed}: ${ball[k]} vs ${v}`);
  }
});

test("/give and region import keep a spawn egg's EntityList id as its damage", async () => {
  const { itemFromOriginal } = await import("./region-import.js");
  assert.deepEqual(itemFromOriginal(383, 100), { id: ITEM_SPAWN_EGG, damage: 100, clamped: false });
  assert.deepEqual(itemFromOriginal(383, 0), { id: ITEM_SPAWN_EGG, damage: 0, clamped: false });
  assert.equal(itemFromOriginal(383, 40000), null);
});
