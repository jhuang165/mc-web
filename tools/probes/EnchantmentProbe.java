import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 Enchantment registry (aft and subclasses), EnumEnchantmentType (afu),
// EnchantmentHelper (afv), EnchantmentData (agc), WeightedRandom (qv), ItemEnchantedBook (acm),
// ItemStack (add) and ContainerEnchantment (aag). Test doubles: a constructor-less World whose
// getBlock reads a fixture map (isAirBlock stays native), a constructor-less EntityPlayer that only
// carries experience fields and capabilities, and a constructor-less EntityLivingBase that only
// exposes a held item, last-active items and a creature attribute. Case inputs come from a fixed
// java.util.Random and are printed with every record, so the replay never regenerates them.
public class EnchantmentProbe {
  static sun.misc.Unsafe U;
  static final Random picks = new Random(17101710L);
  static final List<aft> REG = new ArrayList<>();
  static ro[] SOURCES;
  static final sz[] ATTRS = {sz.a, sz.b, sz.c};

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String ql(long v) { return "\"" + v + "\""; }

  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
  }
  public static class Living extends sv {
    Living() { super(null); }
    add held; add[] items; sz attr;
    public add be() { return held; }
    public add q(int i) { return items[i]; }
    public void c(int i, add s) {}
    public add[] ak() { return items; }
    public sz bd() { return attr; }
  }
  public static class TableWorld extends ahb {
    TableWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<String, Integer> blocks;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { Integer id = blocks.get(x + "," + y + "," + z); return aji.e(id == null ? 0 : id); }
  }

  // ---- stacks -------------------------------------------------------------
  static dh tag(add s) { if (!s.p()) s.d(new dh()); return s.q(); }
  static dq nbtList(int[][] pairs) { dq l = new dq(); for (int[] e : pairs) { dh t = new dh(); t.a("id", (short) e[0]); t.a("lvl", (short) e[1]); l.a(t); } return l; }
  static add make(int id, int count, int damage, int[][] ench, int[][] stored, boolean unbreakable) {
    add s = new add(adb.d(id), count, damage);
    if (ench != null && ench.length > 0) tag(s).a("ench", nbtList(ench));
    if (stored != null && stored.length > 0) tag(s).a("StoredEnchantments", nbtList(stored));
    if (unbreakable) tag(s).a("Unbreakable", true);
    return s;
  }
  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  static String pairs(int[][] p) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < p.length; i++) { if (i > 0) b.append(','); b.append('[').append(p[i][0]).append(',').append(p[i][1]).append(']'); } return b.append(']').toString(); }
  // [itemId,count,damage,ench,storedEnchantments,unbreakable]
  static String enc(add s) {
    if (s == null) return "null";
    dq stored = s.p() && s.q().b("StoredEnchantments", 9) ? s.q().c("StoredEnchantments", 10) : null;
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + pairs(s.r()) + "," + pairs(stored) + "," + (s.p() && s.q().n("Unbreakable") ? 1 : 0) + "]";
  }
  static String list(List<?> l) {
    if (l == null) return "null";
    StringBuilder b = new StringBuilder("[");
    for (Object o : l) { agc d = (agc) o; if (b.length() > 1) b.append(','); b.append('[').append(d.b.B).append(',').append(d.c).append(']'); }
    return b.append(']').toString();
  }
  static int[][] randomEnch(int max) {
    int n = picks.nextInt(max + 1); int[][] r = new int[n][];
    for (int i = 0; i < n; i++) {
      int id = picks.nextInt(12) == 0 ? new int[]{8, 100, 255}[picks.nextInt(3)] : REG.get(picks.nextInt(REG.size())).B;
      int lvl = picks.nextInt(8) == 0 ? new int[]{0, -1, 10, 127}[picks.nextInt(4)] : 1 + picks.nextInt(5);
      r[i] = new int[]{id, lvl};
    }
    return r;
  }
  static final int[] ARMOR = {298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317};
  static add randomArmor() {
    if (picks.nextInt(5) == 0) return null;
    int id = picks.nextInt(10) == 0 ? new int[]{276, 280, 403}[picks.nextInt(3)] : ARMOR[picks.nextInt(ARMOR.length)];
    return make(id, 1, 0, randomEnch(4), id == 403 ? randomEnch(2) : null, false);
  }
  static final int[] HELD = {276, 267, 268, 272, 283, 278, 257, 270, 274, 285, 256, 269, 273, 277, 284, 258, 271, 275, 279, 286, 261, 346, 359, 292, 280, 403, 310};
  static add randomHeld() {
    if (picks.nextInt(8) == 0) return null;
    int id = HELD[picks.nextInt(HELD.length)];
    return make(id, 1, 0, randomEnch(4), id == 403 ? randomEnch(2) : null, false);
  }
  static String stacks(add[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(enc(a[i])); } return b.append(']').toString(); }

  // ---- static tables ------------------------------------------------------
  static void registry() throws Exception {
    StringBuilder book = new StringBuilder("[");
    for (aft e : aft.c) { if (book.length() > 1) book.append(','); book.append(e.B); }
    System.out.println("{\"kind\":\"bookList\",\"ids\":" + book + "]}");
    afu[] types = afu.values(); StringBuilder t = new StringBuilder("[");
    for (afu a : types) { if (t.length() > 1) t.append(','); t.append(q(a.name())); }
    System.out.println("{\"kind\":\"types\",\"names\":" + t + "]}");
    StringBuilder s = new StringBuilder("[");
    for (ro r : SOURCES) { if (s.length() > 1) s.append(','); s.append('[').append(q(r.p())).append(',').append(r.a()).append(',').append(r.c()).append(',').append(r.o()).append(',').append(r.g()).append(',').append(r == ro.h).append(']'); }
    System.out.println("{\"kind\":\"sources\",\"rows\":" + s + "]}");
    for (aft e : aft.b) if (e != null) {
      StringBuilder lv = new StringBuilder("["), co = new StringBuilder("["), li = new StringBuilder("["), dm = new StringBuilder("[");
      for (int l = 0; l <= e.b() + 1; l++) { if (l > 0) lv.append(','); lv.append('[').append(l).append(',').append(e.a(l)).append(',').append(e.b(l)).append(']'); }
      for (aft b : aft.b) if (b != null && e.a(b)) { if (co.length() > 1) co.append(','); co.append(b.B); }
      for (int l = 0; l <= 7; l++) {
        if (l > 0) { li.append(','); dm.append(','); }
        li.append('[').append(e.a(l, sz.a)).append(',').append(e.a(l, sz.b)).append(',').append(e.a(l, sz.c)).append(']');
        dm.append('['); for (int i = 0; i < SOURCES.length; i++) { if (i > 0) dm.append(','); dm.append(e.a(l, SOURCES[i])); } dm.append(']');
      }
      System.out.println("{\"kind\":\"enchantment\",\"id\":" + e.B + ",\"class\":" + q(e.getClass().getName()) + ",\"name\":" + q(e.a()) + ",\"weight\":" + e.c()
        + ",\"minLevel\":" + e.d() + ",\"maxLevel\":" + e.b() + ",\"type\":" + q(e.C.name()) + ",\"levels\":" + lv + "],\"compatible\":" + co + "],\"living\":" + li + "],\"damage\":" + dm + "]}");
    }
  }
  static String kind(adb it) {
    if (it instanceof abb) return "armor"; if (it instanceof aeh) return "sword"; if (it instanceof abf) return "axe"; if (it instanceof acg) return "tool";
    if (it instanceof abm) return "bow"; if (it instanceof acv) return "fishing_rod"; if (it == ade.aG) return "book"; if (it == ade.bR) return "enchanted_book";
    if (it == ade.aZ) return "shears"; return "other";
  }
  static final List<Integer> ENCHANTABLE = new ArrayList<>();
  static void items() throws Exception {
    afu[] types = afu.values();
    for (Object o : adb.e) {
      adb it = (adb) o; int id = adb.b(it); add one = new add(it, 1, 0), two = new add(it, 2, 0);
      long typeMask = 0, applyMask = 0;
      for (int i = 0; i < types.length; i++) if (types[i].a(it)) typeMask |= 1L << i;
      for (int i = 0; i < REG.size(); i++) if (REG.get(i).a(one)) applyMask |= 1L << i;
      if (it.c() > 0) ENCHANTABLE.add(id);
      System.out.println("{\"kind\":\"item\",\"row\":[" + id + "," + q(String.valueOf(adb.e.c(it))) + "," + q(kind(it)) + "," + (it instanceof abb ? ((abb) it).b : -1) + "," + it.c() + "," + it.o() + "," + it.p() + "," + it.m()
        + "," + it.e_(one) + "," + it.e_(two) + "," + one.x() + "," + two.x() + "," + one.g() + "," + typeMask + "," + applyMask + "]}");
    }
    // Stack-sensitive applicability: damage, Unbreakable and existing enchantments.
    int[][] variants = {{276, 0, 0}, {276, 1, 0}, {276, 0, 1}, {359, 0, 1}, {261, 0, 1}, {311, 0, 1}, {278, 5, 0}, {340, 0, 0}, {403, 0, 0}};
    for (int[] v : variants) for (int enchanted = 0; enchanted < 2; enchanted++) {
      add s = make(v[0], 1, v[1], enchanted == 1 ? new int[][]{{34, 1}} : null, null, v[2] == 1);
      long applyMask = 0; for (int i = 0; i < REG.size(); i++) if (REG.get(i).a(s)) applyMask |= 1L << i;
      System.out.println("{\"kind\":\"variant\",\"stack\":" + enc(s) + ",\"apply\":" + applyMask + ",\"damageable\":" + s.g() + ",\"enchantable\":" + s.x() + "}");
    }
  }

  // ---- randomized behaviour ----------------------------------------------
  static void slots() {
    int[][] its = {{276, 0}, {340, 0}, {261, 0}, {359, 0}, {280, 0}, {292, 0}};
    for (int[] ii : its) {
      int seeds = ii[0] == 276 ? 48 : 4;
      for (int seed = 0; seed < seeds; seed++) for (int b : new int[]{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 32}) {
        if (ii[0] != 276 && b % 5 != 0) continue;
        long rs = seed * 1000003L + b; Random r = new Random(rs); add s = new add(adb.d(ii[0]), 1, 0);
        int a0 = afv.a(r, 0, b, s), a1 = afv.a(r, 1, b, s), a2 = afv.a(r, 2, b, s);
        System.out.println("{\"kind\":\"slots\",\"row\":[" + ii[0] + "," + b + "," + ql(rs) + "," + a0 + "," + a1 + "," + a2 + "," + r.nextInt() + "]}");
      }
    }
  }
  static final int[] MAP_ITEMS = {340, 268, 278, 258, 256, 298, 303, 308, 313, 261, 346, 359, 292, 259, 398, 280, 403, 1};
  static void candidates() {
    for (int id : MAP_ITEMS) for (int level = -1; level <= 72; level++) {
      Map<?, ?> m = afv.b(level, new add(adb.d(id), 1, 0)); StringBuilder b = new StringBuilder();
      if (m == null) b.append("null"); else { b.append('['); for (Object o : m.values()) { agc d = (agc) o; if (b.length() > 1) b.append(','); b.append('[').append(d.b.B).append(',').append(d.c).append(']'); } b.append(']'); }
      System.out.println("{\"kind\":\"map\",\"row\":[" + id + "," + level + "," + b + "]}");
    }
  }
  static void build() {
    List<Integer> ids = new ArrayList<>(ENCHANTABLE); ids.add(359); ids.add(280); ids.add(403);
    for (int id : ids) for (int level = 1; level <= 32; level++) {
      long seed = picks.nextLong(); Random r = new Random(seed); List<?> l = afv.b(r, new add(adb.d(id), 1, 0), level);
      System.out.println("{\"kind\":\"build\",\"row\":[" + id + "," + level + "," + ql(seed) + "," + list(l) + "," + r.nextInt() + "]}");
    }
    for (int id : new int[]{340, 276, 278, 311, 261, 346, 298, 314}) for (int level : new int[]{-20, 0, 33, 35, 40, 45, 50, 60, 75, 100, 200}) for (int k = 0; k < 3; k++) {
      long seed = picks.nextLong(); Random r = new Random(seed); List<?> l = afv.b(r, new add(adb.d(id), 1, 0), level);
      System.out.println("{\"kind\":\"build\",\"row\":[" + id + "," + level + "," + ql(seed) + "," + list(l) + "," + r.nextInt() + "]}");
    }
    // Many seeds at the table's top level for the weighted pick and extra-enchantment loop.
    for (int id : new int[]{340, 276, 278, 310, 261}) for (int k = 0; k < 60; k++) {
      long seed = picks.nextLong(); Random r = new Random(seed); List<?> l = afv.b(r, new add(adb.d(id), 1, 0), 30);
      System.out.println("{\"kind\":\"build\",\"row\":[" + id + "," + 30 + "," + ql(seed) + "," + list(l) + "," + r.nextInt() + "]}");
    }
    for (int id : new int[]{340, 276, 261, 298, 359, 280, 403}) for (int level : new int[]{1, 5, 10, 20, 30, 40}) for (int k = 0; k < 2; k++) {
      long seed = picks.nextLong(); Random r = new Random(seed); add s = new add(adb.d(id), 1, 0); add res = afv.a(r, s, level);
      System.out.println("{\"kind\":\"addRandom\",\"row\":[" + id + "," + level + "," + ql(seed) + "," + enc(res) + "," + (res == s) + "," + r.nextInt() + "]}");
    }
  }
  static final int[] TABLE_ITEMS = {276, 267, 268, 283, 278, 257, 270, 285, 256, 258, 271, 298, 299, 300, 301, 310, 311, 312, 313, 302, 314, 261, 346, 340, 359, 292, 259, 398, 280, 1, 403};
  static int[] layout(int mode) {
    // 5 x 2 x 5 cells around the table, index ((dy*5)+(dz+2))*5+(dx+2).
    int[] cells = new int[50];
    for (int dy = 0; dy < 2; dy++) for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) {
      int i = (dy * 5 + dz + 2) * 5 + dx + 2, ring = Math.max(Math.abs(dx), Math.abs(dz)), id = 0;
      if (ring == 0) id = dy == 0 ? 116 : 0;
      else if (mode == 1) id = ring == 2 ? 47 : 0;
      else if (mode == 2) id = ring == 2 && !(Math.abs(dx) == 2 && Math.abs(dz) == 2) && !(dz == 2 && dx == 0) ? 47 : 0;
      else if (mode == 3) id = ring == 2 ? 47 : (dx == 1 && dz == 0 && dy == 1 ? 50 : 0);
      else if (mode >= 4) {
        int p = picks.nextInt(100);
        if (ring == 1) id = p < 85 ? 0 : new int[]{50, 1, 31, 47}[picks.nextInt(4)];
        else id = p < 55 ? 47 : p < 85 ? 0 : new int[]{1, 20, 5}[picks.nextInt(3)];
      }
      cells[i] = id;
    }
    return cells;
  }
  static void table() throws Exception {
    Field randF = field(aag.class, "l");
    for (int c = 0; c < 260; c++) {
      int mode = c < 4 ? c : 4, tx = c % 3 == 0 ? -17 : 5, ty = 64, tz = c % 2 == 0 ? 300 : -2;
      int[] cells = c < 4 ? layout(mode) : layout(4);
      TableWorld w = (TableWorld) U.allocateInstance(TableWorld.class); w.blocks = new HashMap<>();
      for (int dy = 0; dy < 2; dy++) for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) w.blocks.put((tx + dx) + "," + (ty + dy) + "," + (tz + dz), cells[(dy * 5 + dz + 2) * 5 + dx + 2]);
      boolean remote = c % 37 == 5; w.E = remote;
      ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class); p.o = w; p.bE = new yw(); p.bE.d = c % 11 == 3;
      p.bF = c % 13 == 0 ? 0 : picks.nextInt(45); p.bG = 777; p.bH = 0.25f; int level0 = p.bF;
      yx inv = new yx(p); p.bm = inv;
      aag con = new aag(inv, w, tx, ty, tz);
      long seed = picks.nextLong(); ((Random) randF.get(con)).setSeed(seed);
      int id = picks.nextInt(5) == 0 ? 340 : TABLE_ITEMS[picks.nextInt(TABLE_ITEMS.length)], count = id == 340 && picks.nextInt(6) == 0 ? 2 : 1;
      add stack = make(id, count, 0, picks.nextInt(15) == 0 ? new int[][]{{34, 2}} : null, id == 403 ? new int[][]{{16, 3}} : null, false);
      String in = enc(stack);
      con.a.a(0, stack);
      StringBuilder steps = new StringBuilder("[");
      steps.append("[\"put\",").append(ql(con.f)).append(",[").append(con.g[0]).append(',').append(con.g[1]).append(',').append(con.g[2]).append("]]");
      int tries = 1 + picks.nextInt(2);
      for (int k = 0; k < tries; k++) {
        int slot = picks.nextInt(3); boolean ok = con.a(p, slot);
        steps.append(",[\"enchant\",").append(slot).append(',').append(ok).append(',').append(enc(con.a.a(0))).append(',').append(ql(con.f)).append(",[").append(con.g[0]).append(',').append(con.g[1]).append(',').append(con.g[2]).append("],[")
          .append(p.bF).append(',').append(p.bG).append(',').append(p.bH).append("]]");
      }
      if (picks.nextInt(4) == 0) { // Replace the item: the table re-rolls from the same container Random.
        int id2 = TABLE_ITEMS[picks.nextInt(TABLE_ITEMS.length)]; add s2 = make(id2, 1, 0, null, null, false); String in2 = enc(s2); con.a.a(0, s2);
        steps.append(",[\"replace\",").append(in2).append(',').append(ql(con.f)).append(",[").append(con.g[0]).append(',').append(con.g[1]).append(',').append(con.g[2]).append("]]");
        int slot = picks.nextInt(3); boolean ok = con.a(p, slot);
        steps.append(",[\"enchant\",").append(slot).append(',').append(ok).append(',').append(enc(con.a.a(0))).append(',').append(ql(con.f)).append(",[").append(con.g[0]).append(',').append(con.g[1]).append(',').append(con.g[2]).append("],[")
          .append(p.bF).append(',').append(p.bG).append(',').append(p.bH).append("]]");
      }
      con.a.a(0, null);
      steps.append(",[\"remove\",").append(ql(con.f)).append(",[").append(con.g[0]).append(',').append(con.g[1]).append(',').append(con.g[2]).append("]]");
      StringBuilder cs = new StringBuilder("["); for (int i = 0; i < 50; i++) { if (i > 0) cs.append(','); cs.append(cells[i]); }
      System.out.println("{\"kind\":\"table\",\"pos\":[" + tx + "," + ty + "," + tz + "],\"cells\":" + cs + "],\"remote\":" + remote + ",\"creative\":" + p.bE.d + ",\"level\":" + level0 + ",\"seed\":" + ql(seed)
        + ",\"stack\":" + in + ",\"steps\":" + steps + "],\"next\":" + ((Random) randF.get(con)).nextInt() + "}");
    }
  }
  static void modifiers() throws Exception {
    Random er = (Random) field(afv.class, "a").get(null);
    for (int c = 0; c < 400; c++) {
      add[] armor = new add[4]; for (int i = 0; i < 4; i++) armor[i] = randomArmor();
      int si = picks.nextInt(SOURCES.length); long seed = picks.nextLong(); er.setSeed(seed);
      int v = afv.a(armor, SOURCES[si]);
      System.out.println("{\"kind\":\"damage\",\"row\":[" + stacks(armor) + "," + si + "," + ql(seed) + "," + v + "," + er.nextInt() + "]}");
    }
    for (int c = 0; c < 200; c++) {
      add s = randomHeld(); int a = picks.nextInt(3);
      System.out.println("{\"kind\":\"living\",\"row\":[" + enc(s) + "," + a + "," + afv.a(s, ATTRS[a]) + "]}");
    }
    for (int id : new int[]{16, 17, 18, 0}) for (int lvl = -1; lvl <= 6; lvl++) for (int a = 0; a < 3; a++) {
      add s = make(lvl == 3 ? 258 : 276, 1, 0, new int[][]{{id, lvl}, {id == 16 ? 17 : 16, lvl == 6 ? 2 : 0}}, null, false);
      System.out.println("{\"kind\":\"living\",\"row\":[" + enc(s) + "," + a + "," + afv.a(s, ATTRS[a]) + "]}");
    }
    int[] watch = {0, 1, 3, 5, 6, 7, 34};
    for (int c = 0; c < 240; c++) {
      Living e = (Living) U.allocateInstance(Living.class), t = (Living) U.allocateInstance(Living.class);
      int n = c % 2 == 0 ? 4 : 5; e.items = new add[n]; for (int i = 0; i < n; i++) e.items[i] = randomArmor();
      e.held = randomHeld(); if (n == 5 && picks.nextBoolean()) e.items[0] = e.held;
      t.attr = ATTRS[picks.nextInt(3)];
      int ticks = picks.nextInt(400); double knock = picks.nextInt(3) == 0 ? picks.nextInt(4) : picks.nextDouble() * 3;
      StringBuilder first = new StringBuilder("[");
      for (int k = 0; k < watch.length; k++) { add f = afv.a(aft.b[watch[k]], e); int idx = -1; for (int i = 0; i < n; i++) if (e.items[i] == f && f != null) { idx = i; break; } if (k > 0) first.append(','); first.append(idx); }
      System.out.println("{\"kind\":\"getters\",\"held\":" + enc(e.held) + ",\"items\":" + stacks(e.items) + ",\"heldSlot\":" + (n == 5 && e.items[0] == e.held && e.held != null) + ",\"targetAttr\":" + Arrays.asList(ATTRS).indexOf(t.attr)
        + ",\"ticks\":" + ticks + ",\"knock\":" + knock + ",\"out\":[" + afv.a(e, t) + "," + afv.b(e, t) + "," + afv.a(e) + "," + afv.b(e) + "," + afv.c(e) + "," + afv.e(e) + "," + afv.f(e) + "," + afv.g(e) + "," + afv.h(e) + "," + afv.i(e) + "," + afv.j(e)
        + "," + agi.a(e, ticks) + "," + agi.a(e, knock) + "],\"first\":" + first + "]}");
    }
  }
  static void durability() {
    int[] ids = {276, 257, 298, 311, 261, 359, 259, 346, 280, 268, 403};
    for (int c = 0; c < 500; c++) {
      int id = ids[picks.nextInt(ids.length)], max = adb.d(id).o();
      int damage = max > 0 && picks.nextInt(3) == 0 ? Math.max(0, max - picks.nextInt(4)) : (max > 0 ? picks.nextInt(max) : 0);
      int lvl = new int[]{0, 1, 2, 3, 3, 1, 2, 5, 10, -2}[picks.nextInt(10)];
      int[][] ench = lvl == 0 ? (picks.nextBoolean() ? new int[][]{{16, 2}} : null) : (picks.nextInt(5) == 0 ? new int[][]{{0, 1}, {34, lvl}, {34, 3}} : new int[][]{{34, lvl}});
      add s = make(id, 1, damage, ench, null, picks.nextInt(12) == 0);
      int amount = new int[]{0, 1, 1, 1, 2, 3, 5, 9, -1}[picks.nextInt(9)]; long seed = picks.nextLong(); Random r = new Random(seed);
      String before = enc(s); boolean broke = s.a(amount, r);
      System.out.println("{\"kind\":\"unbreaking\",\"row\":[" + before + "," + amount + "," + ql(seed) + "," + broke + "," + s.k() + "," + r.nextInt() + "]}");
    }
    for (int id : new int[]{276, 311, 261, 280}) for (int lvl = 0; lvl <= 5; lvl++) for (int seed = 0; seed < 12; seed++) {
      Random r = new Random(seed); boolean v = afr.a(new add(adb.d(id), 1, 0), lvl, r);
      System.out.println("{\"kind\":\"negate\",\"row\":[" + id + "," + lvl + "," + seed + "," + v + "," + r.nextInt() + "]}");
    }
    for (int lvl = 0; lvl <= 13; lvl++) for (int seed = 0; seed < 10; seed++) {
      Random r = new Random(seed * 31L + lvl); boolean hit = agj.a(lvl, r); int n1 = r.nextInt();
      Random r2 = new Random(seed * 31L + lvl); int dmg = agj.b(lvl, r2);
      System.out.println("{\"kind\":\"thorns\",\"row\":[" + lvl + "," + ql(seed * 31L + lvl) + "," + hit + "," + n1 + "," + dmg + "," + r2.nextInt() + "]}");
    }
  }
  static void nbt() {
    for (int c = 0; c < 120; c++) {
      int op = c % 4; int id = new int[]{276, 340, 403, 311, 261}[picks.nextInt(5)];
      add s = make(id, 1, 0, picks.nextBoolean() ? randomEnch(3) : null, id == 403 && picks.nextBoolean() ? randomEnch(3) : null, false);
      String before = enc(s); StringBuilder arg = new StringBuilder("null"), result = new StringBuilder("null");
      if (op == 0) { Map<?, ?> m = afv.a(s); result = new StringBuilder("["); for (Map.Entry<?, ?> en : m.entrySet()) { if (result.length() > 1) result.append(','); result.append('[').append(en.getKey()).append(',').append(en.getValue()).append(']'); } result.append(']'); }
      else if (op == 1) { int[][] p = randomEnch(4); if (id == 403) p = java.util.Arrays.stream(p).filter(e -> aft.b[e[0]] != null).toArray(int[][]::new); LinkedHashMap<Integer, Integer> m = new LinkedHashMap<>(); for (int[] e : p) m.put(e[0], e[1]); arg = new StringBuilder(pairs(p)); afv.a(m, s); }
      else if (op == 2) { int[][] p = randomEnch(4); arg = new StringBuilder(pairs(p)); for (int[] e : p) if (aft.b[e[0]] != null) ade.bR.a(s, new agc(e[0], e[1])); }
      else { int[][] p = randomEnch(3); for (int[] e : p) if (picks.nextInt(3) == 0) e[1] = new int[]{200, 300, -129}[picks.nextInt(3)]; arg = new StringBuilder(pairs(p)); for (int[] e : p) if (aft.b[e[0]] != null) s.a(aft.b[e[0]], e[1]); }
      System.out.println("{\"kind\":\"nbt\",\"row\":[" + op + "," + before + "," + arg + "," + result + "," + enc(s) + "," + afv.a(34, s) + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    for (aft e : aft.b) if (e != null) REG.add(e);
    SOURCES = new ro[]{ro.a, ro.b, ro.c, ro.d, ro.e, ro.f, ro.g, ro.h, ro.i, ro.j, ro.k, ro.l, ro.m, ro.n,
      ro.a((agw) null), ro.a((zc) null, (sa) null), ro.a((ze) null, (sa) null), ro.a((sa) null, (sa) null), ro.b((sa) null, (sa) null), ro.a((sa) null), ro.a((sv) null), ro.a((yz) null)};
    registry(); items(); slots(); candidates(); build(); table(); modifiers(); durability(); nbt();
  }
}
