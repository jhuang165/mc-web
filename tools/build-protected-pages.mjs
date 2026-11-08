// Freeze an existing Vite build behind an encrypted static gate. The passcode is provided only through the environment;
// neither it nor the derived key is written to the published files. Private pack assets are ciphertext on the server.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, webcrypto, createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { normalizeBase } from "./vite-base-path.mjs";

const encoder = new TextEncoder();
const templateDir = new URL("./protected-pages/", import.meta.url);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".mcmeta": "application/json" };

export async function deriveKey(passcode, salt, iterations) {
  const material = await webcrypto.subtle.importKey("raw", encoder.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(bytes, key, label) {
  const iv = randomBytes(12);
  const data = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(label) }, key, bytes);
  return Buffer.concat([iv, Buffer.from(data)]);
}

export async function buildProtectedPages({ input, output, base = "/", version, passcode, iterations = 600000 }) {
  if (!passcode) throw new Error("Set PAGES_PASSCODE in the environment.");
  input = path.resolve(input); output = path.resolve(output); base = normalizeBase(base);
  if (!/^\/[a-zA-Z0-9/_-]*\/$/.test(base) && base !== "/") throw new Error("Invalid base path.");
  if (output === input || output.startsWith(input + path.sep)) throw new Error("Output must be outside the input directory.");
  await readFile(path.join(input, "index.html")); // validate input before creating output
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error("Output directory must be empty.");
  await mkdir(path.join(output, "sealed"));
  const salt = randomBytes(16), key = await deriveKey(passcode, salt, iterations), files = {};
  let plainBytes = 0, sealedBytes = 0;
  async function walk(dir, prefix = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name, full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full, rel + "/"); continue; }
      if (!entry.isFile()) throw new Error("Unsupported non-file: " + rel);
      // The gate's worker retains the game's resource-pack protocol under this same URL and scope.
      if (rel === "resource-pack-sw.js") continue;
      const plain = await readFile(full), compressed = gzipSync(plain), gzip = compressed.length < plain.length;
      const bytes = await seal(gzip ? compressed : plain, key, rel);
      const name = createHash("sha256").update(bytes).digest("hex") + ".bin";
      await writeFile(path.join(output, "sealed", name), bytes);
      files[rel] = { file: name, type: TYPES[path.extname(rel)] ?? "application/octet-stream", gzip };
      plainBytes += plain.length; sealedBytes += bytes.length;
    }
  }
  await walk(input);
  const manifest = await seal(gzipSync(Buffer.from(JSON.stringify({ version, files }))), key, "manifest");
  await writeFile(path.join(output, "sealed", "manifest.bin"), manifest);
  const config = { base, version, salt: salt.toString("base64"), iterations, sessionMs: 12 * 60 * 60 * 1000 };
  const html = (await readFile(new URL("unlock.html", templateDir), "utf8")).replace("__BASE__", JSON.stringify(base));
  const worker = (await readFile(new URL("worker.js", templateDir), "utf8")).replace("__CONFIG__", JSON.stringify(config));
  await writeFile(path.join(output, "index.html"), html);
  await writeFile(path.join(output, "unlock.html"), html);
  await writeFile(path.join(output, "404.html"), html);
  await writeFile(path.join(output, "resource-pack-sw.js"), worker);
  await writeFile(path.join(output, ".nojekyll"), "");
  return { version, files: Object.keys(files).length, plainBytes, sealedBytes: sealedBytes + manifest.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((all, v, i, a) => i % 2 ? all : [...all, [v.replace(/^--/, ""), a[i + 1]]], []));
  const result = await buildProtectedPages({ input: args.input ?? "dist", output: args.output, base: args.base,
    version: args.version, passcode: process.env.PAGES_PASSCODE });
  console.log(JSON.stringify(result));
}
