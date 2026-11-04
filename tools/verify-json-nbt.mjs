// JsonToNBT of the 1.7.10 client (eb.a, the data-tag parser of /give, /summon, /setblock and /testforblock): runs
// tools/probes/JsonToNBTProbe.java over a corpus of command tags and edge cases against the unchanged JAR, checks
// src/json-nbt.js against every answer, and writes public/research/json-nbt-reference.json for src/json-nbt.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the log4j-api JAR (MC_PROBE_LIBS or a
// Minecraft libraries folder).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { parseJsonNbt, canonicalNbt, NBTException, NBTHang } from "../src/json-nbt.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "json-nbt-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}

const CORPUS = [
  // Command tags people type.
  '{display:{Name:"Excalibur",Lore:["Line one","Line two"]},ench:[{id:16,lvl:5},{id:34,lvl:3}]}',
  '{ench:[{id:0s,lvl:4s}],RepairCost:3}',
  '{display:{color:16711680}}',
  '{Unbreakable:1}',
  '{StoredEnchantments:[{id:51,lvl:1}]}',
  '{CustomName:"Bob",CustomNameVisible:1,Health:5f,PersistenceRequired:1b}',
  '{Riding:{id:Skeleton,Equipment:[{id:261,Count:1},{},{},{},{}]}}',
  '{Equipment:[{id:276},{id:301},{id:300},{id:299},{id:298}],DropChances:[0.0f,0.0f,0.0f,0.0f,0.0f]}',
  '{IsBaby:1,IsVillager:1}',
  '{Profession:2,Offers:{Recipes:[{buy:{id:388,Count:3},sell:{id:264,Count:1},maxUses:10}]}}',
  '{ActiveEffects:[{Id:1,Amplifier:2,Duration:600}]}',
  '{Items:[{Slot:0b,id:1,Count:64b,Damage:0s},{Slot:13,id:"264",Count:2}]}',
  '{Fuse:80,ExplosionPower:4}',
  '{Item:{id:264,Count:1},Age:-32768,PickupDelay:10}',
  '{Motion:[0.0,1.0,0.0],Rotation:[90f,0f],Pos:[1d,2d,3d]}',
  '{Text1:"{\\"text\\":\\"hi\\"}",Text2:"a"}',
  '{Command:"say hi",CustomName:"@"}',
  '{SkullType:3,ExtraType:"Notch",Rot:4b}',
  '{Fire:100s,Air:300s,OnGround:1b,Invulnerable:1b}',
  '{Size:3,Saddle:1,Type:4,Tame:1,Variant:513}',
  // Primitive types and suffixes.
  '{a:1b,b:2B,c:3s,d:4S,e:5L,f:6l,g:7f,h:8F,i:9d,j:10D,k:11,l:12.5,m:.5,n:-.5d,o:+3,p:-0,q:-0.0d}',
  '{a:true,b:false,c:TRUE,d:False,e:tRuE}',
  '{a:128b,b:-129b,c:32768s,d:2147483648,e:9223372036854775807L,f:9223372036854775808L,g:-2147483648}',
  '{a:1.5e3,b:1e3d,c:1.,d:.,e:1.5.5,f:--1,g:+-1,h:5|,i:5|d,j:1|b}',
  '{a:0.1f,b:0.1,c:16777217f,d:3.4028236e38f,e:1.17549435e-38f,f:0.30000001192092896f}',
  '{a:340282356779733661637539395458142568448f,b:1' + "0".repeat(400) + 'd}',
  '{a:00012,b:007b,c:0x10,d:1_000}',
  // Strings and quoting.
  '{a:"quoted",b:unquoted,c:"with, comma",d:"with {brace}",e:"with [bracket]",f:"with:colon"}',
  '{a:"esc \\"inner\\" quote",b:"trailing\\\\"}',
  '{a:"",b:"x",c:"\\"",d:" spaced ",e:  padded  }',
  '{a:"x" ,b:1}',
  '{a:"x"y,b:1}',
  '{a:x"y",b:1}',
  '{a:"x" "y"}',
  '{a:hello world,b:more words here}',
  '{"quoted key":1,b:2}',
  '{a b:1}',
  '{:1}',
  '{a:}',
  '{a:1,a:2}',
  '{a:\u00e9t\u00e9,b:"\u65e5\u672c",c:\u00a0x\u00a0}',
  '{a:\u3000wide\u3000,b:1}',
  // Lists.
  '{a:[1,2,3]}',
  '{a:[1, 2 ,3 ]}',
  '{a:[-1,-2]}',
  '{a:[1,2,]}',
  '{a:[,1]}',
  '{a:[,]}',
  '{a:[]}',
  '{a:[ ]}',
  '{a:[1|2]}',
  '{a:[1-2]}',
  '{a:[2147483648]}',
  '{a:[1b,2b]}',
  '{a:[1b,2]}',
  '{a:[1,2b,3]}',
  '{a:[1.5,2]}',
  '{a:[a,b,c]}',
  '{a:["a,b",c]}',
  '{a:[{x:1},{y:2}]}',
  '{a:[{},{}]}',
  '{a:[[1,2],[3]]}',
  '{a:[[a],[b,c]]}',
  '{a:[0:1,1:2]}',
  '{a:[x:1,y:2]}',
  '{a:[x:1]}',
  '{a:["a:b"]}',
  '{a:[a b, c d]}',
  '{a:[{x:1} ,{y:2}]}',
  '{a:["q" ,r]}',
  '{a:[a,{x:1},2]}',
  // Structure and errors.
  '{}',
  '  {a:1}  ',
  '{ a : 1 , b : 2 }',
  '{a:{b:{c:{d:1}}}}',
  '{a:1',
  '{a:1}}',
  '{a:1}{b:2}',
  '{a:1} x',
  '{a:1,}',
  '{,a:1}',
  '{a:1,,b:2}',
  '{a}',
  '{a,b:1}',
  '{a:1 b:2}',
  '{a:[1,2}',
  '{a:{b:1]}',
  '{a:"unterminated}',
  '{a:\\"x}',
  '{a:"x\\"}',
  '{a:[1,2]]}',
  '{a:{}x}',
  '{a:[]x}',
  '{a:{},b:[]}',
  '{a:{}b:1}',
  '{a:[a,,b]}',
  '{a:[{},,{}]}',
  '',
  '   ',
  'a:1',
  'a:"x"',
  'name:{b:1}',
  '1',
  '[1,2]',
  '[a,b]',
  'x',
  ']',
  '}',
  '"',
  '{"}',
  '{a:"}"}',
  '{a:"]"}',
  '{a:"\\\\"}',
  '{a:b:c}',
  '{a:{b:1}:c}',
  '{a:x{b}}',
  '{a:x[1]}',
  '{\ta:1,\nb:2\r}',
  '{a:\u001f1}',
];

const libs = await Promise.all(["log4j-api-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter), input = path.join(out, "corpus.hex");
// The probe reads one hex line per input; "-" stands for the empty string.
await writeFile(input, CORPUS.map((s) => (s ? Buffer.from(s, "utf8").toString("hex") : "-")).join("\n") + "\n");
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/JsonToNBTProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "JsonToNBTProbe", input], { maxBuffer: 1 << 26 });
const answers = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
assert.equal(answers.length, CORPUS.length, "one answer per corpus entry");

const port = (s) => {
  try { return { tag: canonicalNbt(parseJsonNbt(s)) }; }
  catch (e) {
    if (e instanceof NBTHang) return { hang: true };
    if (e instanceof NBTException) return { error: e.message };
    throw e;
  }
};
const cases = CORPUS.map((input, i) => ({ input, ...answers[i] }));
let mismatches = 0;
for (const c of cases) {
  const { input, ...native } = c;
  try { assert.deepEqual(port(input), native); }
  catch { mismatches++; console.error("MISMATCH", JSON.stringify(input), "\n  native", JSON.stringify(native), "\n  port  ", JSON.stringify(port(input))); }
}
const count = (k) => cases.filter((c) => k in c).length;
console.log(`${cases.length} inputs: ${count("tag")} tags, ${count("error")} NBTException, ${count("hang")} hangs, ${count("throw")} other; ${mismatches} port mismatches`);
await writeFile(path.join(root, "../public/research/json-nbt-reference.json"), JSON.stringify({
  source: "tools/verify-json-nbt.mjs + tools/probes/JsonToNBTProbe.java (JsonToNBT.func_150315_a, eb.a)",
  clientSha1,
  format: "tag: {t: type id, v: value, e: list element type}; floats as raw int bits, doubles and longs as decimal strings, compound keys sorted",
  cases,
}, null, 1) + "\n");
if (mismatches) process.exit(1);
