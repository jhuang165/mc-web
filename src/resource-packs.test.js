import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readZip } from "./zip-reader.js";
import {
  overrideUrls, parsePackMcmeta, parseLang, zipPack, folderPack, packInfo, resolveOverrides, resolveLang, PackLists, sameSelection,
  parseResourcePacksOption, formatResourcePacksOption, memoryStore, applyPacks, openStoredPack, INVALID_META,
} from "./resource-packs.js";
import { writeOptionsTxt, parseOptionsTxt, applyOptionsTxt } from "./options-txt.js";
import { arrowCells, resourcePacksLayout } from "./resource-packs-ui.js";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (d) => { let c = 0xffffffff; for (const b of d) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// Builds a zip: files = { name: string | Uint8Array }; deflate: names to deflate (the rest are stored).
function makeZip(files, deflate = []) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === "string" ? Buffer.from(content) : Buffer.from(content), nameBytes = Buffer.from(name);
    const method = deflate.includes(name) ? 8 : 0, body = method ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc32(data), 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBytes.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const cd = Buffer.concat(central), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, eocd]));
}
const dec = (b) => new TextDecoder().decode(b);

test("zip reader reads stored and deflated entries", async () => {
  const big = "abcdefgh".repeat(500);
  const zip = readZip(makeZip({ "pack.mcmeta": "{}", "assets/minecraft/textures/blocks/stone.png": big, "assets/": "" }, ["assets/minecraft/textures/blocks/stone.png"]));
  assert.equal(zip.size, 3);
  assert.equal(zip.get("pack.mcmeta").method, 0);
  assert.equal(zip.get("assets/minecraft/textures/blocks/stone.png").method, 8);
  assert.equal(dec(await zip.get("pack.mcmeta").read()), "{}");
  assert.equal(dec(await zip.get("assets/minecraft/textures/blocks/stone.png").read()), big);
  assert.equal(zip.get("assets/").directory, true);
});
test("zip reader rejects non-zip data", () => {
  assert.throws(() => readZip(new Uint8Array([1, 2, 3, 4])), /Not a zip/);
});

test("pack.mcmeta parsing", () => {
  assert.deepEqual(parsePackMcmeta('{"pack":{"pack_format":1,"description":"Hi"}}'), { valid: true, packFormat: 1, description: "Hi" });
  assert.equal(parsePackMcmeta('{"pack":{"pack_format":1,"description":{"text":"Chat"}}}').description, "Chat");
  assert.equal(parsePackMcmeta("{}").description, INVALID_META);
  assert.equal(parsePackMcmeta("not json").valid, false);
  assert.equal(parsePackMcmeta('﻿{"pack":{"pack_format":1,"description":"bom"}}').valid, true);
});

test("pack files map to the URLs the game requests", () => {
  assert.deepEqual(overrideUrls("assets/minecraft/textures/blocks/stone.png"), ["/media/1.7.10/blocks/stone.png"]);
  assert.deepEqual(overrideUrls("assets/minecraft/textures/gui/widgets.png"), ["/media/1.7.10/gui/widgets.png"]);
  assert.deepEqual(overrideUrls("assets/minecraft/sounds/dig/stone1.ogg"), ["/audio/1.7.10/dig/stone1.ogg", "/audio/1.7.10-streams/dig/stone1.ogg"]);
  assert.deepEqual(overrideUrls("assets/minecraft/textures/blocks/water_still.png.mcmeta"), []);
  assert.deepEqual(overrideUrls("assets/minecraft/textures/../../x.png"), []);
  assert.deepEqual(overrideUrls("assets/other/textures/blocks/stone.png"), []);
  assert.deepEqual(overrideUrls("pack.png"), []);
});

test("the top selected pack wins an override", async () => {
  const a = zipPack("a.zip", makeZip({ "assets/minecraft/textures/blocks/stone.png": "A", "assets/minecraft/textures/blocks/dirt.png": "A" }));
  const b = folderPack("b", { "assets/minecraft/textures/blocks/stone.png": new Blob(["B"]) });
  // options.txt order is lowest priority first.
  const table = resolveOverrides([a, b]);
  assert.equal(table.get("/media/1.7.10/blocks/stone.png").pack, "b");
  assert.equal(table.get("/media/1.7.10/blocks/dirt.png").pack, "a.zip");
  assert.equal(resolveOverrides([b, a]).get("/media/1.7.10/blocks/stone.png").pack, "a.zip");
});

test("lang files merge in priority order", async () => {
  assert.deepEqual(parseLang("# c\r\nmenu.singleplayer=Solo\n\nmenu.quit=Out=Now"), { "menu.singleplayer": "Solo", "menu.quit": "Out=Now" });
  const a = zipPack("a.zip", makeZip({ "assets/minecraft/lang/en_US.lang": "gui.done=A\ngui.cancel=A" }));
  const b = zipPack("b.zip", makeZip({ "assets/minecraft/lang/en_US.lang": "gui.done=B" }));
  assert.deepEqual(await resolveLang([a, b]), { "gui.done": "B", "gui.cancel": "A" });
});

test("pack info reads description and icon", async () => {
  const info = await packInfo(zipPack("p.zip", makeZip({ "pack.mcmeta": '{"pack":{"pack_format":1,"description":"Line1"}}', "pack.png": new Uint8Array([137, 80, 78, 71]) })));
  assert.equal(info.description, "Line1");
  assert.deepEqual([...info.icon], [137, 80, 78, 71]);
  const bad = await packInfo(zipPack("q.zip", makeZip({ "x.txt": "x" })));
  assert.equal(bad.valid, false);
  assert.equal(bad.description, INVALID_META);
  assert.equal(bad.icon, null);
});

test("applyPacks stores the resolved override table and lang", async () => {
  const store = memoryStore();
  await store.putPack({ name: "low.zip", kind: "zip", blob: new Blob([makeZip({ "assets/minecraft/textures/items/apple.png": "low", "assets/minecraft/lang/en_US.lang": "gui.done=Low" }, ["assets/minecraft/textures/items/apple.png"])]) });
  await store.putPack({ name: "high", kind: "folder", files: { "assets/minecraft/textures/items/apple.png": new Blob(["high"]) } });
  const r = await applyPacks(["low.zip", "high", "missing.zip"], store);
  assert.deepEqual(r.packs, ["low.zip", "high"]);
  const o = await store.getOverrides();
  assert.equal(await o.get("/media/1.7.10/items/apple.png").blob.text(), "high");
  assert.equal(o.get("/media/1.7.10/items/apple.png").type, "image/png");
  assert.deepEqual(await store.getMeta("lang"), { "gui.done": "Low" });
  await applyPacks([], store);
  assert.equal((await store.getOverrides()).size, 0);
  assert.equal((await openStoredPack(await store.getPack("high"))).kind, "folder");
});

test("pack lists follow bgg's arrows", () => {
  const l = new PackLists(["a", "b", "c", "d"], ["a", "b"]);
  assert.deepEqual(l.selected, ["b", "a"]); // top of the list wins, so the last saved name is shown first
  assert.deepEqual(l.available, ["c", "d"]);
  assert.equal(l.select("d"), true);
  assert.deepEqual(l.selected, ["d", "b", "a"]);
  assert.deepEqual(l.names, ["a", "b", "d"]);
  assert.equal(l.canMoveUp("d"), false);
  assert.equal(l.canMoveDown("a"), false);
  assert.equal(l.moveDown("d"), true);
  assert.deepEqual(l.selected, ["b", "d", "a"]);
  assert.equal(l.moveUp("a"), true);
  assert.deepEqual(l.selected, ["b", "a", "d"]);
  assert.equal(l.deselect("b"), true);
  assert.deepEqual(l.available, ["b", "c"]);
  assert.equal(l.select("zzz"), false);
  assert.equal(new PackLists(["a"], ["gone", "a", "a"]).names.join(), "a");
  assert.equal(sameSelection(["a"], ["a"]) && !sameSelection(["a"], ["b"]) && !sameSelection([], ["a"]), true);
});

test("arrow sprite cells and layout", () => {
  assert.deepEqual(arrowCells("available", 5, 5, {}), [[0, 32]]);
  assert.deepEqual(arrowCells("selected", 5, 5, { canUp: true, canDown: true }), [[32, 32], [96, 0], [64, 0]]);
  assert.deepEqual(arrowCells("selected", 20, 5, { canUp: true, canDown: true }), [[32, 0], [96, 32], [64, 0]]);
  assert.deepEqual(arrowCells("selected", 20, 25, { canUp: false, canDown: true }), [[32, 0], [64, 32]]);
  const L = resourcePacksLayout(640, 240);
  assert.deepEqual([L.left, L.right, L.list.top, L.list.bottom], [116, 324, 32, 189]);
  assert.deepEqual(L.buttons.folder, { x: 166, y: 192, w: 150, h: 20 });
});

test("options.txt resourcePacks persists in the native list format", () => {
  assert.equal(formatResourcePacksOption(["a.zip", "b.zip"]), '["a.zip","b.zip"]');
  assert.deepEqual(parseResourcePacksOption('["a.zip","b.zip"]'), ["a.zip", "b.zip"]);
  assert.throws(() => parseResourcePacksOption("{}"));
  const text = writeOptionsTxt({ resourcePacks: ["x.zip", "y"] });
  assert.match(text, /^resourcePacks:\["x\.zip","y"\]$/m);
  assert.deepEqual(parseOptionsTxt(text).options.resourcePacks, ["x.zip", "y"]);
  assert.match(writeOptionsTxt({}), /^resourcePacks:\[\]$/m);
  const bad = parseOptionsTxt("resourcePacks:oops\nclouds:false");
  assert.deepEqual(bad.skipped, ["resourcePacks:oops"]);
  assert.equal(applyOptionsTxt({ resourcePacks: ["keep"] }, "resourcePacks:oops").options.resourcePacks[0], "keep");
});
