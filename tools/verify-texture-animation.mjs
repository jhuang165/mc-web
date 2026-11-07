// Native Java 1.7.10 animation metadata (AnimationMetadataSectionSerializer), TextureAtlasSprite.loadSprite frame
// validation and the TextureAtlasSprite.updateAnimation tick sequence, through tools/probes/TextureAnimationProbe.java.
// Writes public/research/texture-animation-reference.json for src/texture-animation.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the libraries of tools/research/libs-1.7.10
// (gson, guava, commons-lang3, log4j-api, lwjgl) or MC_PROBE_LIBS.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "texture-animation-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = path.join(research, "libs-1.7.10");
const libs = (process.env.MC_PROBE_LIBS ? process.env.MC_PROBE_LIBS.split(path.delimiter) : (await readdir(libDir)).filter((n) => n.endsWith(".jar") && !n.includes("sources")).map((n) => path.join(libDir, n)));
const classes = path.join(out, "classes");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", out, path.join(root, "probes/TextureAnimationProbe.java")]);

const media = path.join(root, "../public/media/1.7.10");
const png = async (file) => { const b = await readFile(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const cases = [];
for (const rel of ["blocks/water_still", "blocks/water_flow", "blocks/lava_still", "blocks/lava_flow", "blocks/fire_layer_0", "blocks/fire_layer_1", "blocks/portal", "items/compass", "items/clock"]) {
  const [w, h] = await png(path.join(media, rel + ".png"));
  cases.push({ name: "vanilla " + rel, w, h, ticks: 200, mcmeta: JSON.stringify(JSON.parse(await readFile(path.join(media, rel + ".png.mcmeta"), "utf8"))) });
}
const syn = (name, frames, mcmeta, ticks = 160, w = 16) => cases.push({ name, w, h: w * frames, ticks, mcmeta });
syn("frametime 3, 4 frames", 4, '{"animation":{"frametime":3}}');
syn("object entries with time", 4, '{"animation":{"frametime":2,"frames":[0,{"index":2,"time":5},1,{"index":3}]}}');
syn("repeated and shuffled", 4, '{"animation":{"frames":[3,3,1,0]}}');
syn("empty frames array", 4, '{"animation":{"frametime":4,"frames":[]}}');
syn("frame index out of range", 4, '{"animation":{"frames":[0,1,4]}}');
syn("frametime 0", 4, '{"animation":{"frametime":0}}');
syn("frametime negative", 4, '{"animation":{"frametime":-3}}');
syn("frame time 0", 4, '{"animation":{"frames":[{"index":0,"time":0}]}}');
syn("interpolate ignored", 4, '{"animation":{"frametime":2,"interpolate":true}}');
syn("frames not an array", 4, '{"animation":{"frames":5}}');
syn("object entry without index", 4, '{"animation":{"frames":[{"time":2}]}}');
syn("negative index", 4, '{"animation":{"frames":[-1]}}');
syn("width and height keys", 4, '{"animation":{"width":8,"height":8,"frametime":2}}');
syn("null and array entries skipped", 4, '{"animation":{"frames":[0,null,[1],2]}}');
syn("no animation section", 4, '{"texture":{"blur":true}}');
syn("single frame list", 4, '{"animation":{"frames":[2]}}');
syn("one frame image", 1, '{"animation":{"frametime":2}}');
syn("long frametime", 3, '{"animation":{"frametime":20}}');
syn("string indexes", 4, '{"animation":{"frames":["1","0"]}}');
syn("float frametime", 4, '{"animation":{"frametime":2.5}}');
syn("HD 32 px, 4 frames", 4, '{"animation":{"frametime":1}}', 40, 32);
syn("per-frame time only", 3, '{"animation":{"frames":[{"index":0,"time":1},{"index":1,"time":7},{"index":2,"time":2}]}}');
syn("frametime 1 explicit", 3, '{"animation":{"frametime":1}}', 20);
syn("no mcmeta, square", 1, null, 4);
syn("no mcmeta, strip", 4, null, 4);

const input = cases.map((c) => [c.name, c.w, c.h, c.ticks, c.mcmeta ?? "-"].join("\t")).join("\n") + "\n";
const stdout = await new Promise((resolve, reject) => {
  const p = spawn("java", ["-cp", [out, cp].join(path.delimiter), "TextureAnimationProbe"], { stdio: ["pipe", "pipe", "inherit"] });
  let data = "";
  p.stdout.on("data", (d) => (data += d));
  p.on("close", (code) => (code === 0 ? resolve(data) : reject(new Error("probe exited " + code))));
  p.stdin.end(input);
});
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
assert.equal(records.length, cases.length);
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bsa: "AnimationMetadataSection", bsb: "AnimationMetadataSectionSerializer", bqd: "TextureAtlasSprite", brz: "AnimationFrame" };
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "Unchanged AnimationMetadataSectionSerializer.deserialize (bsb), AnimationMetadataSection (bsa), TextureAtlasSprite.loadSprite (bqd.a(BufferedImage[], bsa, boolean)) and TextureAtlasSprite.updateAnimation (bqd.j) of the 1.7.10 client. Each case parses a .png.mcmeta text, loads a blank image of the given size and ticks the sprite; `frames[t]` is the frame index shown after t ticks. The GL upload of a changed frame fails (no context) after the counters advance and is swallowed. No patched game classes. 1.7.10 has no `interpolate` key; it reads frametime, frames (ints or {index,time}), width and height.",
  cases: records,
};
await writeFile(process.env.MC_TEXANIM_OUTPUT || path.join(root, "../public/research/texture-animation-reference.json"), JSON.stringify(reference) + "\n");
console.log(`${records.length} texture animation records`);
