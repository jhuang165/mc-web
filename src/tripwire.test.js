import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayScenario } from "./redstone.js";

// Recorded by tools/verify-tripwire.mjs from the unchanged 1.7.10 BlockTripWireHook / BlockTripWire.
const reference = JSON.parse(readFileSync(new URL("../public/research/tripwire-reference.json", import.meta.url)));
const f32 = Math.fround;

test("tripwire reference was recorded against the pinned client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.ok(reference.scenarios.length >= 16);
});

for (const s of reference.scenarios)
  test(`tripwire scenario ${s.name} replays the native run`, () => {
    const mine = replayScenario(s);
    for (let t = 0; t < s.ticks; t++) {
      assert.equal(mine.calls[t], s.calls[t], `call log at tick ${t + 1}`);
      assert.deepEqual(mine.frames[t], s.frames[t], `block changes at tick ${t + 1}`);
    }
    assert.equal(mine.final, s.final);
    assert.deepEqual(mine.pending, s.pending);
    assert.equal(mine.sounds.length, s.sounds.length);
    mine.sounds.forEach((m, i) => {
      assert.deepEqual(m.slice(0, 5), s.sounds[i].slice(0, 5));
      assert.equal(m[5], f32(s.sounds[i][5]));
      assert.equal(m[6], f32(s.sounds[i][6]));
    });
    assert.deepEqual(mine.drops, s.drops);
    assert.equal(mine.rng, s.rng);
  });
