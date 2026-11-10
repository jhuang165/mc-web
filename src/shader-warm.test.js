import test from "node:test";
import assert from "node:assert/strict";
import { compileReady } from "./shader-warm.js";

const fake = (materials, programs) => ({ compile: () => materials, properties: { get: (m) => ({ currentProgram: programs.get(m) }) } });
const timers = () => { const q = []; return { q, setTimer: (f) => q.push(f), run: () => { const f = q.shift(); f?.(); return !!f; } }; };

test("resolves at once when every program is ready", async () => {
  const a = {}, b = {};
  await compileReady(fake(new Set([a, b]), new Map([[a, { isReady: () => true }], [b, { isReady: () => true }]])), {}, {});
});

test("waits for a program that links later", async () => {
  const a = {}; let ready = false, done = false; const t = timers();
  compileReady(fake(new Set([a]), new Map([[a, { isReady: () => ready }]])), {}, {}, { setTimer: t.setTimer }).then(() => { done = true; });
  await Promise.resolve(); assert.equal(done, false); assert.equal(t.q.length, 1);
  ready = true; t.run(); await Promise.resolve(); assert.equal(done, true);
});

test("a material disposed while polling (no program any more) does not hang or throw", async () => {
  const a = {}, b = {}, programs = new Map([[a, { isReady: () => true }], [b, { isReady: () => false }]]); let done = false; const t = timers();
  compileReady(fake(new Set([a, b]), programs), {}, {}, { setTimer: t.setTimer }).then(() => { done = true; });
  await Promise.resolve(); assert.equal(done, false);
  programs.delete(b); // MobRenderer.update disposed it: three's properties.get now returns an empty record
  t.run(); await Promise.resolve(); assert.equal(done, true);
});

test("gives up after the timeout and survives a throwing compile", async () => {
  const a = {}; let clock = 0; const t = timers();
  const p = compileReady(fake(new Set([a]), new Map([[a, { isReady: () => false }]])), {}, {}, { setTimer: t.setTimer, now: () => clock, timeoutMs: 100 });
  clock = 150; t.run(); await p;
  await compileReady({ compile: () => { throw new Error("boom"); } }, {}, {});
});
