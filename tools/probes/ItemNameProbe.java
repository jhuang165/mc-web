import java.util.*;

// ItemStack.getDisplayName (add.s) of every registered original Item/Block-item and damage subtype of Minecraft Java 1.7.10,
// translated through the real StringTranslate (de) that loads assets/minecraft/lang/en_US.lang from the client JAR. Item
// ids 1-4095 are walked with Item.getItemById (adb.d). Damage 0-15 for every item, 0-255 for the spawn egg (383) and
// 0-32767 for the potion (373), where the damage value is the whole potion (ItemPotion.getItemStackDisplayName).
// Each output line is {"id":n,"max":d,"names":[...]}; names[d] is the display name of damage d.
public class ItemNameProbe {
  static String q(String s) {
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
      int max = id == 373 ? 32767 : id == 383 ? 255 : 15;
      StringBuilder names = new StringBuilder();
      for (int d = 0; d <= max; d++) {
        String name;
        try { name = new add(item, 1, d).s(); } catch (Throwable t) { name = "!" + t; }
        if (d > 0) names.append(',');
        names.append(q(name));
      }
      System.out.println("{\"id\":" + id + ",\"max\":" + max + ",\"block\":" + (id < 256) + ",\"names\":[" + names + "]}");
    }
  }
}
