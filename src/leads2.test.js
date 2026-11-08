// Batch 28 leads2: leads held by another mob, the Leash tag rules of EntityLiving.readEntityFromNBT / func_110160_i, tamed-owner lead checks, horse
// owner text and a held stack of size <= 0 in the wolf, ocelot, sheep and horse clicks. Replays public/research/leads2-reference.json
// (tools/probes/Leads2Probe.java, run natively on the unchanged 1.7.10 classes by tools/verify-leads2.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NBT } from "./nbt.js";
import { gearNbtFields } from "./java-mobs.js";
import { relinkMobs, leashHolderUuid } from "./owner-links.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { itemFromOriginal } from "./region-import.js";
import * as G from "./horse-gear.js";
import { FENCE } from "./world.js";

const ref = JSON.parse(await readFile(new URL("../public/research/leads2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const HOLDER = "00000000-0000-0007-0000-000000000008";
const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (recs) => {
  const w = new EntityWorld(terrain, recs.map((r, i) => ({ id: `mob-${i + 1}`, type: "pig", x: 64, y: 0, z: 64, health: 10, ...r })), () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  for (const e of w.entities) e.onGround = true;
  return w;
};
const tg = (type, value) => ({ type, value });
const leashTag = (fields) => new Map([["Leashed", tg(NBT.BYTE, 1)], ["Leash", tg(NBT.COMPOUND, new Map(Object.entries(fields)))]]);
const nums = (type, x, y, z) => ({ X: tg(type, x), Y: tg(type, y), Z: tg(type, z) });
const L = (v) => tg(NBT.LONG, BigInt(v));
const IMPORT = {
  uuid: { UUIDMost: L(7), UUIDLeast: L(8) }, uuidAndXyz: { UUIDMost: L(7), UUIDLeast: L(8), ...nums(NBT.INT, 5, 0, 0) },
  uuidWrongAndXyz: { UUIDMost: L(9), UUIDLeast: L(9), ...nums(NBT.INT, 5, 0, 0) }, mostOnly: { UUIDMost: L(7) }, mostOnlyXyz: { UUIDMost: L(7), ...nums(NBT.INT, 5, 0, 0) },
  leastOnly: { UUIDLeast: L(8) }, uuidInts: { UUIDMost: tg(NBT.INT, 7), UUIDLeast: tg(NBT.INT, 8) }, uuidStrings: { UUIDMost: tg(NBT.STRING, "7"), UUIDLeast: tg(NBT.STRING, "8") },
  empty: {}, xyzBytes: nums(NBT.BYTE, 5, 0, 0), xyzShorts: nums(NBT.SHORT, 5, 0, 0), xyzLongs: nums(NBT.LONG, 5n, 0n, 0n), xyzFloats: nums(NBT.FLOAT, 5.5, 0.5, -0.5),
  xyzDoubles: nums(NBT.DOUBLE, 5.5, 0.5, -0.5), xyzNegDoubles: nums(NBT.DOUBLE, -5.5, -0.5, -0.5), xyzStrings: nums(NBT.STRING, "5", "0", "0"),
  xyzMissingZ: { X: tg(NBT.INT, 5), Y: tg(NBT.INT, 0) },
};

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { leadWrite: 6, leadRead: 49, leadLive: 100, leadCycle: 3, leadUse: 42, leadKnot: 2, horseOwner: 432, horseOwnerWrite: 12, horseOwnerRead: 12, horseTame: 60, sizes: 2700 });
  for (const [k, n] of Object.entries(ref.counts)) assert.equal(by(k).length, n, k);
  for (const c of Object.values(ref.classes)) assert.match(c.sha256, /^[0-9a-f]{64}$/);
});

test("native and port: a Leash tag with a long UUID pair wins over X/Y/Z; otherwise numeric X/Y/Z of any type are floored; anything else drops the lead", () => {
  let checked = 0;
  for (const r of by("leadRead").filter((x) => IMPORT[x.leashKind] && x.held === "pig" && x.name !== "self")) {
    const out = gearNbtFields(leashTag(IMPORT[r.leashKind])).leash;
    if (r.holder === "knot") assert.deepEqual(out, { knot: { x: r.knotAt[0], y: r.knotAt[1], z: r.knotAt[2] } }, r.name);
    else if (r.name === "mobNear" || r.name === "uuidWinsOverXyz" || r.name === "wrongUuidWithXyz") assert.deepEqual(out, { holder: "player" }, r.name); // the holder is resolved by UUID at link time
    else if (r.leashKind === "uuid") assert.deepEqual(out, { holder: "player" }, r.name);
    else assert.equal(out, undefined, r.name);
    checked++;
  }
  assert.ok(checked >= 20);
  assert.equal(leashHolderUuid(new Map([["Leash", tg(NBT.COMPOUND, new Map(Object.entries(IMPORT.uuidInts)))]])), undefined);
  assert.equal(leashHolderUuid(new Map([["Leash", tg(NBT.COMPOUND, new Map(Object.entries(IMPORT.uuid)))]])), HOLDER);
});

test("native and port: a UUID held by a mob of the same save links to it; a missing or dead holder drops the lead", () => {
  const player = "11111111-1111-1111-1111-111111111111";
  const rec = (uuid, leash, health = 10) => ({ type: "pig", uuid, health, ...(leash ? { leash } : {}) });
  const mobs = [rec("aaaaaaaa-0000-0000-0000-000000000001", { holder: "player", holderUuid: HOLDER }), rec(HOLDER), rec("aaaaaaaa-0000-0000-0000-000000000003", { holder: "player", holderUuid: "bbbbbbbb-0000-0000-0000-000000000001" }), rec("aaaaaaaa-0000-0000-0000-000000000004", { holder: "player", holderUuid: player })];
  assert.equal(relinkMobs(mobs, player), 1);
  assert.deepEqual(mobs[0].leash, { holder: "mob", holderUuid: HOLDER });
  assert.equal(mobs[2].leash, undefined);
  assert.deepEqual(mobs[3].leash, { holder: "player" });
  const dead = [rec("aaaaaaaa-0000-0000-0000-000000000001", { holder: "player", holderUuid: HOLDER }), rec(HOLDER, null, 0)];
  assert.equal(relinkMobs(dead, player), 1);
  for (const r of by("leadRead").filter((x) => x.name === "mobDead")) assert.equal(r.leashed, false);
});

test("native and port: a live mob held by another mob follows td.bL (path beyond 4, pull beyond 6, break beyond 10) like a player holder", () => {
  for (const r of by("leadLive").filter((x) => x.steps && x.mob === "pig" && x.dy === 0)) {
    const w = world([{ uuid: "aaaaaaaa-0000-0000-0000-000000000001", x: 64 + r.distance, leash: undefined }, { uuid: "aaaaaaaa-0000-0000-0000-000000000002" }]);
    const [holder, e] = w.entities;
    w.setLeash(e, { holder: "mob", holderUuid: holder.uuid });
    const nav = w.ai.brain(e).navigator;
    if (nav.budget) nav.budget.left = nav.budget.perTick;
    w.leashTick(e);
    const t = r.steps[0], label = `distance ${r.distance}`;
    assert.equal(!!e.leash, t.leashed, label);
    assert.equal(w.events.filter((x) => x.drop === G.LEAD_ITEM).length, t.drops.length, label);
    if (e.leash) assert.equal(e.homeRadius, t.homeRadius, label);
  }
});

test("native and port: the holder mob dying, leaving the world or being far loses the lead on the next tick", () => {
  for (const ev of ["holderDead", "holderFar", "holderDeadRemoved"]) {
    const r = by("leadLive").find((x) => x.event === ev);
    const w = world([{ uuid: "aaaaaaaa-0000-0000-0000-000000000001", x: 67 }, { uuid: "aaaaaaaa-0000-0000-0000-000000000002" }]);
    const [holder, e] = w.entities;
    w.setLeash(e, { holder: "mob", holderUuid: holder.uuid });
    w.leashTick(e);
    assert.ok(e.leash, ev);
    if (ev === "holderDead") holder.health = 0;
    if (ev === "holderFar") holder.x = 94;
    if (ev === "holderDeadRemoved") w.entities.splice(0, 1);
    w.leashTick(e);
    assert.equal(!!e.leash, r.second.leashed, ev);
    assert.equal(w.events.filter((x) => x.drop === G.LEAD_ITEM).length, r.second.drops.length, ev);
  }
});

test("native and port: two mobs holding each other keep their leads within 10 blocks and lose them beyond", () => {
  for (const r of by("leadCycle")) {
    const w = world([{ uuid: "aaaaaaaa-0000-0000-0000-000000000001" }, { uuid: "aaaaaaaa-0000-0000-0000-000000000002", x: 64 + r.distance }]);
    const [a, b] = w.entities;
    w.setLeash(a, { holder: "mob", holderUuid: b.uuid }); w.setLeash(b, { holder: "mob", holderUuid: a.uuid });
    w.leashTick(a); w.leashTick(b);
    assert.equal(!!a.leash, r.aLeashed, `a ${r.distance}`);
    assert.equal(!!b.leash, r.bLeashed, `b ${r.distance}`);
  }
});

test("native and port: a lead in hand does nothing on a mob held by a mob; a tamed wolf or ocelot of another owner refuses the lead", () => {
  for (const r of by("leadUse").filter((x) => x.kind === "heldByMob")) {
    const w = world([{ uuid: "aaaaaaaa-0000-0000-0000-000000000001", x: 66 }, { type: r.subject }]);
    const [holder, e] = w.entities;
    w.setLeash(e, { holder: "mob", holderUuid: holder.uuid });
    const s = new Survival({ inventory: { [G.LEAD_ITEM]: 2 } }, r.creative ? "creative" : "survival");
    if (r.lead) s.inventory.current = s.inventory.find(G.LEAD_ITEM); else s.inventory.current = 8;
    assert.equal(w.leashInteract(e, s), r.result, `${r.subject} lead ${r.lead}`);
    assert.equal(e.leash.holder, "mob");
    assert.equal(w.events.length, 0);
  }
  const OWN = { wild: {}, player: { owner: "player" }, foreign: { owner: "player", ownerUuid: "00000000-0000-0009-0000-000000000009" }, blank: { owner: "player", ownerUuid: " " } };
  const tamed = by("leadUse").filter((x) => x.kind === "tamedInteractWith"); // EntityPlayer.interactWith: Creative clicks a copy of the stack (the raw sw.c `tamed` records consume it)
  assert.equal(tamed.length, 16);
  for (const r of tamed) {
    const type = r.subject.startsWith("wolf") ? "wolf" : "ocelot";
    const w = world([{ type, ...OWN[r.owner] }]);
    const s = new Survival({ inventory: { [G.LEAD_ITEM]: 2 } });
    s.inventory.current = s.inventory.find(G.LEAD_ITEM);
    const fake = { held: s.held, creative: r.creative, inventory: s.inventory };
    assert.equal(w.leashInteract(w.entities[0], fake), r.result, `${r.subject} ${r.owner} creative ${r.creative}`);
    assert.equal(!!w.entities[0].leash, r.leashed, `${r.subject} ${r.owner} leashed`);
    assert.equal(s.inventory.held?.count ?? 0, r.heldAfter ?? 0, `${r.subject} ${r.owner} lead left`);
  }
});

test("native and port: a lead is not used up in Creative (EntityPlayer.interactWith clicks a copy)", () => {
  const w = world([{ type: "pig" }]);
  const s = new Survival({ inventory: { [G.LEAD_ITEM]: 5 } });
  s.inventory.current = s.inventory.find(G.LEAD_ITEM);
  assert.equal(w.leashInteract(w.entities[0], { held: s.held, creative: true, inventory: s.inventory }), true);
  assert.equal(s.held.count, 5);
});

test("export: a mob held by a mob writes the holder's UUID; a restored record keeps the link", async () => {
  const { gearFieldsFrom } = await import("./horse-gear-live.js");
  assert.deepEqual(gearFieldsFrom({ leash: { holder: "mob", holderUuid: HOLDER } }).leash, { holder: "mob", holderUuid: HOLDER });
  assert.equal(gearFieldsFrom({ leash: { holder: "mob" } }).leash, undefined);
});

test("native: the horse owner text never changes interact, taming or the GUI (EntityHorse keeps OwnerUUID in the data watcher only for NBT)", () => {
  const groups = new Map();
  for (const r of by("horseOwner")) {
    const { owner, horse, ...rest } = r;
    const k = JSON.stringify([r.type, r.tame, r.item, r.sneak]), v = JSON.stringify({ ...rest, horse: { ...horse, owner: 0 } });
    if (!groups.has(k)) groups.set(k, v); else assert.equal(v, groups.get(k), k);
  }
  assert.ok(groups.size > 20);
  for (const r of by("horseOwnerWrite")) { assert.equal(r.tag, r.owner); assert.equal(r.hasKey, true); }
  for (const r of by("horseOwnerRead")) assert.equal(r.tameAfter, r.tame);
  // a non-player rider on an untamed horse: the task rears and dismounts it, no taming, no temper change
  for (const r of by("horseTame").filter((x) => x.rider === "pig")) for (const ev of r.events) { assert.equal(ev.status, 6); assert.equal(ev.tame, false); assert.equal(ev.temperAfter, ev.temperBefore); assert.equal(ev.riderLeft, true); }
  for (const r of by("horseTame").filter((x) => x.rider === "player")) for (const ev of r.events) {
    // EntityAIRunAroundLikeCrazy.updateTask with the player: tamed (status 7) or +5 temper and thrown off (status 6)
    if (ev.status === 7) assert.equal(ev.tame, true); else { assert.equal(ev.status, 6); assert.equal(ev.tame, false); assert.equal(ev.temperAfter, ev.temperBefore + 5); assert.equal(ev.riderLeft, true); }
  }
});

const ORIG = { bone: 352, beef: 363, rottenFlesh: 367, dyeBlue: [351, 4], dyeRed: [351, 1], dyeWhite: [351, 15], dyeBlack: [351, 0], rawFish: 349, wheat: 296, sugar: 353, apple: 260, goldenApple: 322, carrot: 391, saddle: 329, shears: 359, stick: 280, lead: 420, bucket: 325 };
function click(r) {
  const kind = r.subject.startsWith("wolf") ? "wolf" : r.subject.startsWith("ocelot") ? "ocelot" : r.subject.startsWith("sheep") || r.subject === "lamb" ? "sheep" : r.subject.startsWith("horse") ? "horse" : null;
  if (!kind) return null;
  const rec = { type: kind, z: 65 };
  if (["wolfOwned", "ocelotOwned", "wolfForeign"].includes(r.subject)) rec.owner = "player";
  if (r.subject === "wolfForeign") rec.ownerUuid = "foreign";
  if (r.subject === "sheepSheared") rec.sheared = true;
  if (r.subject === "lamb" || r.subject === "horseFoal") rec.growingAge = -12000;
  if (kind === "horse") { rec.horse = { type: 0, tame: r.subject !== "horseWild", owner: r.subject !== "horseWild" ? "player" : "" }; if (r.subject === "horseHurt") rec.health = 5; }
  const w = world([rec]), e = w.entities[0];
  if (r.subject === "ocelotWild") w.ai.brain(e).temptRunning = () => true;
  const s = new Survival({}, r.creative ? "creative" : "survival");
  const o = ORIG[r.item], [oid, od] = Array.isArray(o) ? o : [o, 0], m = itemFromOriginal(oid, od);
  s.inventory.main[0] = makeStack(m.id, r.count, m.damage ?? od);
  s.inventory.current = 0;
  let res = true;
  if (w.leashInteract(e, s)) { /* tied */ }
  else if (kind === "wolf" && w.wolfInteract(e, s)) { /* used */ }
  else if (kind === "ocelot" && w.ocelotInteract(e, s)) { /* used */ }
  else if (kind === "horse" && w.horseInteract(e, s, { sneak: false, open: () => {} })) { /* used */ }
  else if (w.shear(e, s.held?.id, s)) { /* sheared */ }
  else if (w.feed(e, s.held?.id, s)) { /* fed */ }
  else if (w.dye(e, s.held, s)) { /* dyed (the dispatcher then destroys a spent stack) */ }
  else res = false;
  // player-edit-simulation.js: a sheep click that fell through to the end of the entity branch empties a held stack of size <= 0 outside Creative
  if (kind === "sheep" && res && !r.creative && s.held && s.held.count <= 0) s.inventory.main[0] = null;
  return s.inventory.main[0]?.count ?? null;
}

test("native and port: a held stack of size <= 0 in wolf, ocelot, sheep and horse clicks is spent, kept or destroyed like EntityPlayer.interactWith does", () => {
  let n = 0;
  for (const r of by("sizes")) {
    const got = click(r);
    if (got === null && !r.subject.match(/^(wolf|ocelot|sheep|lamb|horse)/)) continue;
    if (!r.subject.match(/^(wolf|ocelot|sheep|lamb|horse)/)) continue;
    assert.equal(got ?? null, r.after ? r.after.count : null, `${r.subject} ${r.item} creative ${r.creative} count ${r.count}`);
    n++;
  }
  assert.equal(n, 12 * 18 * 10);
});
