import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { VillageCollection, Village, villageDocument, villagesFromNbt } from "./village.js";
import { encodeNbt, decodeNbt } from "./nbt.js";
import { WOODEN_DOOR } from "./world.js";

// VillageReputationProbe on the unchanged 1.7.10 classes (tools/verify-village-reputation.mjs): Village.playerReputation is a TreeMap<String, Integer>
// (vz.j) keyed by the player's name. The villages.dat Players list is written in String.compareTo order, the whole file is byte-compared against
// vz.b(dh) through CompressedStreamTools, a reload writes the same bytes, and findNearestVillageTargetPlayer walks the names in that order
// (the later of two equally near players wins). The port has one local player, so several holders are exercised on the model only.
const reference = JSON.parse(readFileSync(new URL("../public/research/village-reputation-reference.json", import.meta.url)));

function hex(bytes) { return Buffer.from(bytes).toString("hex"); }
const stand = (e, x, z) => Object.assign(e, { x, y: 0, z, distSqTo: (o) => (o.x - e.x) ** 2 + (o.y - e.y) ** 2 + (o.z - e.z) ** 2 });
const clean = (s) => s.replace(/^_$/, "").replaceAll("_", "");

function replay(r) {
  const online = new Map();
  const cells = new Map([["50,0,50", WOODEN_DOOR]]);
  const host = {
    rand: new JavaRandom(r.seed),
    isWoodenDoor: (x, y, z) => cells.get(`${x},${y},${z}`) === WOODEN_DOOR,
    doorFacing: () => 0,
    canSeeSky: (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100),
    hasSolidTop: () => false, isNormalCube: () => false,
    countEntities: () => 0, spawnGolem() {},
    playerEntity: (name) => online.get(name) ?? null,
  };
  const c = new VillageCollection(host);
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0], asker = stand({}, 0, 0), out = [];
  const file = () => villageDocument({ tick: c.tickCounter, villages: [village.toJSON()] });
  for (const op of r.script) {
    const p = op.split(" ");
    switch (p[0]) {
      case "rep": out.push(village.changeReputation(clean(p[1]), Number(p[2]))); break;
      case "target": { stand(asker, Number(p[1]), Number(p[2])); out.push(village.findNearestTargetPlayer(asker)?.name ?? null); break; }
      case "online": online.set(clean(p[1]), stand({ name: clean(p[1]) }, Number(p[2]), Number(p[3]))); out.push(0); break;
      case "offline": online.delete(clean(p[1])); out.push(0); break;
      case "tick": for (let i = 0; i < Number(p[1]); i++) c.tick(); out.push(0); break;
      case "names": out.push(village.reputationNames().flatMap((n) => [n, village.playerReputation(n)])); break;
      case "reload": {
        const first = encodeNbt(file());
        // the file as the game writes it, read into a fresh collection and written again
        const d = new VillageCollection(host);
        d.loadJSON(villagesFromNbt(decodeNbt(first).tag.value.get("data")));
        const again = encodeNbt(villageDocument({ tick: d.tickCounter, villages: [d.villages[0].toJSON()] }));
        out.push([hex(first), hex(again)]);
        break;
      }
      default: assert.fail(op);
    }
  }
  return out;
}

test("village reputation: 6 native scenarios (name order in villages.dat bytes, clamp, nearest target player, clearing, reload)", () => {
  assert.equal(reference.records.length, 6);
  for (const r of reference.records) {
    const got = replay(r), want = r.out;
    for (let i = 0; i < want.length; i++) assert.deepEqual(got[i], want[i], `${r.name}: ${r.script[i]}`);
  }
});

test("a reputation holder is a name: the map iterates in String.compareTo order whatever the insertion order", () => {
  const v = new Village({ rand: new JavaRandom(1) });
  for (const n of ["zed", "Bob", "alice", "Zed", "", "bob", "émile", "😀", "￿"]) v.changeReputation(n, -1);
  assert.deepEqual(v.reputationNames(), ["", "Bob", "Zed", "alice", "bob", "zed", "émile", "😀", "￿"]);
  assert.deepEqual(v.toJSON().players.map((x) => x[0]), v.reputationNames());
  // a loaded file need not be sorted or clamped; the map re-sorts and keeps the stored value (TreeMap.put of dh.f("S"))
  const w = Village.fromJSON({ rand: new JavaRandom(1) }, { ...v.toJSON(), players: [["b", 99], ["a", -99], ["b", 5]] });
  assert.deepEqual(w.reputationNames().map((n) => [n, w.playerReputation(n)]), [["a", -99], ["b", 5]]);
});
