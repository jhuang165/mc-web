// Batch 77 worldflags77: Generate Structures off (generation 21 / 23), the join-game hardcore flag, Resource Packs rows and the Multiplayer LAN-scan row.
// Evidence: public/research/world-flags-reference.json is Executed (tools/probes/WorldFlagsProbe.java, unchanged ChunkProviderGenerate with
// mapFeaturesEnabled true/false); gui-menus-reference.json rows GuiMultiplayer*/GuiScreenResourcePacks* are Executed (GuiMenusProbe); the port side is Port-read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { PopulationArea, populationBlockMapperReady } from "./population-world.js";
import { structureChunkSha1 } from "./structure-population-area.js";
import { World } from "./world.js";
import { mapFeaturesOn } from "./java-world.js";
import { levelGenerator, readLevelData } from "./level-dat.js";
import { levelNbt } from "./region-export.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerRules } from "./multiplayer/server-properties.js";
import { gameOverScreen } from "./modal-dialogs.js";
import { heartLayout } from "./damage-hud.js";
import { textWidth } from "./menu-screens.js";
import { ServerList, serverListScreen } from "./multiplayer/server-list-gui.js";
import { lanScanDots, serverListOffset } from "./lan-scan.js";
import { packRowTexts } from "./resource-packs-ui.js";
import { recorder } from "./gui-record.test-helper.js";

globalThis.document ??= { fullscreenElement: null };
await populationBlockMapperReady;

const FLAGS = JSON.parse(readFileSync(new URL("../public/research/world-flags-reference.json", import.meta.url), "utf8")).records;
const GUI = JSON.parse(readFileSync(new URL("../public/research/gui-menus-reference.json", import.meta.url), "utf8")).rows;
const row = (screen, w = 320) => GUI.find((r) => r.screen === screen && r.w === w);

function source(seed) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, "default", state), m = gen.manager, top = (x, z) => state.topBlock(m.biomeAt(x, z));
  const caves = new MapGenCaves(seed, m, top), rav = new MapGenRavine(seed, m, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let c = cache.get(k);
    if (!c) { const g = gen.provideChunk(x, z); caves.generate(x, z, g.blocks); rav.generate(x, z, g.blocks); c = { blocks: g.blocks.slice(), metadata: g.metadata.slice() }; cache.set(k, c); }
    return c;
  };
  return { terrain, manager: m };
}
function area(rec, mapFeatures) {
  const seed = BigInt(rec.seed), [cx, cz] = rec.chunk, { terrain, manager } = source(seed);
  const a = new PopulationArea({ seed, chunkX: cx, chunkZ: cz, size: 1, terrain, biomeAt: (x, z) => manager.biomeAt(x, z), structures: mapFeatures, mapFeatures, manager, neighbors: true }).run();
  const h = []; for (let x = cx; x <= cx + 1; x++) for (let z = cz; z <= cz + 1; z++) h.push(structureChunkSha1(a.world.chunk(x, z)));
  return h;
}

test("b77 native probe: both flags covered, structure fixtures differ between on and off", () => {
  assert.equal(FLAGS.length, 26);
  const pairs = FLAGS.filter((r) => r.mapFeatures).map((on) => [on, FLAGS.find((r) => !r.mapFeatures && r.seed === on.seed && r.chunk.join() === on.chunk.join())]);
  assert.equal(pairs.length, 5);
  assert.ok(pairs.filter(([on, off]) => on.areaSha1.join() !== off.areaSha1.join()).length >= 3, "structures change the populated area");
});

test("b77 generation 21 population (structures off) replays the native mapFeatures=false area", () => {
  for (const r of FLAGS.filter((x) => !x.mapFeatures)) assert.deepEqual(area(r, false), r.areaSha1, `off ${r.seed} ${r.chunk}`);
});

test("b77 generation 20 population (structures on) replays the native mapFeatures=true area where the port covers it", () => {
  const same = FLAGS.filter((x) => x.mapFeatures).filter((r) => area(r, true).join() === r.areaSha1.join());
  assert.ok(same.length >= 1, "at least one structure-on fixture matches natively");
});

test("b77 flag gates: odd generations from 17 are off, World and level.dat agree", () => {
  for (const v of [17, 19, 21, 23]) { assert.equal(mapFeaturesOn(v), false, `${v}`); assert.equal(new World("1", "javaStreamed", v).mapFeatures, false, `World ${v}`); }
  for (const v of [16, 18, 20, 22]) { assert.equal(mapFeaturesOn(v), true, `${v}`); assert.equal(new World("1", "javaStreamed", v).mapFeatures, true, `World ${v}`); }
  assert.equal(new World("1", "javaStreamed", 20, "default", "", false).mapFeatures, false);
  assert.equal(levelGenerator({ seed: "1", worldType: "default", mapFeatures: true }).generationVersion, 22);
  assert.equal(levelGenerator({ seed: "1", worldType: "default", mapFeatures: false }).generationVersion, 23);
  assert.equal(mapFeaturesOn(22), true); assert.equal(mapFeaturesOn(23), false);
});

test("b77 level.dat export writes MapFeatures from the generation, and the import reads it back to 22/23", () => {
  const w = { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) };
  for (const [gen, flag] of [[20, 1], [21, 0], [22, 1], [23, 0], [17, 0]]) {
    const record = { name: "t", biome: "javaStreamed", worldType: "default", generationVersion: gen, mode: "survival", worldSpawn: [0, 64, 0], player: { time: 0 }, position: { x: 0, y: 70, z: 0, yaw: 0, pitch: 0 } };
    const data = levelNbt(record, w).tag.value.get("Data").value, level = readLevelData(data);
    assert.equal(data.get("MapFeatures").value, flag, `gen ${gen}`);
    assert.equal(level.mapFeatures, flag === 1);
    assert.equal(mapFeaturesOn(levelGenerator(level).generationVersion), flag === 1, `import of ${gen}`);
  }
  // An explicit mapFeatures:false record (a finite or older world) still exports 0.
  const off = levelNbt({ name: "t", biome: "javaStreamed", worldType: "default", generationVersion: 20, mapFeatures: false, mode: "survival", worldSpawn: [0, 64, 0], player: { time: 0 }, position: { x: 0, y: 70, z: 0, yaw: 0, pitch: 0 } }, w).tag.value.get("Data").value;
  assert.equal(off.get("MapFeatures").value, 0);
});

test("b77 join hardcore flag: the dedicated snapshot carries it and the client screens use it", () => {
  const mk = (rules) => { const world = new World("b77hc"); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return new DedicatedSimulation({}, { world, rules: new ServerRules(rules) }); };
  const hard = mk({ hardcore: true }), soft = mk({});
  for (const s of [hard, soft]) s.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001");
  assert.equal(hard.snapshot("a").hardcore, true);
  assert.equal("hardcore" in soft.snapshot("a"), false);
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.equal(src.split("...(snapshot.hardcore ? { hardcore: true } : {})").length - 1, 2, "welcome and dimension respawn records");
  // Client: remote hardcore death screen reads Leave server; hearts use the hardcore row (v 45).
  const { g, rec } = recorder(320); gameOverScreen({ hardcore: true, remote: true, show() {} }).init(g, 320, 240);
  assert.ok(rec.buttons.some((b) => b.label === "Leave server"));
  assert.deepEqual(heartLayout({ health: 20, maxHealth: 20, hardcore: true }).hearts[0].layers, [[16, 45], [52, 45]]);
});

test("b77 Resource Packs rows replay the native text (name truncation, description wrapping, positions, gray)", () => {
  const trail = (s) => s.replace(/§r$/, "");
  const desc = { "Alpha Pack": "A short description.", Gamma: "§aGreen§r and plain text",
    "Beta Pack With A Very Long Name That Cannot Fit Inside The Pack List Row": "First line of a long description that should wrap across several lines in the pack row, more than two." };
  for (const name of ["GuiScreenResourcePacks+packs", "GuiScreenResourcePacks+packs+selected"]) {
    const n = row(name).text.filter((t) => t.y > 45 && t.y < 200 && t.text !== "Select Resource Packs" && !t.text.startsWith("(Place"));
    let checked = 0;
    for (let i = 0; i < n.length; i++) {
      const t = n[i]; if (t.color !== 0xffffff || t.text === "Default") continue;
      const full = Object.keys(desc).find((k) => k === t.text || (t.text.endsWith("...") && k.startsWith(t.text.slice(0, -3))));
      assert.ok(full, t.text);
      const ours = packRowTexts({ name: full, description: desc[full] }, t.x - 34, t.y - 1);
      assert.equal(ours[0].text, t.text); assert.equal(ours[0].x, t.x); assert.equal(ours[0].y, t.y);
      const lines = []; for (let k = i + 1; k < n.length && n[k].color === 0x808080; k++) lines.push(n[k]);
      assert.deepEqual(ours.slice(1).map((o) => [trail(o.text), o.x, o.y, o.color]), lines.map((o) => [trail(o.text), o.x, o.y, o.color]), full);
      checked++;
    }
    assert.equal(checked, 3, name);
  }
});

test("b77 LAN-scan dots follow Minecraft.getSystemTime() / 300 % 4 (Executed t300..t1200)", () => {
  for (const [name, t] of [["GuiMultiplayer", 0], ["GuiMultiplayer+t300", 300], ["GuiMultiplayer+t600", 600], ["GuiMultiplayer+t900", 900], ["GuiMultiplayer+t1200", 1200]])
    assert.equal(lanScanDots(t), row(name).text.find((s) => /^[Oo] [Oo] [Oo]$/.test(s.text)).text, name);
});

test("b77 Multiplayer list: the LAN row is last and the content is centred like the native list (Executed servers1..4)", () => {
  const store = () => ({ getItem: () => null, setItem() {} });
  for (const [name, n] of [["GuiMultiplayer", 0], ["GuiMultiplayer+servers1", 1], ["GuiMultiplayer+servers2", 2], ["GuiMultiplayer+servers3", 3]]) {
    const l = new ServerList(store()); l.entries = Array.from({ length: n }, (_, k) => ({ name: `Server ${k + 1}`, ip: "127.0.0.1:1" }));
    const { g, rec } = recorder(320); serverListScreen({ list: l, ping: () => new Promise(() => {}), show() {}, join() {}, back() {} }).init(g, 320, 240);
    const native = row(name), port = rec.texts.filter((t) => !t.hidden);
    for (const key of ["Scanning for games on your local network"]) {
      const a = native.text.find((t) => t.text === key), b = port.find((t) => t.text === key);
      assert.ok(b, `${name} port draws the LAN row`);
      assert.equal(b.y, a.y, `${name} y`); assert.equal(b.x - Math.trunc(textWidth(key) / 2), a.x, `${name} x`);
    }
    for (let k = 0; k < n; k++) assert.equal(port.find((t) => t.text === `Server ${k + 1}`).y, native.text.find((t) => t.text === `Server ${k + 1}`).y, `${name} server ${k + 1}`);
  }
  // View height 144 at 320x240 (bottom - top): rows of 36 units, the scan row included; Executed offsets 52, 34, 16, 0 (and 0 beyond).
  assert.deepEqual([36, 72, 108, 144, 180].map((c) => serverListOffset(144, c)), [52, 34, 16, 0, 0]);
});
