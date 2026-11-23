// Batch 98 console98: (1) S0C counts the "textures" profile property of a player with a skin or cape (gb.b writes three strings per property; executed b96: 1097 for a 400 / 684 property),
// (2) watcherSig follows the watcher values, not the effect list (an amplifier change with the same potion colour changes no watcher value),
// (3) only generic.maxHealth and generic.movementSpeed are watched attributes (yj bytecode), so Strength / Weakness / item modifiers (attackDamage) add no S20 bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { writePackets } from "./multiplayer/net-packet-ids.js";
import { profilePropertyBytes, texturesValueLength, TEXTURES_SIGNATURE } from "./multiplayer/profile-properties.js";
import { watcherSig, watcherEntries } from "./multiplayer/server-player-tracker.js";
import { Effects } from "./status-effects.js";

const tick = (players) => writePackets({ type: "tick", tick: 1, players }, { self: 1, peers: new Set() });
const s0c = (row) => tick([{ pk: [], ...row }]).find(([i]) => i === 12)[1];

test("the property framing is the executed 1097 for a 400 char value and a 684 char signature", () => {
  assert.equal(9 + (2 + 400) + (2 + TEXTURES_SIGNATURE), 1097);
});

test("a spawn with a skin or cape adds the textures property to the S0C; no skin adds nothing", () => {
  const base = s0c({ id: 2, name: "Steve" });
  assert.equal(s0c({ id: 2, name: "Steve", skin: null, cape: null }), base);
  const withSkin = s0c({ id: 2, name: "Steve", skin: "abc" });
  assert.equal(withSkin - base, 9 + 2 + texturesValueLength("Steve") + 2 + 684);
  assert.equal(profilePropertyBytes({ name: "Steve", cape: "c" }), withSkin - base, "a cape-only profile holds one CAPE entry, the same size as one SKIN entry");
  assert.ok(profilePropertyBytes({ name: "Steve", skin: "a", cape: "c" }) > withSkin - base, "skin and cape grow the value");
});

test("watcherSig: an amplifier change with the same potion colour changes no watcher value", () => {
  const mk = (amp) => ({ position: { x: 0, y: 70, z: 0 }, input: {}, motion: {}, survival: { health: 20, air: 300, fire: 0, effects: new Effects([{ id: 1, duration: 600, amplifier: amp }]) } });
  const a = mk(0), b = mk(1);
  assert.equal(watcherEntries(a).v[7][1], watcherEntries(b).v[7][1], "one effect: the colour is the same whatever the amplifier");
  assert.equal(watcherSig(a), watcherSig(b));
  assert.notEqual(watcherEntries(a).a.movementSpeed, watcherEntries(b).a.movementSpeed, "the S20 attribute still differs");
  const c = mk(0); c.survival.effects.add({ id: 3, duration: 600, amplifier: 0 });
  assert.notEqual(watcherSig(a), watcherSig(c), "a new colour is a changed watcher value");
  const d = mk(0); d.survival.effects = new Effects([{ id: 1, duration: 600, amplifier: 0, ambient: true }]);
  assert.notEqual(watcherSig(a), watcherSig(d), "the ambient entry (8) is watched");
});

test("Strength, Weakness and Resistance change no watched attribute (only maxHealth and movementSpeed are watched)", () => {
  const mk = (...ids) => ({ position: { x: 0, y: 70, z: 0 }, input: {}, motion: {}, survival: { health: 20, air: 300, fire: 0, effects: new Effects(ids.map((id) => ({ id, duration: 600, amplifier: 1 }))) } });
  assert.deepEqual(watcherEntries(mk(5, 18, 11)).mods, { maxHealth: 0, movementSpeed: 0 });
  assert.deepEqual(watcherEntries(mk(1, 2, 21)).mods, { maxHealth: 1, movementSpeed: 2 });
});
