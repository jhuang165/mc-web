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
const out = path.join(research, "structure-population-world-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe","DecorationFeatureProbe","SpringProbe","BiomeDecoratorProbe","MineshaftProbe","MineshaftWorldProbe","DungeonProbe","BiomeOverrideProbe","PopulationTailProbe","PopulationWorldProbe","StructurePopulationWorldProbe"];
await exec("javac", ["-nowarn","-cp",cp,"-d",probe,...probes.map((n)=>path.join(root,`probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx2g","-cp",cp,"StructurePopulationWorldProbe"], { maxBuffer: 1 << 28 });
await writeFile(path.join(out,"raw.jsonl"),stdout); await writeFile(path.join(out,"trace.txt"),stderr);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records=stdout.trim().split("\n").filter((l)=>l.startsWith("{")).map(JSON.parse);
assert.equal(records.length,5);
assert.ok(records.every(r=>r.kind==="area"&&r.steps.length===1));
assert.ok(records.every(r=>r.searchOrder.join(",")==="mineshaft,village,stronghold,scatteredFeature"));
assert.ok(records.every(r=>r.steps[0].populateOrder.join(",")==="mineshaft,village,stronghold,scatteredFeature"));
const srgText=await readFile(path.join(research,"joined-1.7.10.srg"),"utf8"),mcp={};
for(const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm))mcp[m[1]]=m[2];
const names=["aqz","aqx","ave","asw","avn","aug","atx","avm","avk","asv","apx","ahb","aow","apj"];
const classesUsed=Object.fromEntries(await Promise.all(names.map(async c=>[c,{name:mcp[c],sha256:createHash("sha256").update((await exec("unzip",["-p",jar,c+".class"],{encoding:"buffer"})).stdout).digest("hex")}])));
const jvm=await exec("java",["-XshowSettings:properties","-version"]);
const reference={target:"Minecraft Java 1.7.10",clientSha1,srgSha256:createHash("sha256").update(srgText).digest("hex"),classes:classesUsed,jvm:String(jvm.stderr).match(/java\.version = (\S+)/)?.[1]||"unknown",
 method:"Unchanged ChunkProviderGenerate.provideChunk and populate over one real native Chunk. All four MapGenStructure implementations run in provider order for search and population. Native World/Chunk block callbacks and population tails run; ordered calls/writes, structure maps, tiles, entities, pending ticks, drops, provider Random and World.rand are captured. World light services remain the explicit full/block-zero, sky-15 fixture used by PopulationWorldProbe.",
 records};
const text=JSON.stringify(reference,null,2)+"\n";assert.ok(text.length<12_000_000);
await writeFile(path.join(root,"../public/research/structure-population-world-reference.json"),text);
console.log("Native combined structure population:",records.length,"single-chunk worlds,",records.reduce((n,r)=>n+r.steps[0].writeCount,0),"step writes");
