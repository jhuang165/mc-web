// Probes the unchanged 1.7.10 BlockEnchantmentTable and ContainerEnchantment; see
// probes/EnchantingTableProbe.java. Requires the pinned client JAR, a JDK and the usual probe
// libraries. Writes public/research/enchanting-table-reference.json, replayed by
// src/enchanting-table.test.js and src/enchanting-container.test.js.
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
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const CLIENT_SHA1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "enchanting-table-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), CLIENT_SHA1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe shares the default package.
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/EnchantingTableProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "EnchantingTableProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const one = (kind) => { const r = rows.filter((x) => x.kind === kind); assert.equal(r.length, 1, kind); return r[0]; };
const block = one("block"), layout = one("layout"), reach = one("reach"), containers = rows.filter((r) => r.kind === "container");
assert.equal(block.id, 116);
assert.equal(layout.slotCount, 37);
assert.equal(containers.length, 300);
const srg = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8");
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aks: "BlockEnchantmentTable", aag: "ContainerEnchantment", aah: "ContainerEnchantment$1 (table InventoryBasic)", aai: "ContainerEnchantment$2 (table Slot)", aji: "Block", zs: "Container", aay: "Slot", rh: "InventoryBasic" };
const classHashes = {};
for (const [id, name] of Object.entries(names)) classHashes[id] = { name, sha256: await hashClass(id) };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  srgSha256: createHash("sha256").update(srg).digest("hex"),
  method: "Unchanged BlockEnchantmentTable registry object at id 116, plus the unchanged ContainerEnchantment driven through its real Slot objects and Container.slotClick (click, shift-click, hotbar key), enchantItem and canInteractWith. The World is a block-map double (isAirBlock stays native) and the EntityPlayer is a constructor-less double carrying inventory, experience and position. Case inputs come from a fixed java.util.Random and are printed with each record. No client rendering, no TileEntityEnchantmentTable book animation and no network packets are instantiated.",
  classes: classHashes,
  block,
  layout,
  reach,
  containers,
};
const file = path.join(root, "../public/research/enchanting-table-reference.json");
await writeFile(file, JSON.stringify(reference) + "\n");
console.log(`Original enchanting table records: ${containers.length} container cases, block + layout + reach, ${(await readFile(file)).length} bytes`);
