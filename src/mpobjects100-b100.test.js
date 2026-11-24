// Batch 100 mpobjects100: the dedicated server's jukebox leaves the inert null-item EntityItem for a ghost disc (b99 tiles99 did single player); the tracker's S1C of such an item
// throws in PacketBuffer.writeItemStackToBuffer (executed, public/research/mpobjects100-reference.json), so a player that starts tracking it loses the connection; the golem rose S19 11 per call.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { musicOf, JUKEBOX } from "./multiplayer/server-music.js";
import { GHOST_DROP_REASON, S0E_FRAME } from "./multiplayer/server-ghost-items.js";
import { PLAY_FRAME } from "./multiplayer/net-packet-ids.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/mpobjects100-reference.json", import.meta.url), "utf8"));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat(name) {
  const w = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function fixture(name) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("a", "Alice", key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  const drops = [];
  s.admin.host = { drop: (pid, reason) => drops.push([pid, reason]), kick() {} };
  const m = musicOf(s.redstone);
  s.world.set(66, 11, 62, JUKEBOX, true, 1);
  m.jukeboxes.restore([{ x: 66, y: 11, z: 62, record: { id: 0, ghost: true, count: 1, damage: 0 } }]);
  return { s, p, m, drops };
}

test("executed record: the null-item item's S1C throws in the real PacketBuffer, a feather's does not (the S0E is fine for both)", () => {
  const g = ref.ghostItem, f = ref.featherItem;
  assert.equal(g.spawn[0][0], "S0E"); assert.equal(g.spawn[0][6], "ok:26");
  assert.match(g.spawn[1][3], /^java\.lang\.NullPointerException/);
  assert.match(f.spawn[1][3], /^ok:/);
});

test("a ghost disc ejected by the server leaves an inert record (no item entity), saved as kind inert", () => {
  const { s, m } = fixture("b100-eject");
  const before = s.items.items.length;
  assert.equal(s.redstone.use(66, 11, 62), true);
  assert.equal(m.inert.list.length, 1);
  assert.equal(s.items.items.length, before, "no item entity");
  const rec = s.redstone.save().musicTiles.filter((e) => e.kind === "inert");
  assert.equal(rec.length, 1);
  assert.equal(rec[0].age, 0);
});

test("the inert record ages one per tick, dies at 6000, and restores from the save", () => {
  const { s, m } = fixture("b100-age");
  s.redstone.use(66, 11, 62);
  for (let i = 0; i < 10; i++) s.redstone.beginTick();
  const saved = s.redstone.save().musicTiles.filter((e) => e.kind === "inert");
  assert.equal(saved[0].age, 10);
  m.inert.restore([]);
  assert.equal(m.inert.list.length, 0);
  m.inert.restore(saved);
  assert.equal(m.inert.list[0].age, 10);
  for (let i = 0; i < 5989; i++) s.redstone.beginTick();
  assert.equal(m.inert.list.length, 1);
  s.redstone.beginTick();
  assert.equal(m.inert.list.length, 0, "age 6000");
});

test("a player that tracks the ghost item loses the connection (once); a player 80 blocks away does not; S0E is counted in netstat", () => {
  const { s, m, drops } = fixture("b100-drop");
  const far = s.addPlayer("b", "Bob", key(2)); far.position.copy({ x: 64.5 + 80, y: 10, z: 64.5 });
  s.redstone.use(66, 11, 62);
  const c0 = s.admin.netStats.writes.counts[14], b0 = s.admin.netStats.writes.bytes[14];
  s.redstone.beginTick(); s.redstone.beginTick();
  assert.deepEqual(drops, [["a", GHOST_DROP_REASON]]);
  assert.equal(m.inert.list.length, 1);
  assert.equal(s.admin.netStats.writes.counts[14], c0 + 1, "one S0E");
  assert.equal(s.admin.netStats.writes.bytes[14], b0 + 27, "27 bytes with the id (data 1 adds the 6 motion bytes)");
});

test("a player that walks into range later is dropped then, and nothing happens without an item", () => {
  const { s, p, drops } = fixture("b100-late");
  p.position.copy({ x: 64.5 + 80, y: 10, z: 64.5 });
  s.redstone.use(66, 11, 62);
  s.redstone.beginTick();
  assert.equal(drops.length, 0);
  p.position.copy({ x: 66.5 + 60, y: 10, z: 62.5 });
  s.redstone.beginTick();
  assert.equal(drops.length, 1);
});

test("iron golem setHoldingRose sends S19 11 on every call (executed): the port marks and sends it", () => {
  const rows = ref.golemRose.calls;
  assert.equal(rows.length, 5);
  for (const [, , pk] of rows) assert.deepEqual(pk.map((q) => [q[0], q[2]]), [["S19", 11]]);
});

test("villager hearts, angry and happy bursts reach the watchers as S19 12 / 13 / 14 on the dedicated server", () => {
  const { s } = fixture("b100-villager-status");
  const ew = s.mobs.mobs, v = ew.create("villager", 66.5, 10, 64.5);
  ew.entities.push(v);
  s.tick();
  s.mobs.statuses.length = 0;
  for (const name of ["heart", "angryVillager", "happyVillager"]) ew.villageBurst(name, v, { width: 0.6, height: 1.8 }, { nextGaussian: () => 0, nextDouble: () => 0.5, nextFloat: () => 0.5, nextInt: () => 0 });
  assert.deepEqual(s.mobs.statuses.map((q) => q.status), [12, 13, 14]);
});

test("b100 lead: the ghost-item S0E frame constant equals PLAY_FRAME and server-ghost-items.js stays out of node:zlib (browser LAN host bundle)", () => {
  assert.equal(S0E_FRAME, PLAY_FRAME.clientbound[14]);
  assert.doesNotMatch(readFileSync(new URL("./multiplayer/server-ghost-items.js", import.meta.url), "utf8"), /from ['"]\.\/net-(packet-ids|native-bytes)\.js['"]/);
});
