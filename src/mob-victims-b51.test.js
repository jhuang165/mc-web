// Batch 51 (mobvictims): skeletons, wither skeletons, zombie pigmen and the wither as victims of the 22 DamageSources of b50mr, through EntityWorld.attackEntityFrom.
// Replays public/research/mob-victims-reference.json (tools/probes/MobVictimProbe.java run by tools/verify-mob-victims.mjs, records tagged b51mv): the unchanged
// EntitySkeleton (yl, type 0 and 1), EntityPigZombie (yh) and EntityWither (xc). Each step: accepted, health, absorption, hurt window, revenge target, and per kind the pigman's
// anger or the wither's Invul, armour phase and head/block-break counters. The skeleton's entityToAttack (EntityMob.attackEntityFrom) is unused by its AI tasks: not compared.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, entityRandom } from "./entities.js";
import { enchantmentRandom } from "./armor-enchantments.js";
import { addMobEffect, RESISTANCE } from "./mob-effects.js";
import { revengeOf } from "./revenge-target.js";
import { witherState } from "./wither-boss-mobs.js";
import { summonedMobRecord, javaMobFromNbt } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { World } from "./world.js";
import { exportJavaSave } from "./region-export.js";
import { decodeCompressedNbt } from "./nbt-compression.js";
import { Survival } from "./survival.js";
const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-victims-reference.json", import.meta.url)));
const records = reference.records, groups = records.filter((r) => r.victim === "pigman-group"), singles = records.filter((r) => r.victim !== "pigman-group");

const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const BASE = [[298, 299, 300, 301], [306, 307, 308, 309], [310, 311, 312, 313]];
const stack = (id, damage = 0, enchantments) => ({ id, count: 1, damage, ...(enchantments ? { enchantments: enchantments.map(([id, lvl]) => ({ id, lvl })) } : {}) });
const TYPES = { skeleton: "skeleton", witherSkeleton: "wither_skeleton", pigman: "pigman", wither: "wither" };
// A probe source -> the web's source object. A source with a living entity (mob, arrow and fireball shooter, thrown, indirect magic, thorns) carries the attacker.
const ENTITY_SOURCES = new Set(["mob", "arrow", "fireball", "thrown", "indirectMagic", "thorns"]);
function sourceFor(name, attacker) {
  if (name === "player") return { name: "player", player: true, from: { x: 10.5, z: 8.5 } };
  if (name === "arrow") return { name, arrow: true, shooter: attacker, from: { x: 10.5, z: 8.5 } };
  if (ENTITY_SOURCES.has(name)) return { name, attacker, from: { x: 10.5, z: 8.5 } };
  return { name, from: { x: 10.5, z: 8.5 }, player: false };
}
function build(r) {
  const type = TYPES[r.victim];
  const world = new EntityWorld(flat, [{ id: "v", type, x: 8, y: 0, z: 8, health: 20 }, { id: "a", type: r.attacker, x: 10.5, y: 0, z: 8.5, health: 20 }], () => 0.5);
  const [v, attacker] = world.entities;
  world.currentDate = () => new Date(2014, 5, 1);
  if (r.material >= 0) v.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(BASE[r.material][i], 0, r.ench >= 0 ? [[r.ench, r.level]] : undefined))];
  if (r.resistance >= 0) addMobEffect(v, RESISTANCE, 1000, r.resistance);
  if (r.absorption > 0) v.absorption = f(r.absorption);
  if (r.startHealth >= 0) v.health = r.startHealth;
  if (r.startInvul >= 0) v.invul = r.startInvul;
  enchantmentRandom.setSeed(BigInt(r.seed));
  entityRandom(v).setSeed(7n);
  return { world, v, attacker };
}
const whoRevenge = (v, attacker) => { const t = v.revenge ? revengeOf(v) : null; return t === "player" ? "player" : t === attacker ? "attacker" : t ? "other" : "none"; };
function whoTarget(world, v, attacker) {
  const t = world.silverfishState(v).target;
  return !t ? "none" : t === world.ai.player ? "player" : t.e === attacker ? "attacker" : "other";
}
function observe(r, world, v, attacker, accepted) {
  const o = { accepted, health: v.health, absorbed: f(v.absorption || 0), hurtTime: v.hurt > 0 ? 10 : 0, last: v.hurt > 0 || v.lastDamage ? f(v.lastDamage || 0) : 0, revenge: whoRevenge(v, attacker) };
  if (r.victim === "pigman") { o.anger = v.angerLevel > 0 ? 1 : 0; o.target = whoTarget(world, v, attacker); }
  if (r.victim === "wither") { const s = witherState(v); o.invul = v.invul; o.bv = s.bv; o.bu = [s.bu[0], s.bu[1]]; o.armored = v.health <= 150; }
  return o;
}
const wanted = (r, s) => {
  const o = { accepted: s.accepted, health: f(s.health), absorbed: f(s.absorbed), hurtTime: s.hurtTime, last: f(s.last), revenge: s.revenge };
  if (r.victim === "pigman") { o.anger = s.anger; o.target = s.target; }
  if (r.victim === "wither") { o.invul = s.invul; o.bv = s.bv; o.bu = s.bu; o.armored = s.armored; }
  return o;
};

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.tag, "b51mv");
  for (const [kind, n] of Object.entries({ skeleton: 273, witherSkeleton: 273, pigman: 273 })) assert.equal(records.filter((r) => r.victim === kind).length, n);
  assert.ok(records.filter((r) => r.victim === "wither").length >= 800);
  assert.equal(groups.length, 10);
});

for (const kind of ["skeleton", "witherSkeleton", "pigman", "wither"]) {
  test(`every ${kind} record: accepted, health, absorption, hurt window and reaction match the unchanged attackEntityFrom`, () => {
    const failures = [];
    const rows = singles.filter((r) => r.victim === kind);
    for (const r of rows) {
      const { world, v, attacker } = build(r);
      r.steps.forEach((s, i) => {
        const accepted = world.attackEntityFrom(v, f(s.amount), sourceFor(s.source, attacker));
        const got = JSON.stringify(observe(r, world, v, attacker, accepted)), want = JSON.stringify(wanted(r, s));
        if (got !== want) failures.push(`${r.case}/${r.attacker}/${s.source}:${s.amount}#${i} hp${r.startHealth} inv${r.startInvul}: got ${got} want ${want}`);
      });
    }
    assert.equal(failures.length, 0, failures.length + " of " + rows.length + "\n" + failures.slice(0, 25).join("\n"));
  });
}

test("a pigman hit by a player angers the pigmen within 32 blocks, not those beyond; a mob's hit angers none", () => {
  const failures = [];
  for (const r of groups) {
    const world = new EntityWorld(flat, [{ id: "v", type: "pigman", x: 8, y: 0, z: 8, health: 20 }, { id: "a", type: "zombie", x: 10.5, y: 0, z: 8.5, health: 20 },
      ...r.extra.filter(Boolean).map((c, i) => { const [x, z] = c.split(",").map(Number); return { id: "p" + i, type: "pigman", x: x - 56.5, y: 0, z: z - 56.5, health: 20 }; })], () => 0.5);
    world.currentDate = () => new Date(2014, 5, 1);
    const [v, attacker, ...others] = world.entities;
    const accepted = world.attackEntityFrom(v, f(r.amount), sourceFor(r.source, attacker));
    const got = JSON.stringify({ accepted, anger: v.angerLevel > 0 ? 1 : 0, target: whoTarget(world, v, attacker), others: others.map((o) => [o.angerLevel > 0 ? 1 : 0, whoTarget(world, o, attacker)]) });
    const want = JSON.stringify({ accepted: r.accepted, anger: r.self.anger, target: r.self.target, others: r.others.map((o) => [o.angerLevel > 0 ? 1 : 0, o.target]) });
    if (got !== want) failures.push(`${r.case}/${r.source}: got ${got} want ${want}`);
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

// EntityLivingBase.writeEntityToNBT writes AbsorptionAmount (bs) and readEntityFromNBT sets it back through setAbsorptionAmount (m: negative becomes 0), bytecode-read (sv.b / sv.a).
test("a mob's absorption amount survives a save and a reload, and a negative one loads as 0", () => {
  const w = new EntityWorld(flat, [{ id: "z", type: "zombie", x: 8, y: 0, z: 8, health: 20, absorption: 3.5 }, { id: "s", type: "skeleton", x: 12, y: 0, z: 8, health: 20 }, { id: "n", type: "pigman", x: 16, y: 0, z: 8, health: 20, absorption: -2 }], () => 0.5);
  assert.deepEqual(w.entities.map((e) => e.absorption ?? 0), [3.5, 0, 0]);
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  const again = new EntityWorld(flat, saved, () => 0.5);
  assert.deepEqual(again.entities.map((e) => e.absorption ?? 0), [3.5, 0, 0]);
  again.damageEntity(again.entities[0], 2, "generic");
  assert.equal(again.entities[0].absorption, 1.5, "the reloaded shield absorbs again");
});

test("AbsorptionAmount in a /summon compound or a Java chunk mob is read as the mob's absorption", () => {
  const tag = new Map([["AbsorptionAmount", { type: NBT.FLOAT, value: 6.5 }]]);
  assert.equal(summonedMobRecord("zombie", tag).record.absorption, 6.5);
  assert.equal(summonedMobRecord("zombie", new Map()).record.absorption, undefined);
  assert.equal(summonedMobRecord("zombie", new Map([["AbsorptionAmount", { type: NBT.FLOAT, value: -1 }]])).record.absorption, undefined);
  assert.ok(!summonedMobRecord("wither_skeleton", tag)?.ignored?.includes("AbsorptionAmount"));
  assert.ok(!summonedMobRecord("zombie", tag).ignored.includes("AbsorptionAmount"), "a kept key, not reported lost");
});

test("export writes a mob's AbsorptionAmount (0 when it has none), as every native EntityLivingBase does", async () => {
  for (const [absorption, want] of [[4.25, 4.25], [undefined, 0]]) {
    const w = new World("17", "javaStreamed", 12);
    w.restore([]);
    const record = { id: "mount", name: "Mount", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player: new Survival({}, "survival").serialize(), position: { x: 3.5, y: 70.4, z: 5.5, yaw: 0, pitch: 0 },
      entities: [{ id: "mob-1", type: "pig", x: 3.5, y: 70, z: 5.5, health: 10, yaw: 0, playerRides: true, saddled: true, ...(absorption ? { absorption } : {}) }] };
    const { files } = await exportJavaSave(record, { world: w });
    const data = (await decodeCompressedNbt(files.get("level.dat"))).tag.value.get("Data").value;
    assert.equal(data.get("Player").value.get("Riding").value.get("AbsorptionAmount").value, want);
  }
});
