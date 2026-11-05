// Ad blockers refuse script URLs that look like trackers (/beacon.js blanked the page), so served module names avoid them.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

const BLOCKED = /beacon|analytics|tracking|telemetry|pixel|advert|(^|[-_.])ads?([-_.]|$)/i;

test("served modules have no names that ad blockers treat as trackers", () => {
  const served = readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));
  assert.deepEqual(served.filter((f) => BLOCKED.test(f)), []);
});
