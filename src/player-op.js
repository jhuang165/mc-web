// A playerOp message of the dedicated server (src/server-broadcast.js playerOps): a command an operator ran on this player, applied to the client's own
// survival state. The server mirrors only what it holds (game mode, hotbar, effects, position); the inventory, experience and health live here.
import { clearMatcher } from "./command-host.js";
const ALLOWED = new Set(["setGameMode", "kill", "give", "clear", "addExperience", "addLevels", "addEffect", "removeEffect", "clearEffects", "enchant"]);
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
    case "clear": { // b83 cmdexec83: a is the original Item id (-1 any), b the data value (-1 any); InventoryPlayer.clearInventory also takes the cursor stack
      if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
      const match = clearMatcher(a, b), inv = survival.inventory;
      for (const list of [inv.main, inv.armor ?? []]) for (let i = 0; i < list.length; i++) if (match(list[i])) list[i] = null;
      if (inv.cursor && match(inv.cursor)) inv.cursor = null;
      renderHotbar(); renderVitals();
      break;
    }
    case "addExperience": if (Number.isInteger(a)) { experience.add(a); renderVitals(); } break;
    case "addLevels": if (Number.isInteger(a)) { experience.addLevels(a); renderVitals(); } break;
    case "addEffect": if (Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c)) commandHost.addEffect(a, b, c); break;
    case "removeEffect": commandHost.removeEffect(a); break;
    case "clearEffects": commandHost.clearEffects(); break;
    case "enchant": if (Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a < 256 && b >= 1 && b <= 255) commandHost.enchant(a, b); break;
  }
  return true;
}
