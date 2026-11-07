import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBase, rebase, leftovers } from "../tools/vite-base-path.mjs";

test("normalizeBase keeps root and wraps subpaths in slashes", () => {
  assert.equal(normalizeBase(undefined), "/");
  assert.equal(normalizeBase(""), "/");
  assert.equal(normalizeBase("/"), "/");
  assert.equal(normalizeBase("/mc-web"), "/mc-web/");
  assert.equal(normalizeBase("mc-web/"), "/mc-web/");
});

test("rebase prefixes public asset roots, the worker script and its scope only", () => {
  const src = `fetch("/audio/1.7.10/manifest.json"); a='/media/1.7.10/x.png'; b=\`/lang/1.7.10/\${c}.lang\`;
    css="url(/fonts/m.ttf)"; d="/research/parity.md"; cmd="/scoreboard"; s="/media"; sw.register("/resource-pack-sw.js", { scope: "/" });`;
  const out = rebase(src, "/mc-web/");
  assert.match(out, /"\/mc-web\/audio\/1\.7\.10\/manifest\.json"/);
  assert.match(out, /'\/mc-web\/media\/1\.7\.10\/x\.png'/);
  assert.match(out, /`\/mc-web\/lang\/1\.7\.10\//);
  assert.match(out, /url\(\/mc-web\/fonts\/m\.ttf\)/);
  assert.match(out, /"\/mc-web\/research\/parity\.md"/);
  assert.match(out, /"\/scoreboard"/); // chat commands are not paths
  assert.match(out, /s="\/media"/); // no trailing slash, not an asset reference
  assert.match(out, /register\("\/mc-web\/resource-pack-sw\.js", \{ scope: "\/mc-web\/" \}\)/);
  assert.deepEqual(leftovers(out), []);
  assert.equal(rebase(out, "/mc-web/"), out); // already-prefixed strings are not prefixed twice
  assert.equal(rebase(src, "/"), src);
});
