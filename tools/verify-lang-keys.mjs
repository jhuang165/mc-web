// (Translations round 2, batch 17) Runs tools/probes/KeyTraceProbe.java against the unchanged 1.7.10 jar: StatCollector's translator is
// replaced by one that answers "<key>", so creative tab keys and firework tooltip lines are the native keys and formatting. Writes
// public/research/lang-keys-reference.json (replayed by src/lang-keys.test.js). The keys of the horse, trade and beacon GUIs, the boss
// bar names and the horse inventory title are read from bytecode (javap -c -constants of bez/bfa/bfb/bfc, bfv, wi, sa) and recorded as
// "bytecode" entries; this script checks every probed and bytecode key exists in the jar's en_US.lang.
// Needs a JDK, the pinned client JAR (MC_RESEARCH or tools/research) and the guava / log4j-api / commons-lang3 / netty-all / commons-io JARs.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "lang-key-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/KeyTraceProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "KeyTraceProbe"], { maxBuffer: 1 << 26 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const tabs = rows.filter((r) => r.case === "tab").map(({ index, label, key }) => ({ index, label, key }));
const tooltips = rows.filter((r) => r.case === "tooltip").map(({ name, lines }) => ({ name, lines }));
assert.equal(tabs.length, 12);
assert.equal(tooltips.length, 28);
// Keys of the GUIs and names, read with javap from the jar (class: method -> keys), see languages.md.
const bytecode = {
  "bez.b (GuiBeacon.drawGuiContainerForegroundLayer)": ["tile.beacon.primary", "tile.beacon.secondary"],
  "bfb (GuiBeacon$ConfirmButton)": ["gui.done"],
  "bfa (GuiBeacon$CancelButton)": ["gui.cancel"],
  "bfc (GuiBeacon$PowerButton: translate(Potion.getName()) + ' II' for tier 3 except regeneration)": ["potion.*"],
  "bfv (GuiMerchant: title and bag label)": ["entity.Villager.name", "container.inventory"],
  "wi.b_ (EntityHorse.getCommandSenderName by type 0..4)": ["entity.horse.name", "entity.donkey.name", "entity.mule.name", "entity.zombiehorse.name", "entity.skeletonhorse.name"],
  "sa.b_ (Entity.getCommandSenderName: 'entity.' + EntityList.getEntityString + '.name')": ["entity.EnderDragon.name", "entity.WitherBoss.name"],
};
const { parseLang } = await import("../src/lang.js");
const en = parseLang(await readFile(path.join(classes, "assets/minecraft/lang/en_US.lang"), "utf8"));
const keys = new Set([...tabs.map((t) => t.key), ...Object.values(bytecode).flat().filter((k) => !k.endsWith("*"))]);
for (const t of tooltips) for (const l of t.lines) for (const m of l.matchAll(/<([^>]+)>/g)) keys.add(m[1]);
for (const k of keys) assert.ok(k in en, `${k} missing from en_US`);
const values = Object.fromEntries([...keys].sort().map((k) => [k, en[k]]));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1,
  method: "tools/probes/KeyTraceProbe.java: StatCollector.translator (dd.a) replaced by a de whose map answers '<key>' for every key; tabs from CreativeTabs.creativeTabArray, tooltips from ItemFirework/ItemFireworkCharge.addInformation (section signs shown as &). 'bytecode' lists keys read with javap -c -constants (not probed). 'values' are the en_US.lang values of every key recorded.",
  tabs, tooltips, bytecode, values,
};
await writeFile(path.join(root, "../public/research/lang-keys-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(`PASS: ${tabs.length} tabs, ${tooltips.length} tooltips, ${keys.size} keys`);
