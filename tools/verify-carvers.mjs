// Records unchanged 1.7.10 MapGenBase, caves and ravines; see CarverProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  exists = (p) =>
    access(p).then(
      () => true,
      () => false,
    );
const researchDirs = [
  process.env.MC_RESEARCH,
  path.join(root, "research"),
  path.join(root, "../../tools/research"),
].filter(Boolean);
let research;
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) {
    research = dir;
    break;
  }
if (!research)
  throw new Error(
    "Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.",
  );
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "carver-probe");
assert.equal(
  createHash("sha1")
    .update(await readFile(jar))
    .digest("hex"),
  "e80d9b3bf5085002218d4be59e668bac718abbc6",
);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "")
    .split(path.delimiter)
    .filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec(
      "find",
      [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"],
      { maxBuffer: 1 << 24 },
    );
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(
    `Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`,
  );
}
const libs = await Promise.all(
  ["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library),
);
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], {
  maxBuffer: 1 << 24,
});
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", [
  "-nowarn",
  "-cp",
  cp,
  "-d",
  probe,
  path.join(root, "probes/TerrainProbe.java"),
  path.join(root, "probes/CarverProbe.java"),
]);
const terrain = JSON.parse(
  await readFile(
    path.join(root, "../public/research/terrain-reference.json"),
    "utf8",
  ),
);
const chunks = terrain.records.filter((r) => r.kind === "chunk");
const csv = path.join(out, "chunks.csv");
await writeFile(
  csv,
  chunks.map((r) => [r.seed, r.type, r.x, r.z].join(",")).join("\n"),
);
const { stdout } = await exec("java", ["-cp", cp, "CarverProbe", csv], {
  maxBuffer: 1 << 28,
});
const records = stdout
  .trim()
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map(JSON.parse);
// The SRG is required so the evidence always carries mapped class/member identities.
const srg = path.join(research, "joined-1.7.10.srg"),
  srgText = await readFile(srg, "utf8"),
  mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const used = new Set([...Object.keys(terrain.classes), "aqx", "aqw", "aqs"]);
const { stderr: version } = await exec("java", [
  "-XshowSettings:properties",
  "-version",
]);
const digest = async (name) =>
  createHash("sha256")
    .update(
      (
        await exec("unzip", ["-p", jar, name + ".class"], {
          encoding: "buffer",
          maxBuffer: 1 << 24,
        })
      ).stdout,
    )
    .digest("hex");
const symbols = srgText
  .split("\n")
  .filter((line) => /^(MD|FD): (aqx|aqw|aqs|aqz|qh)\//.test(line));
const names = {};
for (const c of [...used].sort()) names[c] = mcp[c] || null;
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"),
  symbols,
  classes: Object.fromEntries(
    await Promise.all(
      Object.keys(names).map(async (c) => [
        c,
        { name: names[c], sha256: await digest(c) },
      ]),
    ),
  ),
  method:
    "Unchanged 1.7.10 MapGenBase.generate, MapGenCaves and MapGenRavine. World double supplies seed, real WorldChunkManager and WorldInfo; native terrain/surfaces run before carving. Tunnel fixtures invoke the original protected tunnel methods directly via reflection. Numeric block IDs hashed as little-endian uint16; null/air=0. Changes are [arrayIndex, newBlockId]. Full 16x16x256 arrays, x,z,y order. Metadata never passed to native carvers. Fixture stone has y0..3 bedrock, y77..79 dirt, y80 grass and otherwise stone through100; null above. Ceiling fixture fills stone through y255 to exercise the y248 cap. Materials fixture uses a dry block-ID stripe for each z; water fixtures add an x=8 wall at y15..90. Mesa singleton state reset before each chunk. JVM " +
    (String(version).match(/java\.version = (\S+)/)?.[1] || "unknown") +
    ".",
  records,
};
await writeFile(
  path.join(root, "../public/research/carver-reference.json"),
  JSON.stringify(reference) + "\n",
);
console.log(
  "Original carver records:",
  records.length,
  Object.fromEntries(
    [...new Set(records.map((r) => r.kind))].map((k) => [
      k,
      records.filter((r) => r.kind === k).length,
    ]),
  ),
);
