// Adventure mode (WorldSettings.GameType.ADVENTURE) of the 1.7.10 client: runs tools/probes/AdventureProbe.java over every
// registered block and a set of held items (EntityPlayer.isCurrentToolAdventureModeExempt's inputs), and asserts with javap
// the bytecode around it: GameType.configurePlayerCapabilities (allowEdit = !isAdventure), canPlayerEdit, the four
// block-hit/break gates, Item.canItemEditBlocks, and the Material.setAdventureModeExempt calls. Writes
// public/research/adventure-reference.json for src/adventure.test.js. Needs a JDK, the pinned client JAR (tools/research or
// MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all JARs (MC_PROBE_LIBS or a Minecraft libraries folder).
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "adventure-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/AdventureProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "AdventureProbe"], { maxBuffer: 1 << 26 });
const lines = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const { items } = lines.pop();
const blocks = lines;
assert.ok(blocks.length >= 171, `${blocks.length} registered blocks`);

const javap = async (cls) => (await exec("javap", ["-p", "-c", "-cp", classes, cls], { maxBuffer: 1 << 27 })).stdout;
const method = (text, header) => {
  const start = text.indexOf("  " + header);
  assert.ok(start >= 0, header);
  const end = text.indexOf("\n\n", start);
  return text.slice(start, end < 0 ? undefined : end);
};
const ops = (body) => body.split("\n").map((l) => /^\s+\d+: (\w+)\s*(?:#\d+\s*)?(?:\/\/ (?:Method|Field|class) (\S+))?/.exec(l)).filter(Boolean).map((m) => (m[2] ? m[1] + " " + m[2] : m[1]));
// WorldSettings.GameType.configurePlayerCapabilities (ahk.a(yw)): ..., allowEdit (yw.e) = !isAdventure (ahk.c).
const gameType = await javap("ahk");
assert.match(method(gameType, "public void a(yw);"), /invokevirtual #\d+\s+\/\/ Method c:\(\)Z\n\s+\d+: ifne\s+\d+\n\s+\d+: iconst_1\n\s+\d+: goto\s+\d+\n\s+\d+: iconst_0\n\s+\d+: putfield\s+#\d+\s+\/\/ Field yw\.e:Z/, "allowEdit = !isAdventure");
assert.match(method(gameType, "public boolean c();"), /getstatic\s+#\d+\s+\/\/ Field d:Lahk;/, "isAdventure is the fourth constant (ADVENTURE, id 2)");
const player = await javap("yz");
// isCurrentToolAdventureModeExempt and canPlayerEdit, token for token.
const exempt = ops(method(player, "public boolean d(int, int, int);"));
assert.deepEqual(exempt, ["aload_0", "getfield yz.bE:Lyw;", "getfield yw.e:Z", "ifeq", "iconst_1", "ireturn", "aload_0", "getfield o:Lahb;", "iload_1", "iload_2", "iload_3", "invokevirtual ahb.a:(III)Laji;", "astore", "aload", "invokevirtual aji.o:()Lawt;", "getstatic awt.a:Lawt;", "if_acmpeq", "aload", "invokevirtual aji.o:()Lawt;", "invokevirtual awt.q:()Z", "ifeq", "iconst_1", "ireturn", "aload_0", "invokevirtual bF:()Ladd;", "ifnull", "aload_0", "invokevirtual bF:()Ladd;", "astore", "aload", "aload", "invokevirtual add.b:(Laji;)Z", "ifne", "aload", "aload", "invokevirtual add.a:(Laji;)F", "fconst_1", "fcmpl", "ifle", "iconst_1", "ireturn", "iconst_0", "ireturn"].map((o) => o.replace("yz.bE", "bE")), "isCurrentToolAdventureModeExempt");
const edit = ops(method(player, "public boolean a(int, int, int, int, add);"));
assert.deepEqual(edit, ["aload_0", "getfield bE:Lyw;", "getfield yw.e:Z", "ifeq", "iconst_1", "ireturn", "aload", "ifnull", "aload", "invokevirtual add.z:()Z", "ireturn", "iconst_0", "ireturn"], "canPlayerEdit");
// ItemStack.canEditBlocks -> Item.canItemEditBlocks, which is `return true` and overridden by no item class.
assert.deepEqual(ops(method(await javap("add"), "public boolean z();")), ["aload_0", "invokevirtual b:()Ladb;", "invokevirtual adb.v:()Z", "ireturn"]);
assert.deepEqual(ops(method(await javap("adb"), "public boolean v();")), ["iconst_1", "ireturn"], "Item.canItemEditBlocks is true");
// The four hit/break gates open with: if (gameType.isAdventure() && !player.isCurrentToolAdventureModeExempt(x, y, z)) return.
const GATES = [
  ["bje", "public boolean a(int, int, int, int);", "PlayerControllerMP.onPlayerDestroyBlock", "bjk.d:(III)Z"],
  ["bje", "public void b(int, int, int, int);", "PlayerControllerMP.clickBlock", "bjk.d:(III)Z"],
  ["mx", "public void a(int, int, int, int);", "ItemInWorldManager.onBlockClicked", "mw.d:(III)Z"],
  ["mx", "public boolean b(int, int, int);", "ItemInWorldManager.tryHarvestBlock", "mw.d:(III)Z"],
];
const gates = [];
for (const [cls, header, name, call] of GATES) {
  const head = ops(method(await javap(cls), header)).slice(0, 13);
  assert.equal(head[2], "invokevirtual ahk.c:()Z", name);
  assert.equal(head[3], "ifeq", name);
  const at = head.indexOf("invokevirtual " + call);
  assert.ok(at > 3 && head[at + 1] === "ifne" && (head[at + 2] === "iconst_0" || head[at + 2] === "return"), name);
  gates.push({ site: name, obf: `${cls}.${header.replace(/^public \w+ /, "").replace(/;$/, "")}` });
}
// Material.setAdventureModeExempt (awt.p) is called for glass, redstoneLight, ice, packedIce and by MaterialLogic's
// constructor (plants, vine, circuits, carpet, snow layer).
const material = await javap("awt");
assert.equal((method(material, "static {};").match(/Method p:\(\)Lawt;/g) || []).length, 4);
assert.match(method(await javap("awq"), "public awq(awv);"), /Method p:\(\)Lawt;/);
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const CLASSES = { ahk: "WorldSettings$GameType", yz: "EntityPlayer", yw: "PlayerCapabilities", add: "ItemStack", adb: "Item", awt: "Material", awq: "MaterialLogic", bje: "PlayerControllerMP", mx: "ItemInWorldManager" };
const exemptFor = (b, i) => !b.air && (b.exempt || b.harvest[i] || b.speed[i] > 1);
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.keys(CLASSES).map(async (c) => [c, { name: CLASSES[c], sha256: await digest(c) }]))),
  method: "tools/probes/AdventureProbe.java runs the unchanged Block.registerBlocks and Item.registerItems and reads, per registered block, Material.isAdventureModeExempt (awt.q) and, per held item (ItemStack of the item, damage 0), ItemStack.func_150998_b (canHarvestBlock) and func_150997_a (getStrVsBlock). The surrounding bytecode is asserted with javap.",
  rules: {
    capabilities: "GameType.configurePlayerCapabilities: allowEdit = !isAdventure; adventure keeps survival's damage, flight and instabuild (all false)",
    exempt: "isCurrentToolAdventureModeExempt(x, y, z) = allowEdit || material != air && (material.isAdventureModeExempt || held != null && (held.canHarvestBlock(block) || held.getStrVsBlock(block) > 1))",
    canPlayerEdit: "allowEdit || held != null && held.canEditBlocks(); Item.canItemEditBlocks is `return true` for every item, so adventure players place blocks and use items as in survival",
    gates: "onPlayerDestroyBlock and tryHarvestBlock return false, clickBlock and onBlockClicked return, when the game type is adventure and the tool is not exempt (no break progress, no Block.onBlockClicked, no fire punch-out)",
  },
  gates,
  items,
  blocks: blocks.map((b) => ({ id: b.id, exempt: b.air ? false : b.exempt, tools: items.filter((_, i) => exemptFor(b, i)) })),
};
await writeFile(path.join(root, "../public/research/adventure-reference.json"), JSON.stringify(reference, null, 1) + "\n");
// The port's table (src/adventure-data.js): exempt materials, then per held tool the further blocks it may break.
const exemptBlocks = reference.blocks.filter((b) => b.exempt).map((b) => b.id);
const byTool = Object.fromEntries(items.map((item) => [item, reference.blocks.filter((b) => !b.exempt && b.tools.includes(item)).map((b) => b.id)]));
for (const control of [280, 4, 346]) assert.deepEqual(byTool[control], [], `item ${control} is no tool`);
for (const control of [280, 4, 346]) delete byTool[control];
await writeFile(path.join(root, "../src/adventure-data.js"), `// Generated by tools/verify-adventure.mjs from the 1.7.10 client (public/research/adventure-reference.json): do not edit.
// Original block ids whose Material.isAdventureModeExempt is set (MaterialLogic, glass, redstoneLight, ice, packedIce).
export const EXEMPT_MATERIAL_BLOCKS = Object.freeze(${JSON.stringify(exemptBlocks)});
// Original held item id -> the other original block ids it may break in adventure (canHarvestBlock or getStrVsBlock > 1).
// Any other item (and the empty hand) breaks only the exempt materials.
export const TOOL_BLOCKS = Object.freeze(${JSON.stringify(byTool)});
`);
await rm(out, { recursive: true, force: true });
console.log(blocks.length, "blocks;", reference.blocks.filter((b) => b.exempt).length, "exempt materials");
