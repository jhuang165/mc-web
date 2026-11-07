import test from "node:test";
import assert from "node:assert/strict";
import { versioned, unversioned, bumpMediaGeneration, mediaGeneration } from "./media-version.js";
import { rewriteCssText, registeredTextureCount } from "./resource-refresh.js";
import * as THREE from "three";

test("generation 0 leaves urls untouched (vanilla loads are unchanged); later generations add a query", () => {
  assert.equal(versioned("/media/1.7.10/blocks/stone.png", 0), "/media/1.7.10/blocks/stone.png");
  assert.equal(versioned("/media/1.7.10/blocks/stone.png", 3), "/media/1.7.10/blocks/stone.png?r=3");
  assert.equal(unversioned("/media/1.7.10/blocks/stone.png?r=3"), "/media/1.7.10/blocks/stone.png");
  assert.equal(mediaGeneration(), 0);
  assert.equal(bumpMediaGeneration(), 1);
  assert.equal(versioned("/a.png"), "/a.png?r=1");
});
test("css urls into /media/1.7.10 are versioned and re-versioned without stacking", () => {
  const css = `url("/media/1.7.10/gui/widgets.png"), url('/media/1.7.10/gui/icons.png?r=2'), url(/other/x.png)`;
  assert.equal(rewriteCssText(css, 4), `url("/media/1.7.10/gui/widgets.png?r=4"), url('/media/1.7.10/gui/icons.png?r=4'), url(/other/x.png)`);
  assert.equal(rewriteCssText(css, 0), `url("/media/1.7.10/gui/widgets.png"), url('/media/1.7.10/gui/icons.png'), url(/other/x.png)`);
});
test("TextureLoader textures of /media/1.7.10 are registered as they load, others are not", () => {
  const before = registeredTextureCount();
  const orig = THREE.ImageLoader.prototype.load;
  THREE.ImageLoader.prototype.load = () => ({});
  let a, b;
  try { a = new THREE.TextureLoader().load("/media/1.7.10/blocks/stone.png"); b = new THREE.TextureLoader().load("/elsewhere/x.png"); } finally { THREE.ImageLoader.prototype.load = orig; }
  assert.equal(registeredTextureCount(), before + 1);
  assert.ok(a && b);
});
