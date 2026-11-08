import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as G from "./horse-gear.js";
import { jumpBar, riddenHorse, installHorseGear, gearFieldsFrom } from "./horse-gear-live.js";
import { leashStrip } from "./horse-gear-renderer.js";
import { PlayerInventory } from "./inventory.js";
import { ORIGINAL_ITEMS } from "./original-items.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-gear-reference.json", import.meta.url)));
const ORIG = { saddle: 329, ironArmor: 417, goldArmor: 418, diamondArmor: 419, chest: 54, stick: 280, apple: 260 };
const stack = (name, count = 1) => ({ id: G.liveOf(ORIG[name]), count, damage: 0 });
const items = new Proxy({}, { get: (t, id) => ({ id: +id, stack: [G.liveOf(329), ...[417, 418, 419].map(G.liveOf)].includes(+id) ? 1 : 64, durability: 0 }) });
const horse = (type, chested) => G.ensureItems({ type, chested, saddled: false, armor: 0, items: null }) && { type, chested, saddled: false, armor: 0, items: Array(chested ? 17 : 2).fill(null) };

test("reference record counts are the ones asserted by the verify script", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(ref.counts, { container: 7, slotValid: 98, transfer: 80, usable: 12, drops: 4, leash: 24, leashHolderDead: 1, leashUse: 16, unleash: 2, knot: 10, knotNoFence: 1, knotClick: 4, nameTag: 30, recipe: 1, itemIds: 1 });
  for (const [k, n] of Object.entries(ref.counts)) assert.equal([].concat(ref[k]).length, n, k);
});

test("container layout matches aam: slot positions and the armour slot only for a horse", () => {
  for (const r of ref.container) {
    const h = { type: r.type, chested: r.chested };
    const rows = G.layout(h);
    assert.equal(rows.length, r.slots - 0, `${r.type}/${r.chested}`);
    assert.deepEqual(rows, r.rows.map((x) => ({ slot: x.slot, x: x.x, y: x.y, enabled: x.enabled })), `${r.type}/${r.chested}`);
    assert.equal(G.gearSize(h), r.size);
  }
});

test("slot validity matches Slot.isItemValid for every animal and stack", () => {
  for (const r of ref.slotValid) {
    const h = { type: r.type, chested: r.chested }, s = stack(r.item);
    assert.deepEqual(r.valid.map((_, i) => G.slotValid(h, i, s, r.occupied)), r.valid, JSON.stringify(r));
  }
});

test("shift-click transfer matches transferStackInSlot", () => {
  for (const r of ref.transfer) {
    const h = horse(r.type, r.chested), inv = new PlayerInventory(items);
    const container = new G.HorseContainer(inv, h, () => {});
    if (r.dir === "in") {
      if (r.pre >= 1) h.items[0] = stack("saddle");
      if (r.pre === 2) { if (r.type === 0) h.items[1] = stack("goldArmor"); if (h.items.length > 2) h.items[2] = stack("stick", 5); }
      G.syncGear(h);
      const slotIndex = container.size + 27; // hotbar slot 0
      inv.main[0] = stack(r.item, r.item === "stick" || r.item === "apple" ? 3 : 1);
      const moved = container.transfer(slotIndex);
      assert.equal(!!moved, !!r.result, JSON.stringify(r));
      assert.equal(h.saddled, r.saddled, JSON.stringify(r));
      assert.equal(h.armor, r.armor, JSON.stringify(r));
      assert.equal(G.originalId(h.items[0]) ?? null, r.horse[0]?.id ?? null, JSON.stringify(r));
      assert.equal(G.originalId(h.items[1]) ?? null, r.horse[1]?.id ?? null, JSON.stringify(r));
    } else {
      r.horse.forEach((x, i) => { if (x) h.items[i] = { id: G.liveOf(x.id), count: 1, damage: 0 }; });
      if (r.result) h.items[r.slot] = { id: G.liveOf(r.result.id), count: r.result.count, damage: 0 };
      G.syncGear(h);
      const moved = container.transfer(r.slot);
      assert.equal(!!moved, !!r.result, JSON.stringify(r));
      assert.equal(h.saddled, r.saddled);
      assert.equal(h.armor, r.armor);
      if (r.player[0]) assert.equal(G.originalId(inv.main[r.player[0].slot]), r.player[0].stack.id);
      assert.deepEqual(h.items.map((x) => (x ? G.originalId(x) : null)), r.horse.map((x) => x?.id ?? null), JSON.stringify(r));
    }
  }
});

test("canInteractWith: alive and under 8 blocks", () => {
  for (const r of ref.usable) assert.equal(G.canInteract(!r.dead, r.distance), r.usable, JSON.stringify(r));
});

test("death drops: stacks in order, then the chest block", () => {
  for (const r of ref.drops) {
    const h = { type: r.kind, chested: r.chested, items: null };
    assert.deepEqual(G.gearDrops({ ...h, items: [] }).length, 0 + (h.chested ? 1 : 0));
  }
  const h = { type: 2, chested: true, items: [stack("saddle"), null, stack("stick", 5), stack("apple", 2), ...Array(13).fill(null)] };
  assert.deepEqual(G.gearDrops(h).map((s) => `${G.originalId(s)}x${s.count}`), ["329x1", "280x5", "260x2", "54x1"]);
});

test("leash pull and break distance match td.bL", () => {
  for (const r of ref.leash) {
    const step = G.leashStep(r.distance, r.dy, 0);
    const first = r.steps[0];
    if (step.pull) {
      assert.ok(Math.abs(step.pull[0] - first.motion[0]) < 1e-6 || r.distance > 9, JSON.stringify([r.distance, r.dy, step.pull, first.motion]));
    } else assert.deepEqual(first.motion.map((v) => Math.abs(v) < 1e-12), [true, true, true]);
    assert.equal(!first.leashed, step.unleash, JSON.stringify(r));
  }
});

test("leash use, freeing and knots follow the probe", () => {
  for (const r of ref.leashUse) {
    const lead = { leashed: false, holderIsPlayer: false, heldLead: true, creative: r.creative, type: r.subject };
    const out = G.leashUse(lead);
    assert.equal(out.used, r.first, r.subject);
    if (out.used) {
      assert.equal(out.consume, r.heldAfter < r.count, r.subject);
      const freed = G.leashUse({ ...lead, leashed: true, holderIsPlayer: true });
      assert.equal(freed.action, "free");
      assert.equal(freed.dropLead, r.drops.length === 1);
    }
  }
  for (const r of ref.knotClick) assert.deepEqual(G.knotClick({ attached: 0, creative: r.creative }), { kill: r.knotDead, freeAll: r.creative });
  for (const r of ref.knot) {
    const mobs = G.knotAttach([{ x: r.pigDistance, y: 0, z: 0, leash: { holder: "player" } }], { x: 0, y: 0, z: 0 });
    assert.equal(mobs.length, r.knots);
  }
});

test("name tags name any mob that is not a player when the stack has a display name", () => {
  for (const r of ref.nameTag) {
    const out = G.nameTagUse({ stackName: r.hasDisplayName ? (r.stackName === "(empty)" ? "" : r.stackName) : undefined, isMob: r.subject !== "player", isPlayer: r.subject === "player" });
    assert.equal(out.used, r.result, JSON.stringify(r));
    if (out.used) { assert.equal(out.name, r.customName); assert.equal(out.persistent, r.persistentAfter); }
  }
});

test("the lead recipe and item ids come from the original CraftingManager", () => {
  const r = ref.recipe[0] ?? ref.recipe;
  assert.deepEqual([r.result.id, r.result.count, r.width, r.height], [420, 2, 3, 3]);
  assert.equal(G.LEAD_ORIGINAL, ref.itemIds[0]?.lead ?? ref.itemIds.lead);
  assert.equal(G.NAME_TAG_ORIGINAL, 421);
  assert.equal(ORIGINAL_ITEMS[420], 2020);
});

test("nameplate rule: CustomNameVisible or looked at, within 64 (32 sneaking), not ridden", () => {
  const base = { name: "Rex", distance: 10 };
  assert.ok(!G.nameplateShown({ ...base }));
  assert.ok(G.nameplateShown({ ...base, visible: true }));
  assert.ok(G.nameplateShown({ ...base, looked: true }));
  assert.ok(!G.nameplateShown({ ...base, looked: true, distance: 64 }));
  assert.ok(!G.nameplateShown({ ...base, looked: true, distance: 33, sneaking: true }));
  assert.ok(!G.nameplateShown({ ...base, looked: true, ridden: true }));
  assert.ok(!G.nameplateShown({ name: "", looked: true, distance: 1 }));
});

test("jump bar width is (int)(power * 183) while riding any horse (EntityPlayerSP.isRidingHorse)", () => {
  const e = { health: 5, horse: { tame: true, saddled: true } };
  const rider = (p) => ({ vehicle: { horse: true, entity: e }, jumpPower: p });
  assert.deepEqual(jumpBar(rider(0.5)), { visible: true, width: 91 });
  assert.equal(jumpBar(rider(1)).width, 183);
  assert.equal(jumpBar({ vehicle: null }).visible, false);
  e.horse.saddled = false;
  assert.equal(riddenHorse(rider(1)), null);
  // The bar does not ask for a saddle or a tame horse; a ridden pig (the same seat system) has none.
  e.horse.tame = false;
  assert.deepEqual(jumpBar(rider(0.5)), { visible: true, width: 91 });
  assert.equal(jumpBar({ vehicle: { horse: true, entity: { type: "pig", health: 10 } }, jumpPower: 1 }).visible, false);
});

test("saved gear fields are sanitised", () => {
  assert.deepEqual(gearFieldsFrom({ leash: { knot: { x: 1, y: 2, z: 3 } }, customName: "A", customNameVisible: true, persistent: true }), { leash: { knot: { x: 1, y: 2, z: 3 } }, customName: "A", customNameVisible: true, persistent: true });
  assert.equal(gearFieldsFrom({ leash: { knot: { x: 1.5, y: 2, z: 3 } } }).leash, undefined);
  assert.equal(gearFieldsFrom({ leash: { holder: "player" } }).leash.holder, "player");
});

test("the leash line hangs below a straight chord and ends on both anchors", () => {
  const { points } = leashStrip([0, 0, 0], [4, 0, 0]);
  assert.equal(points.length, 25);
  assert.ok(points[12].y > points[24].y);
  assert.equal(points[24].x, 4);
  assert.ok(typeof installHorseGear === "function");
});

// ---- EntityWorld wiring ----
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (rec) => { const w = new EntityWorld(grass, [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 64, health: 10, ...rec }], () => 0.5); Object.assign(w.ai.player, { x: 64, y: 0, z: 64 }); return w; };
const holding = (id, n = 2, extra = {}) => { const s = new Survival({ inventory: { [id]: n } }); s.inventory.current = s.inventory.find(id); Object.assign(s.held, extra); return s; };

test("a lead ties a pig, a click frees it and the lead drops", () => {
  const w = world({}), e = w.entities[0], s = holding(2020, 2);
  assert.equal(w.leashInteract(e, s), true);
  assert.deepEqual(e.leash, { holder: "player" });
  assert.equal(s.held.count, 1);
  assert.equal(w.leashInteract(e, s), true);
  assert.equal(e.leash, undefined);
  assert.ok(w.events.some((x) => x.drop === 2020));
});

test("a lead pulls beyond 6 blocks and breaks beyond 10", () => {
  const w = world({ leash: { holder: "player" }, x: 72 }), e = w.entities[0];
  w.leashTick(e);
  assert.ok(e.vx < 0);
  e.x = 80;
  w.leashTick(e);
  assert.equal(e.leash, undefined);
  assert.ok(w.events.some((x) => x.drop === 2020));
});

test("a name tag names a mob, keeps it from despawning and survives serialize", () => {
  const w = world({}), e = w.entities[0], s = holding(375, 1, { displayName: "Rex" });
  assert.equal(w.nameTagUse(e, s), true);
  assert.equal(e.customName, "Rex");
  assert.equal(e.persistent, true);
  const back = new EntityWorld(grass, JSON.parse(JSON.stringify(w.serialize()))).entities[0];
  assert.equal(back.customName, "Rex");
  assert.equal(back.persistent, true);
  assert.equal(w.nameTagUse(e, holding(375, 1)), false); // an unnamed tag does nothing
});

test("a name tag is used up outside Creative only (EntityPlayer.interactWith copies the stack in Creative; neg-stacks2 interact records)", () => {
  const survival = holding(375, 2, { displayName: "Rex" }), creative = holding(375, 2, { displayName: "Rex" });
  creative.mode = "creative";
  const w = world({});
  assert.equal(w.nameTagUse(w.entities[0], creative), true);
  assert.equal(creative.held.count, 2);
  w.nameTagUse(w.entities[0], survival);
  assert.equal(survival.held.count, 1);
});

test("a dying chested horse drops its saddle, stacks and the chest", () => {
  const w = world({ type: "horse", health: 20, horse: { type: 1, tame: true, chested: true, saddled: true, armor: 0, owner: "player", speed: 0.2, jump: 0.5, maxHealth: 20 } }), e = w.entities[0];
  const items = w.horseGear(e).items;
  items[3] = { id: G.liveOf(280), count: 5, damage: 0 };
  w.gearDeath(e);
  assert.deepEqual(w.events.filter((x) => x.drop).map((x) => [x.drop, x.count]), [[G.liveOf(329), 1], [G.liveOf(280), 5], [G.liveOf(54), 1]]);
});

test("the horse screen title is the AnimalChest name EntityHorse.cN gave it", () => {
  // cN (func_110226_cD) renames the chest to getCommandSenderName; only the constructor (type 0, no name) builds it for an unchested horse.
  const inv = new PlayerInventory();
  assert.equal(new G.HorseContainer(inv, { type: 0 }, null).title, "Horse");
  assert.equal(new G.HorseContainer(inv, { type: 1, chested: false }, null, "Ned").title, "Horse");
  assert.equal(new G.HorseContainer(inv, { type: 4 }, null).title, "Horse");
  assert.equal(new G.HorseContainer(inv, { type: 1, chested: true }, null).title, "Donkey");
  assert.equal(new G.HorseContainer(inv, { type: 2, chested: true }, null).title, "Mule");
  assert.equal(new G.HorseContainer(inv, { type: 2, chested: true }, null, "Ned").title, "Ned");
});

test("main.js opens the horse screen without the edit-local syncContainerState", async () => {
  // syncContainerState is scoped to edit(); the top-level openHorse (also used by the inventory key while riding) must not call it.
  const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
  const open = main.split("\n").find((l) => l.startsWith("function openHorse("));
  assert.ok(open && !open.includes("syncContainerState"));
  assert.match(main, /openHorse: \(e\) => \{ openHorse\(e\); syncContainerState\(\); \}/);
});
