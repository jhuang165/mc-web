import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAtlasUploader } from "./atlas-upload.js";

function fake() {
  const calls = [], binds = [];
  const tex = { flipY: true, image: { width: 256, height: 336 }, version: 3 };
  const gl = {
    TEXTURE_2D: 1, UNPACK_FLIP_Y_WEBGL: 2, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 3, UNPACK_ALIGNMENT: 4, RGBA: 5, UNSIGNED_BYTE: 6,
    pixelStorei: (k, v) => calls.push(["store", k, v]),
    texSubImage2D: (...a) => calls.push(["sub", ...a.slice(0, 7)]),
  };
  const props = new Map([[tex, { __webglTexture: {}, __version: 3 }]]);
  const renderer = { getContext: () => gl, properties: { get: (t) => props.get(t) ?? {} }, state: { bindTexture: (...a) => binds.push(a), unbindTexture: () => binds.push("unbind") } };
  return { renderer, tex, calls, binds, props };
}

describe("atlas sub-rect upload", () => {
  it("is ready only when the texture is on the GPU at its current version", () => {
    const { renderer, tex, props } = fake(), up = createAtlasUploader(renderer);
    assert.equal(up.ready(tex), true);
    tex.version++;
    assert.equal(up.ready(tex), false);
    assert.equal(up.ready({ version: 1 }), false);
    props.get(tex).__version = tex.version;
    assert.equal(up.ready(tex), true);
  });
  it("writes queued rects at flipped GL rows per level with one bind", () => {
    const { renderer, tex, calls, binds } = fake(), up = createAtlasUploader(renderer);
    const d = new Uint8ClampedArray(16 * 16 * 4), m = new Uint8ClampedArray(8 * 8 * 4);
    up.queue(tex, 0, 32, 48, 16, 16, d);
    up.queue(tex, 1, 16, 24, 8, 8, m);
    up.flush();
    const subs = calls.filter((c) => c[0] === "sub");
    assert.deepEqual(subs, [["sub", 1, 0, 32, 336 - 48 - 16, 16, 16, 5], ["sub", 1, 1, 16, 168 - 24 - 8, 8, 8, 5]]);
    assert.deepEqual(calls.filter((c) => c[0] === "store").slice(0, 3), [["store", 2, true], ["store", 3, false], ["store", 4, 4]]);
    assert.equal(binds.length, 2);
    assert.deepEqual(up.stats, { subRects: 2, bytes: 16 * 16 * 4 + 8 * 8 * 4, flushes: 1 });
    up.flush();
    assert.equal(calls.filter((c) => c[0] === "sub").length, 2);
  });
});
