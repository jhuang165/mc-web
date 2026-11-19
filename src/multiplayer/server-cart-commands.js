// The command block minecart on the dedicated server (batch 63 mpvehicles3). The single-player rules are reused: cart-variants.js activatorPass (the powered activator rail runs
// the cart's command at most once per 4 ticks), command-block.js commandBlockSender (the cart is the sender: its custom name, its position, TrackOutput / LastOutput) and the
// command runner. Native facts (bytecode-read, jar SHA1 e80d9b3b): EntityMinecartCommandBlock.interactFirst (xn.c) only opens the GUI on the client and then calls EntityMinecart's
// own interactFirst, which does nothing (the cart cannot be ridden); the cart's logic runs only when MinecraftServer.isCommandBlockEnabled (agp.a(World) reads MinecraftServer.ad(); the
// dedicated property enable-command-block defaults to false, so successCount stays 0 otherwise). The item (id 422) places like any minecart and is obtained only by /give; MC|AdvCdm
// (type 1: the entity's id) sets the command for a Creative operator.
// The server queues the runs in `ServerVehicles.cartCommands` (an activator pass happens inside the vehicle tick); `ServerSocial.drain()` runs them through `runQueued`. Output goes to
// the operators as chat.type.admin (the commandBlockOutput rule), the same text a command block gives.
import { createCommandRunner } from '../commands.js';
import { commandBlockSender } from '../command-block.js';
import { cartCommandPosition } from '../command-cart.js';
import { worldHost, SERVER_WORLD_COMMANDS } from '../servercommands-b59.js';
import { isComponent, translation } from '../chat-component.js';
import { summonHost } from './server-summon.js'; // b67 mpsummon
import { worldCommandsHost } from './server-worldcmds.js'; // b68 mpworldcmds

// The wire form of a line, as ServerSocial.command delivers it (chatMessage is passed in to avoid a module cycle).
const wire = (chatMessage, message) => (typeof message === 'string' || isComponent(message) ? chatMessage(message) : message);

// One cart's run. `social` is the ServerSocial; `commands` is its SERVER_COMMANDS set.
export function runCartCommand(social, cart, { commands, chatMessage, dim = 0 }) {
  const tile = cart.command;
  if (!tile) return 0;
  if (!social.simulation.commandBlocks) { tile.successCount = 0; return 0; } // MinecraftServer.isCommandBlockEnabled is false: agp.a(World) sets the count to 0
  tile.outputChanged = () => { tile.watch24 = tile.lastOutput; };
  try { return runCommandLogic(social, tile, cartCommandPosition(cart), { commands, chatMessage, dim, skipEmpty: true }); } finally { delete tile.outputChanged; }
}

// The carts an activator rail triggered this tick, in every dimension. b81 mpcmd81: the Nether's and the End's carts queue in their own ServerVehicles, which nothing drained (their
// commands never ran and the queue grew); they now run inside that dimension's swap (sim.world, sim.vehicles ... are the lane's), as the cart's own world (xo's ahb) runs them natively.
export function drainCartCommands(social, opts) {
  const sim = social.simulation, dims = sim.dimensions;
  for (const cart of sim.vehicles?.cartCommands?.splice(0) ?? []) if (!cart.dead) runCartCommand(social, cart, { ...opts, dim: 0 });
  for (const [n, dim] of [[dims?.nether, -1], [dims?.end?.n, 1]]) {
    const queued = n?.vehicles?.cartCommands?.splice(0) ?? [];
    if (queued.length) dims.swap(n, () => { for (const cart of queued) if (!cart.dead) runCartCommand(social, cart, { ...opts, dim: n.dim ?? dim }); });
  }
}

// b80 mpcmd80: one CommandBlockLogic run (agp.a(ahb)) of a cart or a command block `tile` at `pos` in dimension `dim`, through the server's command runner; returns and stores
// the success count. The sender is commandBlockSender (permission level 2, the tile's name and position, TrackOutput / LastOutput); a command this server does not hold answers
// "not available". `skipEmpty`: the cart's empty command counts 0 without a run (b63); a command block runs "" like native executeCommand (commands.generic.notFound into its LastOutput).
// A tile's `outputChanged` hook (set by the caller) sees each tracked output line.
// b81 mpcmd81: the count is z.a's (one per player an expanding selector matched, CommandHandler.executeCommand bytecode-read), not 1 or 0. The run no longer needs a player in the
// dimension: native runs the block whenever its chunk ticks (WorldServer.tickUpdates), with nobody online at all. The world, /summon and /setblock hosts are anchored on the block
// itself (`anchor`: its dimension and position), so /summon ~ ~ ~ is relative to the block (CommandSummon reads the sender's getPlayerCoordinates), not to the nearest player as
// before. The player-state base (forPlayer: give, tp, gamemode ... on a target) is the nearest player of the dimension, else any online player; with nobody online the selectors
// and names match nobody, and only commands without a player target act.
export function runCommandLogic(social, tile, pos, { commands, chatMessage, dim = 0, skipEmpty = false }) {
  const sim = social.simulation;
  if (!sim.commandBlocks) { tile.successCount = 0; return 0; }
  let near = null, nd = Infinity;
  for (const p of sim.players.values()) { if ((p.dimension | 0) !== dim) continue; const d = (p.position.x - pos.x) ** 2 + (p.position.y - pos.y) ** 2 + (p.position.z - pos.z) ** 2; if (d < nd) { nd = d; near = p; } }
  near ??= sim.players.values().next().value ?? null; // the target base only; no world state is read from it
  const anchor = { dimension: dim, position: { x: pos.x, y: pos.y, z: pos.z }, survival: {} }; // ServerDimensions.within swaps tile maps on `survival` (a no-op object here)
  const roster = [...sim.players.values()].map(p => ({ name: p.name, position: { x: p.position.x, y: p.position.y, z: p.position.z }, mode: p.survival.mode === 'creative' ? 1 : p.survival.mode === 'adventure' ? 2 : 0 }));
  const records = roster.map(r => ({ name: r.name, position: () => r.position, mode: r.mode, level: 0 }));
  const toOps = (message) => { for (const r of records) if (social.isOp(r.name)) social.toPlayer(r.name, wire(chatMessage, message)); };
  const forPlayer = name => social.playerOps(social.idOf(name), (n, m) => social.toPlayer(n, wire(chatMessage, m)));
  const base = Object.assign(Object.create(near ? forPlayer(near.name) : {}), {
    name: near?.name ?? '', playerName: near?.name ?? '', cheats: true, unsupported: { has: n => !commands.has(n) },
    players: () => records, forPlayer,
    positionOf: name => { const p = sim.players.get(social.idOf(name)); return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : undefined; },
    lookOf: name => { const p = sim.players.get(social.idOf(name)); return p ? { yaw: p.yaw, pitch: p.pitch } : undefined; }, // b84 cmdfix84: /tp <player> <target> copies the target's rotation
    seed: () => sim.world.seed,
    print: (t, c) => toOps(c ?? t), broadcast: (t, c) => { for (const r of records) social.toPlayer(r.name, wire(chatMessage, c ?? t)); },
    deliver: (name, t, c) => social.toPlayer(name, wire(chatMessage, c ?? t)), feedback: (t, c) => toOps(c ?? t),
  });
  Object.defineProperties(base, Object.getOwnPropertyDescriptors(worldHost(sim)));
  base.listPlayers = uuids => ({ names: [...sim.players.values()].map(q => (uuids ? `${q.name} (${q.resumeKey})` : q.name)), max: base.maxPlayers });
  base.printTo = (name, component) => social.toPlayer(name, wire(chatMessage, component));
  Object.defineProperties(base, Object.getOwnPropertyDescriptors(summonHost(sim, anchor))); // b67 mpsummon: /summon from a command block or cart (b81: at the block's own position)
  Object.defineProperties(base, Object.getOwnPropertyDescriptors(worldCommandsHost(sim, anchor, forPlayer))); // b68 mpworldcmds
  const sender = commandBlockSender(base, tile, pos);
  tile.successCount = tile.command || !skipEmpty ? createCommandRunner(sender).count(tile.command) : 0;
  return tile.successCount;
}

// MC|AdvCdm type 1 (nh.a(iz), bytecode-read b81 mpcmd81): MinecraftServer.isCommandBlockEnabled false -> advMode.notEnabled; else the sender needs canCommandSenderUseCommand(2, "")
// (an op of level 2 or more) and Creative, else advMode.notAllowed; then World.getEntityByID in the sender's own world (mw.o) must be an EntityMinecartCommandBlock (xn), else
// nothing is said; then agp.a(String), xo.e() (watchers 23 and 24) and advMode.setCommand.success with the command. There is no distance check (the port's old 8-block reach is gone).
// Returns the chat component for the sender (null: nothing is said). A text over 32767 characters cannot arrive natively (C17's payload stays under 32767 bytes) and is dropped silently.
export function setCartCommand(social, id, key, command) {
  const sim = social.simulation, p = sim.players.get(id);
  if (!p || typeof command !== 'string' || command.length > 32767) return null;
  if (!sim.commandBlocks) return translation('advMode.notEnabled');
  if (!social.isOp(p.name) || social.opLevel(p.name) < 2 || !p.survival.creative) return translation('advMode.notAllowed');
  const find = () => sim.vehicles?.find(key) ?? null, cart = sim.dimensions ? sim.dimensions.within(p, find) : find(); // the cart of the sender's own dimension
  if (!cart || cart.boat || cart.type !== 6 || !cart.command) return null;
  cart.command.command = command;
  cart.command.watch24 = cart.command.lastOutput ?? 'null';
  return translation('advMode.setCommand.success', command);
}
export { SERVER_WORLD_COMMANDS };
