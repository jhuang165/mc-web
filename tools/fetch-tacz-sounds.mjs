// npm run mods:fetch-tacz — installs the guns mod's sounds (P320, AKM, M870) from the official TaCZ release into
// public/audio/mods/tacz/, which Git ignores. Nothing from TaCZ is committed to this repository.
//
// Source: [TaCZ] Timeless and Classics Zero by MCModderAnchor (https://github.com/MCModderAnchor/TACZ), the Modrinth file
// tacz-forge-1.20.1-1.2.0.jar, checked against its SHA-512. TaCZ's assets are licensed CC BY-NC-ND 4.0
// (https://creativecommons.org/licenses/by-nc-nd/4.0/): non-commercial use with attribution, files kept unmodified. The game
// plays them as they are; without them the guns are silent.
// $TACZ_JAR may point at a local copy of the same jar instead of downloading it.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL = "https://cdn.modrinth.com/data/SzzJttH8/versions/QGCbNkTy/tacz-forge-1.20.1-1.2.0.jar";
const SHA512 = "7784dd103fbaa5d26a6130ae6a716a1909f93c126fd226193b21dec38f8c345b0044e9e392a1aa6737e468a346b7e95dc38a3e76f22ecaf37cef438ae57874c1";
const PREFIX = "assets/tacz/custom/tacz_default_gun/assets/tacz/tacz_sounds/";
// TaCZ folder -> this game's gun key (TaCZ's "ak47" is the gun it names AKM).
const GUNS = { p320: "p320", ak47: "akm", m870: "m870" };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = path.join(root, "public/audio/mods/tacz");

async function jar() {
  const b = process.env.TACZ_JAR ? await readFile(process.env.TACZ_JAR)
    : Buffer.from(await (await fetch(URL, { signal: AbortSignal.timeout(300000) })).arrayBuffer());
  const hash = createHash("sha512").update(b).digest("hex");
  if (hash !== SHA512) throw new Error(`TaCZ jar SHA-512 mismatch (${hash.slice(0, 16)}...)`);
  return b;
}
// Minimal zip reader: the end-of-central-directory record, then each central entry's local header (stored or deflated).
function* entries(zip) {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0, n = zip.readUInt16LE(eocd + 10); i < n; i++) {
    const method = zip.readUInt16LE(p + 10), size = zip.readUInt32LE(p + 20), nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30), commentLen = zip.readUInt16LE(p + 32), local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    yield { name, read() {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), body = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(body) : method === 8 ? inflateRawSync(body) : null;
    } };
  }
}

const zip = await jar();
const manifest = {};
for (const e of entries(zip)) {
  if (!e.name.startsWith(PREFIX) || !e.name.endsWith(".ogg")) continue;
  const [folder, file] = e.name.slice(PREFIX.length).split("/");
  const key = GUNS[folder];
  if (!key || !file) continue;
  const data = e.read();
  if (!data) continue;
  await mkdir(path.join(out, key), { recursive: true });
  await writeFile(path.join(out, key, file), data);
  (manifest[key] ??= []).push(file.replace(/\.ogg$/, ""));
}
for (const list of Object.values(manifest)) list.sort();
await writeFile(path.join(out, "manifest.json"), JSON.stringify({ source: URL, sha512: SHA512, license: "CC BY-NC-ND 4.0", guns: manifest }, null, 1));
await writeFile(path.join(out, "CREDITS.txt"), [
  "Sounds from [TaCZ] Timeless and Classics Zero by MCModderAnchor and contributors",
  "https://github.com/MCModderAnchor/TACZ (tacz-forge-1.20.1-1.2.0.jar, default gun pack)",
  "Licensed CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/",
  "Installed locally by tools/fetch-tacz-sounds.mjs; unmodified; not redistributed by this repository.", "",
].join("\n"));
const total = Object.values(manifest).reduce((n, l) => n + l.length, 0);
console.log(`installed ${total} TaCZ sounds for ${Object.keys(manifest).join(", ")} into ${path.relative(root, out)}`);
