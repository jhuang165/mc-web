// b99 portals99: a ridden mob / ridden cart or boat that travels puts its player rider down with the native flag (World.removeEntity -> EntityPlayerMP.mountEntity(null): S08, S1B, S08);
// away-entities uses the same riding / ridden split as the live tick.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ServerPortalTravel } from "./multiplayer/server-portal-travel.js";

test("server unmount and unseat pass native = true to ServerVehicles.dismount", () => {
  const calls = [];
  const pl = { mount: { mob: { id: 1 }, rider: {} } };
  const mob = { rider: {}, riddenBy: null };
  pl.mount.mob = mob;
  const t = new ServerPortalTravel({ sim: { players: new Map([["a", pl]]) } });
  const p = { vehicles: { dismount: (q, n) => calls.push([q, n]) } };
  t.unmount(p, mob, null);
  assert.deepEqual(calls, [[pl, true]]);
  const rider = {}, cart = { rider }, pl2 = { mount: { rider } };
  calls.length = 0;
  const t2 = new ServerPortalTravel({ sim: { players: new Map([["b", pl2]]) } });
  t2.unseat(p, cart);
  assert.deepEqual(calls, [[pl2, true]]);
});

test("away-entities derives riding / ridden from mobLinks", () => {
  const src = readFileSync(new URL("./away-entities.js", import.meta.url), "utf8");
  assert.match(src, /mobLinks\(c\)/);
  assert.match(src, /riding: !!links\?\.riding/);
  assert.doesNotMatch(src, /c\.rider \|\| c\.vehicle \|\| c\.ridingEntity \|\| c\.riddenBy/);
});
