// Batch 70 sptab70: single-player Tab completion = the integrated server's answer to GuiChat's C14PacketTabComplete.
// Natively an integrated server runs the same NetHandlerPlayServer.func_147341_a -> MinecraftServer.func_71248_a -> CommandHandler.getPossibleCommands as a dedicated one (bytecode-read, see
// multiplayer/server-tabcomplete.js); only its command set (31 common + /publish, 35 lookup keys; executed in tabcomplete-reference.json `integrated`) and the owner's permission differ.
// The client side is RemoteTabCompletion (GuiChat's flow) driven synchronously: the reply arrives at once.
import { startsWithIgnoreCase, matchLast, canUse } from "./commands.js";
import { integratedCommandNames, INTEGRATED_BY_KEY, ALL_WORDS } from "./multiplayer/server-tabcomplete.js";

/**
 * MinecraftServer.func_71248_a on the integrated server. ctx: { name: the player's name, cheats: boolean, complete(textWithSlash): string[] (commands.js argument lists) }.
 */
export function spTabComplete(text, ctx) {
  if (!text.startsWith("/")) {
    const words = text.split(" ");
    return [ctx.name].filter((n) => startsWithIgnoreCase(words[words.length - 1], n));
  }
  const line = text.slice(1), parts = line.split(" ");
  if (parts.length === 1) return integratedCommandNames(parts[0], (c) => canUse(c, ctx.cheats)).map((s) => "/" + s);
  const command = INTEGRATED_BY_KEY.get(parts[0]);
  if (!command) return [];
  const args = parts.slice(1);
  if (ALL_WORDS.has(command.name)) return matchLast(args, [ctx.name]);
  return ctx.complete("/" + line); // no permission check for arguments (CommandHandler)
}
