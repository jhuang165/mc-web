import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 BlockEnchantmentTable (aks, registry id 116) and drives the unchanged
// ContainerEnchantment (aag) through its real slots: Container.slotClick (click, shift-click,
// hotbar key), the table's own Slot/InventoryBasic.markDirty chain, enchantItem and
// canInteractWith. Test doubles are a constructor-less World that reads a fixture block map and a
// constructor-less EntityPlayer that carries inventory, experience and a position. Every case's
// inputs come from a fixed java.util.Random and are printed with the record.
public class EnchantingTableProbe {
  static sun.misc.Unsafe U;
  static final Random picks = new Random(11601160L);

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String ql(long v) { return "\"" + v + "\""; }

  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
  }
  public static class TableWorld extends ahb {
    TableWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<String, Integer> blocks;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { Integer id = blocks.get(x + "," + y + "," + z); return aji.e(id == null ? 0 : id); }
  }

  static dh tag(add s) { if (!s.p()) s.d(new dh()); return s.q(); }
  static dq nbtList(int[][] pairs) { dq l = new dq(); for (int[] e : pairs) { dh t = new dh(); t.a("id", (short) e[0]); t.a("lvl", (short) e[1]); l.a(t); } return l; }
  static add make(int id, int count, int damage, int[][] ench, int[][] stored) {
    add s = new add(adb.d(id), count, damage);
    if (ench != null && ench.length > 0) tag(s).a("ench", nbtList(ench));
    if (stored != null && stored.length > 0) tag(s).a("StoredEnchantments", nbtList(stored));
    return s;
  }
  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  // [itemId,count,damage,ench,storedEnchantments]
  static String enc(add s) {
    if (s == null) return "null";
    dq stored = s.p() && s.q().b("StoredEnchantments", 9) ? s.q().c("StoredEnchantments", 10) : null;
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + pairs(s.r()) + "," + pairs(stored) + "]";
  }
  static String levels(int[] g) { return "[" + g[0] + "," + g[1] + "," + g[2] + "]"; }

  static int[] layout() {
    int[] cells = new int[50];
    int mode = picks.nextInt(3);
    for (int dy = 0; dy < 2; dy++) for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) {
      int i = (dy * 5 + dz + 2) * 5 + dx + 2, ring = Math.max(Math.abs(dx), Math.abs(dz)), id = 0;
      if (ring == 0) id = dy == 0 ? 116 : 0;
      else if (mode == 0) id = ring == 2 ? 47 : 0;
      else {
        int p = picks.nextInt(100);
        if (ring == 1) id = p < 85 ? 0 : new int[]{50, 1, 31, 47}[picks.nextInt(4)];
        else id = p < 55 ? 47 : p < 85 ? 0 : new int[]{1, 20, 5}[picks.nextInt(3)];
      }
      cells[i] = id;
    }
    return cells;
  }

  // Block-level facts of the registry object at id 116.
  static void block() throws Exception {
    aji b = aji.e(116);
    if (!(b instanceof aks)) throw new AssertionError("id 116 is " + b);
    awt m = b.o();
    StringBuilder o = new StringBuilder("{\"kind\":\"block\",\"id\":" + aji.b(b) + ",\"className\":\"BlockEnchantmentTable\"");
    o.append(",\"renderType\":").append(b.b()).append(",\"renderNormal\":").append(b.d()).append(",\"opaque\":").append(b.c())
      .append(",\"hardness\":").append(b.f(null, 0, 0, 0)).append(",\"explosionResistance\":").append(b.a((sa) null))
      .append(",\"lightOpacity\":").append(b.k()).append(",\"lightValue\":").append(b.m())
      .append(",\"toolNotRequired\":").append(m.l()).append(",\"materialOpaque\":").append(m.k())
      .append(",\"materialSolid\":").append(m.a()).append(",\"damageDropped\":").append(b.a(0))
      .append(",\"quantityDropped\":").append(b.a(new Random(1)))
      .append(",\"itemDropped\":").append(adb.b(b.a(0, new Random(1), 0)))
      .append(",\"bounds\":[");
    String[] names = {"B", "C", "D", "E", "F", "G"};
    for (int i = 0; i < 6; i++) { if (i > 0) o.append(','); o.append(field(aji.class, names[i]).getDouble(b)); }
    o.append("]}");
    System.out.println(o);
  }

  static final int[] ITEMS = {276, 267, 268, 283, 278, 257, 270, 285, 256, 258, 271, 298, 299, 300, 301, 310, 311, 312, 313, 302, 314, 261, 340, 359, 292, 259, 280, 1, 4, 403, 332};
  static add randomStack() {
    int id = ITEMS[picks.nextInt(ITEMS.length)], max = adb.d(id).m();
    int count = max == 1 ? 1 : 1 + picks.nextInt(Math.min(max, picks.nextInt(3) == 0 ? max : 4));
    int damage = adb.d(id).o() > 0 && picks.nextInt(4) == 0 ? picks.nextInt(adb.d(id).o()) : 0;
    int[][] ench = picks.nextInt(8) == 0 && id != 403 ? new int[][]{{34, 2}} : null;
    int[][] stored = id == 403 ? new int[][]{{16, 3}} : null;
    return make(id, count, damage, ench, stored);
  }

  static void container() throws Exception {
    Field randF = field(aag.class, "l");
    for (int c = 0; c < 300; c++) {
      int tx = c % 3 == 0 ? -17 : 5, ty = 64, tz = c % 2 == 0 ? 300 : -2;
      int[] cells = layout();
      TableWorld w = (TableWorld) U.allocateInstance(TableWorld.class); w.blocks = new HashMap<>();
      for (int dy = 0; dy < 2; dy++) for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) w.blocks.put((tx + dx) + "," + (ty + dy) + "," + (tz + dz), cells[(dy * 5 + dz + 2) * 5 + dx + 2]);
      ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class); p.o = w; p.bE = new yw(); p.bE.d = c % 9 == 4;
      p.bF = c % 13 == 0 ? 0 : picks.nextInt(45); p.bG = 777; p.bH = 0.25f;
      int level0 = p.bF;
      yx inv = new yx(p); p.bm = inv;
      add[] main = new add[36];
      StringBuilder start = new StringBuilder("[");
      for (int i = 0; i < 36; i++) {
        if (picks.nextInt(5) < 2) main[i] = randomStack();
        inv.a[i] = main[i];
        if (i > 0) start.append(','); start.append(enc(main[i]));
      }
      start.append(']');
      add held = picks.nextInt(4) == 0 ? randomStack() : null;
      inv.b(held);
      String heldEnc = enc(held);
      aag con = new aag(inv, w, tx, ty, tz);
      long seed = picks.nextLong(); ((Random) randF.get(con)).setSeed(seed);
      StringBuilder steps = new StringBuilder("[");
      int n = 5 + picks.nextInt(8);
      for (int k = 0; k < n; k++) {
        String op;
        int kind = k == 0 && picks.nextInt(3) > 0 ? 9 : picks.nextInt(10);
        if (kind < 4) {
          int slot = picks.nextInt(37), mode = picks.nextInt(3), button = mode == 2 ? picks.nextInt(9) : picks.nextInt(2);
          // Slot 0 clicks dominate so the table slot sees puts, takes and swaps.
          if (picks.nextInt(2) == 0) slot = 0;
          con.a(slot, button, mode, p);
          op = "[\"click\"," + slot + "," + button + "," + mode + "]";
        } else if (kind < 8) {
          int slot = picks.nextInt(3); boolean ok = con.a(p, slot);
          op = "[\"enchant\"," + slot + "," + ok + "]";
        } else {
          add s = randomStack(); con.a.a(0, s);
          op = "[\"set\"," + enc(s) + "]";
        }
        StringBuilder st = new StringBuilder("[");
        for (int i = 0; i < 36; i++) { if (i > 0) st.append(','); st.append(enc(inv.a[i])); }
        st.append(']');
        if (k > 0) steps.append(',');
        steps.append("[").append(op).append(',').append(enc(con.a.a(0))).append(',').append(enc(inv.o())).append(',').append(levels(con.g)).append(',').append(ql(con.f))
          .append(",[").append(p.bF).append(',').append(p.bG).append(',').append(p.bH).append("],").append(st).append("]");
      }
      steps.append("]");
      StringBuilder cs = new StringBuilder("[");
      for (int i = 0; i < 50; i++) { if (i > 0) cs.append(','); cs.append(cells[i]); }
      System.out.println("{\"kind\":\"container\",\"pos\":[" + tx + "," + ty + "," + tz + "],\"cells\":" + cs + "],\"creative\":" + p.bE.d + ",\"level\":" + level0 + ",\"seed\":" + ql(seed)
        + ",\"main\":" + start + ",\"held\":" + heldEnc + ",\"steps\":" + steps + ",\"next\":" + ((Random) randF.get(con)).nextInt() + "}");
    }
  }

  // ContainerEnchantment's slot layout and canInteractWith over fixed offsets.
  static void layoutAndReach() throws Exception {
    TableWorld w = (TableWorld) U.allocateInstance(TableWorld.class); w.blocks = new HashMap<>();
    w.blocks.put("10,64,10", 116);
    ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class); p.o = w; p.bE = new yw();
    yx inv = new yx(p); p.bm = inv;
    aag con = new aag(inv, w, 10, 64, 10);
    StringBuilder slots = new StringBuilder("[");
    for (int i = 0; i < con.c.size(); i++) {
      aay s = (aay) con.c.get(i);
      if (i > 0) slots.append(',');
      slots.append("[").append(s.g).append(',').append(s.h).append(',').append(s.i).append(',').append(s.a()).append(',').append(s.a(new add(adb.d(1), 1, 0))).append(',').append(s.a(new add(adb.d(340), 1, 0))).append(',').append(s.a(new add(adb.d(351), 1, 4))).append("]");
    }
    slots.append("]");
    System.out.println("{\"kind\":\"layout\",\"slots\":" + slots + ",\"slotCount\":" + con.c.size() + "}");
    StringBuilder reach = new StringBuilder("[");
    double[][] offs = {{0, 0, 0}, {7.9, 0, 0}, {8.0, 0, 0}, {8.01, 0, 0}, {0, 7.5, 0}, {0, 8, 0}, {-4, 4, 4}, {-4.9, 4.9, 4.9}, {0, -7.5, 0}, {0, -8.5, 0}, {5.7, 5.7, 0}, {5.66, 5.66, 0}};
    for (int i = 0; i < offs.length; i++) {
      p.s = 10.5 + offs[i][0]; p.t = 64.5 + offs[i][1]; p.u = 10.5 + offs[i][2];
      if (i > 0) reach.append(',');
      reach.append("[").append(offs[i][0]).append(',').append(offs[i][1]).append(',').append(offs[i][2]).append(',').append(con.a(p)).append("]");
    }
    // Table removed: canInteractWith is false whatever the distance.
    w.blocks.put("10,64,10", 0); p.s = 10.5; p.t = 64.5; p.u = 10.5;
    reach.append(",[0,0,0,").append(con.a(p)).append(",\"gone\"]");
    System.out.println("{\"kind\":\"reach\",\"rows\":" + reach + "]}");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    block(); layoutAndReach(); container();
  }
}
