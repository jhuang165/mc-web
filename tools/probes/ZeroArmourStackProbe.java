import java.lang.reflect.Field;
import java.util.*;

// Batch 22 villagers4. What a zero-size armour stack (left in the slot by ItemStack.damageItem when Thorns wear breaks the piece, see ThornsWearProbe's
// ghost rows) does on a real EntityPlayer double, from the unchanged 1.7.10 classes: getTotalArmorValue (yz.aV), the Protection roll over the worn
// stacks (afv.a(add[], ro), the static Random seeded), InventoryPlayer.writeToNBT / readFromNBT (yx.a(dq) / yx.b(dq)) and InventoryPlayer.damageArmor (yx.a(float)).
// One JSON line per case: {"case": ..., "row": [...]}.
public class ZeroArmourStackProbe {
  static final int CHEST = 307, BOOTS = 309, HELM = 306; // iron chestplate / boots / helmet
  static ThornsWearProbe.WearPlayer player() throws Exception {
    ThornsWearProbe.WearPlayer p = (ThornsWearProbe.WearPlayer) ArmorEnchantmentProbe.U.allocateInstance(ThornsWearProbe.WearPlayer.class);
    p.log = new ArrayList<>();
    p.bE = new yw(); p.bm = new yx(p);
    return p;
  }
  static add piece(int id, int count, int[][] ench) { add s = ArmorEnchantmentProbe.make(id, 0, ench); s.b = count; return s; }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String slots(add[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) b.append(i > 0 ? "," : "").append(slot(a[i])); return b.append(']').toString(); }
  static String slot(add s) { return s == null ? "null" : "[" + s.b + "," + s.k() + "]"; }

  public static void main(String[] a) throws Exception {
    ArmorEnchantmentProbe.U = MobMoveProbe.unsafe();
    aji.p(); adb.l();
    int n = 0;
    int[][] prot = ArmorEnchantmentProbe.ench(0, 4), thorns = ArmorEnchantmentProbe.ench(7, 3), none = ArmorEnchantmentProbe.ench(34, 0);
    // armour value with the chestplate at size 1 and 0, with and without a second piece
    for (int count : new int[] {1, 0}) for (boolean second : new boolean[] {false, true}) {
      ThornsWearProbe.WearPlayer p = player();
      p.bm.b[2] = piece(CHEST, count, thorns);
      if (second) p.bm.b[0] = piece(BOOTS, 1, none);
      System.out.println("{\"case\":\"armorValue\",\"row\":[" + count + "," + second + "," + p.aV() + "]}"); n++;
    }
    // the Protection roll with the stack at size 1 and 0 (the static Random seeded): the sum of EnchantmentHelper.func_77508_a over the armour
    for (int count : new int[] {1, 0}) for (long seed = 0; seed < 6; seed++) {
      add[] arr = new add[4];
      arr[2] = piece(CHEST, count, prot);
      ArmorEnchantmentProbe.helperRandom().setSeed(seed);
      int r = afv.a(arr, ro.j);
      System.out.println("{\"case\":\"protection\",\"row\":[" + count + "," + seed + "," + r + "]}"); n++;
    }
    // NBT: the player's inventory written and read back, a zero-size chestplate in armour slot 2 (and, for comparison, a zero-size stack in the main grid)
    for (int where = 0; where < 2; where++) {
      ThornsWearProbe.WearPlayer p = player();
      add z = piece(CHEST, 0, thorns);
      if (where == 0) p.bm.b[2] = z; else p.bm.a[5] = z;
      dq list = p.bm.a(new dq());
      ThornsWearProbe.WearPlayer p2 = player();
      p2.bm.b(list);
      add back = where == 0 ? p2.bm.b[2] : p2.bm.a[5];
      System.out.println("{\"case\":\"nbt\",\"row\":[" + where + "," + list.c() + "," + q(list.toString()) + "," + slot(back) + "," + (back == null ? "null" : String.valueOf(adb.b(back.b()))) + "]}"); n++;
    }
    // InventoryPlayer.damageArmor(amount): every worn ItemArmor loses max(1, amount / 4); a stack left at size 0 afterwards is nulled
    for (float amount : new float[] {1f, 4f, 8f, 20f}) for (int mode = 0; mode < 3; mode++) {
      ThornsWearProbe.WearPlayer p = player();
      p.bm.b[2] = piece(CHEST, mode == 0 ? 0 : 1, thorns);
      p.bm.b[3] = piece(HELM, 1, none);
      if (mode == 2) { p.bm.b[2].b = 1; p.bm.b[2].b(p.bm.b[2].l() - 1); } // one point of durability left: a break by ordinary damage
      ArmorEnchantmentProbe.field(sa.class, "Z").set(p, new Random(3));
      String before = slots(p.bm.b);
      p.bm.a(amount);
      System.out.println("{\"case\":\"damageArmor\",\"row\":[" + amount + "," + mode + "," + before + "," + slots(p.bm.b) + "," + p.log + "]}"); n++;
    }
    System.err.println("records " + n);
  }
}
