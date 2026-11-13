// A playerOp message of the dedicated server (src/server-broadcast.js playerOps): a command an operator ran on this player, applied to the client's own
// survival state. The server mirrors only what it holds (game mode, hotbar, effects, position); the inventory, experience and health live here.
const ALLOWED = new Set(["setGameMode", "kill", "give", "clear", "addExperience", "addLevels", "addEffect", "removeEffect", "clearEffects"]);
export function applyPlayerOp(message, { survival, experience, commandHost, renderHotbar, renderVitals, makeStack }) {
  if (!ALLOWED.has(message?.op) || !Array.isArray(message.args)) return false;
  const [a, b, c] = message.args;
  switch (message.op) {
    case "setGameMode": if (["survival", "creative", "adventure"].includes(a)) commandHost.setGameMode(a); break;
    case "kill": commandHost.kill(); break;
    case "give": {
      if (!a || !Number.isInteger(a.id) || !Number.isInteger(a.count) || a.count < 1 || a.count > 64) return false;
      const stack = makeStack(a.id, a.count, Number.isInteger(a.damage) ? a.damage : 0);
      if (survival.inventory.add(stack)) { renderHotbar(); renderVitals(); }
      break;
    }
    case "clear": {
      for (const list of [survival.inventory.main, survival.inventory.armor]) for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s && (a === -1 || (s.id === a && (b === -1 || (s.damage ?? 0) === b)))) list[i] = null;
      }
      renderHotbar(); renderVitals();
      break;
    }
    case "addExperience": if (Number.isInteger(a)) { experience.add(a); renderVitals(); } break;
    case "addLevels": if (Number.isInteger(a)) { experience.addLevels(a); renderVitals(); } break;
    case "addEffect": if (Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c)) commandHost.addEffect(a, b, c); break;
    case "removeEffect": commandHost.removeEffect(a); break;
    case "clearEffects": commandHost.clearEffects(); break;
  }
  return true;
}
