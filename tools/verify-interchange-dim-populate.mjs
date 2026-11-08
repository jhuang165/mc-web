// Replays combined 1.7.10 structure population on actual provider chunks.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = (p) => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of dirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), clientSha1 = createHash("sha1").update(await readFile(jar)).digest("hex");
assert.equal(clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "commons-io-"].map(library));
const out = path.join(research, "interchange-dim-populate-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe","DecorationFeatureProbe","SpringProbe","BiomeDecoratorProbe","MineshaftProbe","MineshaftWorldProbe","DungeonProbe","BiomeOverrideProbe","PopulationTailProbe","PopulationWorldProbe","StructurePopulationWorldProbe","InterchangePopulateProbe","NetherProbe","EndProbe","InterchangeDimPopulateProbe"];
await exec("javac", ["-nowarn","-cp",cp,"-d",probe,...probes.map((n)=>path.join(root,`probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx3g","-cp",cp,"InterchangeDimPopulateProbe"], { maxBuffer: 1 << 28, env: { ...process.env } });
await writeFile(path.join(out,"raw.jsonl"),stdout); await writeFile(path.join(out,"trace.txt"),stderr);
console.log(stdout.length, stderr.slice(0,500));

// ---- Replay of every probe scenario through the port (the stored-column path: populateImportedColumns) ----
const src = (f) => import(path.join(root, "../src", f));
const { populationBlockMapperReady } = await src("population-world.js");
await populationBlockMapperReady;
const { populateImportedColumns } = await src("imported-population.js");
const { dimensionTerrain } = await src("imported-population-dims.js");
const { encodeBaseColumn } = await src("whole-save-columns.js");
const { fromOriginal } = await src("block-registry.js");
const sha = (blocks, metadata) => {
  const buf = Buffer.alloc(65536 * 4);
  let k = 0;
  for (let i = 0; i < 65536; i++) { const v = blocks[i] | metadata[i] << 12; buf.writeInt32LE(v, k); k += 4; }
  return createHash("sha1").update(buf).digest("hex");
};
const lines = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
const summary = [], records = [];
for (const sc of lines) {
  const dimension = sc.dim === "nether" ? -1 : 1, terrain = dimensionTerrain(dimension, BigInt(sc.seed)), store = new Map(), stored = [], unpopulated = [];
  const internal = new Map();
  for (const [x, z, , flag] of sc.inputs) {
    const t = terrain(x, z), cells = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) {
      if (!t.blocks[i]) continue;
      const k = t.blocks[i] << 4 | t.metadata[i];
      let m = internal.get(k);
      if (!m) internal.set(k, m = fromOriginal(t.blocks[i], t.metadata[i]));
      assert.ok(m?.exact, `terrain block ${t.blocks[i]} has an exact cell`);
      cells[i] = m.id | m.meta << 8;
    }
    store.set(`${x},${z}`, encodeBaseColumn("w", x, z, cells, { terrainPopulated: !!flag }));
    stored.push([x, z]); if (!flag) unpopulated.push([x, z]);
  }
  const final = new Map();
  const out = await populateImportedColumns({
    population: {}, origin: { chunkX: 0, chunkZ: 0 }, worldKey: "w", coords: stored, unpopulated, dimension, seed: BigInt(sc.seed),
    read: async (_w, list) => list.map(([x, z]) => store.get(`${x},${z}`) ?? null),
    write: async (records) => { for (const r of records) store.set(`${r.x},${r.z}`, r); },
    observe: (x, z, orig) => final.set(`${x},${z}`, sha(orig.blocks, orig.metadata)),
  });
  assert.deepEqual(out.order ?? [], sc.calls, `${sc.dim} ${sc.label}: populate order`);
  let same = 0;
  for (const [x, z, hash, flag] of sc.chunks) {
    const got = final.get(`${x},${z}`);
    if (got !== undefined) assert.equal(got, hash, `${sc.dim} ${sc.label}: chunk ${x},${z}`);
    else assert.equal(hash, sc.inputs.find(([a, b]) => a === x && b === z)[2], `${sc.dim} ${sc.label}: untouched chunk ${x},${z}`);
    assert.equal(!!flag, store.get(`${x},${z}`).terrainPopulated, `${sc.dim} ${sc.label}: flag ${x},${z}`); same++;
  }
  const probeSpawners = sc.tiles.filter((t) => t[3] === "spawner").map((t) => [t[0], t[1], t[2], t[4]]).sort();
  assert.deepEqual(out.spawners.map((t) => [t.x, t.y, t.z, t.EntityId]).sort(), probeSpawners, `${sc.dim} ${sc.label}: spawners`);
  assert.equal(Object.keys(out.chests).length, sc.tiles.filter((t) => t[3] === "chest").length, `${sc.dim} ${sc.label}: chests`);
  const kind = (t) => (t === "crystal" ? "ender_crystal" : "ender_dragon");
  assert.deepEqual(out.entities.map((e) => [e.type, e.x, e.y, e.z]).sort(), sc.entities.map((e) => [kind(e[0]), e[1], e[2], e[3]]).sort(), `${sc.dim} ${sc.label}: entities`);
  const kept = out.fluidTicks.length + out.fireTicks.length + out.fallingTicks.length + out.dropped.ticks;
  assert.equal(kept, sc.pending.length, `${sc.dim} ${sc.label}: scheduled ticks`);
  assert.equal(out.fireTicks.length, sc.pending.filter((p) => p[3] === 51).length, `${sc.dim} ${sc.label}: fire ticks`);
  records.push({ dim: sc.dim, label: sc.label, seed: sc.seed, origin: sc.origin, size: sc.size, populatedMod: sc.populatedMod, holes: sc.holes, inputs: sc.inputs, calls: sc.calls, chunks: sc.chunks, tiles: sc.tiles, entities: sc.entities, pendingCount: sc.pending.length, pendingFire: out.fireTicks.length, pendingFluid: out.fluidTicks.length });
  summary.push({ dim: sc.dim, label: sc.label, calls: sc.calls.length, chunks: same, spawners: out.spawners.length, chests: Object.keys(out.chests).length, entities: out.entities.length, probeEntities: sc.entities.length, probeTiles: sc.tiles.length, ticks: { fluid: out.fluidTicks.length, fire: out.fireTicks.length, falling: out.fallingTicks.length, dropped: out.dropped.ticks, droppedIds: out.droppedTickIds }, probePending: sc.pending.length });
}

const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const classesUsed = Object.fromEntries(await Promise.all(["aqv", "ara", "atd", "apx", "apu"].map(async (c) => [c, { name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer" })).stdout).digest("hex") }])));
const jvm = await exec("java", ["-XshowSettings:properties", "-version"]);
const reference = { target: "Minecraft Java 1.7.10", clientSha1, srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed, jvm: String(jvm.stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderHell.provideChunk (real MapGenNetherBridge search) and ChunkProviderEnd.provideChunk generate a rectangle of stored chunks; the unchanged Chunk.populateChunk (apx.a(apu,apu,II)) is driven through an apu proxy while they load x outer, z inner. Nether: a fresh ChunkProviderHell (constructor-state hellRNG) populates every call, sharing the generating provider's fortress starts. End: World.rand is seeded per chunk with seed ^ (x * 341873128712 + z * 132897987541) before each populate. Halo chunks outside the stored set are dropped after every call.",
  replay: summary, records };
const text = JSON.stringify(reference, null, 2) + "\n";
assert.ok(text.length < 12_000_000);
await writeFile(path.join(root, "../public/research/interchange-dim-populate-reference.json"), text);
console.log("Interchange dim populate:", records.length, "scenarios,", records.reduce((n, r) => n + r.calls.length, 0), "native populate calls");
