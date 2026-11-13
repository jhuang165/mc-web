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
import { isComponent } from '../chat-component.js';

// The wire form of a line, as ServerSocial.command delivers it (chatMessage is passed in to avoid a module cycle).
const wire = (chatMessage, message) => (typeof message === 'string' || isComponent(message) ? chatMessage(message) : message);

// One cart's run. `social` is the ServerSocial; `commands` is its SERVER_COMMANDS set.
export function runCartCommand(social, cart, { commands, chatMessage }) {
  const sim = social.simulation, tile = cart.command;
  if (!tile) return 0;
  if (!sim.commandBlocks) { tile.successCount = 0; return 0; } // MinecraftServer.isCommandBlockEnabled is false: agp.a(World) sets the count to 0
  const pos = cartCommandPosition(cart);
  let near = null, nd = Infinity;
  for (const p of sim.players.values()) { if (p.dimension) continue; const d = (p.position.x - pos.x) ** 2 + (p.position.y - pos.y) ** 2 + (p.position.z - pos.z) ** 2; if (d < nd) { nd = d; near = p; } }
  if (!near) { tile.successCount = 0; return 0; } // nobody is here to read the output or to be a target
  const roster = [...sim.players.values()].map(p => ({ name: p.name, position: { x: p.position.x, y: p.position.y, z: p.position.z }, mode: p.survival.mode === 'creative' ? 1 : p.survival.mode === 'adventure' ? 2 : 0 }));
  const records = roster.map(r => ({ name: r.name, position: () => r.position, mode: r.mode, level: 0 }));
  const toOps = (message) => { for (const r of records) if (social.isOp(r.name)) social.toPlayer(r.name, wire(chatMessage, message)); };
  const forPlayer = name => social.playerOps(social.idOf(name), (n, m) => social.toPlayer(n, wire(chatMessage, m)));
  const base = Object.assign(Object.create(forPlayer(near.name)), {
    name: near.name, playerName: near.name, cheats: true, unsupported: { has: n => !commands.has(n) },
    players: () => records, forPlayer,
    positionOf: name => { const p = sim.players.get(social.idOf(name)); return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : undefined; },
    seed: () => sim.world.seed,
    print: (t, c) => toOps(c ?? t), broadcast: (t, c) => { for (const r of records) social.toPlayer(r.name, wire(chatMessage, c ?? t)); },
    deliver: (name, t, c) => social.toPlayer(name, wire(chatMessage, c ?? t)), feedback: (t, c) => toOps(c ?? t),
  });
  Object.defineProperties(base, Object.getOwnPropertyDescriptors(worldHost(sim)));
  base.listPlayers = uuids => ({ names: [...sim.players.values()].map(q => (uuids ? `${q.name} (${q.resumeKey})` : q.name)), max: base.maxPlayers });
  base.printTo = (name, component) => social.toPlayer(name, wire(chatMessage, component));
  const sender = commandBlockSender(base, tile, pos);
  tile.outputChanged = () => { tile.watch24 = tile.lastOutput; };
  try { tile.successCount = tile.command ? (createCommandRunner(sender).run(tile.command) ? 1 : 0) : 0; } finally { delete tile.outputChanged; }
  return tile.successCount;
}

// MC|AdvCdm type 1 (nh.a(ez)): a Creative operator sets the command text of a command cart (and the cart re-reads LastOutput into watcher 24); false when it is refused.
export function setCartCommand(social, id, key, command) {
  const sim = social.simulation, p = sim.players.get(id), cart = sim.vehicles.find(key);
  if (!p || !cart || cart.boat || cart.type !== 6 || typeof command !== 'string' || command.length > 32767) return false;
  if (!sim.commandBlocks || !social.isOp(p.name) || !p.survival.creative) return false;
  const b = cart.bb, dx = (b[0] + b[3]) / 2 - p.position.x, dy = (b[1] + b[4]) / 2 - (p.position.y + 1.62), dz = (b[2] + b[5]) / 2 - p.position.z;
  if (dx * dx + dy * dy + dz * dz > 64) return false;
  cart.command.command = command;
  cart.command.watch24 = cart.command.lastOutput ?? 'null';
  return true;
}
export { SERVER_WORLD_COMMANDS };
