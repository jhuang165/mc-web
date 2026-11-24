import java.lang.reflect.*;
import java.util.*;
// b99 tiles99: unchanged 1.7.10 classes. An item stack whose `tag` holds a KNOWN key with the wrong type (ench as a string, display as an int, RepairCost as a
// string ...) through a chest (TileEntity.createAndLoadEntity aor.c, writeToNBT aor.b = ItemStack.readFromNBT / writeToNBT). Plus the accessors the game calls on such a stack.
public class Tiles99Probe {
  static Object tag(Object... kv) throws Exception { return Tiles95Probe.tag(kv); }
  static Object list(Object... i) throws Exception { return Tiles95Probe.list(i); }
  static Object itemTag(int slot, int id, int count, int damage, Object t) throws Exception { Object c = Tiles95Probe.item(slot, id, count, damage); Tiles95Probe.put(c, "tag", t); return c; }
  static void chest(String label, int id, Object t) throws Exception { Tiles95Probe.run(label, "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, id, 1, 0, t)))); }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null);
    Tiles95Probe.DH = Class.forName("dh"); Tiles95Probe.DQ = Class.forName("dq"); Tiles95Probe.DY = Class.forName("dy"); Tiles95Probe.TE = Class.forName("aor");
    chest("ench string", 276, tag("ench", "oops"));
    chest("ench int", 276, tag("ench", 5));
    chest("ench list of ints", 276, tag("ench", list(tag("id", 16))));
    chest("ench list of compounds ok", 276, tag("ench", list(tag("id", (short) 16, "lvl", (short) 2))));
    chest("ench compound entries wrong type", 276, tag("ench", list(tag("id", "16", "lvl", 2))));
    chest("StoredEnchantments string", 403, tag("StoredEnchantments", "x"));
    chest("display int", 276, tag("display", 5));
    chest("display string", 276, tag("display", "x"));
    chest("display Name int", 276, tag("display", tag("Name", 5)));
    chest("display color string", 298, tag("display", tag("color", "red")));
    chest("display color short", 298, tag("display", tag("color", (short) 5)));
    chest("display Lore string", 276, tag("display", tag("Lore", "x")));
    chest("display Lore list of ints", 276, tag("display", tag("Lore", list(tag("k", 1)))));
    chest("RepairCost string", 276, tag("RepairCost", "5"));
    chest("RepairCost short", 276, tag("RepairCost", (short) 5));
    chest("RepairCost long", 276, tag("RepairCost", 5L));
    chest("Unbreakable string", 276, tag("Unbreakable", "yes"));
    chest("Unbreakable int", 276, tag("Unbreakable", 1));
    chest("CustomPotionEffects string", 373, tag("CustomPotionEffects", "x"));
    chest("map_is_scaling string", 358, tag("map_is_scaling", "x"));
    chest("map_is_scaling int", 358, tag("map_is_scaling", 1));
    chest("SkullOwner int", 397, tag("SkullOwner", 5));
    chest("pages string", 386, tag("pages", "x", "title", 5, "author", 6, "resolved", "x"));
    chest("Fireworks string", 401, tag("Fireworks", "x"));
    chest("Fireworks compound bad Flight", 401, tag("Fireworks", tag("Flight", "x", "Explosions", "y")));
    chest("Explosion string", 402, tag("Explosion", "x"));
    // the item's own `tag` key with the wrong type is dropped by ItemStack.readFromNBT (hasKey("tag", 10))
    Tiles95Probe.run("tag is a string", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(wrongTag(5))));
    Tiles95Probe.run("tag is a list", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(wrongTagList())));
  }
  static Object wrongTag(int id) throws Exception { Object c = Tiles95Probe.item(0, 276, 1, 0); Tiles95Probe.put(c, "tag", "text"); return c; }
  static Object wrongTagList() throws Exception { Object c = Tiles95Probe.item(0, 276, 1, 0); Tiles95Probe.put(c, "tag", list(tag("a", 1))); return c; }
}
