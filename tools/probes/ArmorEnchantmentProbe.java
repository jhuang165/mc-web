import java.lang.reflect.*;
import java.util.*;

// PROG-04b: runs the unchanged 1.7.10 classes behind live armour and bow enchantment effects.
//  protection  EntityLivingBase.applyPotionDamageCalculations (sv.c) over a constructor-less living double whose
//              getLastActiveItems is an armour array, with EnchantmentHelper's static Random reseeded per case
//              (sum, cap 25, (n+1>>1)+rand.nextInt((n>>1)+1), cap 20, amount * (25-k) / 25);
//  fire        Entity.setFire (sa.e) through EnchantmentProtection.getFireTimeForEntity;
//  blast       EnchantmentProtection.func_92092_a (Blast Protection knockback, with its floor_double);
//  air         EntityLivingBase.decreaseAirSupply (sv.j) with Entity.rand seeded, Respiration worn in any slot;
//  thorns      EnchantmentHelper.func_151384_a (hurt iterator) on a wearer double: every Thorns piece rolls on the
//              wearer's Entity.rand, the attacker double records attackEntityFrom(thorns) and the sound, and the
//              first Thorns piece loses 3 (hit) or 1 durability through ItemStack.damageItem;
//  bow         ItemBow.onPlayerStoppedUsing (abm.a) with a constructor-less EntityPlayer double, a real
//              InventoryPlayer and an EntityArrow created by the unchanged code (damage, knockback, fire, pickup);
//  effect      ItemStack.hasEffect (add.v, the glint test) for every registered item.
// Case inputs come from fixed java.util.Random streams and are printed with each record.
public class ArmorEnchantmentProbe {
  static sun.misc.Unsafe U;
  static final Random picks = new Random(1710_04_02L);
  static ro[] SOURCES;
  static String[] SOURCE_NAMES;

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
    public float g() { return 1.62f; }
  }
  // A living entity that exposes an armour array (getLastActiveItems) and Entity.rand; the thorns attacker records.
  public static class Living extends sv {
    Living() { super(null); }
    add[] items = new add[4]; add held;
    List<String> log = new ArrayList<>();
    public add be() { return held; }
    public add q(int i) { return items[i]; }
    public void c(int i, add s) {}
    public add[] ak() { return items; }
    public void a(add broken) { log.add("\"broken\""); }
    public boolean a(ro source, float amount) { log.add("[" + ArmorEnchantmentProbe.q(source.p()) + "," + amount + "]"); return true; }
    public void a(String sound, float volume, float pitch) { log.add("[" + ArmorEnchantmentProbe.q(sound) + "," + volume + "," + pitch + "]"); }
    public float calc(ro source, float amount) { return c(source, amount); }
    public int air(int air) { return j(air); }
  }
  static Living living() throws Exception {
    Living e = (Living) U.allocateInstance(Living.class);
    e.items = new add[4]; e.log = new ArrayList<>(); field(sv.class, "f").set(e, new HashMap<>());
    return e;
  }
  public static class ProbeWorld extends ahb {
    zc spawned;
    ProbeWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) { return aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public List a(sa entity, azt box) { return new ArrayList(); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj filter) { return new ArrayList(); }
    public boolean d(sa e) { if (e instanceof zc) spawned = (zc) e; return true; }
  }
  static ProbeWorld world() throws Exception {
    ProbeWorld w = (ProbeWorld) U.allocateInstance(ProbeWorld.class);
    field(ahb.class, "t").set(w, U.allocateInstance(aqq.class));
    field(ahb.class, "C").set(w, new qi());
    field(ahb.class, "u").set(w, new ArrayList());
    return w;
  }

  // ---- stacks -------------------------------------------------------------
  static dh tag(add s) { if (!s.p()) s.d(new dh()); return s.q(); }
  static dq nbtList(int[][] pairs) { dq l = new dq(); for (int[] e : pairs) { dh t = new dh(); t.a("id", (short) e[0]); t.a("lvl", (short) e[1]); l.a(t); } return l; }
  static add make(int id, int damage, int[][] ench) {
    add s = new add(adb.d(id), 1, damage);
    if (ench != null && ench.length > 0) tag(s).a("ench", nbtList(ench));
    return s;
  }
  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  // [itemId,damage,ench]
  static String enc(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.k() + "," + pairs(s.r()) + "]"; }
  static String stacks(add[] a) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(enc(a[i])); } return b.append(']').toString(); }
  static String pairs(int[][] p) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < p.length; i++) { if (i > 0) b.append(','); b.append('[').append(p[i][0]).append(',').append(p[i][1]).append(']'); } return b.append(']').toString(); }

  // Armour slots hold boots (298 + 3 ...) first, as InventoryPlayer.armorInventory; pieces are leather/iron/diamond.
  static final int[][] PIECES = {{301, 305, 309, 313, 317}, {300, 304, 308, 312, 316}, {299, 303, 307, 311, 315}, {298, 302, 306, 310, 314}};
  static final int[] PROT_IDS = {0, 1, 2, 3, 4};
  static int[][] ench(int... flat) { int[][] r = new int[flat.length / 2][]; for (int i = 0; i < r.length; i++) r[i] = new int[]{flat[2 * i], flat[2 * i + 1]}; return r; }
  static add[] randomArmor(boolean heavy) {
    add[] a = new add[4];
    for (int slot = 0; slot < 4; slot++) {
      if (picks.nextInt(6) == 0) continue;
      int[][] e = new int[picks.nextInt(heavy ? 4 : 3)][];
      for (int i = 0; i < e.length; i++) {
        int id = picks.nextInt(10) == 0 ? new int[]{5, 6, 7, 34, 16, 8, 255}[picks.nextInt(7)] : PROT_IDS[picks.nextInt(5)];
        int lvl = picks.nextInt(12) == 0 ? new int[]{0, -1, 5, 10, 127}[picks.nextInt(5)] : 1 + picks.nextInt(4);
        e[i] = new int[]{id, lvl};
      }
      a[slot] = make(PIECES[slot][picks.nextInt(5)], 0, e);
    }
    return a;
  }
  static add[] fixedArmor(int kind) {
    add[] a = new add[4];
    for (int slot = 0; slot < 4; slot++) {
      int[][] e;
      switch (kind) {
        case 0: e = null; break;
        case 1: e = ench(0, 4); break; // Protection IV on every piece: sum 4 * 12 = 48, capped at 25
        case 2: e = ench(slot, 4); break; // one of each type except the helmet's own
        case 3: e = ench(2, 4); break; // Feather Falling IV everywhere
        case 4: e = ench(1, 4); break; // Fire Protection IV
        case 5: e = ench(3, 4); break;
        case 6: e = ench(4, 4); break;
        default: e = ench(0, 10); break; // out-of-range level
      }
      a[slot] = make(PIECES[slot][2], 0, e);
    }
    if (kind == 7) a[2] = null;
    return a;
  }

  static Random helperRandom() throws Exception { return (Random) field(afv.class, "a").get(null); }

  // ---- protection ---------------------------------------------------------
  static void sources() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < SOURCES.length; i++) {
      ro r = SOURCES[i];
      if (i > 0) s.append(',');
      s.append('[').append(q(SOURCE_NAMES[i])).append(',').append(r.a()).append(',').append(r.c()).append(',').append(r.o()).append(',').append(r.g()).append(',').append(r.h()).append(']');
    }
    System.out.println("{\"kind\":\"sources\",\"rows\":" + s + "]}");
  }
  static void protection() throws Exception {
    Random er = helperRandom();
    List<add[]> sets = new ArrayList<>();
    for (int k = 0; k <= 7; k++) sets.add(fixedArmor(k));
    for (int k = 0; k < 18; k++) sets.add(randomArmor(k % 3 == 0));
    float[] amounts = {1.0f, 7.0f};
    for (add[] armor : sets) {
      for (int si = 0; si < SOURCES.length; si++) for (float amount : amounts) {
        Living e = living(); e.items = armor;
        long seed = picks.nextLong(); er.setSeed(seed);
        float out = e.calc(SOURCES[si], amount);
        System.out.println("{\"kind\":\"protection\",\"row\":[" + stacks(armor) + "," + si + "," + amount + "," + ql(seed) + "," + out + "," + er.nextInt() + "]}");
      }
    }
    // Amounts that skip the draw (0 and negative) and fractional/large ones.
    add[] armor = fixedArmor(1);
    for (float amount : new float[]{0.0f, -2.0f, 0.5f, 3.3f, 20.0f, 1000.0f}) for (int si : new int[]{0, 7, 14, 21}) {
      Living e = living(); e.items = armor;
      long seed = picks.nextLong(); er.setSeed(seed);
      float out = e.calc(SOURCES[si], amount);
      System.out.println("{\"kind\":\"protection\",\"row\":[" + stacks(armor) + "," + si + "," + amount + "," + ql(seed) + "," + out + "," + er.nextInt() + "]}");
    }
  }

  // ---- fire and blast -----------------------------------------------------
  static void fire() throws Exception {
    Field fireF = field(sa.class, "e");
    int[] levels = {0, 1, 2, 3, 4, 5, 10};
    for (int lvl : levels) for (int slot = 0; slot < 4; slot += 3) for (int secs : new int[]{1, 3, 5, 8, 15}) for (int start : new int[]{0, 60, 400}) {
      Living e = living();
      if (lvl > 0) e.items[slot] = make(PIECES[slot][2], 0, ench(1, lvl));
      if (lvl == 4) e.items[1 + (slot == 0 ? 0 : 1)] = make(PIECES[1][2], 0, ench(1, 2));
      fireF.setInt(e, start);
      e.e(secs);
      System.out.println("{\"kind\":\"fire\",\"row\":[" + stacks(e.items) + "," + secs + "," + start + "," + fireF.getInt(e) + "]}");
    }
    for (int lvl : new int[]{0, 1, 2, 3, 4, 5, 8, 10, 12}) for (double d : new double[]{0.0, 0.1, 0.5, 0.93, 1.0, 2.5, 7.0}) {
      Living e = living();
      if (lvl > 0) e.items[picks.nextInt(4)] = make(PIECES[0][2], 0, ench(3, lvl));
      System.out.println("{\"kind\":\"blast\",\"row\":[" + stacks(e.items) + "," + d + "," + agi.a((sa) e, d) + "]}");
    }
  }

  // ---- respiration ---------------------------------------------------------
  static void air() throws Exception {
    for (int lvl = 0; lvl <= 4; lvl++) for (int slot = 0; slot < 4; slot++) for (long seed : new long[]{1, 2, 9, 123456789L}) {
      if (lvl == 0 && slot > 0) continue;
      Living e = living();
      if (lvl > 0) e.items[slot] = make(PIECES[slot][2], 0, ench(5, lvl));
      field(sa.class, "Z").set(e, new Random(seed));
      StringBuilder seq = new StringBuilder("["); int air = 300;
      for (int t = 0; t < 60; t++) { air = e.air(air); if (t > 0) seq.append(','); seq.append(air); }
      System.out.println("{\"kind\":\"air\",\"row\":[" + stacks(e.items) + "," + ql(seed) + "," + seq + "]],\"next\":" + ((Random) field(sa.class, "Z").get(e)).nextInt() + "}");
    }
  }

  // ---- thorns --------------------------------------------------------------
  static void thorns() throws Exception {
    for (int c = 0; c < 160; c++) {
      Living wearer = living(), attacker = living();
      long seed = picks.nextLong();
      int pieces = c % 5 == 0 ? 2 : 1, level = 1 + picks.nextInt(c % 8 == 7 ? 14 : 3);
      for (int p = 0; p < 4; p++) {
        int[][] e = null;
        if (p == 2) e = ench(7, level, 34, picks.nextInt(3));
        else if (pieces == 2 && p == 1) e = ench(7, 1 + picks.nextInt(3));
        else if (c % 3 == 0) e = ench(0, 2);
        if (c % 11 == 0 && p == 0) e = null;
        wearer.items[p] = c % 13 == 5 && p == 3 ? null : make(PIECES[p][picks.nextInt(5)], picks.nextInt(3) == 0 ? 20 + picks.nextInt(30) : 0, e);
      }
      if (c % 17 == 3) wearer.items[2] = make(311, c % 2 == 1 ? 526 : 527, ench(7, c % 4 == 1 ? 8 : level)); // a hit (3) or a miss (1) can break it (max 528)
      field(sa.class, "Z").set(wearer, new Random(seed));
      String before = stacks(wearer.items);
      afv.a((sv) wearer, (sa) attacker);
      System.out.println("{\"kind\":\"thorns\",\"row\":[" + before + "," + ql(seed) + "," + attacker.log + "," + wearer.log + "," + stacks(wearer.items) + "," + ((Random) field(sa.class, "Z").get(wearer)).nextInt() + "]}");
    }
  }

  // ---- bows ----------------------------------------------------------------
  static String bowCase(int bowId, int[][] bowEnch, boolean creative, int arrows, int ticks, long seed) throws Exception {
    ProbeWorld w = world();
    ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class);
    p.o = w; p.bE = new yw(); p.bE.d = creative; p.bm = new yx(p);
    field(sa.class, "Z").set(p, new Random(seed));
    field(sa.class, "C").set(p, azt.a(0, 0, 0, 0, 0, 0));
    field(sa.class, "M").set(p, 0.6f); field(sa.class, "N").set(p, 1.8f);
    Method setPos = null;
    for (Class<?> k = sa.class; k != null && setPos == null; k = k.getSuperclass()) try { setPos = k.getDeclaredMethod("b", double.class, double.class, double.class); } catch (NoSuchMethodException e) {}
    setPos.setAccessible(true); setPos.invoke(p, 10.5, 64.0, -3.5);
    field(sa.class, "y").set(p, 33.0f); field(sa.class, "z").set(p, -12.0f);
    add bow = make(bowId, 0, bowEnch);
    if (arrows > 0) p.bm.a(new add(ade.g, arrows, 0));
    String before = enc(bow) + "," + arrows;
    abm item = (abm) adb.d(bowId);
    item.a(bow, w, p, 72000 - ticks);
    zc a = w.spawned;
    String arrow = a == null ? "null" : "[" + a.e() + "," + field(zc.class, "aw").getInt(a) + "," + field(sa.class, "e").getInt(a) + "," + a.a + "," + a.f() + "]";
    int left = 0; for (add s : p.bm.a) if (s != null && s.b() == ade.g) left += s.b;
    return "{\"kind\":\"bow\",\"row\":[" + before + "," + creative + "," + ticks + "," + ql(seed) + "," + arrow + "," + left + "," + enc(bow) + "]}";
  }
  static void bows() throws Exception {
    int[][][] sets = {
      null, ench(48, 1), ench(48, 2), ench(48, 3), ench(48, 4), ench(48, 5), ench(48, 6), ench(49, 1), ench(49, 2), ench(49, 3), ench(50, 1), ench(51, 1),
      ench(48, 5, 49, 2, 50, 1), ench(48, 5, 49, 2, 50, 1, 51, 1), ench(51, 1, 34, 3), ench(34, 3), ench(48, 0), ench(48, 255), ench(48, 1, 48, 3), ench(0, 4),
    };
    for (int[][] s : sets) for (int mode = 0; mode < 4; mode++) for (int ticks : new int[]{1, 4, 12, 20, 40}) {
      boolean creative = mode == 1 || mode == 3; int arrows = mode == 2 || mode == 3 ? 0 : 5;
      System.out.println(bowCase(261, s, creative, arrows, ticks, picks.nextLong()));
    }
    // A bow that is almost spent and a one-arrow stack.
    System.out.println(bowCase(261, ench(51, 1), false, 1, 20, picks.nextLong()));
    System.out.println(bowCase(261, null, false, 1, 20, picks.nextLong()));
    // Non-bow items are not ItemBow; the helper still records the unchanged class only for 261.
  }

  // ---- the glint ------------------------------------------------------------
  static void effects() {
    int[][] ench = ench(34, 1);
    for (Object o : adb.e) {
      adb it = (adb) o; int id = adb.b(it);
      add plain = new add(it, 1, 0), enchanted = new add(it, 1, 0), d1 = new add(it, 1, 1), d8 = new add(it, 1, 8);
      tag(enchanted).a("ench", nbtList(ench));
      add emptyList = new add(it, 1, 0); tag(emptyList).a("ench", new dq());
      add stored = new add(it, 1, 0); tag(stored).a("StoredEnchantments", nbtList(ench));
      System.out.println("{\"kind\":\"effect\",\"row\":[" + id + "," + q(String.valueOf(adb.e.c(it))) + "," + plain.v() + "," + enchanted.v() + "," + d1.v() + "," + d8.v() + "," + emptyList.v() + "," + stored.v() + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    SOURCES = new ro[]{ro.a, ro.b, ro.c, ro.d, ro.e, ro.f, ro.g, ro.h, ro.i, ro.j, ro.k, ro.l, ro.m, ro.n,
      ro.a((agw) null), ro.a((zc) null, (sa) null), ro.a((ze) null, (sa) null), ro.a((sa) null, (sa) null), ro.b((sa) null, (sa) null), ro.a((sa) null), ro.a((sv) null), ro.a((yz) null)};
    SOURCE_NAMES = new String[SOURCES.length];
    for (int i = 0; i < SOURCES.length; i++) SOURCE_NAMES[i] = SOURCES[i].p();
    sources(); protection(); fire(); air(); thorns(); bows(); effects();
  }
}
