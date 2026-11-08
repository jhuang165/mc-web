// Batch 29 leads3: a leashed mob's death, a lead across a dimension change, unusable Leash tags, a mob rider on an untamed horse, horse GUI equip
// with size <= 0 stacks, the creative drop bounds and hoppers with negative stacks. Replays public/research/leads3-reference.json
// (tools/probes/Leads3Probe.java and HopperProbe, run natively on the unchanged 1.7.10 classes by tools/verify-leads3.mjs) and leads2-reference.json.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NBT } from "./nbt.js";
import { gearNbtFields } from "./java-mobs.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import * as G from "./horse-gear.js";
import { replayHorseNeg } from "./horse-neg-replay.js";
import { replayHopperScenario } from "./hopper-replay.js";
import { leads3HopperScenarios } from "../tools/leads3-hopper.mjs";
import { tameTick } from "./horse.js";
import { CreativeScreen } from "./creative.js";
import { PlayerInventory, makeStack } from "./inventory.js";

const ref = JSON.parse(await readFile(new URL("../public/research/leads3-reference.json", import.meta.url)));
const ref2 = JSON.parse(await readFile(new URL("../public/research/leads2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (recs) => {
  const w = new EntityWorld(terrain, recs.map((r, i) => ({ id: `mob-${i + 1}`, type: "pig", x: 64, y: 0, z: 64, health: 10, ...r })), () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  for (const e of w.entities) e.onGround = true;
  return w;
};
const leads = (w) => w.events.filter((x) => x.drop === G.LEAD_ITEM).length;
const nativeLeads = (drops) => drops.filter((d) => d === "420x1").length;
const HOLDER = "aaaaaaaa-0000-0000-0000-000000000001";

test("native: record counts and class digests", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(ref.counts, { hopper: 20, leadDeath: 33, leadDimension: 12, horseNeg: 420 });
  assert.equal(ref.hopper.length, leads3HopperScenarios.length);
  for (const c of ["aam", "api", "aln", "sw", "td", "su", "adf", "wi"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("native and port: a leashed mob keeps its lead through the 20-tick death animation, loses it to a far or dead holder and drops nothing at removal", () => {
  for (const r of by("leadDeath")) {
    const kind = r.kind === "wolfStanding" ? "wolf" : r.kind, label = `${r.kind}/${r.holder}/${r.event}`;
    const holderMob = { id: "mob-holder", type: "pig", uuid: HOLDER, x: 67, y: 0, z: 64, health: 10 };
    const w = world(r.holder === "mob" ? [{ type: kind }, holderMob] : [{ type: kind }]);
    const e = w.entities[0];
    const player = { x: 64, y: 0, z: 64 }, survival = new Survival();
    const holder = r.holder === "player" ? player : w.entities[1];
    if (r.holder === "player") player.x = 67;
    if (r.holder === "knot") { w.knotCreate(69, 0, 64); w.setLeash(e, { knot: { x: 69, y: 0, z: 64 } }); }
    else w.setLeash(e, r.holder === "mob" ? { holder: "mob", holderUuid: HOLDER } : { holder: "player" });
    assert.equal(w.attackEntityFrom(e, 1000, {}), r.killed, label);
    for (const t of r.ticks) {
      if (!w.entities.includes(e) && e.death >= 20) break; // removed: the lead is lost silently, nothing more happens
      if (t.t === 5 && r.event === "holderFar" || t.t === 12 && r.event === "holderFarAfterDeath") { if (holder) holder.x = 64 + 40; if (r.holder === "knot") w.knotAt(69, 0, 64).dead = true; }
      if (t.t === 5 && r.event === "holderDies") { if (r.holder === "mob") holder.health = 0; else survival.health = 0; }
      w.tick(player, survival);
      assert.equal(!!e.leash, t.leashed, `${label} tick ${t.t}`);
      assert.equal(leads(w), nativeLeads(t.drops), `${label} tick ${t.t} lead drops`);
    }
  }
});

test("native and port: a leashed mob across a dimension change finds its holder by UUID within 10 blocks or drops the lead", () => {
  for (const r of by("leadDimension")) {
    const label = `${r.holder}/${r.where}`;
    if (r.holder === "player" && (r.where === "absent" || r.where === "oldDead")) { assert.deepEqual(r.first.drops, ["420x1"], label); continue; } // dimension-live.js deliver drops it on arrival
    if (r.where === "holderLeft") { assert.equal(r.leashed, false); assert.deepEqual(r.drops, ["420x1"]); continue; }
    const dist = r.where === "near3" ? 3 : r.where === "edge10.5" ? 10.5 : r.where === "far12" ? 12 : null;
    const recs = [{ type: "pig", x: 64, z: 64 }];
    if (r.holder === "mob" && dist !== null) recs.push({ type: "pig", uuid: HOLDER, x: 64 + dist, z: 64 });
    const w = world(recs);
    const e = w.entities[0];
    if (r.holder === "player") w.ai.player.x = 64 + dist;
    if (r.holder === "knot") e.leash = { knot: { x: 67, y: 0, z: 64 } };
    else e.leash = r.holder === "mob" ? { holder: "mob", holderUuid: HOLDER } : { holder: "player" };
    w.leashTick(e);
    assert.equal(!!e.leash, r.first.leashed, label);
    assert.equal(leads(w), nativeLeads(r.first.drops), label);
    if (r.holder === "knot") assert.ok(w.knotAt(67, 0, 64), label);
    w.leashTick(e);
    assert.equal(!!e.leash, r.second.leashed, label);
    assert.equal(leads(w), nativeLeads(r.second.drops), label);
  }
});

const tg = (type, value) => ({ type, value });
const nums = (type, x, y, z) => ({ X: tg(type, x), Y: tg(type, y), Z: tg(type, z) });
test("native and port: an imported Leashed mob with an unusable Leash tag drops a lead item on its first tick", () => {
  const cases = {
    empty: {}, leastOnly: { UUIDLeast: tg(NBT.LONG, 8n) }, mostOnly: { UUIDMost: tg(NBT.LONG, 7n) },
    uuidInts: { UUIDMost: tg(NBT.INT, 7), UUIDLeast: tg(NBT.INT, 8) }, uuidStrings: { UUIDMost: tg(NBT.STRING, "7"), UUIDLeast: tg(NBT.STRING, "8") },
    xyzStrings: nums(NBT.STRING, "5", "0", "0"), xyzMissingZ: { X: tg(NBT.INT, 5), Y: tg(NBT.INT, 0) },
  };
  for (const [kind, fields] of Object.entries(cases)) {
    const nat = ref2.records.find((r) => r.case === "leadRead" && r.held === "pig" && r.leashKind === kind);
    assert.ok(nat, kind);
    assert.equal(nat.leashed, false);
    const imported = gearNbtFields(new Map([["Leashed", tg(NBT.BYTE, 1)], ["Leash", tg(NBT.COMPOUND, new Map(Object.entries(fields)))]]));
    const w = world([{ type: "pig", ...imported }]);
    w.leashTick(w.entities[0]);
    assert.equal(!!w.entities[0].leash, nat.leashed, kind);
    assert.equal(leads(w), nativeLeads(nat.drops), kind);
  }
  // Leashed with no Leash compound (leashedNoTag), a Leashed byte of 2 with a usable tag, and Leashed 0 or absent (no lead)
  const none = ref2.records.find((r) => r.name === "leashedNoTag");
  const w = world([{ type: "pig", ...gearNbtFields(new Map([["Leashed", tg(NBT.BYTE, 1)]])) }]);
  w.leashTick(w.entities[0]);
  assert.equal(!!w.entities[0].leash, none.leashed);
  assert.equal(leads(w), nativeLeads(none.drops));
  for (const name of ["leashedFalse", "leashedAbsent"]) assert.equal(ref2.records.find((r) => r.name === name).drops.length, 0);
  assert.equal(gearNbtFields(new Map([["Leashed", tg(NBT.BYTE, 0)]])).leash, undefined);
  assert.equal(gearNbtFields(new Map()).leash, undefined);
});

test("native and port: a non-player rider on an untamed horse is thrown with status 6 and no taming or temper change", () => {
  const riders = ref2.records.filter((r) => r.case === "horseTame" && r.rider === "pig");
  assert.ok(riders.length > 0);
  for (const r of riders) for (const ev of r.events) {
    assert.equal(ev.status, 6);
    assert.equal(ev.tame, false);
    assert.equal(ev.temperAfter, ev.temperBefore);
    const out = tameTick({ temper: ev.temperBefore, tame: false }, { nextInt: () => 0, nextFloat: () => 0.5 }, null);
    assert.deepEqual([out.status, out.dismount, out.horse.tame, out.horse.temper], [6, true, false, ev.temperBefore]);
  }
});

test("native and port: horse GUI clicks with saddle, armour and other stacks of size -2..2 (420 records)", () => {
  for (const r of by("horseNeg")) {
    const want = { result: r.result, cursor: r.cursor, horse: r.horse, player: r.player, saddled: r.saddled, armor: r.armor, drops: r.drops };
    assert.deepEqual(replayHorseNeg(r), want, `${r.type}/${r.kind}/${r.count}/${r.action}`);
  }
});

test("hoppers with negative and zero stacks, every facing, single and double chests replay the native frames (20 scenarios)", () => {
  for (const [i, native] of ref.hopper.entries()) {
    const s = leads3HopperScenarios[i];
    assert.equal(native.name, s.name);
    const mine = replayHopperScenario(s);
    for (let t = 0; t < s.ticks; t++) assert.equal(JSON.stringify(mine.frames[t]), JSON.stringify(native.frames[t]), `${s.name} tick ${t + 1}`);
  }
});

test("creative drops need 0 < size <= 64 and a non-negative damage (nh.processCreativeInventoryAction, bytecode-read)", () => {
  const drops = [];
  const fake = { container: { drops }, tick: () => 0 };
  const drop = CreativeScreen.prototype.drop.bind(fake);
  for (const s of [makeStack(1, 1), makeStack(1, 64), makeStack(1, 0), makeStack(1, -3), makeStack(1, 65), makeStack(1, 1, -1)]) drop(s);
  assert.deepEqual(drops.map((s) => s.count), [1, 64]);
});
