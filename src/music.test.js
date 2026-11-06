// Replays public/research/music-reference.json (tools/probes/MusicProbe.java over the unchanged 1.7.10 classes):
// MusicTicker timing, MusicType delays, the record sound, and the cave mood sound of World.func_147467_a.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { MUSIC_TYPES, MAX_INT, MusicTicker, ambientMusicType, randomIntInRange, recordSound } from "./music.js";
import { MoodSound, MOOD_EVENT, moodLight } from "./cave-ambience.js";
import { Weather } from "./weather.js";
import { SoundBank, attenuationDistance } from "./audio.js";
import { DISC_NAMES, DISC_FIRST, discName } from "./note-jukebox-content.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/music-reference.json", import.meta.url), "utf8"));
const f = Math.fround;

test("MusicType: the seven types, their events and native delays", () => {
  const types = Object.values(MUSIC_TYPES);
  assert.deepEqual(types.map((t) => ({ name: t.name, location: "minecraft:" + t.event, min: t.min, max: t.max })),
    reference.types.map(({ name, location, min, max }) => ({ name, location, min, max })));
  assert.equal(MUSIC_TYPES.CREDITS.min, MAX_INT);
});

test("MusicTicker replays the probe's timers, plays and stops", () => {
  for (const run of reference.ticker) {
    let tick = 0, next = 0;
    const ends = new Map(), events = [];
    const sound = {
      play(event) {
        const handle = { event };
        ends.set(handle, tick + run.lengths[next++ % run.lengths.length]);
        events.push("play minecraft:" + event);
        return handle;
      },
      stop(handle) { ends.delete(handle); events.push("stop minecraft:" + handle.event); },
      isPlaying(handle) { return ends.has(handle) && tick < ends.get(handle); },
    };
    const ticker = new MusicTicker(sound, new JavaRandom(run.seed)), rows = [];
    for (const [name, ticks] of run.script)
      for (let i = 0; i < ticks; i++, tick++) {
        events.length = 0;
        ticker.update(MUSIC_TYPES[name]);
        if (events.length) rows.push({ t: tick, d: ticker.timer, events: [...events] });
      }
    assert.deepEqual(rows, run.rows, `seed ${run.seed}`);
    assert.equal(ticker.timer, run.final, `seed ${run.seed} final timer`);
  }
});

test("MusicTicker: a skipped play (no streams, volume 0) rolls the next delay at once", () => {
  const ticker = new MusicTicker({ play: () => ({}), stop() {}, isPlaying: () => false }, new JavaRandom(3));
  for (let i = 0; i <= 100; i++) ticker.update(MUSIC_TYPES.GAME);
  assert.equal(ticker.timer, MAX_INT); // the first song started on tick 100
  ticker.update(MUSIC_TYPES.GAME);
  assert.ok(ticker.current === null && ticker.timer >= 12000 - 1 && ticker.timer <= 24000);
  assert.equal(randomIntInRange(new JavaRandom(1), 5, 5), 5);
});

test("getAmbientMusicType: credits, menu, Nether, End and the dragon, creative", () => {
  assert.equal(ambientMusicType({ credits: true, inWorld: true }), MUSIC_TYPES.CREDITS);
  assert.equal(ambientMusicType({}), MUSIC_TYPES.MENU);
  assert.equal(ambientMusicType({ inWorld: true }), MUSIC_TYPES.GAME);
  assert.equal(ambientMusicType({ inWorld: true, creative: true }), MUSIC_TYPES.CREATIVE);
  assert.equal(ambientMusicType({ inWorld: true, creative: true, allowFlying: false }), MUSIC_TYPES.GAME);
  assert.equal(ambientMusicType({ inWorld: true, dimension: -1, creative: true }), MUSIC_TYPES.NETHER);
  assert.equal(ambientMusicType({ inWorld: true, dimension: 1 }), MUSIC_TYPES.END);
  assert.equal(ambientMusicType({ inWorld: true, dimension: 1, bossName: "Ender Dragon", bossFrames: 0 }), MUSIC_TYPES.END);
  assert.equal(ambientMusicType({ inWorld: true, dimension: 1, bossName: "Ender Dragon", bossFrames: 100 }), MUSIC_TYPES.END_BOSS);
});

test("records: PositionedSoundRecord at the jukebox's block coordinates, volume 4, LINEAR, 64 blocks", () => {
  const r = reference.sounds.record, s = recordSound("cat", r.x, r.y, r.z);
  assert.equal("minecraft:" + s.event, r.location);
  assert.deepEqual([s.volume, s.pitch, s.attenuation, s.position.x, s.position.y, s.position.z], [r.volume, r.pitch, r.attenuation, r.x, r.y, r.z]);
  assert.equal(attenuationDistance(s.volume), 64);
  assert.deepEqual(reference.sounds.music.attenuation, "NONE");
  assert.deepEqual(DISC_NAMES.map((_, i) => recordSound(discName(DISC_FIRST + i), 0, 0, 0).event),
    ["13", "cat", "blocks", "chirp", "far", "mall", "mellohi", "stal", "strad", "ward", "11", "wait"].map((n) => "records." + n));
});

test("SoundBank: playRecord stops the jukebox's record before the next, and a missing stream is not playing", () => {
  const bank = new SoundBank(() => ({ sound: true, soundLevels: {} }), () => ({ x: 0, y: 0, z: 0, yaw: 0 }));
  bank.ready.catch(() => {});
  bank.playRecord(recordSound("cat", 1, 2, 3), 1, 2, 3);
  const first = bank.records.get("1,2,3");
  assert.equal(bank.isPlaying(first), false); // no audio context here: skipped
  bank.playRecord(null, 1, 2, 3);
  assert.equal(bank.records.has("1,2,3"), false);
});

test("SoundBank: a nested event entry weighs the whole referenced event", () => {
  const bank = new SoundBank(() => ({ sound: true, soundLevels: {} }), () => ({ x: 0, y: 0, z: 0, yaw: 0 }));
  bank.ready.catch(() => {});
  const songs = (n, prefix) => Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}`, stream: true }));
  bank.manifest = { files: {}, events: {
    "music.game": { category: "music", sounds: songs(12, "game") },
    "music.game.creative": { category: "music", sounds: [{ type: "event", name: "music.game" }, ...songs(6, "creative")] },
    "missing.nested": { category: "music", sounds: [{ type: "event", name: "nothing" }, "a"] },
  } };
  assert.equal(bank.weight("music.game.creative"), 18);
  assert.equal(bank.weight("missing.nested"), 1);
  const random = Math.random;
  try {
    Math.random = () => 11.9 / 18; // inside the nested music.game share
    assert.match(bank.resolve("music.game.creative").name, /^game/);
    Math.random = () => 12.1 / 18;
    assert.equal(bank.resolve("music.game.creative").name, "creative0");
    Math.random = () => 0.5;
    assert.equal(bank.resolve("missing.nested").name, "a");
  } finally {
    Math.random = random;
  }
  bank.manifest.events["music.game.creative"].sounds.forEach((s) => s.type || assert.equal(s.stream, true));
});

// MusicProbe's synthetic world: air or stone by a hash, light from the same hash, chunks visited in a fixed cycle.
const hash = (x, y, z) => Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
const probeWorld = { height: 256, get: (x, y, z) => ((hash(x, y, z) & 3) !== 0 ? 0 : 1) };
const probeLight = {
  full: (x, y, z) => (hash(x, y, z) >>> 2) & 15,
  sky: (x, y, z) => { const h = hash(x, y, z); return ((h >>> 6) & 3) === 0 ? (h >>> 8) & 15 : 0; },
};
const CHUNKS = [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]];

test("World.func_147467_a: the cave mood sound replays the probe's cells, rolls and countdowns", () => {
  for (const run of reference.mood) {
    const state = { random: new JavaRandom(run.seed), lcg: run.lcg };
    const mood = Object.assign(Object.create(MoodSound.prototype), { state, countdown: 0, light: probeLight });
    const [px, py, pz] = run.player;
    mood.player = () => ({ x: px, y: py, z: pz });
    const trace = [], plays = [];
    for (let i = 0; i < run.calls; i++) {
      const [cx, cz] = CHUNKS[i % CHUNKS.length];
      const e = mood.chunk(probeWorld, cx, cz);
      if (i < 400) trace.push(state.lcg);
      if (e) {
        plays.push({ i, K: mood.countdown, lcg: state.lcg, sound: { x: e.x, y: e.y, z: e.z, name: e.sound, volume: f(e.volume), pitch: e.pitch } });
        mood.countdown = 0;
      }
    }
    assert.deepEqual(trace, run.trace, `seed ${run.seed} trace`);
    assert.deepEqual(plays, run.plays.map((p) => ({ ...p, sound: { ...p.sound, volume: f(p.sound.volume), pitch: f(p.sound.pitch) } })), `seed ${run.seed} plays`);
    assert.equal(state.lcg, run.finalLcg);
    assert.equal(state.random.nextInt(), run.nextInt);
    assert.ok(plays.every((p) => p.sound.name === MOOD_EVENT && p.K >= 6000 && p.K < 18000));
  }
});

test("MoodSound: the countdown starts at rand.nextInt(12000), runs down once per tick and holds back the roll", () => {
  const random = new JavaRandom(77), expected = new JavaRandom(77).nextInt(12000);
  const mood = new MoodSound({ random, lcg: 5 });
  assert.equal(mood.countdown, expected);
  mood.countdown = 2;
  mood.player = () => ({ x: 0, y: 0, z: 0 });
  mood.light = probeLight;
  assert.equal(mood.chunk(probeWorld, 0, 0), null);
  assert.equal(mood.state.lcg, 5); // no draw while counting down
  mood.tick(); mood.tick(); mood.tick();
  assert.equal(mood.countdown, 0);
});

test("moodLight: daylight is not subtracted, the sky blocks it, and no-sky dimensions read saved sky 0", () => {
  const light = { skyAt: (x, y) => (y > 10 ? 15 : 0), blockAt: (x, y) => (y === 3 ? 7 : 0) };
  const over = moodLight({ height: 64 }, light), nether = moodLight({ height: 128, hasNoSky: true }, light);
  assert.deepEqual([over.full(0, 3, 0), over.sky(0, 3, 0), over.full(0, 20, 0), over.sky(0, 20, 0), over.full(0, 70, 0), over.sky(0, 70, 0)], [7, 0, 15, 15, 15, 15]);
  assert.deepEqual([nether.full(0, 20, 0), nether.sky(0, 20, 0), nether.full(0, 200, 0), nether.sky(0, 200, 0)], [0, 0, 0, 15]);
});

test("Weather: the mood sound runs first in each chunk and its countdown before the chunk loop", () => {
  const weather = new Weather({ random: new JavaRandom(9), lcg: 1 }), order = [];
  weather.mood = { tick: () => order.push("tick"), chunk: (w, cx, cz) => { order.push(`chunk ${cx},${cz}`); return cx === 0 && cz === 0 ? { sound: MOOD_EVENT, volume: 0.7, pitch: 1, x: 1, y: 2, z: 3 } : null; } };
  weather.rollLightningChunk = (w, cx, cz) => order.push(`lightning ${cx},${cz}`);
  const world = { height: 16, get: () => 0, getMeta: () => 0, blockLight: () => 0, sectionTickCount: () => 0, biomeAt: () => null };
  weather.tickChunks = (w, chunks) => { for (const [cx, cz] of chunks.slice(0, 2)) weather.tickChunk(w, cx, cz); };
  weather.tick(world, { x: 8, y: 10, z: 8 });
  assert.deepEqual(order.slice(0, 5), ["tick", "chunk 0,0", "lightning 0,0", "chunk 0,1", "lightning 0,1"]);
  assert.deepEqual(weather.drain().map((e) => e.sound), [MOOD_EVENT]);
});
