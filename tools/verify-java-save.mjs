import {World} from '../src/world.js';
import {exportJavaSave} from '../src/region-export.js';
// Checks a JS-exported save with the unchanged native RegionFile/NBT/AnvilChunkLoader. Requires the pinned client JAR and a JDK.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) =>
    access(p).then(
      () => true,
      () => false,
    );
const researchDirs = [
  process.env.MC_RESEARCH,
  path.join(root, "research"),
  path.join(root, "../../tools/research"),
].filter(Boolean);
let research;
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) {
    research = dir;
    break;
  }
if (!research)
  throw new Error(
    "Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.",
  );
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "java-save-probe");
assert.equal(
  createHash("sha1")
    .update(await readFile(jar))
    .digest("hex"),
  "e80d9b3bf5085002218d4be59e668bac718abbc6",
);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "")
    .split(path.delimiter)
    .filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec(
      "find",
      [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"],
      { maxBuffer: 1 << 24 },
    );
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(
    `Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`,
  );
}
const libs = await Promise.all(
  ["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library),
);
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], {
  maxBuffer: 1 << 24,
});
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ChunkNbtProbe.java'),path.join(root,'probes/JavaSaveProbe.java')]);
const w=new World('17','javaStreamed',12);w.restore([['-1,100,-1',41]]);
const record={id:'native-export',name:'Native export',seed:'17',biome:'javaStreamed',generationVersion:12,mode:'creative',position:{x:-.5,y:101,z:-.5},edits:[...w.edits],player:{time:100,slots:[],chests:{'-1,100,-1':{facing:4,items:[{id:19,count:3,damage:14}]}},furnaces:{}},entities:[{type:'pig',x:-2,y:101,z:-2,health:9}],fluidTicks:{version:1,time:100,entries:[{x:-1,y:99,z:-1,block:10,delay:3}]}};
const result=await exportJavaSave(record,{world:w}),save=path.join(out,'save');await mkdir(path.join(save,'region'),{recursive:true});
for(const [name,bytes] of result.files)await writeFile(path.join(save,name),bytes);
const {stdout}=await exec('java',['-cp',cp,'JavaSaveProbe',save]);console.log(stdout.trim());
