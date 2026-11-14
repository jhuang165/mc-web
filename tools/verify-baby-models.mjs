// Batch 64: records the unchanged 1.7.10 child render paths of the mob models and writes public/research/baby-model-reference.json (see tools/probes/BabyModelProbe.java).
// ModelBase.render runs for real with isChild false and true; GL is recorded by probes/gl/GL11.java. Needs a JDK and the pinned client JAR (tools/research or MC_RESEARCH).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
let research;
for (const dir of [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean)) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "baby-model-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/BabyModelProbe.java"), path.join(root, "probes/gl/GL11.java")]);
const { stdout } = await exec("java", ["-Djava.awt.headless=true", "-cp", cp, "BabyModelProbe"], { maxBuffer: 1 << 26 });
const models = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
assert.equal(models.length, 11);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bhm: "ModelBiped", bip: "ModelZombie", bhw: "ModelQuadruped", bhu: "ModelPig", bhi: "ModelCow", bhy: "ModelSheep2", bhx: "ModelSheep1", bhh: "ModelChicken", bio: "ModelWolf", bht: "ModelOcelot", bik: "ModelVillager", bil: "ModelZombieVillager", bix: "ModelRenderer" };
await writeFile(path.join(root, "../public/research/baby-model-reference.json"), JSON.stringify({
  source: "tools/verify-baby-models.mjs: unchanged ModelBase.render (a(sa, f, f, f, f, f, f)) of each model with isChild false (adult) and true (child), null entity, zero limb inputs; the biped family and the villager have setRotationAngles replaced by a no-op (limbs at their constructor rest)",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  events: "[\"T\", x, y, z] glTranslatef, [\"R\", angle, x, y, z] glRotatef, [\"S\", x, y, z] glScalef, [\"P\"] push, [\"O\"] pop, [\"L\", part] the part's display list. Units are blocks; model axes (x right, y down, z back) with the origin 24 pixels above the feet.",
  parts: "per model: part name 'class.field' (children 'class.field/i') -> rest point (px), angles, offset and box bounds (px); floats: the model's float fields (the quadruped childYOffset / childZOffset are g and h).",
  models,
}) + "\n");
console.log("Baby model records:", models.length);
