// Replays public/research/sound-reference.json (tools/probes/SoundProbe.java over the unchanged 1.7.10 classes and the paulscode
// SoundSystem libraries, no audio device): SoundManager.playSound's values, paulscode's LINEAR gain, Library.getNextChannel's
// 28 + 4 channel rotation and eviction, and World.setActivePlayerChunksAndCheckLight's light-check draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { MoodSound } from "./cave-ambience.js";
import { SoundBank } from "./audio.js";
import { normalizedVolume, normalizedPitch, SOUND_CATEGORIES } from "./settings.js";
import { ATTENUATION, ChannelPool, NORMAL_CHANNELS, STREAMING_CHANNELS, alGain, attenuationDistance, distanceDelayTicks, sourceDistance, sourceGain, stereoPan } from "./sound-channels.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/sound-reference.json", import.meta.url), "utf8"));
const f = Math.fround;

test("the probe's SoundCategory order matches settings.js", () => {
  assert.deepEqual(reference.categories, SOUND_CATEGORIES.map(([k]) => k));
});

test("SoundManager.playSound: normalized volume and pitch, 16 * volume LINEAR distance, skips at 0", () => {
  for (const c of reference.manager) {
    const levels = Object.fromEntries(reference.categories.map((k, i) => [k, f(c.levels[i])]));
    // bso.a(location, pitch) is the GUI factory: volume 0.25, attenuation NONE at the origin.
    const volume = c.linear ? c.volume : 0.25, pitch = c.linear ? c.pitch : c.volume;
    const vol = normalizedVolume(volume, c.entryVolume, levels, c.category);
    if (c.master <= 0 || vol === 0) {
      assert.deepEqual(c.calls, [], JSON.stringify(c));
      continue;
    }
    const [source, setPitch, setVolume, play] = c.calls;
    assert.equal(source.call, "newSource");
    assert.equal(source.priority, false);
    assert.equal(source.loop, false);
    assert.equal(source.stream, c.stream);
    assert.equal(source.att, c.linear ? ATTENUATION.LINEAR : ATTENUATION.NONE);
    assert.equal(f(source.dist), attenuationDistance(volume));
    assert.deepEqual([source.x, source.y, source.z], c.linear ? [1.5, 64, -2.25] : [0, 0, 0]);
    assert.equal(f(setPitch.value), normalizedPitch(pitch, c.entryPitch));
    assert.equal(f(setVolume.value), vol);
    assert.equal(play.call, "play");
  }
  assert.ok(reference.manager.some((c) => c.volume === 4 && c.calls[0]?.dist === 64));
  assert.ok(reference.manager.some((c) => c.volume === 10000 && c.calls[0]?.dist === 160000));
});

test("paulscode LINEAR gain and distance over the probe's source and listener positions", () => {
  for (const g of reference.gain) {
    const [lx, ly, lz] = g.listener, [x, y, z] = g.pos;
    const d = sourceDistance({ x, y, z }, { x: lx, y: ly, z: lz });
    assert.equal(d, f(g.distance));
    assert.equal(sourceGain(g.att, d, g.dist), f(g.gain), JSON.stringify(g));
  }
  assert.ok(reference.gain.some((g) => g.att === 2 && g.gain > 0 && g.gain < 1));
  assert.ok(reference.gain.some((g) => g.att === 2 && g.gain === 0));
  assert.equal(alGain(0.5, 0.25), 0.125);
});

test("Library.getNextChannel: 28 + 4 channels, rotation, and taking over the next channel when all are busy", () => {
  for (const run of reference.channels) {
    assert.equal(run.normal, NORMAL_CHANNELS);
    assert.equal(run.streaming, STREAMING_CHANNELS);
    const normal = new ChannelPool(NORMAL_CHANNELS), streaming = new ChannelPool(STREAMING_CHANNELS), live = new Map();
    let takeovers = 0;
    for (const row of run.rows) {
      if (row[0] === "end") { live.get(row[1]).playing = false; continue; }
      const [, id, stream, index, prevId, prevPlaying] = row, handle = { id, playing: true };
      const r = (stream ? streaming : normal).acquire(handle);
      assert.deepEqual([r.index, r.prev?.id ?? 0, r.prevPlaying ? 1 : 0], [index, prevId, prevPlaying], `seed ${run.seed} source ${id}`);
      if (r.prev && r.prevPlaying) { r.prev.playing = false; takeovers++; }
      live.set(id, handle);
    }
    if (run.seed !== 3) assert.ok(takeovers > 0, "the run saturates the channels");
  }
});

test("World.C: the light check draws nextInt(1) and three nextInt(11) per tick, after the countdown", () => {
  for (const run of reference.light) {
    const state = { random: new JavaRandom(run.seed), lcg: 0 };
    const mood = Object.assign(Object.create(MoodSound.prototype), { state, countdown: run.countdown, light: null });
    const [first] = run.players;
    mood.player = () => (first ? { x: first[0], y: first[1], z: first[2] } : null);
    const counts = [], cells = [];
    for (let i = 0; i < run.calls; i++) {
      const cell = mood.tick();
      if (i < 40) counts.push(mood.countdown);
      if (cell && cells.length < 60) cells.push([cell.x, cell.y, cell.z]);
    }
    assert.deepEqual(counts, run.countdowns);
    assert.deepEqual(cells, run.checks);
    assert.equal(run.checkCount, first ? run.calls : 0);
    assert.equal(state.random.nextInt(), run.nextInt);
  }
});

test("stereoPan: the azimuth on the listener's right axis (the full law is in audio3.test.js)", () => {
  const l = { x: 0, y: 0, z: 0 };
  assert.equal(stereoPan({ x: 0, y: 0, z: 5 }, l, 0), 0);
  assert.ok(Math.abs(Math.abs(stereoPan({ x: 5, y: 0, z: 0 }, l, 0)) - 1) < 1e-6);
  assert.equal(stereoPan(l, l, 0), 0);
});

test("distance delay: held (int)(sqrt(d2)/40*20) ticks beyond 10 blocks, SoundBank.tick releases it", () => {
  assert.equal(distanceDelayTicks(100), 0);
  assert.equal(distanceDelayTicks(101), Math.trunc((Math.sqrt(101) / 40) * 20));
  assert.equal(distanceDelayTicks(1600), 20);
  const bank = new SoundBank(() => ({ sound: false, soundLevels: {} }), () => ({ x: 0, y: 0, z: 0, yaw: 0 }));
  bank.ready.catch(() => {});
  bank.play("fireworks.blast", { volume: 20, pitch: 1, position: { x: 40, y: 0, z: 0 }, distanceDelay: true });
  bank.play("fireworks.blast", { volume: 20, pitch: 1, position: { x: 5, y: 0, z: 0 }, distanceDelay: true });
  assert.equal(bank.delayed.length, 1);
  for (let i = 0; i < 19; i++) bank.tick();
  assert.equal(bank.delayed.length, 1);
  bank.tick();
  assert.equal(bank.delayed.length, 0);
});
