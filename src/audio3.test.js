import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SoundBookkeeping, STOP_TIME_GRACE } from "./sound-bookkeeping.js";
import { MovingSoundMinecart, MovingSoundMinecartRiding } from "./moving-sounds.js";
import { nativeListener, stereoPan, stereoGains, portOrientation, broadcastRange, receivesBroadcast, sourceGain, sourceDistance, ATTENUATION, attenuationDistance, UNPOSITIONED } from "./sound-channels.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/audio3-reference.json", import.meta.url), "utf8"));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

test("audio3 reference is the unchanged 1.7.10 client's", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ref.listener.length, 40);
});

test("SoundManager.setListener: interpolated float position and the look/up orientation, replayed (40 cases)", () => {
  for (const c of ref.listener) {
    const l = nativeListener({ x: c.prev[0], y: c.prev[1], z: c.prev[2] }, { x: c.cur[0], y: c.cur[1], z: c.cur[2] }, c.prevYaw, c.yaw, c.prevPitch, c.pitch, c.t);
    // the probe prints Java floats as shortest decimals: compare as floats
    assert.deepEqual([l.x, l.y, l.z], c.position.map(Math.fround), JSON.stringify(c));
    assert.deepEqual(l.orientation, c.orientation.map(Math.fround), JSON.stringify(c));
  }
});

test("sneaking lowers the listener only through posY: a 0.08 drop moves the AL listener 0.08", () => {
  const stand = nativeListener({ x: 0, y: 65.62, z: 0 }, { x: 0, y: 65.62, z: 0 }, 0, 0, 0, 0, 0.5);
  const sneak = nativeListener({ x: 0, y: 65.62 - 0.08, z: 0 }, { x: 0, y: 65.62 - 0.08, z: 0 }, 0, 0, 0, 0, 0.5);
  assert.ok(Math.abs(stand.y - sneak.y - 0.08) < 1e-4); // floats
  assert.deepEqual(stand.orientation, sneak.orientation);
});

test("pan: OpenAL right axis (at x up), azimuth over 90 degrees, rear folded onto the front", () => {
  // port yaw 0 looks -z, pitch 0 level: +x is the listener's right
  const l = { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 };
  near(stereoPan({ x: 5, y: 64, z: 0 }, l), 1);
  near(stereoPan({ x: -5, y: 64, z: 0 }, l), -1);
  near(stereoPan({ x: 0, y: 64, z: -5 }, l), 0);
  near(stereoPan({ x: 0, y: 64, z: 5 }, l), 0);
  near(stereoPan({ x: 5, y: 64, z: -5 }, l), 0.5); // 45 degrees: linear in the angle, not the sine (0.707)
  near(stereoPan({ x: 5, y: 64, z: 5 }, l), 0.5); // behind: the same side and fold
  near(stereoPan({ x: 0, y: 70, z: 0 }, l), 0); // straight above
  near(stereoPan(l, l), 0);
  // turning right by 90 degrees (three.js yaw -pi/2) makes +x the front: centred
  near(stereoPan({ x: 5, y: 64, z: 0 }, { ...l, yaw: -Math.PI / 2 }), 0);
  // looking straight down: the right axis is still the right
  near(stereoPan({ x: 3, y: 64, z: 0 }, { ...l, pitch: -Math.PI / 2 }), 1);
  const o = portOrientation(0, 0);
  near(o[2], -1);
  near(o[4], 1);
});

test("stereoGains: equal power, centre 0.707 each, hard sides", () => {
  const c = stereoGains(0);
  near(c.left, Math.SQRT1_2);
  near(c.right, Math.SQRT1_2);
  assert.deepEqual([stereoGains(-1).left, stereoGains(1).right], [1, 1]);
  for (const p of [-0.9, -0.3, 0.2, 0.77]) near(stereoGains(p).left ** 2 + stereoGains(p).right ** 2, 1);
});

test("an ATTENUATION_NONE click sits at the world origin: panned toward it, full gain", () => {
  const l = { x: 10, y: 64, z: 0, yaw: 0, pitch: 0 }; // looking -z with the origin on the left
  assert.ok(stereoPan(UNPOSITIONED, l) < -0.4);
  assert.equal(sourceGain(ATTENUATION.NONE, sourceDistance(UNPOSITIONED, l), 16), 1);
});

test("S29 broadcast range: strictly within 16 (16 * volume above 1), same dimension, source player excluded", () => {
  assert.equal(broadcastRange(0.5), 16);
  assert.equal(broadcastRange(1), 16);
  assert.equal(broadcastRange(4), 64);
  assert.equal(broadcastRange(10000), 160000);
  const player = { id: 1, x: 0, y: 64, z: 0 };
  assert.equal(receivesBroadcast({ x: 15.99, y: 64, z: 0, volume: 1 }, player), true);
  assert.equal(receivesBroadcast({ x: 16, y: 64, z: 0, volume: 1 }, player), false);
  assert.equal(receivesBroadcast({ x: 40, y: 64, z: 0, volume: 4 }, player), true);
  assert.equal(receivesBroadcast({ x: 1, y: 64, z: 0, volume: 1 }, player, { except: 1 }), false);
  assert.equal(receivesBroadcast({ x: 1, y: 64, z: 0, volume: 1 }, player, { except: 2 }), true);
  assert.equal(receivesBroadcast({ x: 1, y: 64, z: 0, volume: 1 }, player, { sameDimension: false }), false);
  // the LINEAR gain agrees at the boundary: zero from 16 (or 16 * volume) on
  assert.equal(sourceGain(ATTENUATION.LINEAR, 16, attenuationDistance(1)), 0);
  assert.equal(sourceGain(ATTENUATION.LINEAR, 64, attenuationDistance(4)), 0);
});

test("SoundManager bookkeeping replays the probed update / isSoundPlaying / stopSound / repeat / tickable traces", () => {
  assert.equal(STOP_TIME_GRACE, 20);
  let total = 0;
  for (const run of ref.bookkeeping) {
    const alive = new Map(), startsBy = new Map(), sounds = [], pendingStops = [];
    const bk = new SoundBookkeeping({
      playing: (name) => !!alive.get(name),
      stop: (name) => pendingStops.push(name), // the sound system executes the stop command after the manager call returns
      remove: (name) => alive.delete(name),
      start: (sound, name) => alive.set(name, startsBy.get(sound)),
      apply: () => {},
    });
    for (const row of run.rows) {
      const [op] = row;
      if (op === "play") {
        const [, id, kind, arg, starts] = row;
        const sound = { id, canRepeat: kind === 2, repeatDelay: kind === 2 ? arg : 0 };
        if (kind === 1) {
          let updates = 0;
          sound.tickable = { update: () => { updates++; }, donePlaying: () => updates >= arg };
        }
        startsBy.set(sound, !!starts);
        sounds[id] = sound;
        bk.play(sound);
      } else if (op === "end") {
        const name = bk.nameOf.get(sounds[row[1]]);
        if (name !== undefined) alive.set(name, false);
      } else if (op === "stop") bk.stopSound(sounds[row[1]]);
      else if (op === "tick") bk.update();
      else assert.equal(bk.isSoundPlaying(sounds[row[1]]) ? 1 : 0, row[2], `query ${row[1]} at playTime ${bk.playTime}`);
      for (const name of pendingStops.splice(0)) if (alive.has(name)) alive.set(name, false);
      assert.deepEqual([bk.playTime, bk.playing.size, bk.stopTimes.size, bk.delayed.size, bk.tickables.length], row.slice(-5), JSON.stringify(row));
      total++;
    }
  }
  assert.equal(total, 2100);
});

test("a source that is not playing counts as not playing for 20 ticks, then as playing until the update pass removes it", () => {
  const bk = new SoundBookkeeping({ playing: () => false, stop() {}, remove() {}, start() {}, apply() {} });
  const sound = { canRepeat: false, repeatDelay: 0 };
  bk.play(sound);
  const seen = [];
  for (let i = 0; i < 24; i++) { seen.push(bk.isSoundPlaying(sound)); bk.update(); }
  // playTime 0..19 are before the stop time; the pass that reaches playTime 20 removes it before anything can ask again
  assert.deepEqual(seen.slice(0, 20), new Array(20).fill(false));
  assert.equal(bk.playing.size, 0);
});

test("MovingSoundMinecart / Riding formulas replay the probed volumes (160 ticks)", () => {
  const cart = { dead: false, x: 0, y: 0, z: 0, mx: 0, mz: 0 }, player = { riding: cart };
  const base = new MovingSoundMinecart(cart), inside = new MovingSoundMinecartRiding(player, cart);
  for (const r of ref.moving) {
    Object.assign(cart, { mx: r.mx, mz: r.mz, dead: r.dead, x: r.x, y: r.y, z: r.z });
    player.riding = r.riding ? cart : null;
    base.update();
    inside.update();
    assert.equal(base.volume, Math.fround(r.baseVolume), JSON.stringify(r));
    assert.equal(base.distance, Math.fround(r.baseDistance));
    assert.equal(base.done, r.baseDone);
    assert.equal(inside.volume, Math.fround(r.insideVolume), JSON.stringify(r));
    assert.equal(inside.done, r.insideDone);
  }
});
