// b54cn: death messages and the achievement broadcast take EntityPlayer.func_145748_c_ components (the "/msg <name> " suggest_command click) for the
// victim and a player attacker; a mob stays plain text. Rows are executed on the unchanged fq/fr/fn/fh/fk classes (ChatComponentProbe, tag b54cn); the
// trees are source-recalled, func_145748_c_ is bytecode-read. Scoreboard displays (sidebar, tab list) are strings natively (see the note).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeComponent, translation, text } from "./chat-component.js";
import { CombatTracker, damageSource } from "./combat-tracker.js";
import { deathComponent, senderComponent, withTeamName } from "./team-names.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/chat-component-reference.json", import.meta.url)));
const same = (name, c) => {
  const [, json, formatted, unformatted] = ref.rows.find((r) => r[0] === name);
  assert.equal(serializeComponent(c), json, name + " json");
  assert.equal(c.formatted(), formatted, name + " formatted");
  assert.equal(c.unformatted(), unformatted, name + " unformatted");
};
function kill(reason, source, from, formatted = "Steve") {
  const t = new CombatTracker(), src = damageSource(reason, source, from);
  t.record(src, 20, 20, 0, { alive: false });
  t.noteAttacker(src, 0);
  return deathComponent(t, formatted, { rawName: "Steve" });
}
const board = { formatName: (n) => (n === "Alex" ? "§9Alex§r" : n) };

test("a player killer and victim are player components with the /msg click (executed row)", () => {
  const alex = withTeamName({ type: "player", isPlayer: true, customName: "Alex" }, board);
  same("deathPlayerClick", kill("a player", "player", alex));
});

test("a mob killer is plain text; a team-formatted victim keeps the click on the raw name (executed row)", () => {
  same("deathMobPlayerVictim", kill("a zombie", "mob", { type: "zombie", customName: "Zombie" }, "§cSteve§r"));
});

test("the generic death and the achievement broadcast replay the executed rows", () => {
  same("deathGenericClick", deathComponent(new CombatTracker(), "Steve", { rawName: "Steve" }));
  same("achievementClick", translation("chat.type.achievement", senderComponent("Steve", "Steve"), (() => { const a = text("[Taking Inventory]"); a.style.color = "green"; return a; })()));
});
