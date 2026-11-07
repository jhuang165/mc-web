import java.lang.reflect.*;
import java.util.*;

// Batch 21 combat3: EnchantmentThorns armour wear with Unbreaking, on the unchanged 1.7.10 classes (reuses ArmorEnchantmentProbe's doubles).
// EnchantmentHelper.func_151384_a(wearer, attacker) runs for Thorns I-III with Unbreaking 0-III on one worn piece, for three wearers:
//   mob     a non-player EntityLivingBase whose getLastActiveItems has FIVE stacks (held first), as EntityLiving
//   player  an EntityPlayer double with a real InventoryPlayer (survival capabilities)
//   creative the same with capabilities.isCreativeMode
// For every seed (Entity.rand of the wearer), piece and starting damage the record is
//   [wearer, thorns, unbreaking, before, seed, attackerLog, wearerLog, after, nextInt of the wearer's Random]
// so the Thorns roll, the damage roll, the wear amount (3 on a hit, 1 on a miss), the Unbreaking draws and the break are all pinned.
public class ThornsWearProbe {
  /** EntityPlayer double: records renderBrokenItemStack (sv.a(add)) and swallows the break statistic (yz.a(ph,int)). */
  public static class WearPlayer extends ArmorEnchantmentProbe.ProbePlayer {
    List<String> log = new ArrayList<>();
    public void a(add broken) { log.add("\"broken\""); }
    public void a(ph stat, int amount) {}
  }
  static final int[] CHEST = {299, 303, 307, 311, 315}, BOOTS = {301, 305, 309, 313, 317}, HELM = {298, 302, 306, 310, 314};

  public static void main(String[] a) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); ArmorEnchantmentProbe.U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    Random picks = new Random(1710_21_01L);
    String[] wearers = {"mob", "player", "creative"};
    int n = 0;
    for (String kind : wearers) for (int t = 1; t <= 3; t++) for (int u = 0; u <= 3; u++) for (int[] ids : new int[][]{CHEST, BOOTS, HELM}) for (int mat : new int[]{0, 3})
      for (int dmgMode = 0; dmgMode < 4; dmgMode++) for (int s = 0; s < 3; s++) {
        int id = ids[mat];
        int max = new add(adb.d(id), 1, 0).l();
        int dmg = dmgMode == 0 ? 0 : dmgMode == 1 ? max - 1 : dmgMode == 2 ? max - 3 : max;
        long seed = picks.nextLong();
        n += run(kind, t, u, id, dmg, seed, -1, 0, 0);
      }
    // two Thorns pieces: the helmet (slot 3) and the chestplate (slot 2) differ in level and Unbreaking; the FIRST Thorns piece (boots first) takes both wears
    for (String kind : wearers) for (int t = 1; t <= 3; t++) for (int u = 0; u <= 3; u++) for (int s = 0; s < 8; s++)
      n += run(kind, t, u, 299 + 4 * 0 + 8, 0, picks.nextLong(), 1 + picks.nextInt(3), picks.nextInt(4), 1);
    // A piece broken by Thorns wear: natively ItemStack.damageItem only decrements stackSize, so the zero-size stack stays in the slot. A second
    // reaction (new seed) is recorded: does the empty stack still roll Thorns, what are its size and damage, what does the wearer see in the slot?
    for (String kind : new String[]{"mob", "player"}) for (int t = 1; t <= 3; t++) for (int s = 0; s < 6; s++) n += ghost(kind, t, picks.nextLong(), picks.nextLong());
    System.err.println("records " + n);
  }

  // second thorns piece (helmet) when t2 > 0; mode 1 only
  static int run(String kind, int t, int u, int id, int dmg, long seed, int t2, int u2, int mode) throws Exception {
    boolean mob = kind.equals("mob");
    ArmorEnchantmentProbe.Living attacker = ArmorEnchantmentProbe.living();
    sv wearer; add[] arr;
    int[][] e1 = u > 0 ? ArmorEnchantmentProbe.ench(7, t, 34, u) : ArmorEnchantmentProbe.ench(7, t);
    add main = ArmorEnchantmentProbe.make(id, dmg, e1);
    if (mob) {
      ArmorEnchantmentProbe.Living w = ArmorEnchantmentProbe.living(); w.items = new add[5]; arr = w.items; wearer = w;
      arr[4 - ((id - 298) & 3)] = main; // held 0, boots 1, leggings 2, chestplate 3, helmet 4
      if (mode == 1) arr[4] = ArmorEnchantmentProbe.make(HELM[2], 0, u2 > 0 ? ArmorEnchantmentProbe.ench(7, t2, 34, u2) : ArmorEnchantmentProbe.ench(7, t2));
      ArmorEnchantmentProbe.field(sa.class, "Z").set(w, new Random(seed));
      String before = ArmorEnchantmentProbe.stacks(arr);
      afv.a(wearer, (sa) attacker);
      emit(kind, t, u, before, seed, attacker.log, w.log, arr, ((Random) ArmorEnchantmentProbe.field(sa.class, "Z").get(w)).nextInt(), t2, u2);
    } else {
      WearPlayer p = (WearPlayer) ArmorEnchantmentProbe.U.allocateInstance(WearPlayer.class); p.log = new ArrayList<>();
      p.bE = new yw(); p.bE.d = kind.equals("creative"); p.bm = new yx(p);
      arr = p.bm.b; wearer = p;
      arr[3 - ((id - 298) & 3)] = main; // boots 0 ... helmet 3
      if (mode == 1) arr[3] = ArmorEnchantmentProbe.make(HELM[2], 0, u2 > 0 ? ArmorEnchantmentProbe.ench(7, t2, 34, u2) : ArmorEnchantmentProbe.ench(7, t2));
      ArmorEnchantmentProbe.field(sa.class, "Z").set(p, new Random(seed));
      String before = ArmorEnchantmentProbe.stacks(arr);
      try { afv.a(wearer, (sa) attacker); }
      catch (Throwable ex) { System.err.println("player run failed " + ex); throw ex; }
      emit(kind, t, u, before, seed, attacker.log, p.log, arr, ((Random) ArmorEnchantmentProbe.field(sa.class, "Z").get(p)).nextInt(), t2, u2);
    }
    return 1;
  }

  static int ghost(String kind, int t, long seed1, long seed2) throws Exception {
    ArmorEnchantmentProbe.Living attacker = ArmorEnchantmentProbe.living(), attacker2 = ArmorEnchantmentProbe.living();
    int id = CHEST[0], max = new add(adb.d(id), 1, 0).l();
    add piece = ArmorEnchantmentProbe.make(id, max, ArmorEnchantmentProbe.ench(7, t));
    sv wearer; add[] arr; List<String> log;
    if (kind.equals("mob")) {
      ArmorEnchantmentProbe.Living w = ArmorEnchantmentProbe.living(); w.items = new add[5]; arr = w.items; arr[3] = piece; wearer = w; log = w.log;
    } else {
      WearPlayer p = (WearPlayer) ArmorEnchantmentProbe.U.allocateInstance(WearPlayer.class); p.log = new ArrayList<>();
      p.bE = new yw(); p.bm = new yx(p); arr = p.bm.b; arr[2] = piece; wearer = p; log = p.log;
    }
    ArmorEnchantmentProbe.field(sa.class, "Z").set(wearer, new Random(seed1));
    afv.a(wearer, (sa) attacker);
    int idx = kind.equals("mob") ? 3 : 2;
    add after1 = arr[idx];
    String first = after1 == null ? "null" : "[" + after1.b + "," + after1.k() + "]";
    ArmorEnchantmentProbe.field(sa.class, "Z").set(wearer, new Random(seed2));
    afv.a(wearer, (sa) attacker2);
    add after2 = arr[idx];
    String second = after2 == null ? "null" : "[" + after2.b + "," + after2.k() + "]";
    System.out.println("{\"kind\":\"ghost\",\"row\":[\"" + kind + "\"," + t + ",\"" + seed1 + "\",\"" + seed2 + "\"," + attacker.log + "," + first + "," + log + "," + attacker2.log + "," + second + "]}");
    return 1;
  }

  static void emit(String kind, int t, int u, String before, long seed, List<String> att, List<String> wl, add[] after, int next, int t2, int u2) {
    System.out.println("{\"kind\":\"thornswear\",\"row\":[\"" + kind + "\"," + t + "," + u + "," + before + ",\"" + seed + "\"," + att + "," + wl + "," + ArmorEnchantmentProbe.stacks(after) + "," + next + "," + t2 + "," + u2 + "]}");
  }
}
