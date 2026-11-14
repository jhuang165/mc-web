// Skins for player heads (block, worn on a player, worn on a zombie or skeleton). Native (TileEntitySkullRenderer bms.a, bytecode-read):
// a type 3 head with a GameProfile asks SkinManager.func_152790_a for the profile's textures and binds its SKIN, else it binds the
// default Steve skin (field f). This port has no Mojang lookup (no network), so a profile is matched by name against the skins the
// game already holds: the signed-in player's own and those of the other multiplayer players. Anything else stays Steve, as native
// does while no lookup has answered. Matching by name is this port's stand-in for the textures property; it is not native.
import { skullProfileOfStack } from "./skull.js";

export class SkinBook {
  constructor() { this.sources = new Set(); }
  // A source has skinOf(lowerCaseName): a loaded THREE.Texture or null.
  add(source) { this.sources.add(source); return source; }
  remove(source) { this.sources.delete(source); }
  // The skin texture of a profile ({ name }) or a bare name, or null (draw Steve).
  lookup(profile) {
    const name = typeof profile === "string" ? profile : profile?.name;
    if (typeof name !== "string" || !name) return null;
    const key = name.toLowerCase();
    for (const s of this.sources) { const t = s.skinOf(key); if (t) return t; }
    return null;
  }
}
export const skinBook = new SkinBook();
// The skin of the head in a stack (a worn player head with a SkullOwner), or null.
export const stackSkin = (stack, book = skinBook) => (stack ? book.lookup(skullProfileOfStack(stack)) : null);
// A cache-key part: changes when the skin that would be drawn changes.
export const stackSkinKey = (stack, book = skinBook) => stackSkin(stack, book)?.uuid ?? "";
