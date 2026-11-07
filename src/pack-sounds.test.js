import test from "node:test";
import assert from "node:assert/strict";
import { parseSoundsJson, applySoundLayers, SOUND_CATEGORIES } from "./pack-sounds.js";

const base = {
  files: { "random/click": { url: "/audio/1.7.10/random/click.ogg" }, "mob/pig/say1": { url: "/audio/1.7.10/mob/pig/say1.ogg" } },
  events: { "random.click": { category: "player", sounds: [{ name: "random/click" }] }, "mob.pig.say": { category: "neutral", sounds: [{ name: "mob/pig/say1" }] } },
};
const layer = (json, pack = "p") => ({ pack, events: parseSoundsJson(JSON.stringify(json)) });

test("defaults and categories (SoundListSerializer)", () => {
  const [e] = parseSoundsJson(JSON.stringify({ "a.b": { sounds: ["x/y"] } }));
  assert.deepEqual(e, { event: "a.b", replace: false, category: "master", sounds: [{ name: "x/y", type: "file", volume: 1, pitch: 1, weight: 1, stream: false }] });
  assert.equal(SOUND_CATEGORIES.length, 9);
  assert.throws(() => parseSoundsJson(JSON.stringify({ a: { category: "nope", sounds: [] } })), /category/i);
});
test("volume, pitch and weight must be above zero; one bad entry rejects the file", () => {
  for (const key of ["volume", "pitch", "weight"]) assert.throws(() => parseSoundsJson(JSON.stringify({ ok: { sounds: ["a"] }, bad: { sounds: [{ name: "a", [key]: 0 }] } })));
});
test("an appended sound keeps the first category; replace starts over with the new category", () => {
  const files = ["custom/boop"];
  let { manifest } = applySoundLayers(base, [layer({ "random.click": { category: "block", sounds: ["custom/boop"] } })], files);
  assert.equal(manifest.events["random.click"].category, "player");
  assert.deepEqual(manifest.events["random.click"].sounds.map((s) => s.name), ["random/click", "custom/boop"]);
  ({ manifest } = applySoundLayers(base, [layer({ "random.click": { replace: true, category: "block", sounds: ["custom/boop"] } })], files));
  assert.equal(manifest.events["random.click"].category, "block");
  assert.deepEqual(manifest.events["random.click"].sounds.map((s) => s.name), ["custom/boop"]);
});
test("a new event takes its own category; packs apply lowest first", () => {
  const { manifest } = applySoundLayers(base, [
    layer({ "my.event": { category: "hostile", sounds: ["random/click"] } }, "low"),
    layer({ "my.event": { replace: true, sounds: [{ name: "mob/pig/say1", weight: 3, volume: 0.5, pitch: 2 }] } }, "high"),
  ]);
  assert.deepEqual(manifest.events["my.event"], { category: "master", sounds: [{ name: "mob/pig/say1", volume: 0.5, pitch: 2, weight: 3 }] });
});
test("a pack's own sound file is added, a missing one is skipped with a warning, the base stays untouched", () => {
  const { manifest, warnings } = applySoundLayers(base, [layer({ "random.click": { sounds: ["custom/boop", "custom/gone"] } })], ["custom/boop"]);
  assert.equal(manifest.files["custom/boop"].url, "/audio/1.7.10/custom/boop.ogg");
  assert.equal(manifest.files["custom/gone"], undefined);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /custom\/gone/);
  assert.equal(base.events["random.click"].sounds.length, 1);
  assert.equal(base.files["custom/boop"], undefined);
});
test("stream sounds use the streams url and are flagged; event references and weights are kept", () => {
  const { manifest } = applySoundLayers(base, [layer({ "music.game": { category: "music", sounds: [{ name: "music/x", stream: true }, { name: "random.click", type: "event", weight: 2 }] } })], ["music/x"]);
  assert.deepEqual(manifest.files["music/x"], { url: "/audio/1.7.10-streams/music/x.ogg", stream: true });
  assert.deepEqual(manifest.events["music.game"].sounds, [{ name: "music/x", stream: true }, { type: "event", name: "random.click", weight: 2 }]);
});
