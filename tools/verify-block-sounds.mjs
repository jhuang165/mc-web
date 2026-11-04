// Reads Block.SoundType (stepSound) of every registered original block through tools/probes/BlockSoundProbe.java and
// extracts the SoundType call-site formulas (break, hit, place, step, hoe) from the unchanged client bytecode with javap;
// asserts the formulas the port uses and writes public/research/block-sounds-reference.json for src/block-sounds.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all JARs.
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
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "block-sound-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/BlockSoundProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "BlockSoundProbe"], { maxBuffer: 1 << 26 });
const lines = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const { types } = lines.shift();
const blocks = lines.map(({ kind, ...b }) => (assert.equal(kind, "block"), b));
assert.equal(types.length, 12);
assert.ok(blocks.length >= 171, `${blocks.length} registered blocks`);
for (const b of blocks) assert.ok(b.type, `block ${b.id} (${b.blockClass}) stepSound is not one of the twelve Block.soundType fields`);

// ---- call sites: SoundType accessor use in the client bytecode ----
const javap = async (cls) => (await exec("javap", ["-p", "-c", "-constants", "-cp", classes, cls], { maxBuffer: 1 << 27 })).stdout;
// Token stream of one call site: from the SoundType name accessor (a break, b place, e step) through the pitch expression.
const TOKEN = [
  [/Method ajm\.([a-e]):/, (m) => "ajm." + m[1]],
  [/\bfconst_(\d)\b/, (m) => m[1] + ".0"],
  [/\/\/ float ([\d.]+)f/, (m) => m[1]],
  [/\b(fadd|fdiv|fmul|frem|fcmpl)\b/, (m) => m[1]],
  [/Field ajn\.aC:/, () => "snow_layer"],
];
function windows(text, accessor) {
  const ops = text.split("\n").map((l) => {
    for (const [re, fn] of TOKEN) { const m = re.exec(l); if (m) return fn(m); }
    return null;
  }).filter(Boolean);
  const found = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] !== accessor) continue;
    let j = ops.indexOf("ajm.d", i) + 1;
    if (/^[\d.]+$/.test(ops[j] ?? "") && ops[j + 1] === "fmul") j += 2; // pitch multiplier
    found.push(ops.slice(i, j));
  }
  return found;
}
const classNames = { bje: "PlayerControllerMP", bma: "RenderGlobal", abh: "ItemBlock", abi: "ItemReed", aec: "ItemSnow", aeg: "ItemSlab", ada: "ItemHoe", sa: "Entity", aji: "Block", ajm: "Block$SoundType", ajj: "Block$1 (glass)", ajk: "Block$2 (ladder)", ajl: "Block$3 (anvil)", sv: "EntityLivingBase", wi: "EntityHorse" };
const BREAK = ["ajm.a", "ajm.c", "1.0", "fadd", "2.0", "fdiv", "ajm.d", "0.8", "fmul"];
const PLACE = ["ajm.b", "ajm.c", "1.0", "fadd", "2.0", "fdiv", "ajm.d", "0.8", "fmul"];
const HOE = ["ajm.e", "ajm.c", "1.0", "fadd", "2.0", "fdiv", "ajm.d", "0.8", "fmul"];
const HIT = ["ajm.e", "ajm.c", "1.0", "fadd", "8.0", "fdiv", "ajm.d", "0.5", "fmul"];
const STEP = ["ajm.e", "ajm.c", "0.15", "fmul", "ajm.d"];
const sites = [];
async function site(label, cls, accessor, expected, count = 1) {
  const found = windows(await javap(cls), accessor);
  assert.equal(found.length, count, `${label}: ${found.length} ${accessor} windows in ${cls}`);
  for (const tokens of found) assert.deepEqual(tokens, expected, `${label} tokens`);
  sites.push({ site: label, class: cls, name: classNames[cls], accessor, tokens: expected, windows: count });
}
await site("playAuxSFX 2001 (block break effect)", "bma", "ajm.a", BREAK);
await site("ItemBlock.onItemUse (place)", "abh", "ajm.b", PLACE);
await site("ItemReed.onItemUse (place)", "abi", "ajm.b", PLACE);
await site("ItemSnow.onItemUse (stack a layer)", "aec", "ajm.b", PLACE);
await site("ItemSlab.onItemUse / tryPlace (place)", "aeg", "ajm.b", PLACE, 2);
await site("ItemHoe.func_150857_a (till)", "ada", "ajm.e", HOE);
await site("PlayerControllerMP.onPlayerDamageBlock (hit, step name)", "bje", "ajm.e", HIT);
await site("Entity.func_145780_a (step)", "sa", "ajm.e", STEP, 2);
// The hit sound runs only on ticks where the controller's counter is a multiple of 4.
const controller = await javap("bje");
assert.match(controller, /ldc\s+#\d+\s+\/\/ float 4\.0f\n\s+\d+: frem\n\s+\d+: fconst_0\n\s+\d+: fcmpl\n\s+\d+: ifne/, "hit sound every 4 ticks (stepSoundTickCounter % 4 == 0)");
assert.match(controller, /Method aji\.o:\(\)Lawt;\n\s+\d+: getstatic\s+#\d+\s+\/\/ Field awt\.a:Lawt;\n\s+\d+: if_acmpne/, "air material skips the hit");
// Entity.func_145780_a: snow layer above replaces the sound type; liquids (Material.isLiquid awt.d) are silent.
const entity = await javap("sa");
assert.match(entity, /ahb\.a:\(III\)Laji;\n\s+\d+: getstatic\s+#\d+\s+\/\/ Field ajn\.aC:Laji;\n\s+\d+: if_acmpne/, "snow layer above the stepped block");
assert.match(entity, /Method awt\.d:\(\)Z\n\s+\d+: ifne/, "liquid material is silent");

// Item classes whose onItemUse plays no sound at all (ItemDye: bone meal only sends level event 2005) (no SoundType accessor, no world sound call).
const silent = { ach: "ItemDoor", abg: "ItemBed", adz: "ItemSign", ads: "ItemRedstone", adw: "ItemSeeds", adv: "ItemSeedFood", aeb: "ItemSkull", acj: "ItemDye" };
for (const [cls, name] of Object.entries(silent)) {
  const text = await javap(cls);
  assert.ok(!/Method ajm\.|Field aji\.H:/.test(text), `${name} uses a SoundType`);
  assert.ok(!/ahb\.a:\(DDDLjava\/lang\/String;FF\)V|ahb\.a:\(Lsa;Ljava\/lang\/String;FF\)V|ahb\.a:\(Lyz;Ljava\/lang\/String;FF\)V/.test(text), `${name} plays a sound`);
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.keys(classNames).map(async (c) => [c, { name: classNames[c], sha256: await digest(c) }]))),
  method:
    "tools/probes/BlockSoundProbe.java runs the unchanged Block.registerBlocks and reads every registered block's stepSound (aji.H) by identity against the twelve Block.soundType* fields (aji.e-p) plus the SoundType accessors getBreakSound a(), getStepResourcePath e(), func_150496_b b(), getVolume c(), getFrequency d(). The call sites are javap bytecode token windows (accessor to the sound-playing call) of the original client classes, asserted against the formulas below.",
  formulas: {
    break: "name = type.break; volume = (type.volume + 1) / 2; pitch = type.frequency * 0.8 (RenderGlobal.playAuxSFX 2001, at x+0.5, y+0.5, z+0.5)",
    hit: "every 4th tick of continued digging: name = type.step; volume = (type.volume + 1) / 8; pitch = type.frequency * 0.5 (PlayerControllerMP.onPlayerDamageBlock; air material skipped; at x+0.5, y+0.5, z+0.5)",
    place: "name = type.place; volume = (type.volume + 1) / 2; pitch = type.frequency * 0.8 (ItemBlock, ItemReed, ItemSnow, ItemSlab; at x+0.5, y+0.5, z+0.5; ItemDoor, ItemBed, ItemSign, ItemRedstone and ItemSeeds play nothing)",
    hoe: "name = type.step of the tilled block; volume = (type.volume + 1) / 2; pitch = type.frequency * 0.8 (ItemHoe)",
    step: "name = type.step; volume = type.volume * 0.15; pitch = type.frequency (Entity.func_145780_a); a snow layer on top of the stepped block substitutes the snow layer's sound type; a liquid-material block is silent",
  },
  types,
  callSites: sites,
  silentItems: silent,
  blocks,
};
await writeFile(path.join(root, "../public/research/block-sounds-reference.json"), JSON.stringify(reference) + "\n");
const counts = {};
for (const b of blocks) counts[b.type] = (counts[b.type] || 0) + 1;
console.log(`PASS: ${blocks.length} blocks, ${sites.length} call sites`, JSON.stringify(counts));
