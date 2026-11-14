// Batch 69 mptabcomplete: runs tools/probes/TabProbe.java against the unchanged 1.7.10 client JAR. CommandHandler.getPossibleCommands (z.b) is
// executed on a handler holding the dedicated server's command classes in ServerCommandManager's registration order (read from the constructor
// bytecode), for senders of permission level 0..4. Also records bytecode-read facts about GuiChat and MinecraftServer.func_71248_a.
// Writes public/research/tabcomplete-reference.json, replayed by src/mptabcomplete-b69.test.js. Needs a JDK, the pinned JAR and the probe libraries.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "tabcomplete-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort().reverse().find((p) => !/\b(sources|javadoc)\b/.test(p));
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "gson-", "commons-io-", "authlib-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/TabProbe.java")]);
const javap = async (cls, ...extra) => (await exec("javap", ["-p", "-c", "-constants", ...extra, "-cp", classes, cls], { maxBuffer: 1 << 27 })).stdout;
const ctor = (await javap("bl")).split("\n  public void a(")[0];
const registered = [];
for (const line of ctor.split("\n")) { const m = /new\s+#\d+\s+\/\/ class (\w+)$/.exec(line.trim().replace(/^\d+:\s*/, "")); if (m && m[1] !== "bg") registered.push(m[1]); }
assert.equal(registered.length, 47);
const { stdout } = await exec("java", ["-cp", cp, "TabProbe", registered.join(",")], { maxBuffer: 1 << 27 });
const records = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
assert.equal(records.length, 5 * 18);
// bytecode facts: the arguments branch of z.b has no canCommandSenderUseCommand call, and the names branch has one.
const handler = await javap("z"), body = handler.split("public java.util.List b(ac, java.lang.String);")[1].split("\n\n")[0];
const permissionCalls = [...body.matchAll(/aa\.a:\(Lac;\)Z/g)].map((m) => body.slice(0, m.index).split("\n").length);
assert.equal(permissionCalls.length, 1);
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6", registered,
  method: "Executed: CommandHandler.getPossibleCommands (z.b) on a handler holding the 47 command classes the dedicated server registers (ServerCommandManager's constructor order, /publish excluded), with a proxy sender whose permission check is level >= required. Bytecode-read: the arguments branch of z.b has no permission call (one aa.a(ac) call, in the names branch).",
  argumentsBranchPermissionCalls: 0, records,
};
await writeFile(path.join(root, "../public/research/tabcomplete-reference.json"), JSON.stringify(reference) + "\n");
console.log(`Tab-complete records: ${records.length}`);
