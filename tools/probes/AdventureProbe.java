import java.util.*;

// EntityPlayer.isCurrentToolAdventureModeExempt (yz.d(III)Z, func_82246_f) of Minecraft Java 1.7.10 for every registered
// block and a set of held items, read from the unchanged original classes after Block.registerBlocks / Item.registerItems.
// With PlayerCapabilities.allowEdit false (WorldSettings.GameType.ADVENTURE), the method answers:
//   material != air && (material.isAdventureModeExempt() || held != null && (held.func_150998_b(block) || held.func_150997_a(block) > 1))
// so the probe prints, per block: its Material's exemption (awt.q, func_85157_q), and per held item the canHarvestBlock
// (add.b(aji)Z) and getStrVsBlock (add.a(aji)F) answers. Metadata is not consulted by either item method in 1.7.10.
public class AdventureProbe {
  static final int[] ITEMS = {256, 257, 258, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 283, 284, 285, 286, 290, 291, 292, 293, 294, 359, 280, 4, 346};

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    for (int id = 0; id < 4096; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && aji.b(b) != id)) continue;
      awt m = b.o();
      StringBuilder harvest = new StringBuilder(), speed = new StringBuilder();
      for (int i = 0; i < ITEMS.length; i++) {
        adb item = adb.d(ITEMS[i]);
        if (item == null) throw new IllegalStateException("item " + ITEMS[i]);
        add stack = new add(item, 1, 0);
        harvest.append(i == 0 ? "" : ",").append(stack.b(b));
        speed.append(i == 0 ? "" : ",").append(stack.a(b));
      }
      System.out.println("{\"id\":" + id + ",\"air\":" + (m == awt.a) + ",\"exempt\":" + m.q() + ",\"harvest\":[" + harvest + "],\"speed\":[" + speed + "]}");
    }
    StringBuilder items = new StringBuilder();
    for (int i = 0; i < ITEMS.length; i++) items.append(i == 0 ? "" : ",").append(ITEMS[i]);
    System.out.println("{\"items\":[" + items + "]}");
  }
}
