import { printChat } from "./chat-ui.js";
// The 1.7.10 death message. EntityPlayerMP.onDeath [mw.a(ro)] first broadcasts
// CombatTracker.func_151521_b [rn.b()] to chat; GuiGameOver [bdc] itself shows only the title
// and the score. When the last hit is not a fall, the text is DamageSource.func_151519_b:
// "death.attack.<type>", or "death.attack.<type>.player" naming the entity that last attacked
// the player when that key exists. player-damage-reference.json records the original text of
// each source alone and after a zombie hit.
//
// Sources with no ".player" form that this build can produce are mapped here; causes whose
// death text requires a tracked attacker still return null.
export const DEATH_TEXT = {
  inWall: "%1$s suffocated in a wall",
  starve: "%1$s starved to death",
  outOfWorld: "%1$s fell out of the world",
  anvil: "%1$s was squashed by a falling anvil",
};
// Survival.lastDamage reasons and the DamageSource each one is.
const SOURCE = { suffocation: "inWall", starvation: "starve", void: "outOfWorld", anvil: "anvil" };

// This build has no account name; "Player" stands in for the profile name.
export const PLAYER_NAME = "Player";

export function deathMessage(reason, name = PLAYER_NAME) {
  const text = DEATH_TEXT[SOURCE[reason]];
  return text ? text.replace("%1$s", name) : null;
}

// Death, bed and command messages all print to the one GuiNewChat model (chat.js), drawn by chat-ui.js: 100 stored
// lines, wrapped to the chat width, shown for 200 ticks and faded over the last 20 unless the chat is open.
export function showChatLine(doc, text) {
  printChat(text);
  return null;
}
