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
const out = path.join(research, "interchange-populate-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe","DecorationFeatureProbe","SpringProbe","BiomeDecoratorProbe","MineshaftProbe","MineshaftWorldProbe","DungeonProbe","BiomeOverrideProbe","PopulationTailProbe","PopulationWorldProbe","StructurePopulationWorldProbe","InterchangePopulateProbe"];
await exec("javac", ["-nowarn","-cp",cp,"-d",probe,...probes.map((n)=>path.join(root,`probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx2g","-cp",cp,"InterchangePopulateProbe"], { maxBuffer: 1 << 28 });
await writeFile(path.join(out,"raw.jsonl"),stdout); await writeFile(path.join(out,"trace.txt"),stderr);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records=stdout.trim().split("\n").filter((l)=>l.startsWith("{")).map(JSON.parse);
assert.equal(records.length,6);
// Replay through src/imported-population.js over the same terrain (the generator port), compare order, flags and chunk hashes.
const { populationBlockMapperReady } = await import("../src/population-world.js");
await populationBlockMapperReady;
const { streamedSource } = await import("../src/java-world.js");
const { fromOriginal, toOriginal } = await import("../src/block-registry.js");
const { encodeBaseColumn } = await import("../src/whole-save-columns.js");
const { populateImportedColumns, populationPlan } = await import("../src/imported-population.js");
const summary = [];
for (const exact of [false, true]) for (const r of records) {
  const source = streamedSource({ seed: BigInt(r.seed), generationVersion: r.mapFeatures ? 16 : 17, originX: 0, originZ: 0, worldType: r.type });
  const pop = source.population, store = new Map(), coords = [], unpopulated = [];
  for (const [x, z, , flag] of r.inputs) {
    const o = pop.original(x, z), cells = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) { if (!o.blocks[i] && !o.metadata[i]) continue; const m = fromOriginal(o.blocks[i], o.metadata[i]); cells[i] = m.id | m.meta << 8; }
    store.set(`${x},${z}`, encodeBaseColumn("w", x, z, cells, { terrainPopulated: !!flag }));
    coords.push([x, z]); if (!flag) unpopulated.push([x, z]);
  }
  const plan = populationPlan(r.inputs.map(([x, z, , f]) => [x, z, !!f]));
  assert.deepEqual(plan, r.calls, `${r.label}: Chunk.populateChunk order`);
  const finals = new Map();
  const result = await populateImportedColumns({ population: pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: "w", coords, unpopulated,
    read: async (w, cs) => cs.map(([x, z]) => store.get(`${x},${z}`)), write: async (rs) => { for (const rec of rs) store.set(`${rec.x},${rec.z}`, rec); },
    exactInput: exact ? (x, z) => pop.original(x, z) : null,
    observe: (x, z, orig) => finals.set(`${x},${z}`, { blocks: Uint8Array.from(orig.blocks), metadata: Uint8Array.from(orig.metadata) }) });
  assert.equal(result.skipped.failed + result.skipped.unmapped, 0, `${r.label}: skipped ${JSON.stringify(result.skipped)} ${result.errors}`);
  let hashesEqual = 0, hashesDiffer = [];
  for (const [x, z, hash, flag] of r.chunks) {
    const rec = store.get(`${x},${z}`);
    assert.equal(rec.terrainPopulated, !!flag, `${r.label}: flag ${x},${z}`);
    // The stored input is the registry's cell form: cells the populate left alone read back through toOriginal, which cannot keep
    // flowing-versus-still fluid or chest facing (state kept outside the cell). Those cells are the true generated input again.
    const truth = pop.original(x, z), f = finals.get(`${x},${z}`) ?? truth;
    if (!exact && f !== truth) for (let i = 0; i < 65536; i++) {
      const m = fromOriginal(truth.blocks[i], truth.metadata[i]), lossy = m ? toOriginal(m.id, m.meta, { flowing: m.meta !== 0 }) : null;
      if (lossy && f.blocks[i] === lossy[0] && f.metadata[i] === (lossy[1] & 15)) { f.blocks[i] = truth.blocks[i]; f.metadata[i] = truth.metadata[i]; }
    }
    const buf = Buffer.alloc(65536 * 4); let k = 0;
    for (let c = 0; c < 256; c++) for (let y = 0; y < 256; y++) { const v = f.blocks[c * 256 + y] | f.metadata[c * 256 + y] << 12; buf.writeInt32LE(v, k); k += 4; }
    (createHash("sha1").update(buf).digest("hex") === hash ? hashesEqual++ : hashesDiffer.push(`${x},${z}`));
  }
  summary.push({ label: r.label, exactInput: exact, populates: r.calls.length, chunks: r.chunks.length, hashesEqual, hashesDiffer, nativeChests: r.tiles.filter((t) => t[3] === "chest").length, nativeSpawners: r.tiles.filter((t) => t[3] === "spawner").length,
    replayChests: Object.keys(result.chests).length, replaySpawners: result.spawners.length, nativeAnimals: r.animals, replayAnimals: result.dropped.animals, ms: result.ms });
}
const known = { "amplified-flowing-lava": ["3,0"], "structures-seed17": ["-7,-56"] };
for (const s of summary) assert.deepEqual(s.hashesDiffer, s.exactInput ? [] : known[s.label] ?? [], `${s.label} exactInput=${s.exactInput}`);
console.log(JSON.stringify(summary, null, 1));
const srgText=await readFile(path.join(research,"joined-1.7.10.srg"),"utf8"),mcp={};
for(const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm))mcp[m[1]]=m[2];
const names=["aqz","apx","ahb","aow","apj","apu"];
const classesUsed=Object.fromEntries(await Promise.all(names.map(async c=>[c,{name:mcp[c],sha256:createHash("sha256").update((await exec("unzip",["-p",jar,c+".class"],{encoding:"buffer"})).stdout).digest("hex")}])));
const jvm=await exec("java",["-XshowSettings:properties","-version"]);
const reference={target:"Minecraft Java 1.7.10",clientSha1,srgSha256:createHash("sha256").update(srgText).digest("hex"),classes:classesUsed,jvm:String(jvm.stderr).match(/java\.version = (\S+)/)?.[1]||"unknown",
 method:"Unchanged ChunkProviderGenerate.provideChunk and populate; the unchanged Chunk.populateChunk (apx.a(apu,apu,II)) driven through an apu proxy (chunkExists = loaded set, populate = ChunkProviderServer.populate) while a rectangle of stored chunks loads x outer, z inner. Halo chunks outside the stored set are dropped after every populate call.",
 replay:summary,records};
const text=JSON.stringify(reference,null,2)+"\n";assert.ok(text.length<12_000_000);
await writeFile(path.join(root,"../public/research/interchange-populate-reference.json"),text);
console.log("Interchange populate:",records.length,"scenarios,",records.reduce((n,r)=>n+r.calls.length,0),"native populate calls");
