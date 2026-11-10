// Slimes, magma cubes, ghasts and blazes replayed against public/research/legacy-ai-reference.json: the unchanged 1.7.10 classes (ym, yf, yd, xx)
// ticked whole by tools/probes/LegacyAiProbe.java. Every record must match Random draw for Random draw (positions, motion, yaw, the type
// fields, split children, sounds, level events, fireball launches, the player's hits).
import test from "node:test";
import assert from "node:assert/strict";
import { legacyReference, replayLegacy, firstDivergence } from "./legacy-ai-replay.js";

test("the reference holds the 33 probe records", () => {
  assert.equal(legacyReference.records.length, 33);
  const kinds = new Set(legacyReference.records.map((r) => r.name.split("-")[1]));
  for (const k of ["idle", "chase", "split", "hurt", "water", "ghast", "blaze", "mixed"]) assert.ok(kinds.has(k), k);
});

for (const r of legacyReference.records) {
  test(`${r.name} replays exactly`, () => {
    assert.equal(firstDivergence(r, replayLegacy(r)), null);
  });
}

test("a split slime leaves children that tick on the same pass", () => {
  const r = legacyReference.records.find((x) => x.name === "la-split-s4-3930"), got = replayLegacy(r);
  assert.equal(r.children.length, 3);
  assert.equal(got.made.length, 3);
  assert.equal(got.states[40].ents.length, r.rows[40][0].length);
});

test("a ghast and a blaze launch the recorded fireballs", () => {
  for (const name of ["la-ghast-fire-3942", "la-blaze-volley-3952"]) {
    const r = legacyReference.records.find((x) => x.name === name), got = replayLegacy(r);
    const want = r.rows.reduce((n, row) => n + row[3].length, 0), have = got.states.reduce((n, s) => n + s.shots.length, 0);
    assert.ok(want > 0, name);
    assert.equal(have, want, name);
  }
});
