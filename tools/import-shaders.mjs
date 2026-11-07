// Extracts the 1.7.10 post-processing shader assets (assets/minecraft/shaders/post and program) from the pinned
// client JAR into public/media/1.7.10/shaders and records them in provenance.json (same policy as the textures
// and texts that import-vanilla-media.mjs ships). Offline: needs only the JAR.
// Usage: MC_RESEARCH=/path/to/tools/research node tools/import-shaders.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url)), exec = promisify(execFile);
const research = process.env.MC_RESEARCH || path.join(root, "research");
const mediaRoot = path.join(root, "../public/media/1.7.10");
const sha1 = (b) => createHash("sha1").update(b).digest("hex");
const jar = path.join(research, "minecraft-1.7.10.jar");
const jarSha = sha1(await readFile(jar));
if (jarSha !== "e80d9b3bf5085002218d4be59e668bac718abbc6") throw new Error("Unexpected client JAR");
const { stdout } = await exec("unzip", ["-Z1", jar, "assets/minecraft/shaders/*"]);
const members = stdout.trim().split("\n").filter((n) => /\.(json|vsh|fsh)$/.test(n)).sort();
const provenancePath = path.join(mediaRoot, "provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
provenance.assets = provenance.assets.filter((a) => !a.member.startsWith("assets/minecraft/shaders/"));
for (const member of members) {
  const { stdout: text } = await exec("unzip", ["-p", jar, member], { encoding: "buffer", maxBuffer: 1 << 24 });
  const bytes = Buffer.from(text), relative = member.replace("assets/minecraft/", "");
  await mkdir(path.dirname(path.join(mediaRoot, relative)), { recursive: true });
  await writeFile(path.join(mediaRoot, relative), bytes);
  provenance.assets.push({ member, url: "/media/1.7.10/" + relative, sha1: sha1(bytes), bytes: bytes.length });
}
await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
console.log(`Imported ${members.length} original shader files (post JSON, program JSON, .vsh, .fsh).`);
