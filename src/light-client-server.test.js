// Batch 30: the recorded server-against-client light probe (tools/probes/LightClientServerProbe.java, public/research/light-client-server.jsonl).
// Client light = the server's chunk packet light plus the same setBlock edits and no recheckGaps. Pins the measured size of the difference.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rows = readFileSync(new URL("../public/research/light-client-server.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));

test("client relight differs from server light only in one column under the first floating block, in 8 edit scripts", () => {
  assert.equal(rows.length, 8);
  let extra = 0, edits = 0;
  for (const r of rows) for (const s of r.snaps) {
    if (s.label === "initial") continue;
    edits++;
    extra += s.beyondInitial;
    assert.equal(s.block, 0, `${r.case} ${s.label}: block light never differs`);
    assert.equal(s.heights, 0, `${r.case} ${s.label}: height maps never differ`);
    if (s.beyondInitial) { assert.equal(r.case, "roof-slab"); assert.equal(s.label, "slab 0"); assert.equal(s.beyondInitial, 9); assert.deepEqual(s.box, [0, 61, 0, 0, 69, 0]); }
  }
  assert.ok(edits > 100 && extra === 18, `${edits} edits, ${extra} new differing cells (9 in each client variant)`);
});

test("empty sections are not in the chunk packet: the client starts darker beside shadowed empty sections only", () => {
  for (const r of rows) {
    const s = r.snaps[0];
    assert.equal(s.label, "initial");
    assert.equal(s.skyClientBrighter, 0);
    assert.ok(s.sky > 0 && s.maxSky <= 14 && s.box[1] >= 64 && s.box[4] <= 95, "only cells of the empty sections 4 and 5 beside the anchor pillars");
  }
});
