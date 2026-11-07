import java.util.*;

// Unlocalized names of every registered original Item/Block-item and damage subtype of Minecraft Java 1.7.10: Item.getUnlocalizedName(ItemStack)
// (adb.a(add), virtual so ItemBlock/ItemMultiTexture/ItemColored/ItemSlab overrides apply) and the lang key Item.getItemStackDisplayName
// reads (adb.k(add) + ".name"). "display" is ItemStack.getDisplayName (add.s); "plain" is true when it equals translate(key + ".name"),
// i.e. the item has no display-name override (potion 373, spawn egg 383, skull 397, written book 387 and a few others do).
// For the spawn egg (383) "entities" is EntityList.getStringFromID(damage) per damage (ItemMonsterPlacer builds "entity." + name + ".name").
// Ids 1-4095 via Item.getItemById (adb.d); damage 0-15, 0-255 for the spawn egg (383), 0-63 for the potion (373).
public class ItemKeyProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    for (int id = 1; id < 4096; id++) {
      adb item = adb.d(id);
      if (item == null) continue;
      int max = id == 383 ? 255 : id == 373 ? 63 : 15;
      StringBuilder keys = new StringBuilder(), plain = new StringBuilder();
      for (int d = 0; d <= max; d++) {
        String key, ok;
        try {
          add stack = new add(item, 1, d);
          key = item.k(stack) + ".name";
          ok = (key.equals("null") ? "0" : dd.a(key).trim().equals(stack.s()) ? "1" : "0");
        } catch (Throwable t) { key = "!" + t; ok = "0"; }
        if (d > 0) { keys.append(','); plain.append(','); }
        keys.append(q(key));
        plain.append(ok);
      }
      StringBuilder ents = new StringBuilder();
      if (id == 383) for (int d = 0; d <= max; d++) { if (d > 0) ents.append(','); ents.append(q(sg.b(d))); }
      System.out.println("{\"id\":" + id + (id == 383 ? ",\"entities\":[" + ents + "]" : "") + ",\"max\":" + max + ",\"block\":" + (id < 256) + ",\"keys\":[" + keys + "],\"plain\":[" + plain + "]}");
    }
  }
}
