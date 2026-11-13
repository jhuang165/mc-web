// b53ct: /tell, /say, /me and player chat build the component trees 1.7.10 sends (CommandMessage, CommandBroadcast, CommandServerEmote,
// NetHandlerPlayServer.processChatMessage; source-recalled, the classes are not in the client jar). The executed part is how the unchanged
// fq/fr/fn/fh/fk classes format and serialize those trees (tools/probes/ChatComponentProbe.java -> chat-component-reference.json); EntityPlayer.func_145748_c_
// (suggest_command "/msg <name> ", no hover) is bytecode-read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeComponent } from "./chat-component.js";
import { createCommandRunner } from "./commands.js";
import { ChatLog } from "./chat.js";
import { chatTextComponent } from "./team-names.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/chat-component-reference.json", import.meta.url)));
const row = (n) => ref.rows.find((r) => r[0] === n);
const same = (name, c) => {
  const [, json, formatted, unformatted] = row(name);
  assert.equal(serializeComponent(c), json, name + " json");
  assert.equal(c.formatted(), formatted, name + " formatted");
  assert.equal(c.unformatted(), unformatted, name + " unformatted");
};
function run(line, opts = {}) {
  const sent = [], broadcast = [];
  const host = { name: "Steve", cheats: true, rules: {}, print: (t, c) => sent.push(c ?? t), broadcast: (t, c) => broadcast.push(c ?? t), position: () => ({ x: 0, y: 64, z: 0 }), ...opts };
  createCommandRunner(host).run(line);
  return { sent, broadcast };
}

test("/say and /me: the sender's component and a word-sibling message (replayed)", () => {
  // executed (cmd-chat-reference.json): CommandBroadcast passes the plain sender name, not the click component; the message siblings are the same
  const say = run("/say hi there").broadcast[0];
  assert.equal(say.args[0], "Steve");
  assert.equal(serializeComponent(say.args[1]), '{"extra":["hi"," ","there"],"text":""}');
  same("emoteWords", run("/me waves hello").broadcast[0]);
});

test("a command block's /say expands selectors to the player's name and has no click on its own name", () => {
  const block = run("/say hi @p", { name: "@", isCommandBlock: true, playerName: "Steve" }).broadcast[0];
  same("sayBlockSelector", block);
  // a player's /say does not stay literal either: CommandBroadcast always allows selectors
  assert.equal(run("/say @p[r=1]").broadcast[0].unformatted(), "[Steve] Steve");
  assert.equal(run("/say hello @a").broadcast[0].args[1].unformatted(), "hello Steve");
});

test("a selector that matches nobody is a player-not-found error", () => {
  assert.equal(run("/say @p[name=Nobody]").broadcast.length, 0);
  // executed: /me expands selectors for a player sender too (cmd-chat-reference.json)
  assert.equal(run("/me @p").broadcast[0].unformatted(), "* Steve Steve");
});

test("/tell: gray italic incoming for the target, outgoing for the sender (replayed)", () => {
  // the sender is a command block "@" (the only sender whose target differs from itself in one world); the target is the player
  const { sent, broadcast } = run("/tell Steve hi there", { name: "@", isCommandBlock: true, playerName: "Steve" });
  same("tellFromBlock", broadcast[0]);
  assert.equal(sent[0].formatted(), "§7§oYou whisper to §r§7§oSteve§r§7§o: §r§7§o§r§7§ohi§r§7§o §r§7§othere§r");
  assert.equal(sent[0].style.color, "gray");
  assert.equal(sent[0].style.italic, true);
  assert.equal(sent[0].args[0].style.click.value, "/msg Steve ");
});

test("/tell to yourself is still commands.message.sameTarget", () => {
  const { sent, broadcast } = run("/tell Steve hi");
  assert.equal(broadcast.length, 0);
  assert.match(String(sent[0].unformatted?.() ?? sent[0]), /yourself|message|same/i);
});

test("player chat: the name is a component with the /msg click, the message a plain string (replayed)", () => {
  same("chatTextClick", chatTextComponent("Steve", "hello"));
  same("chatTextTeam", chatTextComponent("§c[Red] Steve§r", "hello", "Steve"));
  assert.equal(chatTextComponent("Steve", "hello").args[1], "hello");
});

test("the chat window returns the click of the name: a left click suggests /msg <name> ", () => {
  const log = new ChatLog();
  log.print(chatTextComponent("Steve", "hello"));
  const click = log.clickAt(10, 0); // inside "Steve", after the "<"
  assert.deepEqual({ action: click.action, value: click.value }, { action: "suggest_command", value: "/msg Steve " });
  assert.equal(log.clickAt(1, 0), null);
});
