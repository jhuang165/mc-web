import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { buildProtectedPages, deriveKey, previousSalt } from "../tools/build-protected-pages.mjs";

test("protected publication encrypts every app file, authenticates the passcode and rejects tampering", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "protected-pages-test-")), input = path.join(dir, "input"), output = path.join(dir, "output");
  try {
    await mkdir(path.join(input, "mods"), { recursive: true });
    await writeFile(path.join(input, "index.html"), "<h1>Only visible after unlocking</h1>");
    const asset = "private fixture ".repeat(300);
    await writeFile(path.join(input, "mods", "fixture.json"), asset);
    await writeFile(path.join(input, "resource-pack-sw.js"), "ordinary worker, replaced by encrypted worker");
    const passcode = "synthetic-test-password";
    const result = await buildProtectedPages({ input, output, base: "/mc-web/", version: "test-version", passcode });
    assert.equal(result.files, 2);
    const worker = await readFile(path.join(output, "resource-pack-sw.js"), "utf8");
    const config = JSON.parse(worker.match(/const CONFIG = (.+);/)[1]);
    assert.equal(config.iterations, 600000);
    assert.equal(config.base, "/mc-web/");
    assert.ok(!worker.includes(passcode));
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.ok(!html.includes(passcode));
    assert.ok(!html.includes("Only visible after unlocking"));
    assert.deepEqual((await readdir(output)).sort(), [".nojekyll", "404.html", "index.html", "resource-pack-sw.js", "sealed", "unlock.html"]);
    const salt = Buffer.from(config.salt, "base64"), key = await deriveKey(passcode, salt, config.iterations);
    const encrypted = await readFile(path.join(output, "sealed", "manifest.bin"));
    const open = (data, key, label) => webcrypto.subtle.decrypt({ name: "AES-GCM", iv: data.subarray(0, 12),
      additionalData: new TextEncoder().encode(label) }, key, data.subarray(12));
    const manifest = JSON.parse(gunzipSync(Buffer.from(await open(encrypted, key, "manifest"))));
    assert.equal(manifest.version, "test-version");
    const entry = manifest.files["mods/fixture.json"];
    assert.equal(entry.gzip, true);
    const sealed = await readFile(path.join(output, "sealed", entry.file));
    assert.equal(gunzipSync(Buffer.from(await open(sealed, key, "mods/fixture.json"))).toString(), asset);
    const wrong = await deriveKey("wrong", salt, config.iterations);
    await assert.rejects(open(encrypted, wrong, "manifest"), { name: "OperationError" });
    const changed = Buffer.from(sealed); changed[15] ^= 1;
    await assert.rejects(open(changed, key, "mods/fixture.json"), { name: "OperationError" });
    await assert.rejects(open(sealed, key, "different/path.json"), { name: "OperationError" });
    await assert.rejects(buildProtectedPages({ input, output, passcode }), /must be empty/);
    await assert.rejects(buildProtectedPages({ input, output: path.join(input, "nested"), passcode }), /outside the input/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a republication can keep the previous salt, so an unlocked browser's key still opens the new manifest", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "protected-pages-salt-")), input = path.join(dir, "input"), a = path.join(dir, "a"), b = path.join(dir, "b");
  try {
    await mkdir(input, { recursive: true });
    await writeFile(path.join(input, "index.html"), "<h1>build</h1>");
    const passcode = "synthetic-test-password", config = async out => JSON.parse((await readFile(path.join(out, "resource-pack-sw.js"), "utf8")).match(/const CONFIG = (.+);/)[1]);
    await buildProtectedPages({ input, output: a, base: "/mc-web/", version: "a", passcode, iterations: 1000 });
    await buildProtectedPages({ input, output: b, base: "/mc-web/", version: "b", passcode, saltFrom: path.join(a, "resource-pack-sw.js") });
    const [ca, cb] = [await config(a), await config(b)];
    assert.equal(cb.salt, ca.salt); assert.equal(cb.iterations, 1000, "the previous iteration count too");
    const key = await deriveKey(passcode, Buffer.from(ca.salt, "base64"), ca.iterations), data = await readFile(path.join(b, "sealed", "manifest.bin"));
    const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: data.subarray(0, 12), additionalData: new TextEncoder().encode("manifest") }, key, data.subarray(12));
    assert.equal(JSON.parse(gunzipSync(Buffer.from(plain))).version, "b");
    // A fresh build without it still picks a new random salt; a worker for another base path is refused.
    const c = path.join(dir, "c");
    await buildProtectedPages({ input, output: c, base: "/mc-web/", version: "c", passcode, iterations: 1000 });
    assert.notEqual((await config(c)).salt, ca.salt);
    await assert.rejects(previousSalt(path.join(a, "resource-pack-sw.js"), "/other/"), /no usable salt/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
