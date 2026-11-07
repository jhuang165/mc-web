// The player's own boat or minecart (EntityPlayerMP's Riding compound): Entity.writeToNBT nests the mount in level.dat's Player, the chunk does not list
// the ridden vehicle, and ServerConfigurationManager.initializeConnectionToPlayer creates it and mounts the player on load (bytecode-read:
// sa.e writes Riding when ridingEntity != null, sa.d (writeToNBTOptional) skips a ridden entity, oi reads Riding with sg.a and mountEntity).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { exportJavaSave } from "./region-export.js";
import { importJavaRegionArea } from "./region-import.js";
import { decodeCompressedNbt } from "./nbt-compression.js";
import { readLevelData } from "./level-dat.js";
import { Survival } from "./survival.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from "./region-file.js";
import { chunkFromNbt } from "./chunk-nbt.js";

async function exported(vehicle) {
  const w = new World("17", "javaStreamed", 12);
  w.restore([]);
  const player = new Survival({}, "survival").serialize();
  const position = { x: 3.5, y: 70.4, z: 5.5, yaw: 0, pitch: 0 };
  const record = { id: "mount", name: "Mount", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player, position, ...vehicle };
  const { files } = await exportJavaSave(record, { world: w });
  const data = (await decodeCompressedNbt(files.get("level.dat"))).tag.value.get("Data").value;
  return { w, files, data, record };
}
const boatRecord = { x: 3.5, y: 70.1, z: 5.5, motion: [0, 0, 0], rotation: [90, 0], fallDistance: 0, fire: 0, onGround: false, rider: true };

test("a player in a boat exports the boat as the player's Riding, not as a chunk entity", async () => {
  const { w, files, data } = await exported({ boats: [boatRecord] });
  const riding = data.get("Player").value.get("Riding").value;
  assert.equal(riding.get("id").value, "Boat");
  assert.deepEqual(riding.get("Pos").value.items, [3.5 + w.originX, 70.1, 5.5 + w.originZ]);
  const cx = Math.floor((3.5 + w.originX) / 16), cz = Math.floor((5.5 + w.originZ) / 16), a = regionAddress(cx, cz);
  const entries = readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`));
  const chunk = chunkFromNbt(await decodeRegionChunk(entries.get(regionSlot(cx & 31, cz & 31))));
  assert.equal(chunk.entities?.some((e) => e.get("id")?.value === "Boat") ?? false, false);
});

test("a boat nobody rides stays a chunk entity and the player has no Riding", async () => {
  const { data } = await exported({ boats: [{ ...boatRecord, rider: undefined }] });
  assert.equal(data.get("Player").value.has("Riding"), false);
});

for (const [name, vehicle, kind] of [["boat", { boats: [boatRecord] }, "boats"], ["minecart", { minecarts: { version: 1, carts: [{ type: 0, x: 3.5, y: 70.1, z: 5.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, items: [], rider: true }] } }, "carts"]])
  test(`importing a level.dat with the player in a ${name} brings the player back seated, and the browser save restores it`, async () => {
    const { w, files, data } = await exported(vehicle);
    const level = readLevelData(data);
    const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
    const { record, report } = await importJavaRegionArea(regions, { level, area: undefined });
    const list = kind === "boats" ? record.boats : record.minecarts?.carts;
    assert.equal(list.filter((c) => c.rider === true).length, 1);
    const seat = list.find((c) => c.rider === true);
    assert.ok(Math.abs(seat.x - 3.5) < 1e-9 && Math.abs(seat.z - 5.5) < 1e-9, `seat ${seat.x},${seat.z}`);
    assert.deepEqual(report.level.player.lost.filter((l) => l.startsWith("Riding")), []);
    // The save keeps the flag through boats.js / minecarts.js, which seat the player (restorePlayerVehicle).
    const system = kind === "boats" ? Boats.fromJSON(record.boats, {}) : Minecarts.fromJSON(record.minecarts, {});
    const restored = system.carts.filter((c) => c.restorePlayer);
    assert.equal(restored.length, 1);
  });
