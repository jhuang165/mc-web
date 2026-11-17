// Batch 78 packs78: pack row description text (native getFormattedText trailing reset, wrapping, error line colour) and straight-alpha
// frame / tint-icon helpers. Rows are Executed (gui-menus-reference.json, GuiMenusProbe); the wrapping rules are Bytecode-read FontRenderer.
// The pixel tests are pure functions (no browser, no canvas).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packRowTexts, packRowDescription, wrapFormatted } from "./resource-packs-ui.js";
import { INVALID_META, DEFAULT_DESCRIPTION } from "./resource-packs.js";
import { decodePng } from "./png-decode.js";
import { encodePngStored } from "./atlas-texels.js";
import { frameRgba, frameUrl, tintRgba, eggRgba, eggUrl, fetchDecoded } from "./straight-frames.js";

const GUI = JSON.parse(readFileSync(new URL("../public/research/gui-menus-reference.json", import.meta.url), "utf8")).rows;
const row = (screen) => GUI.find((r) => r.screen === screen && r.w === 320);

test("b78 pack rows replay the executed text including the trailing reset", () => {
  const desc = { "Alpha Pack": "A short description.", Gamma: "§aGreen§r and plain text",
    "Beta Pack With A Very Long Name That Cannot Fit Inside The Pack List Row": "First line of a long description that should wrap across several lines in the pack row, more than two." };
  for (const name of ["GuiScreenResourcePacks+packs", "GuiScreenResourcePacks+packs+selected"]) {
    const n = row(name).text.filter((t) => t.y > 45 && t.y < 200 && t.text !== "Select Resource Packs" && !t.text.startsWith("(Place"));
    let checked = 0;
    for (let i = 0; i < n.length; i++) {
      const t = n[i]; if (t.color !== 0xffffff || t.text === "Default") continue;
      const full = Object.keys(desc).find((k) => k === t.text || (t.text.endsWith("...") && k.startsWith(t.text.slice(0, -3))));
      const ours = packRowTexts({ name: full, description: desc[full], valid: true }, t.x - 34, t.y - 1);
      const lines = []; for (let k = i + 1; k < n.length && n[k].color === 0x808080; k++) lines.push(n[k]);
      assert.deepEqual(ours.slice(1).map((o) => [o.text, o.x, o.y, o.color]), lines.map((o) => [o.text, o.x, o.y, o.color]), full);
      checked++;
    }
    assert.equal(checked, 3, name);
  }
});

test("b78 the error line is red with no reset, the Default row reads the bundled description with a reset", () => {
  assert.equal(packRowDescription({ valid: false, description: INVALID_META }), "§cInvalid pack.mcmeta (or missing 'pack' section)");
  assert.equal(packRowDescription({ valid: false, description: "ENOENT whatever" }), "§c" + INVALID_META);
  assert.equal(packRowDescription({ name: "Default", description: DEFAULT_DESCRIPTION, valid: true }), "The default look and feel of Minecraft§r");
  // The executed probe row "§cMissing pack.mcmeta :(" is a different string (the double had no pack section); the colour code is the same.
  const err = packRowTexts({ name: "Bad", valid: false, description: INVALID_META }, 0, 0).slice(1);
  assert.equal(err[0].text.startsWith("§c"), true);
  assert.equal(err[1].text.startsWith("§c"), true, "the continuation line carries the colour");
  assert.equal(err.length, 2);
});

test("b78 listFormattedStringToWidth: format carried to the next line, newline, bold width", () => {
  assert.deepEqual(wrapFormatted("§aaaa bbb", 100), ["§aaaa bbb"]);
  const green = wrapFormatted("§a" + "word ".repeat(12).trim(), 60);
  assert.ok(green.length > 2 && green.every((l) => l.startsWith("§a")));
  assert.deepEqual(wrapFormatted("one\ntwo", 200), ["one", "two"]);
  assert.deepEqual(wrapFormatted("a§r", 200), ["a§r"]);
  const plain = wrapFormatted("aaa aaa aaa aaa aaa aaa aaa aaa", 60), bold = wrapFormatted("§laaa aaa aaa aaa aaa aaa aaa aaa", 60);
  assert.ok(bold.length >= plain.length);
  assert.equal(bold[1].startsWith("§l"), true);
});

// A strip of two 2 x 2 frames with partly transparent texels whose colour a premultiplied canvas would change.
const strip = () => {
  const data = new Uint8Array(2 * 4 * 4);
  const px = (f, x, y, c) => data.set(c, ((f * 2 + y) * 2 + x) * 4);
  px(0, 0, 0, [201, 101, 51, 3]); px(0, 1, 0, [7, 250, 99, 128]); px(0, 0, 1, [255, 255, 255, 255]); px(0, 1, 1, [13, 14, 15, 0]);
  px(1, 0, 0, [90, 91, 92, 1]); px(1, 1, 0, [255, 0, 128, 254]); px(1, 0, 1, [1, 2, 3, 77]); px(1, 1, 1, [100, 200, 50, 200]);
  return { width: 2, height: 4, data };
};
const premultRoundTrip = (data) => { const o = Uint8Array.from(data); for (let i = 0; i < o.length; i += 4) { const a = o[i + 3]; if (!a) { o[i] = o[i + 1] = o[i + 2] = 0; continue; } for (let c = 0; c < 3; c++) o[i + c] = Math.min(255, Math.round(Math.round(o[i + c] * a / 255) * 255 / a)); } return o; };

test("b78 frame urls are straight-alpha: decoding the data url gives exactly the strip's rows", async () => {
  const s = strip();
  assert.notDeepEqual(premultRoundTrip(s.data), s.data, "the canvas path would change these texels");
  for (const f of [0, 1]) {
    const url = frameUrl(s, f), b = Buffer.from(url.split(",")[1], "base64");
    assert.equal(url.startsWith("data:image/png;base64,"), true);
    const png = await decodePng(new Uint8Array(b));
    assert.deepEqual([png.width, png.height], [2, 2]);
    assert.deepEqual([...png.data], [...s.data.subarray(f * 16, f * 16 + 16)], `frame ${f}`);
    assert.deepEqual([...frameRgba(s, f)], [...png.data]);
  }
});

test("b78 spawn egg layers: tint multiplies colour only, layers compose source-over, the PNG reads back exactly", async () => {
  const base = { width: 2, height: 2, data: Uint8Array.from([255, 255, 255, 255, 200, 100, 50, 255, 9, 9, 9, 3, 0, 0, 0, 0]) };
  const over = { width: 2, height: 2, data: Uint8Array.from([255, 255, 255, 255, 255, 255, 255, 128, 255, 255, 255, 77, 80, 160, 240, 77]) };
  assert.deepEqual([...tintRgba(base.data, 0xff8000)], [255, 128, 0, 255, 200, 50, 0, 255, 9, 5, 0, 3, 0, 0, 0, 0]);
  const { size, data } = eggRgba(base, over, 0xff8000, 0x0000ff);
  assert.equal(size, 2);
  assert.deepEqual([...data.subarray(0, 4)], [0, 0, 255, 255], "opaque overlay replaces");
  assert.deepEqual([...data.subarray(12, 16)], [0, 0, 240, 77], "over a transparent base the overlay texel is kept as stored (tinted)");
  // 128 / 255 of blue over (200, 50, 0): colour = (0 * a + base * (1 - a)), alpha 255
  const a = 128 / 255;
  assert.deepEqual([...data.subarray(4, 8)], [Math.round(200 * (1 - a)), Math.round(50 * (1 - a)), Math.round(255 * a), 255]);
  // translucent over translucent keeps straight colour: alpha = a_o + a_b (1 - a_o), colour unpremultiplied
  const ao = 77 / 255, ab = 3 / 255, ar = ao + ab * (1 - ao);
  assert.equal(data[11], Math.round(ar * 255));
  assert.equal(data[8], Math.round((0 * ao + 9 * ab * (1 - ao)) / ar));
  assert.equal(data[10], Math.round((255 * ao) / ar));
  const png = await decodePng(new Uint8Array(Buffer.from(eggUrl(base, over, 0xff8000, 0x0000ff).split(",")[1], "base64")));
  assert.deepEqual([...png.data], [...data]);
  assert.deepEqual([...encodePngStored(2, 2, data)].length > 0, true);
});

test("b78 fetchDecoded returns straight pixels, and null for a failed or undecodable response", async () => {
  const s = strip(), bytes = encodePngStored(2, 4, s.data), real = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const png = await fetchDecoded("/x.png");
    assert.deepEqual([png.width, png.height, [...png.data]], [2, 4, [...s.data]]);
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await fetchDecoded("/x.png"), null);
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    assert.equal(await fetchDecoded("/x.png"), null);
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await fetchDecoded("/x.png"), null);
  } finally { globalThis.fetch = real; }
});
