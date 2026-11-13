// Chat and commands over several player records (batch 57): the broadcasts 1.7.10 sends to every player, and the command layer the dedicated server's chat channel uses.
// EntityPlayerMP.onDeath sends the CombatTracker message with ServerConfigurationManager.func_148539_a (to all players) when the showDeathMessages gamerule is on;
// StatisticsFile.func_150873_a sends chat.type.achievement the same way (recalled; the single-player print is main.js). /say and /me broadcast, /tell whispers.
import { translation } from "./chat-component.js";
import { senderComponent } from "./team-names.js";
import { lookupStat, statComponent } from "./commands-extra.js";
import { createCommandRunner, canUse } from "./commands.js";

// Deliver one component to every named player through send(name, component).
export function broadcastToAll(names, send, component) {
  for (const name of names) send(name, component);
}

// chat.type.achievement: the team-formatted player name (with its /msg click) and the achievement's hover component.
export const achievementComponent = (name, achievementId, formatted = name) =>
  translation("chat.type.achievement", senderComponent(formatted, name), statComponent(lookupStat("achievement." + achievementId)));

// A chat line starting with "/" on the dedicated server (no operators: permission level 0 only, so /tell and /me; /say and the rest answer with the permission text).
// players: [{ name, position: {x,y,z}, mode: 0|1|2, level }]. Returns [{ to: playerName, text }] with the legacy text the chat channel carries.
export function serverChatCommand(senderName, line, players) {
  const out = [];
  const records = players.map((p) => ({ name: p.name, position: () => p.position, mode: p.mode ?? 0, level: p.level ?? 0 }));
  const me = records.find((r) => r.name === senderName);
  const to = (name, text) => out.push({ to: name, text: String(text) });
  const host = {
    name: senderName, playerName: senderName, cheats: false, rules: {}, canUse: (command) => canUse(command, false),
    position: () => ({ ...me.position() }), players: () => records,
    print: (text) => to(senderName, text),
    broadcast: (text) => { for (const r of records) to(r.name, text); },
    deliver: (name, text) => to(name, text),
  };
  createCommandRunner(host).run(line);
  return out;
}
