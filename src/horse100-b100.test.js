// b100 horse100: a `dismount` message (S08, S1B, S08) that arrives while the client is not ready (terrain loading, or after a dimRespawn) is queued in order, after the ticks
// that came before it and before the ones that follow, instead of being dropped by buffer().
import test from "node:test";
import assert from "node:assert/strict";
import { DedicatedClient } from "./multiplayer/client.js";

const tick = (n, x) => ({ type: "tick", tick: n, time: n, changes: [], players: [{ id: "a", x }] });
const mk = () => {
  const log = [];
  const c = new DedicatedClient({ onTick: (m) => log.push(["tick", m.tick]), onDismount: (m) => log.push(["dismount", m.x]) });
  return { c, log };
};

test("a dismount buffered during loading is applied at start() between the earlier and later ticks", () => {
  const { c, log } = mk();
  c.buffer(tick(1, 1)); c.buffer(tick(2, 2));
  c.buffer({ type: "dismount", x: 6.5, y: 65, z: 5.5, vehicle: "h1" });
  c.buffer(tick(3, 3));
  c.start();
  assert.deepEqual(log, [["tick", 2], ["dismount", 6.5], ["tick", 3]]);
});

test("a dismount that arrives after a dimRespawn (not ready) survives the world swap and applies once", () => {
  const { c, log } = mk();
  c.onDimRespawn = () => log.push(["swap"]);
  c.ready = true;
  c.apply({ type: "dimRespawn", world: {} }); // ready = false
  assert.equal(c.ready, false);
  c.buffer({ type: "dismount", x: 1, y: 2, z: 3 });
  c.buffer({ type: "chunkBulk", columns: [] });
  c.start();
  assert.deepEqual(log, [["swap"], ["dismount", 1]]);
});
