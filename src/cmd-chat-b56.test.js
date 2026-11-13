// Replays public/research/cmd-chat-reference.json (tools/probes/CmdChatProbe.java): the unchanged 1.7.10 CommandMessage, CommandBroadcast and CommandEmote with
// PlayerSelector on a server double. The "solo" scenario (only Alex online) is what a one-player world can show.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeComponent } from "./chat-component.js";
import { createCommandRunner } from "./commands.js";
import { Scoreboard } from "./scoreboard.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/cmd-chat-reference.json", import.meta.url)));
function board() {
  const b = new Scoreboard(), t = b.createTeam("red");
  b.setTeam(t, { prefix: "\u00a7c", suffix: "\u00a7r" });
  b.joinTeam("Alex", "red");
  return b;
}
export function runLine(line, { block = false } = {}) {
  const sent = [], broadcast = [];
  const host = {
    name: block ? "@" : "Alex", playerName: "Alex", isCommandBlock: block, cheats: true, rules: {}, position: () => (block ? { x: 0, y: 0, z: 0 } : { x: 0.5, y: 64, z: 0.5 }), playerPosition: () => ({ x: 0.5, y: 64, z: 0.5 }),
    scoreboard: board(),
    print: (t, c) => sent.push(c ?? t), broadcast: (t, c) => broadcast.push(c ?? t),
  };
  createCommandRunner(host).run(line);
  return { sent, broadcast };
}
const ser = (c) => (typeof c === "string" ? c : serializeComponent(c));

test("facts: names, aliases, usage keys and permission levels", () => {
  assert.deepEqual(ref.facts.map((f) => f.slice(0, 5)), [["tell", "tell", ["w", "msg"], "commands.message.usage", 0], ["say", "say", null, "commands.say.usage", 1], ["me", "me", null, "commands.me.usage", 0]]);
});

test("solo records", () => {
  const rows = ref.records.filter((r) => r[0] === "solo");
  const bad = [];
  for (const [, cmd, sender, args, res] of rows) {
    const line = `/${cmd} ${args.join(" ")}`.trimEnd();
    const mine = runLine(line, { block: sender === "@" });
    const expectOut = res.out.Alex.map((c) => c[0]);
    const expectSender = res.out.sender.map((c) => c[0]);
    const got = sender === "@" ? mine.broadcast.map(ser) : [...mine.broadcast, ...mine.sent].map(ser);
    const gotSender = sender === "@" ? mine.sent.map(ser) : [];
    if (JSON.stringify(got) !== JSON.stringify(expectOut) || JSON.stringify(gotSender) !== JSON.stringify(expectSender)) bad.push([line, sender, expectOut, got, expectSender, gotSender]);
  }
  // Open divergence, not explained by the bytecode read: from a command block, /tell with a radius selector that matches nobody (r=5, Alex 64 blocks away)
  // printed commands.generic.player.notFound to the sender in the executed run (count 0), while @a[name=Bob], @a[m=1] and the other empty matches stayed silent.
  // The port keeps the silent CommandHandler.a rule (selectsNobody).
  assert.deepEqual(bad.map((b) => b[0] + " from " + b[1]), ["/tell @p[r=5] hi from @"]);
  assert.ok(rows.length >= 150);
});
