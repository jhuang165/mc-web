// Native ChunkProviderFlat provide + populate over small areas (tools/probes/FlatPopulateProbe.java, areas in
// tools/probes/flat-populate-areas.json; FLAT_AREAS_FILE, FLAT_JAVA_ARGS (for example -DtraceChunk=x,z -DtraceFile=f) and FLAT_REFERENCE_OUT override). Writes public/research/flat-populate-reference.json, replayed by src/flat-populate.test.js.
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
const out = path.join(research, "flat-populate-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe","DecorationFeatureProbe","SpringProbe","BiomeDecoratorProbe","MineshaftProbe","MineshaftWorldProbe","DungeonProbe","BiomeOverrideProbe","PopulationTailProbe","PopulationWorldProbe","StructurePopulationWorldProbe","StructureAreaProbe","FlatPopulateProbe"];
await exec("javac", ["-nowarn","-cp",cp,"-d",probe,...probes.map((n)=>path.join(root,`probes/${n}.java`))]);
const AREAS = JSON.parse(await readFile(process.env.FLAT_AREAS_FILE || path.join(root, "probes/flat-populate-areas.json"), "utf8"));
// One JVM per area: the native jungle temple leaves static state that changes later areas, so shared runs are order dependent.
const runs=[];for(const area of AREAS)runs.push(await exec("java", ["-Xmx3g",...(process.env.FLAT_JAVA_ARGS ? process.env.FLAT_JAVA_ARGS.split(" ") : []),"-cp",cp,"FlatPopulateProbe",area], { maxBuffer: 1 << 29 }));
const stdout=runs.map(r=>r.stdout).join(""),stderr=runs.map(r=>r.stderr).join("");
await writeFile(path.join(out,"raw.jsonl"),stdout); await writeFile(path.join(out,"trace.txt"),stderr);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr.slice(0, 3000));
const records=stdout.trim().split("\n").filter((l)=>l.startsWith("{")).map(JSON.parse);
assert.equal(records.length,AREAS.length);
assert.ok(records.every(r=>r.kind==="flatArea"&&r.steps.length===r.size*r.size&&r.chunks.length===r.size*r.size));
const srgText=await readFile(path.join(research,"joined-1.7.10.srg"),"utf8"),mcp={};
for(const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm))mcp[m[1]]=m[2];
const names=["aqu","aqx","ave","asw","avn","aug","atx","avm","avk","asv","apx","ahb","aow","apj","aie","ass","arx","asd"];
const classesUsed=Object.fromEntries(await Promise.all(names.map(async c=>[c,{name:mcp[c],sha256:createHash("sha256").update((await exec("unzip",["-p",jar,c+".class"],{encoding:"buffer"})).stdout).digest("hex")}])));
const jvm=await exec("java",["-XshowSettings:properties","-version"]);
const reference={target:"Minecraft Java 1.7.10",clientSha1,srgSha256:createHash("sha256").update(srgText).digest("hex"),classes:classesUsed,jvm:String(jvm.stderr).match(/java\.version = (\S+)/)?.[1]||"unknown",
 method:"Unchanged ChunkProviderFlat (aqu, constructed with the generator options string and the mapFeatures flag) provides every chunk of a small area (flat layers, the biome array from WorldChunkManagerHell, each enabled structure generator's range-8 start search in list order), then populates each chunk x outer / z inner with aqu.populate: the population reseed, the structure generators on the provider Random in list order, lake (nextInt(4), no village), lava_lake (nextInt(8), nextInt(10) at y >= 63), eight dungeon attempts when enabled, then biome decorate when 'decoration' is set. Native World/Chunk block callbacks run; ordered World calls and writes (SHA-1), the provider Random and World.rand afterwards, structure start maps, tile entities, entities, pending ticks and drops are captured. World light services are PopulationWorldProbe's fixture (sky 15, block 0). The halo is an unpopulated second ChunkProviderFlat with map features off. Not a WorldServer: no light engine, entity ticking or later block ticks.",
 records};
const text=JSON.stringify(reference)+"\n";assert.ok(text.length<40_000_000);
await writeFile(process.env.FLAT_REFERENCE_OUT || path.join(root,"../public/research/flat-populate-reference.json"),text);
console.log("Native flat areas:",records.length,"areas,",records.reduce((n,r)=>n+r.steps.length,0),"populated chunks,",records.reduce((n,r)=>n+r.steps.reduce((m,x)=>m+x.writeCount,0),0),"writes");
