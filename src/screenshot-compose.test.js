import test from "node:test";
import assert from "node:assert/strict";
import { inlineCssUrls, hostSelector } from "./screenshot-compose.js";

test("css urls become data urls, data/blob/fragment urls stay, failures become none", async () => {
  const seen = [];
  const out = await inlineCssUrls(`a{background:url('/media/1.7.10/x.png')}b{background:url(data:image/png;base64,AA)}c{mask:url(#m)}d{background:url("/gone.png"),url('/media/1.7.10/x.png')}`, async (u) => {
    seen.push(u);
    if (u === "/gone.png") throw new Error("404");
    return "data:image/png;base64,QQ";
  });
  assert.deepEqual([...new Set(seen)].sort(), ["/gone.png", "/media/1.7.10/x.png"]);
  assert.match(out, /a\{background:url\("data:image\/png;base64,QQ"\)\}/);
  assert.match(out, /b\{background:url\(data:image\/png;base64,AA\)\}/);
  assert.match(out, /c\{mask:url\(#m\)\}/);
  assert.match(out, /d\{background:none,url\("data:image\/png;base64,QQ"\)\}/);
});

test("host selectors drop pseudo-elements only", () => {
  assert.equal(hostSelector(".slot::after"), ".slot");
  assert.equal(hostSelector(".button:hover::before"), ".button:hover");
  assert.equal(hostSelector("::selection"), "*");
});
