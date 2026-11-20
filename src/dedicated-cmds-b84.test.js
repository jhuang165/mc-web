import { isDeepStrictEqual } from "node:util";
// Batch 84 dedicated84: replays dedicated-cmds-reference.json (tools/probes/Dedicated84Probe.java, executed on the unchanged 1.7.10 ServerCommandManager and the dedicated
// command classes with a real ServerConfigurationManager, UserLists and PlayerProfileCache) through the port's server chat path (ServerSocial.command -> ServerAdmin).
// Rows left out here: the console sender and offline mode (b86 console86: replayed in console86-b86.test.js). b87 offline87: the partly-off world saving rows replay
// here too (ServerAdmin.levelSaving keeps one flag per world).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { langReady } from "./chat-component.js";
import { build, observe, expected, wordOf, differences } from "./dedicated-cmds-replay.js"; // b86 console86: the harness moved there (shared with console86-b86.test.js)

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/dedicated-cmds-reference.json", import.meta.url)));
// b86 console86: the player rows also compare the server log (the admin notices bl.a logs for a non-server sender); the console sender and offline-mode rows replay in
// console86-b86.test.js. A save row of the native saves each world; the port has one save call (host.save), compared with world 0's save calls.
const reachable = (row) => row[2] !== "console" && row[1] !== "offline";

const rows = ref.run.filter(reachable);
const byGroup = new Map();
for (const row of rows) { const word = wordOf(row); (byGroup.get(word) ?? byGroup.set(word, []).get(word)).push(row); }

for (const [word, group] of byGroup) {
  test(`dedicated command ${word}: ${group.length} executed rows`, async () => {
    const bad = [];
    if (process.env.COMPACT) for (const row of group) { const d = differences(await observe(row), expected(row)); if (d.length) console.log(`${JSON.stringify(row.slice(0, 3))}\n   ${d.join("\n   ")}`); } // COMPACT=1: one line per differing row (developer aid)
    for (const row of group) {
      const got = await observe(row), want = expected(row);
      try { assert.deepEqual(got, want); } catch (e) { bad.push(`${JSON.stringify(row.slice(0, 3))}\n${e.message}`); }
    }
    assert.equal(bad.length, 0, `${bad.length} of ${group.length} rows differ:\n${bad.slice(0, Number(process.env.SHOW ?? 3)).join("\n---\n")}`);
  });
}

// Batch 85 dedtab85: the 64 recorded tab rows (CommandHandler.getPossibleCommands on the real command classes) replayed through the port's socialTabComplete (Alex, op 4).
test(`dedicated tab completion: ${ref.tab.length} executed rows`, async () => {
  const { socialTabComplete } = await import("./multiplayer/server-tabcomplete.js");
  const bad = [];
  for (const [text, setup, want] of ref.tab) {
    const f = build(setup, "alex");
    const got = socialTabComplete(f.social, f.ids.Alex, "/" + text);
    if (!isDeepStrictEqual(got, want ?? [])) bad.push(`${JSON.stringify([text, setup])} port ${JSON.stringify(got)} native ${JSON.stringify(want)}`);
  }
  assert.equal(bad.length, 0, bad.join("\n"));
});
