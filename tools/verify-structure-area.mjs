// Native multi-chunk structure areas: unchanged ChunkProviderGenerate provides and populates whole areas.
// Writes public/research/structure-area-reference.json (replayed by src/structure-area.test.js).
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
const out = path.join(research, "structure-area-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe","DecorationFeatureProbe","SpringProbe","BiomeDecoratorProbe","MineshaftProbe","MineshaftWorldProbe","DungeonProbe","BiomeOverrideProbe","PopulationTailProbe","PopulationWorldProbe","StructurePopulationWorldProbe","StructureAreaProbe"];
await exec("javac", ["-nowarn","-cp",cp,"-d",probe,...probes.map((n)=>path.join(root,`probes/${n}.java`))]);
const AREAS = ["village120:120:8:12:6", "village110:110:-15:12:6", "desertVillage126:126:-12:4:6", "strongholdLibraryPortal9:9:-10:-66:4", "strongholdLibraryPortal11:11:-2:-45:6",
  "desertTemple120:120:8:18:4", "desertTemple17:17:9:-55:4", "jungleTemple671:671:0:13:4", "swampHut579:579:6:10:4"];
const { stdout, stderr } = await exec("java", ["-Xmx3g","-cp",cp,"StructureAreaProbe",...AREAS], { maxBuffer: 1 << 29 });
await writeFile(path.join(out,"raw.jsonl"),stdout); await writeFile(path.join(out,"trace.txt"),stderr);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records=stdout.trim().split("\n").filter((l)=>l.startsWith("{")).map(JSON.parse);
assert.equal(records.length,AREAS.length);
assert.ok(records.every(r=>r.kind==="structureArea"&&r.steps.length===r.size*r.size&&r.chunks.length===r.size*r.size));
const srgText=await readFile(path.join(research,"joined-1.7.10.srg"),"utf8"),mcp={};
for(const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm))mcp[m[1]]=m[2];
const names=["aqz","aqx","ave","asw","avn","aug","atx","avm","avk","asv","apx","ahb","aow","apj"];
const classesUsed=Object.fromEntries(await Promise.all(names.map(async c=>[c,{name:mcp[c],sha256:createHash("sha256").update((await exec("unzip",["-p",jar,c+".class"],{encoding:"buffer"})).stdout).digest("hex")}])));
const jvm=await exec("java",["-XshowSettings:properties","-version"]);
const reference={target:"Minecraft Java 1.7.10",clientSha1,srgSha256:createHash("sha256").update(srgText).digest("hex"),classes:classesUsed,jvm:String(jvm.stderr).match(/java\.version = (\S+)/)?.[1]||"unknown",
 method:"Unchanged ChunkProviderGenerate provides every chunk of an area (terrain, caves, ravines, all four start searches), then populates each in x-outer/z-inner order. All four MapGenStructure implementations run in provider order for search and population. Native World/Chunk block callbacks and population tails run; ordered calls/writes, structure maps, tiles, entities, pending ticks, drops, provider Random and World.rand are captured. World light services remain the explicit full/block-zero, sky-15 fixture used by PopulationWorldProbe.",
 records};
const text=JSON.stringify(reference,null,2)+"\n";assert.ok(text.length<40_000_000);
await writeFile(path.join(root,"../public/research/structure-area-reference.json"),text);
console.log("Native structure areas:",records.length,"areas,",records.reduce((n,r)=>n+r.steps.length,0),"populated chunks,",records.reduce((n,r)=>n+r.steps.reduce((m,x)=>m+x.writeCount,0),0),"writes");
