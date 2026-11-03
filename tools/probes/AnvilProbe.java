import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 ContainerRepair (zu), its output slot (zw) and input inventory (zv), with
// ItemStack (add), EnchantmentHelper (afv), the enchantment registry (aft), ItemEnchantedBook (acm) and the
// NBT classes. Test doubles: a constructor-less EntityPlayer carrying only capabilities, experience fields and
// a seeded Entity.rand, and a World whose getBlock/getBlockMetadata/setBlockMetadataWithNotify/setBlockToAir/
// playAuxSFX operate on one anvil cell and log what the container asked for. The container is built with the
// real constructor. Case inputs come from a fixed java.util.Random and are printed with every record.
public class AnvilProbe {
  static sun.misc.Unsafe U;
  static final Random picks = new Random(70701710L);
  static final List<aft> REG = new ArrayList<>();
  static Field FINPUT, FUSED;

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String js(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"') b.append("\\\""); else if (c == '\\') b.append("\\\\");
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
    }
    return b.append('"').toString();
  }

  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
  }
  public static class AnvilWorld extends ahb {
    AnvilWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    int meta; // -1: air at the anvil cell
    int ax, ay, az;
    List<String> log = new ArrayList<>();
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return x == ax && y == ay && z == az && meta >= 0 ? ajn.bQ : aji.e(0); }
    public int e(int x, int y, int z) { return meta; }
    public boolean f(int x, int y, int z) { log.add("air"); meta = -1; return true; }
    public boolean a(int x, int y, int z, int m, int flags) { log.add("meta:" + m + ":" + flags); meta = m; return true; }
    public void c(int id, int x, int y, int z, int data) { log.add("aux:" + id); }
  }

  // ---- stacks -------------------------------------------------------------
  static dh tag(add s) { if (!s.p()) s.d(new dh()); return s.q(); }
  static dq nbtList(int[][] pairs) { dq l = new dq(); for (int[] e : pairs) { dh t = new dh(); t.a("id", (short) e[0]); t.a("lvl", (short) e[1]); l.a(t); } return l; }
  static add make(int id, int count, int damage, int[][] ench, int[][] stored, boolean unbreakable, int repairCost, String name) {
    add s = new add(adb.d(id), count, damage);
    if (ench != null && ench.length > 0) tag(s).a("ench", nbtList(ench));
    if (stored != null && stored.length > 0) tag(s).a("StoredEnchantments", nbtList(stored));
    if (unbreakable) tag(s).a("Unbreakable", true);
    if (repairCost != 0) tag(s).a("RepairCost", repairCost);
    if (name != null) s.c(name);
    return s;
  }
  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  static String pairs(int[][] p) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < p.length; i++) { if (i > 0) b.append(','); b.append('[').append(p[i][0]).append(',').append(p[i][1]).append(']'); } return b.append(']').toString(); }
  // [itemId,count,damage,ench,storedEnchantments,unbreakable,repairCost,customName]
  static String enc(add s) {
    if (s == null) return "null";
    dq stored = s.p() && s.q().b("StoredEnchantments", 9) ? s.q().c("StoredEnchantments", 10) : null;
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + pairs(s.r()) + "," + pairs(stored) + "," + (s.p() && s.q().n("Unbreakable") ? 1 : 0) + "," + s.C() + "," + (s.u() ? js(s.s()) : "null") + "]";
  }
  static int maxLevel(int id) { return aft.b[id].b(); }

  // ---- generators -----------------------------------------------------------
  static final int[] SWORDS = {268, 267, 272, 276, 283}, SHOVELS = {269, 256, 273, 277, 284}, PICKS = {270, 257, 274, 278, 285}, AXES = {271, 258, 275, 279, 286},
    HOES = {290, 291, 292, 293, 294}, OTHERS = {261, 346, 359, 259, 398};
  static final int[] ARMOR = {298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317};
  static final List<Integer> DAMAGEABLE = new ArrayList<>();
  static final int[] PLAIN = {280, 4, 264, 265, 1, 260, 332, 266, 334, 5}; // non-damageable, no sub-item names except planks (damage 0)
  static final Map<Integer, List<Integer>> MATERIALS = new TreeMap<>();
  static final List<Integer> ALL_ITEMS = new ArrayList<>();

  static int[][] randomEnch(int itemId, int max) {
    int n = picks.nextInt(max + 1); List<int[]> r = new ArrayList<>(); Set<Integer> used = new HashSet<>();
    add probe = new add(adb.d(itemId), 1, 0);
    for (int i = 0; i < n; i++) {
      aft e = null;
      for (int tries = 0; tries < 8; tries++) {
        aft c = REG.get(picks.nextInt(REG.size()));
        if (picks.nextInt(10) < 6 && itemId != 403 && !c.a(probe)) continue;
        e = c; break;
      }
      if (e == null) continue;
      if (used.contains(e.B) && picks.nextInt(30) != 0) continue;
      used.add(e.B);
      int lvl, m = e.b(), roll = picks.nextInt(100);
      if (roll < 60) lvl = 1 + picks.nextInt(m); else if (roll < 80) lvl = m; else if (roll < 90) lvl = m + 1; else if (roll < 96) lvl = 1; else lvl = new int[]{0, 7, 10, 127}[picks.nextInt(4)];
      r.add(new int[]{e.B, lvl});
    }
    return r.toArray(new int[0][]);
  }
  static int cost() {
    int p = picks.nextInt(100);
    if (p < 55) return 0;
    if (p < 85) return new int[]{1, 3, 7, 15, 31, 63}[picks.nextInt(6)];
    if (p < 95) return picks.nextInt(101);
    if (p < 98) return new int[]{127, 1000, 65535, 1 << 20, 1 << 30, Integer.MAX_VALUE}[picks.nextInt(6)];
    return new int[]{-1, -5, Integer.MIN_VALUE}[picks.nextInt(3)];
  }
  static add leftStack() {
    int p = picks.nextInt(100), id, count = 1; int[][] stored = null;
    if (p < 62) id = DAMAGEABLE.get(picks.nextInt(DAMAGEABLE.size()));
    else if (p < 70) { id = 403; stored = randomEnch(403, 3); }
    else if (p < 78) { id = 340; count = picks.nextInt(5) == 0 ? 1 + picks.nextInt(5) : 1; }
    else { id = PLAIN[picks.nextInt(PLAIN.length)]; count = picks.nextInt(3) == 0 ? 1 : 1 + picks.nextInt(64); if (id == 5) count = Math.min(count, 64); }
    int max = adb.d(id).o(), damage = 0;
    if (max > 0) { int q = picks.nextInt(100); damage = q < 25 ? 0 : q < 45 ? Math.max(0, max - picks.nextInt(4)) : picks.nextInt(max); }
    boolean unb = max > 0 && picks.nextInt(40) == 0;
    int[][] ench = id == 403 ? null : randomEnch(id, picks.nextInt(3) == 0 ? 3 : 2);
    String name = picks.nextInt(5) == 0 ? new String[]{"Excalibur", "Old Faithful", "x", "\u00a7aGreen"}[picks.nextInt(4)] : null;
    return make(id, count, damage, ench, stored, unb, cost(), name);
  }
  static add rightStack(add left) {
    int p = picks.nextInt(100);
    if (p < 15) return null;
    int lid = adb.b(left.b());
    if (p < 45) { // same item: combine
      int max = adb.d(lid).o(), damage = 0;
      if (max > 0) { int q = picks.nextInt(100); damage = q < 20 ? 0 : q < 35 ? Math.max(0, max - picks.nextInt(4)) : picks.nextInt(max); }
      int[][] ench = lid == 403 ? null : randomEnch(lid, 2), stored = lid == 403 ? randomEnch(403, 3) : null;
      return make(lid, lid == 340 || lid == 403 || max > 0 ? 1 : 1 + picks.nextInt(64), damage, ench, stored, false, cost(), null);
    }
    if (p < 68) { // repair material (matching 75%)
      List<Integer> mats = MATERIALS.get(lid);
      int mid = mats != null && !mats.isEmpty() && picks.nextInt(4) != 0 ? mats.get(picks.nextInt(mats.size())) : PLAIN[picks.nextInt(PLAIN.length)];
      int count = picks.nextInt(4) == 0 ? 64 : 1 + picks.nextInt(picks.nextBoolean() ? 6 : 64);
      return make(mid, count, mid == 5 ? picks.nextInt(6) : 0, null, null, false, picks.nextInt(12) == 0 ? cost() : 0, null);
    }
    if (p < 88) return bookRight();
    if (p < 94) return make(340, 1, 0, null, null, false, cost(), null);
    int[] misc = {276, 311, 280, 261, 359, 4, 346, 403};
    return make(misc[picks.nextInt(misc.length)], 1, 0, null, null, false, 0, null);
  }
  static add bookRight() {
    int[][] st = picks.nextInt(15) == 0 ? new int[0][] : randomEnch(403, 3);
    if (st.length == 0 && picks.nextInt(15) != 0) st = new int[][]{{REG.get(picks.nextInt(REG.size())).B, 1 + picks.nextInt(3)}};
    return make(403, 1, 0, null, st, false, cost(), null);
  }
  static final String[] NEW_NAMES = {"Excalibur", "Dinnerbone", "x", "\u00a7aGreen blade", "a very long name for a sword indeed, forty chars", "\u540d\u524d", "  padded  ", "Name With Spaces"};
  static final String[] BLANKS = {"", " ", "\t", "   ", "\n", "\u2003", "\u00a0", "\u2007", "\u202f", "\u001f", "\u3000"};
  static String pickName(add left, Map<Integer, String> defaults) {
    int p = picks.nextInt(100);
    if (p < 38) return null;
    if (p < 52) return BLANKS[picks.nextInt(BLANKS.length)];
    if (p < 70) return left.u() ? left.s() : defaults.get(adb.b(left.b()));
    if (p < 75) return (left.u() ? left.s() : defaults.get(adb.b(left.b()))) + "!";
    return NEW_NAMES[picks.nextInt(NEW_NAMES.length)];
  }

  // ---- harness --------------------------------------------------------------
  static class Rig { AnvilWorld w; ProbePlayer p; zu con; rb input; aay out; }
  static AnvilWorld world(int meta, boolean remote) throws Exception {
    AnvilWorld w = (AnvilWorld) U.allocateInstance(AnvilWorld.class);
    w.log = new ArrayList<>(); w.meta = meta; w.ax = 5; w.ay = 64; w.az = -3; w.E = remote;
    return w;
  }
  static ProbePlayer player(AnvilWorld w, boolean creative, long seed) throws Exception {
    ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class);
    p.o = w; p.bE = new yw(); p.bE.d = creative; p.Z = new Random(seed);
    p.bm = new yx(p);
    return p;
  }
  static Rig rig(AnvilWorld w, ProbePlayer p) throws Exception {
    Rig r = new Rig(); r.w = w; r.p = p;
    r.con = new zu(p.bm, w, 5, 64, -3, p);
    r.input = (rb) FINPUT.get(r.con); r.out = r.con.a(2);
    return r;
  }
  static String events(List<String> l) { StringBuilder b = new StringBuilder("["); for (String e : l) { if (b.length() > 1) b.append(','); b.append(js(e)); } return b.append(']').toString(); }

  // One ContainerRepair case: put left, put right, send the name, then read the output; optionally take it.
  // level < 0 picks the player's experience level around the cost.
  static void record(String kind, add left, add right, String name, boolean creative, boolean remote, int meta0, int seed, int level, boolean take) throws Exception {
    String inL = enc(left), inR = enc(right);
    AnvilWorld w = world(meta0, remote); ProbePlayer p = player(w, creative, seed);
    Rig r = rig(w, p);
    r.input.a(0, left); r.input.a(1, right);
    if (name != null) r.con.a(name);
    add out = r.out.d();
    String outS = enc(out); int maxCost = r.con.a, used = FUSED.getInt(r.con);
    if (level < 0) { int q = picks.nextInt(10); level = q < 3 ? maxCost - 1 : q < 5 ? maxCost : q < 6 ? maxCost + 1 : picks.nextInt(60); if (level < 0) level = 0; }
    p.bF = level; p.bG = picks.nextInt(3000); p.bH = 0.25f; int total0 = p.bG;
    boolean can = r.out.a(p);
    String takeS = "null";
    if (can && take) {
      r.out.a(p, out);
      add s1 = r.input.a(1);
      takeS = "[" + enc(s1) + "," + p.bF + "," + p.bG + "," + p.bH + "," + events(w.log) + "," + w.meta + "," + r.con.a + "," + enc(r.input.a(0)) + "," + p.Z.nextInt() + "]";
    }
    System.out.println("{\"kind\":\"" + kind + "\",\"row\":[" + inL + "," + inR + "," + js(name) + "," + (creative ? 1 : 0) + "," + (remote ? 1 : 0) + "," + meta0 + "," + seed + "," + level + "," + total0 + "," + outS + "," + maxCost + "," + used + "," + (can ? 1 : 0) + "," + takeS + "]}");
  }

  static void statics(Map<Integer, String> defaults) {
    StringBuilder ids = new StringBuilder("["), mats = new StringBuilder("{");
    for (Object o : adb.e) {
      adb it = (adb) o; int id = adb.b(it); ALL_ITEMS.add(id);
      if (ids.length() > 1) ids.append(','); ids.append(id);
    }
    for (int id : ALL_ITEMS) {
      adb it = adb.d(id); List<Integer> m = new ArrayList<>();
      for (int mid : ALL_ITEMS) if (it.a(new add(it, 1, 0), new add(adb.d(mid), 1, 0))) m.add(mid);
      if (!m.isEmpty()) { MATERIALS.put(id, m); if (mats.length() > 1) mats.append(','); mats.append('"').append(id).append("\":").append(m); }
    }
    StringBuilder names = new StringBuilder("{");
    for (int id : defaults.keySet()) { if (names.length() > 1) names.append(','); names.append('"').append(id).append("\":").append(js(defaults.get(id))); }
    System.out.println("{\"kind\":\"statics\",\"items\":" + ids + "],\"materials\":" + mats + "},\"names\":" + names + "}}");
  }

  static void random(int n) throws Exception {
    Map<Integer, String> defaults = DEFAULTS;
    for (int c = 0; c < n; c++) {
      add left = leftStack(), right = rightStack(left);
      boolean creative = picks.nextInt(4) == 0, remote = picks.nextInt(40) == 0;
      record("repair", left, right, pickName(left, defaults), creative, remote, picks.nextInt(3) << 2 | picks.nextInt(4), picks.nextInt(), -1, c % 3 == 0);
    }
  }
  static void materials() throws Exception {
    for (int id : DAMAGEABLE) {
      List<Integer> mats = MATERIALS.get(id); if (mats == null) continue;
      int max = adb.d(id).o();
      for (int mid : mats) for (int count : new int[]{1, 2, 64}) for (int dmg : new int[]{1, max / 2, max}) for (int e = 0; e < 2; e++) {
        int[][] ench = e == 0 ? null : randomEnch(id, 3);
        record("material", make(id, 1, dmg, ench, null, false, picks.nextInt(3) == 0 ? cost() : 0, null), make(mid, count, 0, null, null, false, 0, null), null, picks.nextInt(5) == 0, false, 0, picks.nextInt(), -1, picks.nextInt(4) == 0);
      }
    }
  }
  static void conflicts() throws Exception {
    int[] items = {403, 276, 278, 311, 313, 261, 279, 346, 359};
    for (int id : items) for (aft a : REG) for (aft b : REG) {
      int la = picks.nextInt(3) == 0 ? a.b() : 1, lb = picks.nextInt(3) == 0 ? b.b() : 1 + picks.nextInt(b.b());
      add left = id == 403 ? make(403, 1, 0, null, new int[][]{{a.B, la}}, false, 0, null) : make(id, 1, picks.nextInt(4) == 0 ? 1 : 0, new int[][]{{a.B, la}}, null, false, 0, null);
      add right = make(403, 1, 0, null, new int[][]{{b.B, lb}}, false, 0, null);
      if (id != 403 && id != 276 && picks.nextInt(3) != 0) continue; // thin out the less interesting item types
      record("conflict", left, right, null, id == 278 && picks.nextBoolean(), false, 0, picks.nextInt(), 100, false);
    }
  }
  static void blocks() throws Exception {
    for (int c = 0; c < 84; c++) {
      boolean creative = c % 8 == 3, remote = c % 16 == 5; int meta0 = c >= 72 ? -1 : (((c / 4) % 3) << 2) | (c % 4); int seed = picks.nextInt();
      AnvilWorld w = world(meta0, remote); ProbePlayer p = player(w, creative, seed);
      StringBuilder steps = new StringBuilder("[");
      for (int step = 0; step < (meta0 < 0 || creative || remote ? 4 : 70); step++) {
        p.bF = 100; w.log.clear();
        Rig r = rig(w, p);
        r.input.a(0, make(257, 1, 100, null, null, false, 0, null)); r.input.a(1, make(265, 2, 0, null, null, false, 0, null));
        add out = r.out.d(); boolean can = r.out.a(p);
        if (can) r.out.a(p, out);
        if (step > 0) steps.append(',');
        steps.append('[').append(can ? 1 : 0).append(',').append(events(w.log)).append(',').append(w.meta).append(',').append(p.bF).append(']');
        if (w.meta < 0 && meta0 >= 0) break;
      }
      System.out.println("{\"kind\":\"block\",\"row\":[" + (creative ? 1 : 0) + "," + (remote ? 1 : 0) + "," + meta0 + "," + seed + "," + steps + "]," + p.Z.nextInt() + "]}");
    }
    for (int seed = 0; seed < 24; seed++) {
      Random r = new Random(seed * 7919L); StringBuilder hits = new StringBuilder("[");
      for (int i = 0; i < 400; i++) if (r.nextFloat() < 0.12f) { if (hits.length() > 1) hits.append(','); hits.append(i); }
      System.out.println("{\"kind\":\"roll\",\"row\":[" + (seed * 7919L) + "," + hits + "]," + r.nextInt() + "]}");
    }
  }

  static final Map<Integer, String> DEFAULTS = new TreeMap<>();
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    for (aft e : aft.b) if (e != null) REG.add(e);
    for (int[] g : new int[][]{SWORDS, SHOVELS, PICKS, AXES, HOES, OTHERS, ARMOR}) for (int id : g) DAMAGEABLE.add(id);
    FINPUT = field(zu.class, "h"); FUSED = field(zu.class, "m");
    for (int id : DAMAGEABLE) DEFAULTS.put(id, new add(adb.d(id), 1, 0).s());
    for (int id : PLAIN) DEFAULTS.put(id, new add(adb.d(id), 1, 0).s());
    DEFAULTS.put(340, new add(adb.d(340), 1, 0).s()); DEFAULTS.put(403, new add(adb.d(403), 1, 0).s());
    statics(DEFAULTS);
    random(9000); materials(); conflicts(); blocks();
  }
}
