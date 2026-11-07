import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { SoundBank } from "./audio.js";
import { CartSounds } from "./cart-sounds.js";
import { reachesPlayer, isClientMade } from "./sound-origin.js";
import { normalizedVolume, normalizedPitch, categoryVolume } from "./settings.js";

const manifest = JSON.parse(readFileSync(new URL("../public/audio/1.7.10/manifest.json", import.meta.url), "utf8"));

test("the manifest ships the two minecart events and their original clips", () => {
  assert.deepEqual(manifest.events["minecart.base"], { category: "neutral", sounds: ["minecart/base"] });
  assert.deepEqual(manifest.events["minecart.inside"], { category: "player", sounds: ["minecart/inside"] });
  const index = { "minecart/base": "28f9973fcd8366ac9837dbe190b129a8fce15857", "minecart/inside": "6a83b514027c328b74f8428448dc6589d4b16388" };
  for (const [name, hash] of Object.entries(index)) {
    const file = manifest.files[name];
    assert.equal(file.sha1, hash); // the 1.7.10 asset index object hash
    const path = new URL(`../public${file.url}`, import.meta.url);
    assert.ok(existsSync(path));
    assert.equal(createHash("sha1").update(readFileSync(path)).digest("hex"), hash);
  }
});

const cartAt = (o = {}) => ({ dead: false, x: 0, posY: 64, z: 0, vx: 0, vz: 0, ...o });
test("CartSounds starts one MovingSoundMinecart per cart and one riding sound per mount", () => {
  const started = [];
  const sounds = { epoch: 0, playMoving: (s) => started.push(s) };
  const cs = new CartSounds(sounds), a = cartAt(), b = cartAt({ x: 5 }), rider = { vehicle: null };
  cs.tick([a, b], rider);
  cs.tick([a, b], rider);
  assert.deepEqual(started.map((s) => s.event), ["minecart.base", "minecart.base"]);
  rider.vehicle = a;
  cs.tick([a, b], rider);
  cs.tick([a, b], rider);
  assert.deepEqual(started.map((s) => s.event), ["minecart.base", "minecart.base", "minecart.inside"]);
  const inside = started[2];
  a.vx = 0.4; a.vz = 0.3; // speed 0.5
  inside.update();
  assert.equal(inside.volume, Math.fround(Math.fround(0.5) * Math.fround(0.75)));
  rider.vehicle = null; // dismount: the riding sound is done
  inside.update();
  assert.ok(inside.tickable.donePlaying());
  rider.vehicle = { boat: true };
  cs.tick([a, b], rider);
  assert.equal(started.length, 3); // a boat is not an EntityMinecart
  sounds.epoch++; // stopAllSounds: the carts are announced again
  cs.tick([a, b], rider);
  assert.equal(started.length, 5);
});

test("a cart that died is never started", () => {
  const started = [], cs = new CartSounds({ playMoving: (s) => started.push(s) });
  cs.tick([cartAt({ dead: true })], { vehicle: null });
  assert.equal(started.length, 0);
});

test("S29 range: the server position, 16 blocks (16 * volume above 1), strictly within; client-made sounds are exempt", () => {
  const feet = { x: 0, y: 64, z: 0 };
  assert.ok(reachesPlayer("mob.zombie.say", { x: 15.9, y: 64, z: 0 }, 1, feet));
  assert.ok(!reachesPlayer("mob.zombie.say", { x: 16, y: 64, z: 0 }, 1, feet)); // strict
  assert.ok(!reachesPlayer("mob.zombie.say", { x: 0, y: 80.5, z: 0 }, 0.5, feet)); // volume below 1 stays 16
  assert.ok(reachesPlayer("mob.enderdragon.growl", { x: 40, y: 64, z: 0 }, 5, feet)); // 80 blocks
  assert.ok(reachesPlayer("ambient.weather.thunder", { x: 5000, y: 64, z: 0 }, 10000, feet));
  assert.ok(reachesPlayer("fireworks.blast", { x: 50, y: 64, z: 0 }, 20, feet));
  assert.ok(reachesPlayer("mob.zombie.say", { x: 500, y: 64, z: 0 }, 1, null)); // no world: no filter
  assert.ok(reachesPlayer("mob.zombie.say", { x: 500, y: 64, z: 0 }, 1, feet, { local: true }));
  assert.ok(isClientMade("gui.button.press") && isClientMade("minecart.base") && !isClientMade("random.explode"));
});

function bank(levels = {}) {
  const o = { sound: true, soundLevels: levels };
  const b = new SoundBank(() => o, () => ({ x: 0, y: 0, z: 0, yaw: 0, feet: { x: 0, y: -1.62, z: 0 }, inWorld: true }));
  return { b, o };
}
const fakeNode = () => ({ gain: { value: 1 }, pan: { value: 0 }, connect(n) { return n ?? this; }, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; }, playbackRate: { value: 1 } });

test("playMoving loops the clip and follows the cart each tick; stopping silences it", async () => {
  const { b } = bank();
  b.manifest = manifest; b.ready = Promise.resolve(manifest);
  b.context = { createBufferSource: fakeNode, createGain: fakeNode, createStereoPanner: fakeNode, destination: {} };
  b.buffer = async () => ({ numberOfChannels: 1 });
  const cart = cartAt({ x: 8, posY: 0, vx: 0.3, vz: 0.4 });
  const cs = new CartSounds(b);
  const started = [];
  const original = b.playMoving.bind(b);
  b.playMoving = (s) => { const p = original(s); started.push(p); return p; };
  cs.tick([cart], { vehicle: null });
  const handle = await started[0];
  assert.equal(handle.source.loop, true);
  b.tick(); // SoundManager.update: update(), then setVolume / setPosition
  const volume = Math.fround(Math.fround(0.5) * Math.fround(0.7)); // speed 0.5
  assert.equal(handle.volume, volume);
  assert.ok(Math.abs(handle.gain.gain.value - volume * (1 - 8 / 16)) < 1e-6);
  cart.vx = cart.vz = 0;
  b.tick();
  assert.equal(handle.gain.gain.value, 0); // a still cart is silent but its source keeps looping
  assert.ok(b.moving.has(handle));
  cart.dead = true;
  b.tick(); // done: stopSound
  assert.ok(handle.source.stopped);
  assert.ok(!b.moving.has(handle));
});

test("setSoundCategoryVolume visits only the category that moved (btj.a(w, float), bytecode-read)", () => {
  const { b, o } = bank({});
  b.updateVolumes(); // baseline
  const keep = { category: "neutral", volume: 0, entryVolume: 1, gain: { gain: { value: 1 } }, attenuation: 1, source: fakeNode() };
  const kill = { category: "music", volume: 1, entryVolume: 1, gain: { gain: { value: 1 } }, attenuation: 1, source: fakeNode() };
  b.active.set(keep.source, keep);
  b.active.set(kill.source, kill);
  o.soundLevels = { music: 0 };
  b.updateVolumes();
  assert.equal(kill.playing, false); // music dropped to 0: stopped
  assert.ok(b.active.has(keep.source)); // a volume-0 sound of another category is untouched
  o.soundLevels = { music: 0, neutral: 0 };
  b.updateVolumes();
  assert.ok(!b.active.has(keep.source)); // its own category moved to 0: now stopped
});

test("getNormalizedVolume / Pitch: clamp(volume * entry * category), MASTER and no category give 1, pitch clamps to 0.5..2", () => {
  assert.equal(categoryVolume({ master: 0.2 }, "master"), 1);
  assert.equal(categoryVolume({ block: 0.5 }, null), 1);
  assert.equal(normalizedVolume(3, 1, {}, "block"), 1);
  assert.equal(normalizedVolume(0.5, 0.5, { block: 0.5 }, "block"), 0.125);
  assert.equal(normalizedVolume(1, 1, { block: 0 }, "block"), 0);
  assert.equal(normalizedPitch(0.1, 1), 0.5);
  assert.equal(normalizedPitch(3, 1), 2);
});
