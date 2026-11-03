import java.lang.reflect.Field;
import java.util.*;

// Live effects of tool and weapon enchantments, run on the unchanged 1.7.10 classes over the
// CombatProbe world double (a stone floor, captured spawned entities and sounds, a Random for
// World.rand): EntityPlayer.getCurrentPlayerStrVsBlock (Efficiency, Aqua Affinity, the underwater
// and airborne divisions), Block.harvestBlock for real block objects (Silk Touch, Fortune, the
// drops on World.rand and the experience orbs), EntityPlayer.attackTargetEntityWithCurrentItem
// (Sharpness, Smite, Bane of Arthropods, Knockback, Fire Aspect, critical hits, the magic-crit
// flag, tool damage) and EntityLivingBase.onDeath with Looting (dropFewItems, dropEquipment, the
// rare drop). Case inputs come from fixed seeds and are printed with every record.
// No game class is patched or shipped.
public class EnchantmentEffectProbe {
  static final int SHARPNESS = 16, SMITE = 17, BANE = 18, KNOCKBACK = 19, FIRE_ASPECT = 20, LOOTING = 21, EFFICIENCY = 32, SILK = 33, UNBREAKING = 34, FORTUNE = 35, AQUA = 6;
  static CombatProbe.World w;
  static Random picks = new Random(17101711L);

  public static class Player extends DifficultyProbe.Player {
    boolean wet, magic, crit;
    public boolean a(awt material) { return wet && material == awt.h; }
    public void b(sa target) { crit = true; }
    public void c(sa target) { magic = true; }
  }

  // The block fixture: air above everything, `below` under the harvested cell.
  public static class World extends CombatProbe.World {
    static Map<String, Integer> ids = new HashMap<>(), metas = new HashMap<>();
    static List<String> sets = new ArrayList<>();
    public aji a(int x, int y, int z) { Integer id = ids.get(x + "," + y + "," + z); return aji.e(id == null ? (y < 0 ? 1 : 0) : id); }
    public int e(int x, int y, int z) { Integer m = metas.get(x + "," + y + "," + z); return m == null ? 0 : m; }
    public boolean d(int x, int y, int z, aji block, int meta, int flags) { sets.add("[" + x + "," + y + "," + z + "," + aji.b(block) + "," + meta + "]"); return true; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }

  static add stack(int id, int[][] ench) {
    add s = new add(adb.d(id), 1, 0);
    if (ench != null) for (int[] e : ench) if (e[1] > 0) s.a(aft.b[e[0]], e[1]);
    return s;
  }
  static String enchJson(int[][] ench) {
    StringBuilder b = new StringBuilder("[");
    if (ench != null) for (int[] e : ench) { if (b.length() > 1) b.append(','); b.append('[').append(e[0]).append(',').append(e[1]).append(']'); }
    return b.append(']').toString();
  }
  static String drops() {
    StringBuilder s = new StringBuilder();
    for (Object o : CombatProbe.World.spawned)
      if (o instanceof xk) {
        add st = ((xk) o).f();
        s.append(s.length() == 0 ? "" : ",").append("[").append(adb.b(st.b())).append(",").append(st.b).append(",").append(st.k()).append("]");
      }
    return "[" + s + "]";
  }
  static String xp() throws Exception { return CombatProbe.xp(); }

  static Player player(sun.misc.Unsafe u) throws Exception {
    Player p = DifficultyProbe.player(u, Player.class);
    fd(yz.class, "bm").set(p, new yx(p));
    fd(yz.class, "bp").set(p, new zr());
    return p;
  }

  // ---- dig speed ----------------------------------------------------------
  static void dig(Player p) throws Exception {
    int[] blocks = {1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 20, 21, 24, 30, 31, 35, 41, 42, 45, 47, 49, 56, 57, 58, 59, 61, 65, 66, 73, 78, 79, 80, 81, 82, 86, 103, 106, 110, 129, 145, 174, 52, 60, 85, 46};
    int[] tools = {0, 268, 267, 283, 270, 257, 285, 271, 258, 286, 269, 256, 284, 291, 359};
    // [efficiency, env]: env 0 dry ground, 1 wet ground, 2 wet ground with Aqua Affinity, 3 dry airborne, 4 wet airborne with Aqua Affinity.
    int[][] cases = {{0, 0}, {1, 0}, {2, 0}, {3, 0}, {5, 0}, {0, 1}, {2, 1}, {0, 2}, {2, 2}, {0, 3}, {3, 3}, {0, 4}, {3, 4}};
    yx inv = p.bm;
    for (int block : blocks) {
      aji b = aji.e(block);
      for (int tool : tools)
        for (int[] c : cases) {
          for (int i = 0; i < inv.b.length; i++) inv.b[i] = null;
          for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
          inv.c = 0;
          if (tool != 0) inv.a[0] = stack(tool, c[0] > 0 ? new int[][]{{EFFICIENCY, c[0]}} : null);
          boolean wet = c[1] == 1 || c[1] == 2 || c[1] == 4;
          if (c[1] >= 1) inv.b[3] = stack(306, c[1] == 2 || c[1] == 4 ? new int[][]{{AQUA, 1}} : null);
          p.wet = wet;
          fd(sa.class, "D").setBoolean(p, c[1] < 3);
          float speed = p.a(b, false);
          System.out.println("{\"case\":\"dig\",\"block\":" + block + ",\"tool\":" + tool + ",\"eff\":" + c[0] + ",\"env\":" + c[1] + ",\"speed\":" + num(speed) + "}");
        }
    }
    p.wet = false;
    fd(sa.class, "D").setBoolean(p, true);
    for (int i = 0; i < inv.b.length; i++) inv.b[i] = null;
    for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
  }

  // ---- block harvest ------------------------------------------------------
  // [block, metas, below block, seeds]
  static final int[][] HARVEST = {
    {2, 0, 3, 4}, {3, 0, 3, 3}, {3, 2, 3, 3}, {1, 0, 3, 4}, {4, 0, 3, 3}, {13, 0, 3, 20}, {12, 0, 3, 3},
    {16, 0, 3, 20}, {15, 0, 3, 3}, {14, 0, 3, 3}, {56, 0, 3, 20}, {129, 0, 3, 20}, {21, 0, 3, 20}, {73, 0, 3, 20}, {74, 0, 3, 20},
    {20, 0, 3, 3}, {95, 0, 3, 3}, {102, 0, 3, 3}, {82, 0, 3, 3}, {80, 0, 3, 3}, {110, 0, 3, 3}, {47, 0, 3, 3}, {103, 0, 3, 20}, {86, 0, 3, 4}, {86, 2, 3, 4},
    {30, 0, 3, 3}, {49, 0, 3, 3}, {35, 0, 3, 3}, {35, 11, 3, 3}, {159, 0, 3, 3}, {159, 7, 3, 3}, {24, 1, 3, 3}, {45, 0, 3, 3},
    {17, 0, 3, 3}, {17, 5, 3, 3}, {162, 1, 3, 3}, {5, 3, 3, 3}, {5, 0, 3, 3},
    {79, 0, 3, 3}, {79, 0, 8, 3}, {79, 0, 0, 3}, {174, 0, 3, 3},
    {78, 0, 3, 3}, {78, 3, 3, 3}, {78, 7, 3, 3}, {23, 0, 3, 3}, {52, 0, 3, 20}, {145, 0, 3, 3}, {145, 4, 3, 3}, {145, 8, 3, 3},
    {99, 0, 3, 16}, {99, 5, 3, 16}, {99, 10, 3, 16}, {100, 14, 3, 16}, {100, 15, 3, 16},
    {18, 0, 3, 50}, {18, 1, 3, 50}, {18, 2, 3, 20}, {18, 3, 3, 50}, {18, 8, 3, 20}, {18, 4, 3, 3}, {161, 0, 3, 50}, {161, 1, 3, 50}, {161, 5, 3, 3},
    {31, 0, 3, 12}, {31, 1, 3, 20}, {31, 2, 3, 20}, {32, 0, 3, 12}, {37, 0, 3, 3}, {106, 0, 3, 3}, {175, 0, 3, 3},
    {59, 0, 60, 12}, {59, 5, 60, 12}, {59, 7, 60, 24}, {141, 0, 60, 12}, {141, 3, 60, 12}, {141, 7, 60, 24}, {142, 0, 60, 12}, {142, 7, 60, 24},
    {83, 0, 3, 3}, {81, 0, 3, 3}, {127, 0, 3, 3}, {127, 8, 3, 3}, {6, 0, 3, 3}, {85, 0, 3, 3}, {65, 0, 3, 3}, {66, 0, 3, 3}, {120, 0, 3, 3}, {7, 0, 3, 3}
  };
  // [id, level] sets: 0 none, 1 silk, 2 fortune 1, 3 fortune 2, 4 fortune 3, 5 silk + fortune 3, 6 fortune 4 (clamped caps).
  static final int[][][] SETS = {null, {{SILK, 1}}, {{FORTUNE, 1}}, {{FORTUNE, 2}}, {{FORTUNE, 3}}, {{SILK, 1}, {FORTUNE, 3}}, {{FORTUNE, 4}}};

  static void harvest(Player p) throws Exception {
    yx inv = p.bm;
    inv.c = 0;
    for (int[] spec : HARVEST) {
      int id = spec[0], meta = spec[1], below = spec[2], seeds = spec[3];
      aji block = aji.e(id);
      if (block == null || id == 0) continue;
      for (int set = 0; set < SETS.length; set++)
        for (int seed = 0; seed < seeds; seed++) {
          World.ids.clear(); World.metas.clear(); World.sets.clear();
          World.ids.put("0,64,0", id); World.metas.put("0,64,0", meta);
          World.ids.put("0,63,0", below); World.ids.put("0,65,0", 0);
          for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
          inv.a[0] = stack(257, SETS[set]);
          Random rand = new Random(seed * 2654435761L + id * 31 + meta);
          MobMoveProbe.set(w, "s", rand);
          CombatProbe.World.spawned.clear();
          block.a(w, p, 0, 64, 0, meta);
          System.out.println("{\"case\":\"harvest\",\"block\":" + id + ",\"meta\":" + meta + ",\"below\":" + below + ",\"set\":" + set + ",\"seed\":" + (seed * 2654435761L + id * 31 + meta)
            + ",\"drops\":" + drops() + ",\"xp\":" + xp() + ",\"sets\":[" + String.join(",", World.sets) + "],\"next\":" + rand.nextInt() + "}");
        }
    }
    for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
  }

  // ---- attack and looting -------------------------------------------------
  static final String[] MOBS = {"pig", "cow", "sheep", "chicken", "zombie", "skeleton", "spider", "creeper"};
  static sv make(String type) {
    switch (type) {
      case "pig": return new wo(w);
      case "cow": return new wh(w);
      case "sheep": return new wp(w);
      case "chicken": return new wg(w);
      case "zombie": return new yq(w);
      case "skeleton": return new yl(w);
      case "spider": return new yn(w);
      default: return new xz(w);
    }
  }
  static final int[] WEAPONS = {0, 268, 272, 267, 276, 283, 271, 258, 270, 257, 269, 256, 291, 359};

  static String effectJson(sv e) {
    rw slow = e.b(rv.a[2]);
    return slow == null ? "null" : "[" + slow.b() + "," + slow.c() + "]";
  }

  static void attack(Player p, sun.misc.Unsafe u, int index, int weapon, int[][] ench, String type, boolean crit, boolean sprint, boolean burning, int prehit, float health, int seed, float yaw, boolean armorBane, int baneArmorLevel) throws Exception {
    yx inv = p.bm;
    for (int i = 0; i < inv.a.length; i++) inv.a[i] = null;
    for (int i = 0; i < inv.b.length; i++) inv.b[i] = null;
    inv.c = 0;
    // The attack damage attribute with the held item's modifiers, as EntityLivingBase.onUpdate applies them.
    add held = weapon == 0 ? null : stack(weapon, ench);
    inv.a[0] = held;
    if (armorBane) inv.b[2] = stack(300, new int[][]{{BANE, baneArmorLevel}});
    ti attack = p.a(yj.e);
    attack.a(1.0);
    for (Object m : new ArrayList<>(attack.c())) attack.b((tj) m);
    if (held != null) p.bc().b(held.D());
    sv e = make(type);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 8.5, 0, -4.5);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(p, 10.5, 0, -4.0);
    if (type.equals("skeleton")) e.c(0, new add(ade.f));
    if (type.equals("sheep")) ((wp) e).s(seed % 16);
    Random rand = new Random(seed);
    MobMoveProbe.set(e, "Z", rand);
    Random prand = new Random(seed * 7 + 3);
    MobMoveProbe.set(p, "Z", prand);
    MobMoveProbe.set(w, "s", new Random(seed + 900));
    e.g(health);
    if (burning) e.e(8);
    p.crit = false; p.magic = false;
    fd(sa.class, "y").setFloat(p, yaw);
    fd(sa.class, "R").setFloat(p, crit ? 1.5f : 0f);
    fd(sa.class, "D").setBoolean(p, !crit);
    p.c(sprint);
    CombatProbe.World.spawned.clear();
    if (prehit > 0) {
      e.a(ro.h, 3f);
      CombatProbe.World.spawned.clear();
    }
    e.v = 0; e.w = 0; e.x = 0;
    p.v = 0.3; p.w = 0; p.x = -0.2;
    p.r(e);
    System.out.println("{\"case\":\"attack\",\"index\":" + index + ",\"weapon\":" + weapon + ",\"ench\":" + enchJson(ench) + ",\"mob\":\"" + type + "\",\"crit\":" + crit + ",\"sprint\":" + sprint
      + ",\"burning\":" + burning + ",\"prehit\":" + prehit + ",\"health0\":" + num(health) + ",\"seed\":" + seed + ",\"yaw\":" + num(yaw) + ",\"armorBane\":" + baneArmorLevel
      + ",\"health\":" + num(e.aS()) + ",\"fire\":" + fd(sa.class, "e").getInt(e) + ",\"motion\":[" + num(e.v) + "," + num(e.w) + "," + num(e.x) + "],\"pmotion\":[" + num(p.v) + "," + num(p.w) + "," + num(p.x) + "]"
      + ",\"sprinting\":" + p.ao() + ",\"critFx\":" + p.crit + ",\"magicFx\":" + p.magic + ",\"toolDamage\":" + (held == null ? 0 : held.k()) + ",\"toolCount\":" + (held == null ? 0 : held.b)
      + ",\"recentlyHit\":" + fd(sv.class, "aS").getInt(e) + ",\"resist\":" + fd(sa.class, "ad").getInt(e) + ",\"lastDamage\":" + num(fd(sv.class, "bb").getFloat(e))
      + ",\"slowness\":" + effectJson(e) + ",\"drops\":" + drops()
      + ",\"randNext\":" + rand.nextInt() + ",\"playerNext\":" + prand.nextInt() + ",\"worldNext\":" + w.s.nextInt() + "}");
    CombatProbe.World.spawned.clear();
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (CombatProbe.World) u.allocateInstance(World.class);
    DifficultyProbe.w = w;
    CombatProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    fd(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);

    Player p = player(u);
    dig(p);
    harvest(p);

    int index = 0;
    // Random weapon, enchantments, mob and state: 1200 attacks.
    for (; index < 1200; index++) {
      int weapon = WEAPONS[picks.nextInt(WEAPONS.length)];
      List<int[]> en = new ArrayList<>();
      if (picks.nextInt(3) == 0) en.add(new int[]{SHARPNESS, 1 + picks.nextInt(5)});
      if (picks.nextInt(3) == 0) en.add(new int[]{SMITE, 1 + picks.nextInt(5)});
      if (picks.nextInt(3) == 0) en.add(new int[]{BANE, 1 + picks.nextInt(5)});
      if (picks.nextInt(3) == 0) en.add(new int[]{KNOCKBACK, 1 + picks.nextInt(2)});
      if (picks.nextInt(3) == 0) en.add(new int[]{FIRE_ASPECT, 1 + picks.nextInt(2)});
      if (picks.nextInt(3) == 0) en.add(new int[]{LOOTING, 1 + picks.nextInt(3)});
      if (picks.nextInt(8) == 0) en.add(new int[]{EFFICIENCY, 1 + picks.nextInt(5)});
      String mob = MOBS[picks.nextInt(MOBS.length)];
      float[] hs = {1f, 2f, 4f, 6f, 10f, 20f};
      boolean bane = picks.nextInt(15) == 0;
      attack(p, u, index, weapon, en.toArray(new int[0][]), mob, picks.nextInt(3) == 0, picks.nextInt(3) == 0, picks.nextInt(4) == 0, picks.nextInt(6) == 0 ? 1 : 0,
        hs[picks.nextInt(hs.length)], index * 17 + 5, new float[]{0f, 30f, 90f, -45f, 135f, 180f}[picks.nextInt(6)], bane, bane ? 1 + picks.nextInt(3) : 0);
    }
    // Looting: a diamond sword kills every mob (and a spider and zombie with smite/bane too).
    for (String mob : MOBS)
      for (int looting = 0; looting <= 3; looting++)
        for (int seed = 0; seed < 14; seed++, index++)
          attack(p, u, index, 276, looting > 0 ? new int[][]{{LOOTING, looting}} : null, mob, false, false, seed % 3 == 1, 0, 20f, 4000 + seed * 13 + looting, 0f, false, 0);
    // 40 rare-drop rolls on zombies: nextInt(200) - looting < 5.
    for (int looting = 0; looting <= 3; looting++)
      for (int seed = 0; seed < 160; seed++, index++)
        attack(p, u, index, 276, looting > 0 ? new int[][]{{LOOTING, looting}} : null, "zombie", false, false, false, 0, 20f, 9000 + seed, 0f, false, 0);
  }
}
