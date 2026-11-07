// Batch 20 interchange: UUIDMost/UUIDLeast on every entity, the leader zombie/pigman max-health bonus as a saved Attributes modifier, the mounts a level.dat
// import keeps, and the spider jockey rider's gear. Replays public/research/interchange-reference.json (tools/probes/InterchangeProbe.java and
// InterchangeMountProbe.java run natively against the unchanged 1.7.10 classes; the jockey's unseeded Random is recovered by inverting its LCG).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./lighting.js";
import { skeletonSpawnRolls, zombieSpawnRolls } from "./difficulty.js";
import { decodeNbt } from "./nbt.js";
import { attributesNbt, attributeFieldsFromNbt, cleanModifiers, modifiedValue } from "./mob-attributes.js";
import { uuidLongs, longsUuid, newUuid, uuidFields, deriveUuid } from "./entity-uuid.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { exportJavaSave } from "./region-export.js";
import { importJavaRegionArea } from "./region-import.js";
import { decodeCompressedNbt } from "./nbt-compression.js";
import { readLevelData } from "./level-dat.js";
import { playerMountable } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/interchange-reference.json", import.meta.url)));
const f = Math.fround, date = { month: 6, day: 1 };
const gear = ref.records.filter((r) => r.case === "spiderJockeyGear");
const leaders = ref.records.filter((r) => r.case === "leader");
const stackRecord = (s) => (s ? [s.id, s.damage, (s.enchantments ?? []).map((e) => [e.id, e.lvl])] : null);

test("native: the probe recovered every jockey seed and the counts match", () => {
  assert.equal(ref.counts.spiderJockeyGear, gear.length);
  assert.equal(ref.counts.leader, leaders.length);
  assert.ok(gear.length >= 100 && leaders.length >= 60);
});

test("spider jockey rider: the skeleton gear rolls replay from the recovered Random seed", () => {
  for (const r of gear) {
    const rand = new JavaRandom(r.seed), at = JSON.stringify(r);
    const out = skeletonSpawnRolls(rand, r.difficulty, f(r.local), date, false);
    assert.deepEqual(out.stacks.map(stackRecord), r.equipment, at);
    assert.deepEqual(out.dropChances, r.dropChances.map(f), at);
    assert.equal(out.loot, r.loot, at);
    assert.equal(out.wither ? 1 : 0, r.wither, at);
    assert.equal(rand.nextInt(), r.randNext, `stream ${at}`);
  }
});

const nbtOf = (r) => decodeNbt(Uint8Array.from(Buffer.from(r.nbt, "hex"))).tag;
const sortKey = (a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]);
// The baby speed boost (yq.br) is a modifier the port keeps as the baby flag (entities.js), not in `modifiers`.
const leaderMods = (r) => {
  const out = [];
  for (const a of nbtOf(r).value.get("Attributes").value.items) for (const m of a.get("Modifiers")?.value.items ?? []) if (m.get("Name").value !== "Baby speed boost") out.push([a.get("Name").value, m.get("Name").value, m.get("Amount").value, m.get("Operation").value]);
  return out.sort(sortKey);
};

test("zombie and pigman spawn rolls give the native Attributes modifiers, leader bonus included", () => {
  let leadersSeen = 0;
  for (const r of leaders) {
    const out = zombieSpawnRolls(new JavaRandom(r.seed), new JavaRandom(r.worldSeed), r.difficulty, f(r.local), date, r.kind === "pigman");
    const mods = out.modifiers.map((m) => [m.attribute, m.name, m.amount, m.operation]).sort(sortKey);
    assert.deepEqual(mods, leaderMods(r), JSON.stringify(r));
    if (r.leader) leadersSeen++;
    assert.equal(modifiedValue({ modifiers: cleanModifiers(out.modifiers) }, "generic.maxHealth", 20, 0, 2048), r.maxHealth);
  }
  assert.ok(leadersSeen > 10);
});

test("the Attributes list is the native key set and imports as the native read-back", () => {
  for (const r of leaders) {
    const mine = attributesNbt({ type: r.kind, modifiers: [], reinforcement: 0 }, r.kind).value.items.map((a) => a.get("Name").value);
    assert.deepEqual(mine, nbtOf(r).value.get("Attributes").value.items.map((a) => a.get("Name").value));
    const back = attributeFieldsFromNbt(new Map([["Attributes", nbtOf(r).value.get("Attributes")]]));
    assert.equal(back.maxHealth ?? 20, r.readMaxHealth);
    assert.equal(back.reinforcement ?? 0, r.readReinforcement);
  }
});

test("UUID helpers: long pair round trip, fresh and derived ids", () => {
  const u = newUuid(), { most, least } = uuidLongs(u);
  assert.equal(longsUuid(most, least), u);
  assert.notEqual(newUuid(), u);
  assert.equal(deriveUuid("a"), deriveUuid("a"));
  assert.notEqual(deriveUuid("a"), deriveUuid("b"));
  assert.deepEqual(uuidFields(new Map()), {});
});

test("playerMountable: every mob but the chicken, dragon, wither, crystal and babies", () => {
  assert.equal(playerMountable({ type: "cow" }), true);
  assert.equal(playerMountable({ type: "zombie" }), true);
  assert.equal(playerMountable({ type: "chicken" }), false);
  assert.equal(playerMountable({ type: "cow", growingAge: -100 }), false);
});

async function exported(extra) {
  const w = new World("17", "javaStreamed", 12);
  w.restore([]);
  const record = { id: "x", name: "X", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player: new Survival({}, "survival").serialize(), position: { x: 3.5, y: 70.4, z: 5.5, yaw: 0, pitch: 0 }, ...extra };
  const { files } = await exportJavaSave(record, { world: w });
  const data = (await decodeCompressedNbt(files.get("level.dat"))).tag.value.get("Data").value;
  const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
  return { data, regions };
}
const mob = (type, extra = {}) => ({ id: "mob-1", type, x: 3.5, y: 70, z: 5.5, health: 10, yaw: 0, ...extra });

test("export and import: a mob keeps its UUID and a leader zombie its max-health modifier", async () => {
  const uuid = newUuid();
  const leader = mob("zombie", { uuid, health: 30, maxHealth: 30, modifiers: [{ attribute: "generic.maxHealth", name: "Leader zombie bonus", amount: 0.5, operation: 2, uuid: newUuid() }] });
  const { data, regions } = await exported({ entities: [leader] });
  const { record } = await importJavaRegionArea(regions, { level: readLevelData(data), area: undefined });
  const z = record.entities.find((e) => e.type === "zombie");
  assert.equal(z.uuid, uuid);
  assert.equal(z.maxHealth, 30);
  assert.equal(z.modifiers[0].name, "Leader zombie bonus");
});

for (const type of ["cow", "spider", "zombie"]) test(`import: a player riding a ${type} comes back as playerRides`, async () => {
  const { data, regions } = await exported({ entities: [mob(type, { playerRides: true })] });
  assert.ok(data.get("Player").value.get("Riding"), "Riding written");
  assert.ok(data.get("Player").value.has("UUIDMost"));
  const { record, report } = await importJavaRegionArea(regions, { level: readLevelData(data), area: undefined });
  assert.deepEqual(report.level.player.lost.filter((l) => l.startsWith("Riding")), []);
  assert.equal(record.entities.filter((e) => e.playerRides === true && e.type === type).length, 1);
});

for (const cartType of [2, 3, 5]) test(`import: a player in cart type ${cartType} stays seated`, async () => {
  const cart = { minecarts: { version: 1, carts: [{ type: cartType, x: 3.5, y: 70.1, z: 5.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, items: [], pushX: 0, pushZ: 0, fuel: 0, fuse: -1, cooldown: -1, rider: true }] } };
  const { data, regions } = await exported(cart);
  const { record } = await importJavaRegionArea(regions, { level: readLevelData(data), area: undefined });
  assert.equal(record.minecarts.carts.filter((c) => c.rider === true && c.type === cartType).length, 1);
});
