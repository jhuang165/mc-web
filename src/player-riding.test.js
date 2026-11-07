// The player's own mount in level.dat, replayed against public/research/player-riding-reference.json (tools/probes/PlayerRidingProbe.java, unchanged
// 1.7.10 classes): a real EntityPlayer rides a boat, minecarts, a saddled pig and a tame horse; Entity.writeToNBT nests the mount as Riding, the mount
// alone is refused by writeToNBTOptional, ServerConfigurationManager's load (createEntityFromNBT + mountEntity) remounts it, no nested chain is built,
// and an unknown id makes no entity. Export and import are checked against those key sets (UUIDMost/UUIDLeast are the one known difference).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World } from "./world.js";
import { exportJavaSave } from "./region-export.js";
import { importJavaRegionArea } from "./region-import.js";
import { decodeCompressedNbt } from "./nbt-compression.js";
import { decodeNbt } from "./nbt.js";
import { readLevelData } from "./level-dat.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { createPlayerRider, restorePlayerVehicle } from "./vehicle-simulation.js";

const ref = JSON.parse(await readFile(new URL("../public/research/player-riding-reference.json", import.meta.url)));
const native = Object.fromEntries(ref.records.map((r) => [r.kind, decodeNbt(Buffer.from(r.playerNbt, "hex")).tag.value.get("Riding").value]));
const keys = (m) => [...m.keys()].filter((k) => k !== "UUIDMost" && k !== "UUIDLeast").sort();

test("native: the mount is the player's Riding, never a chunk entity, no nested chain, bad ids make nothing", () => {
  assert.deepEqual(ref.records.map((r) => r.mountId), ["Boat", "Boat", "MinecartRideable", "MinecartChest", "Pig", "EntityHorse"]);
  for (const r of ref.records) {
    assert.equal(r.mountChunkSaved, false, r.kind);
    assert.equal(r.loadedId, r.mountId, r.kind);
    assert.equal(r.mounted, true, r.kind);
    assert.equal(r.nestedRidingLinked, false, r.kind);
    assert.equal(r.again, r.playerNbt, `${r.kind}: the remounted player writes the same bytes`);
  }
  assert.ok(ref.bad.every((b) => b.loadedId === null));
});

async function exported(extra) {
  const w = new World("17", "javaStreamed", 12);
  w.restore([]);
  const record = { id: "mount", name: "Mount", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player: new Survival({}, "survival").serialize(), position: { x: 3.5, y: 70.4, z: 5.5, yaw: 0, pitch: 0 }, ...extra };
  const { files } = await exportJavaSave(record, { world: w });
  const data = (await decodeCompressedNbt(files.get("level.dat"))).tag.value.get("Data").value;
  return { w, files, data };
}
const cart = (type) => ({ minecarts: { version: 1, carts: [{ type, x: 3.5, y: 70.1, z: 5.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, items: [], rider: true }] } });

for (const [kind, extra] of [["boat", { boats: [{ x: 3.5, y: 70.1, z: 5.5, motion: [0, 0, 0], rotation: [90, 0], fallDistance: 0, fire: 0, onGround: false, rider: true }] }], ["cart", cart(0)], ["chest-cart", cart(1)]])
  test(`export: a player in a ${kind} writes the Riding compound with the native key set`, async () => {
    const { data } = await exported(extra);
    assert.deepEqual(keys(data.get("Player").value.get("Riding").value), keys(native[kind]));
  });

const mobRecord = (type, extra) => ({ id: "mob-1", type, x: 3.5, y: 70, z: 5.5, health: 10, yaw: 0, ...extra });
for (const [kind, id, mob] of [["saddled-pig", "Pig", mobRecord("pig", { saddled: true, playerRides: true })], ["horse", "EntityHorse", mobRecord("horse", { health: 53, playerRides: true, horse: { type: 0, variant: 0, temper: 0, tame: true, saddled: true, owner: "player", speed: 0.225, jump: 0.7, maxHealth: 53 } })]])
  test(`export and import: a player on a ${kind} is the player's Riding, not in the chunk, and comes back mounted`, async () => {
    const { w, files, data } = await exported({ entities: [mob, mobRecord("pig", { id: "mob-2", x: 9.5 })] });
    const riding = data.get("Player").value.get("Riding").value;
    assert.equal(riding.get("id").value, id);
    // The same compound a chunk mob gets: EntityLivingBase/EntityLiving keys that every native mob writes with default values but this exporter writes
    // only when set (AbsorptionAmount, Attributes of a pig, CustomName/CustomNameVisible); a native load defaults them.
    const optional = new Set(["AbsorptionAmount", "CustomName", "CustomNameVisible", ...(kind === "saddled-pig" ? ["Attributes"] : [])]);
    const missing = keys(native[kind]).filter((k) => !riding.has(k) && !optional.has(k)), extra = keys(riding).filter((k) => !native[kind].has(k));
    assert.deepEqual(missing, [], "native keys missing");
    assert.deepEqual(extra, [], "keys the native class does not write");
    const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
    const { record, report } = await importJavaRegionArea(regions, { level: readLevelData(data), area: undefined });
    assert.deepEqual(report.level.player.lost.filter((l) => l.startsWith("Riding")), []);
    const mounts = record.entities.filter((e) => e.playerRides === true);
    assert.equal(mounts.length, 1);
    assert.equal(mounts[0].type, mob.type);
    assert.ok(Math.abs(mounts[0].x - 3.5) < 1e-9 && Math.abs(mounts[0].z - 5.5) < 1e-9);
    assert.equal(record.entities.filter((e) => e.type === "pig").length, kind === "horse" ? 1 : 2, "the free pig stays a chunk entity");
    // The browser save seats the player (entities.js playerRides -> vehicle-simulation.js restorePlayerVehicle).
    const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
    const mobs = new EntityWorld(grass, JSON.parse(JSON.stringify(record.entities)).map((e, i) => ({ ...e, id: `mob-${i + 1}`, x: 64, y: 0, z: 64 + i * 3 })));
    const rider = createPlayerRider(), state = { rider, horses: mobs.horseSeats, survival: new Survival({}, "survival"), position: { x: 0, y: 0, z: 0 }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0, world: grass };
    mobs.horseSeats.player = rider;
    restorePlayerVehicle(state);
    assert.equal(rider.vehicle?.entity?.type, mob.type);
    assert.equal(mobs.entities.some((e) => e.playerRides), false, "the flag is consumed");
    assert.equal(mobs.serialize().filter((e) => e.playerRides).length, 1, "the next save carries it again while the player rides");
  });

test("a player who dismounted does not save playerRides", () => {
  const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const mobs = new EntityWorld(grass, [mobRecord("pig", { x: 64, y: 0, z: 64, saddled: true })]);
  assert.equal(mobs.serialize()[0].playerRides, undefined);
});
