// Scoreboard-team formatting of names in death messages and chat (Minecraft Java 1.7.10).
// Probed (TeamNameProbe, public/research/team-names-reference.json, 329 records on the unchanged classes and a real Scoreboard):
//   Entity.func_145748_c_ (sa.c_) is a plain ChatComponentText of the name for every non-player entity: a mob whose custom name equals a team
//   member's name is NOT formatted (bytecode-read too: sv.bt returns null, only EntityPlayer.bt looks the team up).
//   EntityPlayer.func_145748_c_ (yz.c_) is ChatComponentText(ScorePlayerTeam.formatPlayerName(team, name)) = prefix + name + suffix, with a /msg click.
//   So the victim, an attacking player (mob/player/arrow/thorns/explosion/fireball sources), the own-arrow shooter, fall assists and revenge
//   (".player") texts all print the formatted player name, and a mob or tame wolf never does.
//   Every argument of the ChatComponentTranslation is its own component and the chat draws getFormattedText, which appends "§r" after each
//   component (arguments and literal runs alike), so a team prefix without a closing "§r" cannot colour the rest of the line.
import { translation, text } from "./chat-component.js";

/** The death message of a CombatTracker as the chat component EntityPlayerMP.onDeath broadcasts (ChatComponentTranslation of key + arguments).
 *  `name` is EntityPlayer.func_145748_c_ for the victim: scoreboard.formatName(PLAYER_NAME). */
export function deathComponent(tracker, name, ctx = {}) {
  let { key, args } = tracker.message({ name, selfItem: ctx.selfItem ?? null });
  // ItemStack.func_151000_E: "[" + name + "]" as one component in the rarity colour (probed: "§f[§r§fSting§r§f]§r"; the port gives every stack the
  // common colour, so a rare/epic or enchanted named stack would print aqua/light purple natively).
  if (key.endsWith(".item") && args.length === 3) {
    const item = text("[").append(text(args[2].slice(1, -1))).append(text("]"));
    item.style.color = "white";
    args = [args[0], args[1], item];
  }
  return translation(key, ...args);
}

/** EntityPlayer.func_145748_c_ (yz.c_, bytecode-read): a ChatComponentText of the team-formatted name whose style holds a suggest_command click
 *  "/msg <raw name> " (fi.e, no hover event). Any other sender's component is a plain text (`raw` omitted). */
export function senderComponent(formattedName, raw) {
  const c = text(formattedName);
  if (raw != null) c.style.click = { action: "suggest_command", value: "/msg " + raw + " " };
  return c;
}

/** The chat line "<name> message" (NetHandlerPlayServer.processChatMessage: ChatComponentTranslation("chat.type.text", the sender's func_145748_c_,
 *  the message as a plain string); `rawName` is the player's own name when `formattedName` carries a team prefix or suffix. */
export const chatTextComponent = (formattedName, message, rawName = formattedName) => translation("chat.type.text", senderComponent(formattedName, rawName), message);

/** A player attacker as combat-tracker.js reads it: only a player carries its team-formatted name (`scoreboard.formatName`); any other entity keeps
 *  its plain name even when a team lists that name. */
export function withTeamName(raw, scoreboard) {
  if (!raw?.isPlayer) return raw;
  return { ...raw, formattedName: scoreboard.formatName(raw.customName ?? raw.name ?? "Player") };
}
