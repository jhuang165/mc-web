// BlockCommandBlock (akb), TileEntityCommandBlock/CommandBlockLogic (aox/agp), Java 1.7.10.
// Original block 137; internal 139 (internal 137 already denotes an activator rail).
import { createCommandRunner } from './commands.js';
import { ruleOn } from './game-rules.js';
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { getStringAny } from './nbt-string.js'; // Command is NBTTagCompound.getString: any tag reads as its toString (b79 falling79, executed)
import { serializeComponent, translation, text as textComponent, componentFromLegacy, normalizeLastOutput, lastOutputPlainText, LastOutputError } from './chat-component.js';
export const COMMAND_BLOCK = 139, COMMAND_BLOCK_ITEM = 1139, COMMAND_BLOCK_ID = 137;
export const newCommandBlock = () => ({ command: '', successCount: 0, customName: '@', trackOutput: true, lastOutput: null });
export { normalizeLastOutput, lastOutputPlainText };
export function readCommandBlock(tag) {
  return { command: getStringAny(tag, 'Command'), successCount: nbtGet(tag, 'SuccessCount', NBT.INT, 0), customName: nbtGet(tag, 'CustomName', NBT.STRING, '@'), trackOutput: tag.get('TrackOutput')?.type === NBT.BYTE ? !!nbtGet(tag, 'TrackOutput', NBT.BYTE, 1) : true, lastOutput: normalizeLastOutput(nbtGet(tag, 'LastOutput', NBT.STRING, null)) };
}
export function writeCommandBlock(tile, x, y, z) {
  const t = (type, value) => ({ type, value });
  const map = new Map([['id', t(NBT.STRING, 'Control')], ['x', t(NBT.INT, x)], ['y', t(NBT.INT, y)], ['z', t(NBT.INT, z)], ['Command', t(NBT.STRING, tile.command)], ['SuccessCount', t(NBT.INT, tile.successCount)], ['CustomName', t(NBT.STRING, tile.customName)], ['TrackOutput', t(NBT.BYTE, tile.trackOutput ? 1 : 0)]]);
  if (tile.lastOutput != null) map.set('LastOutput', t(NBT.STRING, tile.lastOutput));
  return map;
}
// CommandBase.notifyAdmins: ChatComponentTranslation("chat.type.admin", sender name, the message), gray and italic.
export function adminComponent(senderName, component) {
  const c = translation('chat.type.admin', senderName, component);
  Object.assign(c.style, { color: 'gray', italic: true });
  return c;
}
export function commandBlockSender(host, tile, position, { now = () => new Date() } = {}) {
  const sender = Object.create(host);
  Object.defineProperties(sender, { name: { value: tile.customName }, isCommandBlock: { value: true }, playerName: { value: host.playerName ?? host.name, writable: true }, cheats: { value: true } }); // b81 mpcmd81: writable, so the server's redirect (commands.js dispatch: Object.assign(sub, { playerName })) can shadow it; read-only it threw, and /give, /tp, /gamemode ... on another player from a server command block failed with commands.generic.exception
  sender.canUse = command => command.permission <= 2;
  sender.position = () => ({ ...position });
  // The player-state base's own position (CommandSetSpawnpoint reads the TARGET's EntityPlayerMP.getPlayerCoordinates, bytecode-read bp.b). b82 mpcmd82: a getter, because the server's
  // redirect (commands.js dispatch) builds its target host on top of this sender and copies the target's `position` onto it; the inherited `() => host.position()` kept reading the base
  // (nearest) player, so `/spawnpoint <other>` from a server block set the other player's spawn at the base player's block. On the redirected host it is now the target's position.
  Object.defineProperty(sender, 'playerPosition', { configurable: true, get() { return this.redirected ? () => this.position() : () => host.position(); } });
  // CommandBlockLogic.addChatMessage (agp.a(fj)): with TrackOutput, LastOutput = ChatComponentText("[" + HH:mm:ss + "] ").appendSibling(component), serialized.
  // `component` is the IChatComponent the command sent; a message with only text becomes a ChatComponentText (a leading colour code its colour).
  sender.print = (message, component) => {
    if (!tile.trackOutput) return;
    const d = now(), time = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    const root = textComponent(`[${time}] `);
    root.append(component ?? componentFromLegacy(String(message)));
    tile.lastOutput = serializeComponent(root);
    tile.outputChanged?.(); // a command cart's CommandBlockLogic.func_145756_e (agp.e) copies the output to watcher 24
  };
  // ServerCommandManager.func_152372_a (bl.a(ac, aa, int, String, Object[]), bytecode-read b83): the rule suppresses op feedback, never the sender's tracked output; a flag with
  // bit 0 set (only CommandGameMode passes 1) skips the sender's own addChatMessage, so the block keeps its previous LastOutput (b83 cmdblock83: it recorded the success line).
  sender.feedback = (text, component, flags = 0) => {
    if ((flags & 1) !== 1) sender.print(text, component);
    if (ruleOn({ gameRules: host.rules }, 'commandBlockOutput') && host.cheats) host.print(`§7§o[${tile.customName}: ${text}]`, adminComponent(tile.customName, component ?? componentFromLegacy(String(text))));
  };
  sender.broadcast = (text, component) => { host.print(text, component); };
  // b83 cmdblock83: a line for the TARGET player (CommandGameMode's S2B state 3, which the target's client shows as gameMode.changed) never reaches the block's LastOutput.
  // A server host delivers it to the player-state base (the target when not redirected; the redirect sets its own targetPrint), single player prints it to the one player.
  sender.targetPrint = (text, component) => { if (host.deliver) host.deliver(sender.playerName, text, component); else host.print(text, component); }; // called detached (commands.js gamemode)
  return sender;
}
export function installCommandBlocks(redstone, { host, changed = () => {} } = {}) {
  const tiles = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const tile = (x, y, z) => {
    const k = key(x, y, z);
    if (!tiles.has(k)) tiles.set(k, newCommandBlock());
    return tiles.get(k);
  };
  redstone.registerBehaviour(COMMAND_BLOCK_ID, {
    onNeighborBlockChange(w, x, y, z) {
      const powered = w.isBlockIndirectlyGettingPowered(x, y, z), meta = w.getBlockMetadata(x, y, z), was = !!(meta & 1);
      if (powered && !was) { w.setBlockMetadataWithNotify(x, y, z, meta | 1, 4); w.scheduleBlockUpdate(x, y, z, COMMAND_BLOCK_ID, 1); }
      else if (!powered && was) w.setBlockMetadataWithNotify(x, y, z, meta & ~1, 4);
    },
    updateTick(w, x, y, z) {
      const t = tile(x, y, z), sender = commandBlockSender(host(), t, { x, y, z });
      t.successCount = createCommandRunner(sender).count(t.command); // b81 mpcmd81: z.a's count of runs (one per player an @a selector matched)
      w.updateNeighbourForOutputSignal(x, y, z, COMMAND_BLOCK_ID);
      changed();
    },
    comparator: (w, x, y, z) => tile(x, y, z).successCount,
    breakBlock(w, x, y, z) { if (w.getBlock(x, y, z) !== COMMAND_BLOCK_ID) tiles.delete(key(x, y, z)); },
  });
  return { tile, get: (x, y, z) => tiles.get(key(x, y, z)) ?? null, save: () => [...tiles].filter(([k]) => { const p = k.split(',').map(Number); return !redstone.loaded?.(...p) || redstone.getBlock(...p) === COMMAND_BLOCK_ID; }).map(([k, value]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, ...value }; }),
    restore(records) { tiles.clear(); for (const e of records ?? []) if ([e.x, e.y, e.z].every(Number.isInteger)) { const { x, y, z, ...value } = e; try { tiles.set(key(x, y, z), { ...newCommandBlock(), ...value, lastOutput: normalizeLastOutput(value.lastOutput) }); } catch (err) { if (!(err instanceof LastOutputError)) throw err; /* agp.b threw: the block does not load */ } } } };
}
