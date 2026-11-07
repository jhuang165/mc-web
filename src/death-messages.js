import { printChat } from "./chat-ui.js";
import { translate } from "./lang.js";
import { entityDisplayName } from "./entity-names.js";
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

// DamageSource.func_151519_b with a known attacker (EntityDamageSource / EntityDamageSourceIndirect): "death.attack.<type>" with the
// victim as %1$s and the attacker's getCommandSenderName as %2$s; an attacker holding a renamed item uses the ".item" key and %3$s.
// English fallbacks are the en_US values (lang-en-us.js, pinned by death-messages.test.js).
export const ATTACK_TEXT = {
  mob: "%1$s was slain by %2$s",
  arrow: "%1$s was shot by %2$s",
  "arrow.item": "%1$s was shot by %2$s using %3$s",
  fireball: "%1$s was fireballed by %2$s",
  "fireball.item": "%1$s was fireballed by %2$s using %3$s",
  "explosion.player": "%1$s was blown up by %2$s",
  indirectMagic: "%1$s was killed by %2$s using magic",
  "indirectMagic.item": "%1$s was killed by %2$s using %3$s",
  magic: "%1$s was killed by magic",
  explosion: "%1$s blew up",
};
const fill = (text, ...args) => text.replace(/%(\d)\$s/g, (m, n) => args[n - 1] ?? m);
const sourceType = (reason, source) =>
  source === "fireball" || reason === "fireball" ? "fireball"
  : source === "explosion" || reason === "an explosion" ? "explosion"
  : reason === "an arrow" ? "arrow"
  : reason === "magic" ? "magic"
  : source === "mob" ? "mob" : null;
// What hit the player: an entity with a type is named by entity-names.js; a source with no living shooter (a dispenser arrow, a
// fireball with no owner) names the projectile itself, as EntityDamageSourceIndirect.getEntity falls back to it.
const attackerName = (type, attacker) => (attacker?.type ? entityDisplayName(attacker) : type === "arrow" ? translate("entity.Arrow.name", "arrow") : type === "fireball" ? translate("entity.Fireball.name", "Fireball") : null);

/** The chat line for a death. `ctx` ({ source, attacker, item }) names the DamageSource entity when the port knows it. */
export function deathMessage(reason, name = PLAYER_NAME, ctx = {}) {
  const type = sourceType(reason, ctx.source), who = type && attackerName(type, ctx.attacker);
  if (type && who) {
    const kind = type === "magic" ? "indirectMagic" : type === "explosion" ? "explosion.player" : type;
    const key = ctx.item && ATTACK_TEXT[kind + ".item"] ? kind + ".item" : kind;
    return fill(translate("death.attack." + key, ATTACK_TEXT[key]), name, who, ctx.item);
  }
  if (type === "magic" || type === "explosion") return fill(translate("death.attack." + type, ATTACK_TEXT[type]), name);
  const id = SOURCE[reason], text = id && translate("death.attack." + id, DEATH_TEXT[id]);
  return text ? fill(text, name) : null;
}

// Death, bed and command messages all print to the one GuiNewChat model (chat.js), drawn by chat-ui.js: 100 stored
// lines, wrapped to the chat width, shown for 200 ticks and faded over the last 20 unless the chat is open.
export function showChatLine(doc, text) {
  printChat(text);
  return null;
}
