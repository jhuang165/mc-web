// Records unchanged 1.7.10 FlatGeneratorInfo, GuiFlatPresets, ChunkProviderFlat chunks, WorldChunkManagerHell and the bonus chest;
// see FlatWorldProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "flat-world-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/FlatWorldProbe.java")]);
// GuiFlatPresets.<clinit> needs the client's RenderItem, so its preset table is read from the bytecode instead of running it.
const { stdout: dump } = await exec("javap", ["-p", "-c", "-constants", "-cp", classes, "bdq"], { maxBuffer: 1 << 24 });
const clinit = dump.slice(dump.indexOf("static {};")).split("\n").map((l) => l.match(/^\s*\d+: (\w+)\s*(.*?)(?:\s*\/\/ (.*))?$/)).filter(Boolean).map((m) => ({ op: m[1], arg: m[2], note: m[3] ?? "" }));
const ref = (n) => n.match(/Field (\w+\.\w+):/)[1];
const small = (i) => { const o = clinit[i]; return o.op.startsWith("iconst_") ? +o.op.slice(7) : o.op === "bipush" || o.op === "sipush" ? +o.arg : NaN; };
const presetLines = [];
for (let i = 0; i < clinit.length; i++) {
  if (clinit[i].op !== "ldc" || !/^String /.test(clinit[i].note) || clinit[i + 1]?.op !== "getstatic") continue;
  const name = clinit[i].note.slice(7).replaceAll("\\'", "'");
  let j = i + 1, icon;
  if (clinit[j + 1].op === "invokestatic" && /adb\.a:/.test(clinit[j + 1].note)) { icon = "block:" + ref(clinit[j].note); j += 2; } else { icon = "item:" + ref(clinit[j].note); j++; }
  const biome = ref(clinit[j++].note), features = [];
  if (clinit[j + 1].op === "anewarray" && /java\/lang\/String/.test(clinit[j + 1].note)) {
    j += 2;
    while (clinit[j].op === "dup") { features.push(clinit[j + 2].note.replace(/^String /, "")); j += 4; }
    assert.match(clinit[j].note, /Arrays\.asList/); j++;
  }
  j += 2; // iconst n, anewarray ast
  const layers = [];
  while (clinit[j].op === "dup") {
    j += 3; // dup, iconst index, new ast, dup follows
    j += 1; // dup
    const count = small(j++), block = ref(clinit[j++].note);
    let meta = null;
    if (/\(ILaji;I\)V/.test(clinit[j + 1]?.note ?? "")) meta = small(j++);
    assert.equal(clinit[j].op, "invokespecial"); j++; assert.equal(clinit[j].op, "aastore"); j++;
    layers.push(meta === null ? `${count}:${block}` : `${count}:${block}:${meta}`);
  }
  presetLines.push([name, icon, biome, features.join(","), layers.join(";")].join("\t"));
  i = j;
}
assert.equal(presetLines.length, 8);
const presetFile = path.join(out, "presets.tsv");
await writeFile(presetFile, presetLines.join("\n") + "\n");
const { stdout } = await exec("java", ["-cp", cp, "FlatWorldProbe", presetFile], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const by = (k) => rows.filter((r) => r.kind === k);
const presets = by("presets")[0].list;
assert.equal(presets.length, 8);
assert.ok(by("parse").length >= 50 && by("chunk").length >= 22 && by("bonus").length === 40 && by("manager").length === 4);
assert.equal(by("bonusContents")[0].items.length, 10);
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { ass: "FlatGeneratorInfo", ast: "FlatLayerInfo", aqu: "ChunkProviderFlat", bdq: "GuiFlatPresets", bcz: "GuiCreateFlatWorld", aie: "WorldChunkManagerHell", arg: "WorldGeneratorBonusChest", mt: "WorldServer", qx: "WeightedRandomChestContent" };
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "Unchanged FlatGeneratorInfo.createFlatGeneratorFromString/toString over " + by("parse").length + " fixed strings (features and their parameters are listed in the probe JVM's HashMap order); the eight GuiFlatPresets entries read from the class; BiomeGenBase.getBiome edge ids; ChunkProviderFlat.provideChunk (mapFeatures off, the World double supplies seed, a WorldChunkManagerHell and the provider) for each preset and three more strings at two chunks, with SHA-1 of block ids and metadata over the 16x256x16 chunk, one full column and the biome histogram; WorldChunkManagerHell findBiomePosition/areBiomesViable; WorldServer.bonusChestContent and WorldServer.k's ten placement attempts with the unchanged WorldGeneratorBonusChest over flat chunks (spawn coordinates are fixture inputs, world Random seeded from the fixture seed; every setBlock and every chest slot write recorded). Populate (structures, lakes, dungeons, decoration) is not replayed natively.",
  records: rows,
};
await writeFile(path.join(root, "../public/research/flat-world-reference.json"), JSON.stringify(reference) + "\n");
console.log("Flat world records:", rows.length, "presets:", presets.length);
