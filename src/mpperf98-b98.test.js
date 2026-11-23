// Batch 98 mpperf98: movePlayer stores without literals, the beacon player list only when read, deliverSounds without the splice copy; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast98 } from "./mpperf98-fast.js";
import { buildPlayersScene, drain } from "./mpperf77-scene.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast98.mode; fast98.mode = m; try { return f(); } finally { fast98.mode = old; } };
const countCalls = (obj, name, f) => { const orig = obj[name]; let n = 0; obj[name] = function (...a) { n++; return orig.apply(this, a); }; try { f(); } finally { obj[name] = orig; } return n; };

test("deliverSounds hands the same sounds to the same players in every mode and empties the queue in place", () => {
  const result = {};
  for (const m of modes) withMode(m, () => {
    const s = buildPlayersScene({ players: 4, mobs: 0, seed: 3 });
    const ps = [...s.players.values()]; ps[3].dimension = -1;
    const at = ps[0].position;
    for (const p of ps.slice(1)) { p.position.x = at.x + 1; p.position.y = at.y; p.position.z = at.z; }
    const queue = s.soundsOut;
    s.soundsOut.push({ name: "a", x: at.x, y: at.y, z: at.z, volume: 1, pitch: 1, except: null, dim: 0 }, { name: "b", x: at.x, y: at.y, z: at.z, volume: 1, pitch: 1, except: ps[0].id, dim: 0 });
    for (const p of ps) p.soundsOut = [];
    s.deliverSounds();
    assert.equal(s.soundsOut.length, 0);
    if (m !== "off") assert.equal(s.soundsOut, queue, "the queue array is emptied in place");
    result[m] = ps.map((p) => p.soundsOut.map((x) => x.name).join(","));
    s.deliverSounds(); // empty queue: nothing more is delivered
    assert.deepEqual(ps.map((p) => p.soundsOut.map((x) => x.name).join(",")), result[m]);
  });
  assert.deepEqual(result.on, result.off); assert.deepEqual(result.verify, result.off);
  assert.ok(result.off.some((x) => x.includes("a")) && result.off.some((x) => x === "b" || x.includes("b")));
});

test("the beacon player list is built on an 80th tick with a beacon only (not every tick), same effects", () => {
  const built = (mode, withBeacon, ticks) => withMode(mode, () => {
    const s = buildPlayersScene({ players: 3, mobs: 0, seed: 3 });
    if (withBeacon) s.tileEntities.beacons.tiles.set("0,60,0", { x: 0, y: 60, z: 0 });
    let n = 0; const map = Array.prototype.map;
    Array.prototype.map = function (f) { const r = map.call(this, f); if (r.length && r[0] && typeof r[0] === "object" && "player" in r[0] && "width" in r[0]) n++; return r; };
    try { for (let i = 0; i < ticks; i++) { s.tick(); drain(s); } } finally { Array.prototype.map = map; }
    return { n, beaconLeft: s.tileEntities.beacons.tiles.size, ticks: s.ticks };
  });
  const offA = built("off", false, 10), onA = built("on", false, 10);
  assert.equal(offA.n, 10); assert.equal(onA.n, 0);
  const onB = built("on", true, 100), offB = built("off", true, 100);
  assert.equal(onB.beaconLeft, offB.beaconLeft); // the world has no beacon block there: the tile is dropped on the check either way
  assert.equal(offB.beaconLeft, 0);
  assert.equal(offB.n, 100);
  assert.ok(onB.n >= 1 && onB.n <= 2, `built ${onB.n} times in 100 ticks`);
});

test("server movement stores positions without Object.assign literals and ends on the same state", () => {
  const run = (m) => withMode(m, () => {
    const s = buildPlayersScene({ players: 4, mobs: 0, seed: 3 });
    const calls = countCalls(Object, "assign", () => { for (let i = 0; i < 20; i++) { s.tick(); drain(s); } });
    return { calls, pos: [...s.players.values()].map((p) => [p.position.x, p.position.y, p.position.z, p.velocity?.x, p.velocity?.z, p.previous.x].join("|")) };
  });
  const off = run("off"), on = run("on"), ver = run("verify");
  assert.deepEqual(on.pos, off.pos); assert.deepEqual(ver.pos, off.pos);
  assert.ok(on.calls < off.calls, `Object.assign calls ${on.calls} (on) vs ${off.calls} (off)`);
});

test("bench hashes are identical off / on / verify and the bench prints mode98", () => {
  const h = (s) => s.slice(s.indexOf("["));
  for (const scene of [["--scene=pen", "--mobs=20"], ["--scene=travel"]]) {
    const out = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", ...scene, "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF98: m }, encoding: "utf8" }).stdout);
    modes.forEach((m, i) => assert.match(out[i], new RegExp(`mode98=${m} mobs=\\d+ \\[`)));
    assert.equal(h(out[1]), h(out[0])); assert.equal(h(out[2]), h(out[0]));
  }
});
