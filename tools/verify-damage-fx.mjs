// Reads the damage effects of Minecraft Java 1.7.10 from the unchanged client: tools/probes/DamageFxProbe.java runs MathHelper.sin, the
// fall-sound selector (EntityLivingBase.func_146067_o) of EntityPlayerMP / EntityZombie / EntityPig and the fall-damage rounding; javap
// assertions pin the call sites (EntityRenderer.hurtCameraEffect, GuiIngame.renderPlayerStats, handleHealthUpdate, fall, setPlayerSPHealth).
// Writes public/research/damage-fx-reference.json for src/damage-fx.test.js. Needs a JDK, the pinned client JAR and the library JARs.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "damage-fx-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/DamageFxProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "DamageFxProbe"], { maxBuffer: 1 << 26 });
const probed = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.equal(probed.camera.length, 50);
assert.equal(probed.fallSounds.length, 24);
for (const r of probed.fallSounds) {
  const kind = { player: "player", mob: "hostile", animal: "neutral" }[r.entity];
  assert.equal(r.sound, `game.${kind}.hurt.fall.${r.points > 4 ? "big" : "small"}`, `${r.entity} ${r.points}`);
}
for (const r of probed.blink) assert.equal(r.blink, r.hurtResistantTime >= 10 && Math.trunc(r.hurtResistantTime / 3) % 2 === 1);

// ---- call sites in the client bytecode ----
const javap = async (cls) => (await exec("javap", ["-p", "-c", "-constants", "-cp", classes, cls], { maxBuffer: 1 << 27 })).stdout;
const method = (text, header) => {
  const start = text.indexOf(header);
  assert.ok(start >= 0, `missing ${header}`);
  const end = text.indexOf("\n\n", start);
  return text.slice(start, end < 0 ? undefined : end);
};
// Instruction stream with operands, comments reduced to the symbol.
const ops = (body) => body.split("\n").map((l) => /^\s+\d+: (\w+)\s*(.*)$/.exec(l)).filter(Boolean).map((m) => (m[1] + " " + m[2].replace(/\s+\/\/\s*/, " ").replace(/#\d+/, "").trim()).trim());
const contains = (list, seq, label) => {
  outer: for (let i = 0; i + seq.length <= list.length; i++) {
    for (let j = 0; j < seq.length; j++) if (!list[i + j].startsWith(seq[j])) continue outer;
    return;
  }
  assert.fail(`${label}: sequence not found: ${seq.join(" | ")}`);
};
const sites = [];
const check = (site, cls, name, seqs, list) => { for (const seq of seqs) contains(list, seq, site); sites.push({ site, class: cls, name, checks: seqs.length }); };

// EntityRenderer (blt).hurtCameraEffect: death roll, early return below zero, f^4 * PI through MathHelper.sin, -f * 14 about z.
const renderer = ops(method(await javap("blt"), "private void f(float);"));
check("EntityRenderer.hurtCameraEffect", "blt", "EntityRenderer", [
  ["fload_1", "fsub", "fstore_3"], // f1 = hurtTime - p
  ["ldc float 40.0f", "ldc float 8000.0f", "fload", "ldc float 200.0f", "fadd", "fdiv", "fsub", "fconst_0", "fconst_0", "fconst_1", "invokestatic Method org/lwjgl/opengl/GL11.glRotatef"],
  ["fload_3", "fconst_0", "fcmpg", "ifge", "return"],
  ["fdiv", "fstore_3", "fload_3", "fload_3", "fmul", "fload_3", "fmul", "fload_3", "fmul", "ldc float 3.1415927f", "fmul", "invokestatic Method qh.a:(F)F"],
  ["fload_3", "fneg", "ldc float 14.0f", "fmul", "fconst_0", "fconst_0", "fconst_1", "invokestatic Method org/lwjgl/opengl/GL11.glRotatef"],
], renderer);
assert.ok(renderer.some((o) => o.includes("sv.aS:()F")) && renderer.some((o) => o.includes("sv.aA:I")) && renderer.some((o) => o.includes("sv.ay:I")), "health, deathTime, maxHurtTime");

// EntityLivingBase (sv).
const living = await javap("sv");
// handleHealthUpdate(2): attackedAtYaw = 0, own hurt sound at getSoundVolume and (r - r) * 0.2 + 1; (3): die sound, same pitch.
const status = ops(method(living, "public void a(byte);"));
check("EntityLivingBase.handleHealthUpdate", "sv", "EntityLivingBase", [
  ["ldc float 1.5f", "putfield Field aF:F"],
  ["bipush 10", "dup_x1", "putfield Field ay:I", "putfield Field ax:I"],
  ["fconst_0", "putfield Field az:F"],
  ["invokevirtual Method aT:()Ljava/lang/String;", "aload_0", "invokevirtual Method bf:()F", "aload_0", "getfield Field Z:Ljava/util/Random;", "invokevirtual Method java/util/Random.nextFloat", "aload_0", "getfield Field Z:Ljava/util/Random;", "invokevirtual Method java/util/Random.nextFloat", "fsub", "ldc float 0.2f", "fmul", "fconst_1", "fadd"],
  ["invokevirtual Method aU:()Ljava/lang/String;", "aload_0", "invokevirtual Method bf:()F"],
], status);
// attackEntityFrom: a client world returns at once, before attackedAtYaw is written; a fresh hit sends status 2, a lethal one plays die.
const attack = ops(method(living, "public boolean a(ro, float);"));
check("EntityLivingBase.attackEntityFrom (client refuses, hurtResistantTime, status 2)", "sv", "EntityLivingBase", [
  ["aload_0", "invokevirtual Method aw:()Z", "ifeq", "iconst_0", "ireturn", "aload_0", "getfield Field o:Lahb;", "getfield Field ahb.E:Z", "ifeq", "iconst_0", "ireturn"],
  ["getfield Field ad:I", "i2f", "aload_0", "getfield Field aH:I", "i2f", "fconst_2", "fdiv", "fcmpl"],
  ["iconst_2", "invokevirtual Method ahb.a:(Lsa;B)V"],
  ["invokevirtual Method aU:()Ljava/lang/String;"],
  ["invokevirtual Method aT:()Ljava/lang/String;"],
], attack);
// fall: ceiling(f - 3 - (jump amplifier + 1)), the fall sound at 1/1, then the damage and the block's step sound at *0.5 / *0.75.
const fall = ops(method(living, "protected void b(float);"));
check("EntityLivingBase.fall", "sv", "EntityLivingBase", [
  ["getstatic Field rv.j:Lrv;", "invokevirtual Method b:(Lrv;)Lrw;"],
  ["invokevirtual Method rw.c:()I", "iconst_1", "iadd", "i2f"],
  ["fload_1", "ldc float 3.0f", "fsub", "fload_3", "fsub", "invokestatic Method qh.f:(F)I"],
  ["iload 4", "ifle"],
  ["invokevirtual Method o:(I)Ljava/lang/String;", "fconst_1", "fconst_1", "invokevirtual Method a:(Ljava/lang/String;FF)V"],
  ["getstatic Field ro.h:Lro;", "iload 4", "i2f", "invokevirtual Method a:(Lro;F)Z"],
  ["ldc2_w double 0.20000000298023224d", "dsub"],
  ["invokevirtual Method ajm.e:()Ljava/lang/String;", "aload", "invokevirtual Method ajm.c:()F", "ldc float 0.5f", "fmul", "aload", "invokevirtual Method ajm.d:()F", "ldc float 0.75f", "fmul", "invokevirtual Method a:(Ljava/lang/String;FF)V"],
], fall);
const selector = ops(method(living, "protected java.lang.String o(int);"));
check("EntityLivingBase.func_146067_o", "sv", "EntityLivingBase", [["iload_1", "iconst_4", "if_icmple", "ldc String game.neutral.hurt.fall.big", "areturn", "ldc String game.neutral.hurt.fall.small"]], selector);
for (const [cls, name, kind] of [["yz", "EntityPlayer", "player"], ["yg", "EntityMob", "hostile"]]) {
  check(`${name}.func_146067_o`, cls, name, [["iload_1", "iconst_4", "if_icmple", `ldc String game.${kind}.hurt.fall.big`, "areturn", `ldc String game.${kind}.hurt.fall.small`]], ops(method(await javap(cls), "protected java.lang.String o(int);")));
}
// EntityPlayer.fall: nothing while the abilities allow flying; EntityPlayerSP plays sounds locally, EntityPlayer to everyone else.
const player = await javap("yz");
check("EntityPlayer.fall", "yz", "EntityPlayer", [["getfield Field bE:Lyw;", "getfield Field yw.c:Z", "ifeq", "return"], ["invokespecial Method sv.b:(F)V"]], ops(method(player, "protected void b(float);")));
check("EntityPlayer.playSound (not to itself)", "yz", "EntityPlayer", [["invokevirtual Method ahb.a:(Lyz;Ljava/lang/String;FF)V"]], ops(method(player, "public void a(java.lang.String, float, float);")));
check("EntityPlayerSP.playSound (local)", "blk", "EntityPlayerSP", [["invokevirtual Method ahb.a:(DDDLjava/lang/String;FFZ)V"]], ops(method(await javap("blk"), "public void a(java.lang.String, float, float);")));
// EntityPlayerSP.setPlayerSPHealth: a drop opens hurtResistantTime 20, hurtTime = maxHurtTime = 10; a rise sets hurtResistantTime 10.
check("EntityPlayerSP.setPlayerSPHealth", "blk", "EntityPlayerSP", [
  ["fcmpg", "ifgt", "aload_0", "fload_1", "invokevirtual Method g:(F)V", "fload_2", "fconst_0", "fcmpg", "ifge", "aload_0", "aload_0", "getfield Field aH:I", "iconst_2", "idiv", "putfield Field ad:I"],
  ["getfield Field aH:I", "putfield Field ad:I", "aload_0", "getstatic Field ro.j:Lro;", "fload_2", "invokevirtual Method d:(Lro;F)V", "aload_0", "aload_0", "bipush 10", "dup_x1", "putfield Field ay:I", "putfield Field ax:I"],
], ops(method(await javap("blk"), "public void n(float);")));
// EntityLivingBase.updateFallState: the landing dust event (2006) is server-side, for a solid block and fallDistance > 3.
check("EntityLivingBase.updateFallState (2006)", "sv", "EntityLivingBase", [["sipush 2006", "iload", "iload", "iload", "aload_0", "getfield Field R:F", "ldc float 3.0f", "fsub", "invokestatic Method qh.f:(F)I", "invokevirtual Method ahb.c:(IIIII)V"]], ops(method(living, "protected void a(double, boolean);")));

// GuiIngame (bbv).renderPlayerStats: hurt blink, jiggle, regeneration wave, poison / wither / absorption sprites, hunger shake.
const gui = ops(method(await javap("bbv"), "private void a(int, int);"));
check("GuiIngame.renderPlayerStats", "bbv", "GuiIngame", [
  ["getfield Field bjk.ad:I", "iconst_3", "idiv", "iconst_2", "irem", "iconst_1", "if_icmpne"],
  ["getfield Field bjk.ad:I", "bipush 10", "if_icmpge", "iconst_0", "istore_3"],
  ["ldc int 312871", "imul", "i2l", "invokevirtual Method java/util/Random.setSeed"],
  ["getstatic Field rv.l:Lrv;", "invokevirtual Method bjk.a:(Lrv;)Z", "ifeq", "aload_0", "getfield Field n:I", "fload", "ldc float 5.0f", "fadd", "invokestatic Method qh.f:(F)I", "irem", "istore"],
  ["bipush 16", "istore", "aload_0", "getfield", "getfield", "getstatic Field rv.u:Lrv;", "invokevirtual", "ifeq", "iinc 23, 36"],
  ["iinc 23, 72"],
  ["iload", "iconst_4", "if_icmpgt", "iload", "aload_0", "getfield Field j:Ljava/util/Random;", "iconst_2", "invokevirtual Method java/util/Random.nextInt", "iadd", "istore"],
  ["iinc 27, -2"],
  ["bipush 54", "iadd"], ["bipush 63", "iadd"], ["sipush 144", "iadd"], ["sipush 153", "iadd"], ["bipush 36", "iadd"], ["bipush 45", "iadd"],
  ["bipush 10", "iload", "iconst_2", "isub", "isub", "iconst_3", "invokestatic Method java/lang/Math.max"],
  ["iconst_3", "imul", "iconst_1", "iadd", "irem", "ifne"],
  ["getfield Field j:Ljava/util/Random;", "iconst_3", "invokevirtual Method java/util/Random.nextInt", "iconst_1", "isub", "iadd"],
  ["bipush 13", "istore"],
], gui);

const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const classNames = { blt: "EntityRenderer", sv: "EntityLivingBase", yz: "EntityPlayer", yg: "EntityMob", yq: "EntityZombie", wo: "EntityPig", mw: "EntityPlayerMP", blk: "EntityPlayerSP", bbv: "GuiIngame", qh: "MathHelper" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.keys(classNames).map(async (c) => [c, { name: classNames[c], sha256: await digest(c) }]))),
  method:
    "tools/probes/DamageFxProbe.java calls MathHelper.sin and MathHelper.ceiling_float_int and EntityLivingBase.func_146067_o (allocated without constructors) in the unchanged classes; tools/verify-damage-fx.mjs pins the call sites with javap.",
  formulas: {
    hurtCamera: "z roll (GL degrees) = (health <= 0 ? 40 - 8000 / (deathTime + p + 200) : 0) + (hurtTime - p >= 0 ? -sin(((hurtTime - p) / maxHurtTime)^4 * PI) * 14 : 0); attackedAtYaw is 0 on a client",
    fall: "points = ceiling_float_int(distance - 3 - (jump boost amplifier + 1)); sound game.<player|hostile|neutral>.hurt.fall.<big if points > 4 else small> at 1 / 1; then the step sound of the block at floor(y - 0.2 - yOffset) at volume * 0.5 and pitch * 0.75; then attackEntityFrom(fall, points)",
    clientHurtSound: "handleHealthUpdate(2) / (3): hurt / die sound at getSoundVolume and (r - r) * 0.2 + 1 on the client entity's own Random",
    heartBlink: "hurtResistantTime / 3 % 2 == 1 and hurtResistantTime >= 10; setPlayerSPHealth sets hurtResistantTime 20 for a drop and 10 for a rise",
  },
  camera: probed.camera,
  death: probed.death,
  fallSounds: probed.fallSounds,
  fallPoints: probed.fallPoints,
  blink: probed.blink,
  callSites: sites,
};
await writeFile(path.join(root, "../public/research/damage-fx-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${probed.camera.length} camera rolls, ${probed.fallSounds.length} fall sounds, ${probed.fallPoints.length} fall rows, ${sites.length} call sites`);
