// (Localization round 2) Reads the unlocalized lang key of every original item/damage through tools/probes/ItemKeyProbe.java and writes
// public/research/item-keys-reference.json + src/item-keys-data.js. Derived from verify-item-names.mjs, which documents the setup.
// (old header) Reads ItemStack.getDisplayName of every registered original item/block-item and damage subtype through
// tools/probes/ItemKeyProbe.java (real StringTranslate over the JAR's en_US.lang) and writes
// public/research/item-names-reference.json for src/item-names.test.js. Needs a JDK, the pinned client JAR and the guava /
// log4j-api / commons-lang3 / netty-all JARs.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "item-key-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "commons-io-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/lang/en_US.lang", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/ItemKeyProbe.java")]);
    const { stdout } = await exec("java", ["-cp", cp, "ItemKeyProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
assert.ok(rows.length > 300, `${rows.length} items`);
const keys = {}, special = {};
let potionKeys, eggKeys;
for (const r of rows) {
  assert.ok(!r.keys.some((k) => k.startsWith("!")), `item ${r.id} threw`);
  if (r.id === 383) { eggKeys = r.entities; }
    let last = r.keys.length - 1;
  while (last > 0 && r.keys[last] === r.keys[last - 1]) last--;
  keys[r.id] = r.keys.slice(0, last + 1).map((k) => k.replace(/\.name$/, ""));
  const odd = r.plain.map((p, d) => (p ? -1 : d)).filter((d) => d >= 0);
  if (odd.length) special[r.id] = odd.length === r.plain.length ? "all" : odd;
}
// en_US from the same JAR against the already-probed English names (item-names-data.js).
const { parseLang } = await import("../src/lang.js");
const { ITEM_NAMES } = await import("../src/item-names-data.js");
const en = parseLang(await readFile(path.join(classes, "assets/minecraft/lang/en_US.lang"), "utf8"));
const mismatch = [];
for (const [id, list] of Object.entries(keys)) {
  if (special[id]) continue;
  list.forEach((k, d) => { const v = (en[k + ".name"] ?? k + ".name").trim(); const n = ITEM_NAMES[id]?.[d]; if (v !== n) mismatch.push([Number(id), d, k, v, n]); });
}
assert.deepEqual(mismatch, [], "en_US value of a key differs from the probed English display name");
assert.equal(keys[265][0], "item.ingotIron");
assert.equal(keys[1][0], "tile.stone");
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  method: "tools/probes/ItemKeyProbe.java: for ids 1-4095 (Item.getItemById) after Block.registerBlocks/Item.registerItems, key = Item.getUnlocalizedNameInefficiently(ItemStack) (adb.k) + '.name' for new ItemStack(item, 1, damage); keys are stored without '.name' and trimmed after the last distinct damage (a larger damage reads the last entry). 'special' lists items/damages whose ItemStack.getDisplayName is not translate(key): their names are composed by the item class (potion, spawn egg, skull, written book ...).",
  special,
  eggEntities: eggKeys,
  keys,
};
await writeFile(path.join(root, "../public/research/item-keys-reference.json"), JSON.stringify(reference) + "\n");
const data = Object.entries(keys).map(([id, l]) => `  ${id}: ${JSON.stringify(l)},`).join("\n");
await writeFile(path.join(root, "../src/item-keys-data.js"), `// Generated by tools/verify-item-keys.mjs from tools/probes/ItemKeyProbe.java: Item.getUnlocalizedName(ItemStack) of every original
// 1.7.10 item/block-item id indexed by damage, without the ".name" suffix (trimmed after the last distinct key). Items whose display name
// is composed by the item class (potion 373, spawn egg 383, skull 397, written book 387) are special-cased in item-names.js.
export const ITEM_KEYS = {
${data}
};
// EntityList.getStringFromID per spawn egg damage (null: no entity registered; ItemMonsterPlacer then shows plain item.monsterPlacer.name).
export const EGG_ENTITIES = ${JSON.stringify(eggKeys)};
`);
console.log(`PASS: ${rows.length} items, ${Object.keys(special).length} with composed names: ${JSON.stringify(special)}`);
