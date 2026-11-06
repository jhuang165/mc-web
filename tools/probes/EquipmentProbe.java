import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Mob spawn equipment of the unchanged 1.7.10 classes, on the DifficultyProbe world double:
// EntityLiving.addRandomArmor/enchantEquipment (sw.bC/bD) through onSpawnWithEgg of the zombie (yq),
// zombie pigman (yh) and skeleton (yl, overworld and Nether), the equipment's effect on
// getTotalArmorValue and EntityLivingBase.damageEntity, EntityMob.attackEntityAsMob with the held
// item's attribute modifiers, EntitySkeleton.attackEntityWithRangedAttack's arrow, dropEquipment
// (sw.a(boolean, int)), getExperiencePoints and the item pickup of EntityLiving.onLivingUpdate.
// Output is one JSON object per scenario. Items are [original id, damage, [[enchant id, level]...]].
public class EquipmentProbe {
  public static class World extends DifficultyProbe.World {
    static List<Object> items = new ArrayList<>();
    public List a(Class c, azt box) { return c == xk.class ? new ArrayList<>(items) : new ArrayList(); }
  }
  static World w;
  static sun.misc.Unsafe u;
  static void set(Object o, String name, Object v) throws Exception { MobMoveProbe.set(o, name, v); }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  static String enc(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.k() + "," + pairs(s.r()) + "]"; }
  static String slots(sw e) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < 5; i++) { if (i > 0) b.append(','); b.append(enc(e.q(i))); } return b.append(']').toString(); }
  static String chances(sw e) throws Exception { float[] c = (float[]) MobMoveProbe.field(sw.class, "e").get(e); StringBuilder b = new StringBuilder("["); for (int i = 0; i < 5; i++) { if (i > 0) b.append(','); b.append(num(c[i])); } return b.append(']').toString(); }
  static add make(int id, int damage, int... ench) {
    add s = new add(adb.d(id), 1, damage);
    if (ench.length > 0) {
      dq l = new dq();
      for (int i = 0; i < ench.length; i += 2) { dh t = new dh(); t.a("id", (short) ench[i]); t.a("lvl", (short) ench[i + 1]); l.a(t); }
      if (!s.p()) s.d(new dh());
      s.q().a("ench", l);
    }
    return s;
  }
  static void apply(sv e) throws Exception {
    for (int i = 0; i < 5; i++) { add s = ((sw) e).q(i); if (s != null) e.bc().b(s.D()); }
  }
  static Random rand(sa e) throws Exception { return (Random) MobMoveProbe.field(sa.class, "Z").get(e); }
  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void environment(long worldTime, long inhabited, int month, int day, boolean hell) throws Exception {
    DifficultyProbe.World.inhabited = inhabited;
    DifficultyProbe.setTime(worldTime);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, month - 1, day);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    Object provider = u.allocateInstance(hell ? aqp.class : aqq.class);
    float[] table = new float[16]; Arrays.fill(table, 0.5f);
    MobMoveProbe.field(provider.getClass(), "h").set(provider, table);
    MobMoveProbe.field(ahb.class, "t").set(w, provider);
  }

  // Everything before the pickup loop draws from Entity.rand too, so the loop is driven with one constant float.
  static class Constant extends Random { final float v; Constant(float v) { super(1); this.v = v; } public float nextFloat() { return v; } }

  // The attack target: takes every hit and records its amount (a spider is an arthropod, the zombie undead).
  static float lastAmount;
  static class Spider extends yn { Spider(ahb w) { super(w); } public boolean a(ro s, float a) { lastAmount = a; return true; } }
  static class Zombie extends yq { Zombie(ahb w) { super(w); } public boolean a(ro s, float a) { lastAmount = a; return true; } }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    DifficultyProbe.w = w;
    set(w, "s", new Random(2));
    set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    th reinforcements = DifficultyProbe.reinforcement();

    // ---- spawn: onSpawnWithEgg(null) per mob kind ----------------------------------------------
    String[] kinds = { "zombie", "pigman", "skeleton", "skeletonNether" };
    long[][] locals = { { 0, 3600000 }, { 4, 0 }, { 2, 1800000 }, { 1, 360000 } };
    int[][] dates = { { 6, 1 }, { 10, 31 } };
    for (String kind : kinds)
      for (int d = 1; d < 4; d++)
        for (long[] lc : locals)
          for (int[] date : dates)
            for (int seed = 0; seed < 60; seed++) {
              DifficultyProbe.setDifficulty(d);
              environment(lc[0] * 24000L + 1, lc[1], date[0], date[1], kind.equals("skeletonNether"));
              set(w, "s", new Random(seed * 2654435761L + 31));
              sw e = kind.equals("zombie") ? new yq(w) : kind.equals("pigman") ? new yh(w) : new yl(w);
              if (e instanceof yq) e.a(reinforcements).a(0.0);
              Random rand = new Random(seed);
              set(e, "Z", rand);
              ChickenProbe.World.spawned.clear();
              float local = w.b(0.0, 0.0, 0.0);
              e.a((sy) null);
              apply(e);
              System.out.println("{\"case\":\"spawn\",\"kind\":\"" + kind + "\",\"difficulty\":" + d + ",\"worldTime\":" + (lc[0] * 24000L + 1) + ",\"inhabited\":" + lc[1] + ",\"month\":" + date[0] + ",\"day\":" + date[1]
                + ",\"seed\":" + seed + ",\"worldSeed\":" + (seed * 2654435761L + 31) + ",\"local\":" + num(local) + ",\"equipment\":" + slots(e) + ",\"dropChances\":" + chances(e)
                + ",\"loot\":" + e.bJ() + ",\"skeletonType\":" + (e instanceof yl ? ((yl) e).cb() : -1) + ",\"attack\":" + num(e.a(yj.e).e()) + ",\"followRange\":" + num(e.a(yj.b).e())
                + ",\"armor\":" + e.aV() + ",\"worldNext\":" + w.s.nextInt() + ",\"randNext\":" + rand.nextInt() + "}");
            }

    // ---- armor: damageEntity with worn armour and protection enchantments -----------------------
    DifficultyProbe.setDifficulty(2);
    environment(1, 0, 6, 1, false);
    Random helper = (Random) MobMoveProbe.field(afv.class, "a").get(null);
    int[][][] armorSets = {
      {}, // nothing
      { { 306, 0 }, { 307, 0 }, { 308, 0 }, { 309, 0 } }, // iron
      { { 310, 0 }, { 311, 0 }, { 312, 0 }, { 313, 0 } }, // diamond
      { { 298, 0 }, { 301, 0 } }, // leather helmet and boots
      { { 314, 0 }, { 315, 0 } }, // golden helmet and chestplate
      { { 310, 0, 0, 4 }, { 311, 0, 0, 3 }, { 312, 0, 0, 3 }, { 313, 0, 0, 4 } }, // diamond, protection III-IV
      { { 306, 0, 1, 4 }, { 307, 0, 3, 4 }, { 309, 0, 4, 2 } }, // iron with fire, blast, projectile
      { { 302, 0, 2, 4 }, { 303, 0 } }, // chain with feather falling
    };
    for (String kind : new String[] { "zombie", "pigman", "skeleton" })
      for (int[][] set : armorSets)
        for (String src : new String[] { "mob", "generic" })
          for (float amount : new float[] { 1f, 3f, 5f, 8.5f, 12f, 19f })
            for (int seed = 0; seed < 3; seed++) {
              sw e = kind.equals("zombie") ? new yq(w) : kind.equals("pigman") ? new yh(w) : new yl(w);
              for (int[] piece : set) {
                int[] ench = Arrays.copyOfRange(piece, 2, piece.length);
                add s = make(piece[0], piece[1], ench);
                int slot = piece[0] % 4 == 2 ? 4 : piece[0] % 4 == 3 ? 3 : piece[0] % 4 == 0 ? 2 : 1; // 298 helmet .. 301 boots
                e.c(slot, s);
              }
              e.g(20.0f);
              helper.setSeed(seed * 7 + 1);
              set(e, "Z", new Random(seed));
              DifficultyProbe.Target attacker = new DifficultyProbe.Target(w);
              ro source = src.equals("mob") ? ro.a((sv) attacker) : ro.j;
              MobMoveProbe.method(sv.class, "d", ro.class, float.class).invoke(e, source, amount);
              System.out.println("{\"case\":\"armor\",\"kind\":\"" + kind + "\",\"equipment\":" + slots(e) + ",\"source\":\"" + src + "\",\"amount\":" + num(amount) + ",\"seed\":" + seed
                + ",\"total\":" + e.aV() + ",\"health\":" + num(e.aS()) + ",\"enchantNext\":" + helper.nextInt() + "}");
            }

    // ---- attack: EntityMob.attackEntityAsMob with the held item's modifiers --------------------
    DifficultyProbe.setDifficulty(2);
    int[][] helds = { {}, { 267, 0 }, { 256, 0 }, { 283, 0 }, { 268, 0 }, { 276, 0 }, { 272, 0 }, { 267, 0, 16, 3 }, { 267, 0, 17, 5 }, { 267, 0, 18, 4 }, { 267, 0, 19, 2 }, { 267, 0, 20, 2 }, { 261, 0 }, { 258, 0 } };
    for (String kind : new String[] { "zombie", "pigman", "witherSkeleton" })
      for (int[] held : helds)
        for (String target : new String[] { "spider", "zombie" })
          for (int seed = 0; seed < 2; seed++) {
            sw e = kind.equals("zombie") ? new yq(w) : kind.equals("pigman") ? new yh(w) : new yl(w);
            if (kind.equals("witherSkeleton")) { ((yl) e).a(1); e.a(yj.e).a(4.0); }
            if (held.length > 0) e.c(0, make(held[0], held[1], Arrays.copyOfRange(held, 2, held.length)));
            apply(e);
            sa t = target.equals("spider") ? new Spider(w) : new Zombie(w);
            set(e, "Z", new Random(seed));
            lastAmount = -1;
            boolean hit = e.n(t);
            System.out.println("{\"case\":\"attack\",\"kind\":\"" + kind + "\",\"equipment\":" + slots(e) + ",\"target\":\"" + target + "\",\"seed\":" + seed + ",\"attribute\":" + num(e.a(yj.e).e()) + ",\"hit\":" + hit
              + ",\"amount\":" + num(lastAmount) + ",\"targetFire\":" + MobMoveProbe.field(sa.class, "e").getInt(t) + ",\"targetMotion\":[" + num(MobMoveProbe.d(t, "v")) + "," + num(MobMoveProbe.d(t, "w")) + "," + num(MobMoveProbe.d(t, "x")) + "]"
              + ",\"attackerMotion\":[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "x")) + "],\"randNext\":" + rand(e).nextInt() + "}");
          }

    // ---- arrow: EntitySkeleton.attackEntityWithRangedAttack -------------------------------------
    int[][] bows = { { 261, 0 }, { 261, 0, 48, 1 }, { 261, 0, 48, 3 }, { 261, 0, 48, 5 }, { 261, 0, 49, 1 }, { 261, 0, 49, 2 }, { 261, 0, 50, 1 }, { 261, 0, 48, 2, 49, 1, 50, 1 }, { 261, 0, 51, 1 } };
    for (int d = 0; d < 4; d++)
      for (int[] bow : bows)
        for (boolean wither : new boolean[] { false, true })
          for (int seed = 0; seed < 2; seed++) {
            DifficultyProbe.setDifficulty(d);
            yl e = new yl(w);
            if (wither) e.a(1);
            e.c(0, make(bow[0], bow[1], Arrays.copyOfRange(bow, 2, bow.length)));
            place(e, 0.5, 64.0, 0.5);
            yq target = new yq(w);
            place(target, 6.5, 64.0, 2.5);
            set(e, "Z", new Random(seed));
            ChickenProbe.World.spawned.clear();
            e.a((sv) target, 1.0f);
            String arrow = "null";
            for (Object o : ChickenProbe.World.spawned) if (o instanceof zc) {
              zc a = (zc) o;
              arrow = "[" + num(a.e()) + "," + MobMoveProbe.field(zc.class, "aw").getInt(a) + "," + MobMoveProbe.field(sa.class, "e").getInt(a) + "," + a.f() + "]";
            }
            System.out.println("{\"case\":\"arrow\",\"difficulty\":" + d + ",\"wither\":" + wither + ",\"equipment\":" + slots(e) + ",\"seed\":" + seed + ",\"arrow\":" + arrow + ",\"randNext\":" + rand(e).nextInt() + "}");
          }

    // ---- drops: dropEquipment and getExperiencePoints ---------------------------------------------
    DifficultyProbe.setDifficulty(2);
    Object[][] dropSets = {
      // held, boots, leggings, chest, helmet, chances (null = 0.085 each)
      { make(283, 0), make(317, 0), make(316, 0), make(315, 0), make(314, 0), null },
      { make(267, 5), null, null, make(307, 100), make(298, 3), null },
      { make(261, 0), make(309, 0), null, null, make(86, 0), new float[] { 0.085f, 0.085f, 0.085f, 0.085f, 0.0f } },
      { make(272, 10, 21, 2), make(301, 0), null, make(303, 7), make(310, 30, 0, 4), new float[] { 2.0f, 0.085f, 0.085f, 2.0f, 2.0f } },
      { make(256, 0), null, null, null, make(306, 0), new float[] { 2.0f, 0.085f, 0.085f, 0.085f, 1.0f } },
      { make(276, 1560), null, make(312, 494), null, null, null },
    };
    for (String kind : new String[] { "zombie", "skeleton" })
      for (Object[] set : dropSets)
        for (boolean hit : new boolean[] { false, true })
          for (int looting = 0; looting < 4; looting++)
            for (int seed = 0; seed < 15; seed++) {
              sw e = kind.equals("zombie") ? new yq(w) : new yl(w);
              for (int i = 0; i < 5; i++) if (set[i] != null) e.c(i, ((add) set[i]).m());
              if (set[5] != null) set(e, "e", ((float[]) set[5]).clone());
              set(e, "Z", new Random(seed));
              ChickenProbe.World.spawned.clear();
              String before = slots(e), chances = chances(e);
              MobMoveProbe.method(sw.class, "a", boolean.class, int.class).invoke(e, hit, looting);
              StringBuilder drops = new StringBuilder("[");
              for (Object o : ChickenProbe.World.spawned) if (o instanceof xk) { add s = ((xk) o).f(); drops.append(drops.length() > 1 ? "," : "").append(enc(s)); }
              drops.append("]");
              long nextDrop = rand(e).nextLong();
              set(e, "Z", new Random(seed + 500));
              MobMoveProbe.field(sw.class, "b").setInt(e, 5);
              int xp = (Integer) MobMoveProbe.method(sw.class, "e", yz.class).invoke(e, (Object) null);
              System.out.println("{\"case\":\"drop\",\"kind\":\"" + kind + "\",\"equipment\":" + before + ",\"dropChances\":" + chances + ",\"hit\":" + hit + ",\"looting\":" + looting + ",\"seed\":" + seed
                + ",\"drops\":" + drops + ",\"randNext\":" + nextDrop + ",\"xp\":" + xp + "}");
            }

    // ---- pickup: EntityLiving.onLivingUpdate's item loop (canPickUpLoot) ---------------------------
    DifficultyProbe.setDifficulty(2);
    environment(18000, 0, 6, 1, false);
    add[] held = { null, make(283, 0), make(267, 0), make(272, 0), make(256, 0), make(267, 5, 16, 2), make(276, 0), make(268, 0) };
    add[] worn = { null, make(298, 0), make(306, 0), make(306, 30), make(310, 0), make(310, 0, 0, 3), make(314, 0), make(86, 0) };
    for (String kind : new String[] { "zombie", "pigman" })
      for (boolean loot : new boolean[] { true, false })
        for (int slot = 0; slot < 2; slot++)
          for (int cur = 0; cur < (slot == 0 ? held.length : worn.length); cur++)
            for (int cand = 0; cand < (slot == 0 ? held.length : worn.length) + 3; cand++)
              for (float roll : new float[] { 0.05f, 0.15f, 0.2f, 0.9f }) {
                add current = slot == 0 ? held[cur] : worn[cur];
                add candidate = cand < (slot == 0 ? held.length : worn.length) ? (slot == 0 ? held[cand] : worn[cand]) : cand == (slot == 0 ? held.length : worn.length) ? make(3, 0) : cand == (slot == 0 ? held.length : worn.length) + 1 ? make(298, 0, 34, 2) : new add(adb.d(4), 5, 0);
                if (candidate == null) continue;
                sw e = kind.equals("zombie") ? new yq(w) : new yh(w);
                place(e, 0.5, 64.0, 0.5);
                if (current != null) e.c(slot == 0 ? 0 : 4, current.m());
                e.h(loot);
                set(e, "Z", new Constant(roll));
                xk item = new xk(w, 0.5, 64.0, 0.5, candidate.m());
                World.items = new ArrayList<>(List.of(item));
                ChickenProbe.World.spawned.clear();
                String before = slots(e);
                try { MobMoveProbe.method(sw.class, "e").invoke(e); } catch (java.lang.reflect.InvocationTargetException ex) { if (!(ex.getCause() instanceof ClassCastException)) throw ex; }
                StringBuilder dropped = new StringBuilder("[");
                for (Object o : ChickenProbe.World.spawned) if (o instanceof xk && o != item) dropped.append(dropped.length() > 1 ? "," : "").append(enc(((xk) o).f()));
                dropped.append("]");
                System.out.println("{\"case\":\"pickup\",\"kind\":\"" + kind + "\",\"loot\":" + loot + ",\"slot\":" + (slot == 0 ? 0 : 4) + ",\"before\":" + before + ",\"item\":" + enc(candidate) + ",\"roll\":" + num(roll)
                  + ",\"after\":" + slots(e) + ",\"dropChances\":" + chances(e) + ",\"persistence\":" + MobMoveProbe.field(sw.class, "bt").getBoolean(e) + ",\"dropped\":" + dropped + "}");
              }
  }
}
