import java.lang.reflect.Field;
import java.util.*;

// Knockback on the player, from the unchanged 1.7.10 classes on the EquipmentProbe/DifficultyProbe world double. The target is a real
// EntityPlayer (yz) whose attackEntityFrom (yz.a(ro, F) -> EntityLivingBase.attackEntityFrom -> knockBack) runs unmodified.
//   melee:   EntityMob.attackEntityAsMob (yg.n) of a zombie (bare hand, sword, Knockback I/II sword) on the player, then a second hit in the hurt window
//   golem:   EntityIronGolem.attackEntityAsMob (wt.n)
//   arrow:   EntityArrow.onUpdate (zc.h) onto the player with Punch 0-2, with and without a shooter
//   blast:   Explosion.doExplosionA (agw.a()) of a creeper-like exploder (EntityLivingBase) and of no exploder, player motion after
//   attrs:   movementSpeed / attackDamage attribute values of the player under Slowness, Weakness, Speed and Strength levels 0-3 (EntityLivingBase.addPotionEffect)
// Output is one JSON object per scenario. Motion triples are [motionX, motionY, motionZ].
public class PlayerKnockbackProbe {
  public static class W extends EquipmentProbe.World {
    static List<sa> targets = new ArrayList<>();
    public List b(sa e, azt box) { return a(e, box, null); }
    public List a(sa e, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa t : targets) if (t != e) { try { azt b = (azt) MobMoveProbe.field(sa.class, "C").get(t); if (b.b(box)) out.add(t); } catch (Exception x) { throw new RuntimeException(x); } }
      return out;
    }
  }
  public static class P extends yz {
    P(ahb world) { super(world, new com.mojang.authlib.GameProfile(UUID.nameUUIDFromBytes("probe".getBytes()), "probe")); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static W w;
  static sun.misc.Unsafe u;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static void set(Object o, String name, Object v) throws Exception { MobMoveProbe.set(o, name, v); }
  static String motion(sa e) throws Exception { return "[" + num(MobMoveProbe.d(e, "v")) + "," + num(MobMoveProbe.d(e, "w")) + "," + num(MobMoveProbe.d(e, "x")) + "]"; }
  static void setMotion(sa e, double x, double y, double z) throws Exception { set(e, "v", x); set(e, "w", y); set(e, "x", z); }
  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static void yaw(sa e, float v) throws Exception { MobMoveProbe.field(sa.class, "y").setFloat(e, v); }
  static P player() throws Exception {
    P p = new P(w);
    set(p, "Z", new Random(0));
    p.a(yj.a).a(1000.0); // a player that survives every hit: EntityPlayer.onDeath replaces the motion with its death throw
    p.g(1000.0f);
    place(p, 0.5, 65.62, 0.5); // EntityPlayer.yOffset 1.62: the feet are at 64
    return p;
  }
  static add make(int id, int damage, int... ench) { return EquipmentProbe.make(id, damage, ench); }

  static void setup() throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    w = (W) u.allocateInstance(W.class);
    DifficultyProbe.w = w; EquipmentProbe.u = u;
    set(w, "s", new Random(2));
    set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    MobMoveProbe.field(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
  }

  public static void main(String[] args) throws Exception {
    setup();
    // ---- melee: zombie on the player ------------------------------------------------------------
    double[][] offsets = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 }, { 1.5, 1.5 }, { -0.7, 0.2 } };
    double[][] motions = { { 0, 0, 0 }, { 0.1, -0.0784, 0 }, { -0.2, 0.3, 0.15 }, { 0, 0.6, 0 } };
    int[][] helds = { {}, { 267, 0 }, { 267, 0, 19, 1 }, { 267, 0, 19, 2 }, { 283, 0, 19, 2 } };
    float[] yaws = { 0f, 90f, 180f, -90f, 37.5f };
    for (double[] off : offsets) for (double[] m : motions) for (int[] held : helds) for (float yawV : yaws) {
      P p = player();
      yq z = new yq(w);
      if (held.length > 0) z.c(0, make(held[0], held[1], Arrays.copyOfRange(held, 2, held.length)));
      EquipmentProbe.apply(z);
      place(z, 0.5 + off[0], 64.0, 0.5 + off[1]); yaw(z, yawV);
      set(z, "Z", new Random(5));
      setMotion(p, m[0], m[1], m[2]); setMotion(z, 0.3, 0.0, -0.2);
      boolean hit = z.n(p);
      String first = "\"hit\":" + hit + ",\"motion\":" + motion(p) + ",\"mob\":" + motion(z) + ",\"health\":" + num(p.aS()) + ",\"resist\":" + MobMoveProbe.field(sa.class, "ad").getInt(p);
      boolean hit2 = z.n(p);
      System.out.println("{\"case\":\"melee\",\"offset\":[" + off[0] + "," + off[1] + "],\"motion0\":" + Arrays.toString(m) + ",\"held\":" + Arrays.toString(held) + ",\"yaw\":" + yawV + ",\"first\":{" + first + "},\"second\":{\"hit\":" + hit2 + ",\"motion\":" + motion(p) + ",\"health\":" + num(p.aS()) + "}}");
    }

    // ---- golem: EntityIronGolem.attackEntityAsMob -----------------------------------------------
    for (double[] off : offsets) for (double[] m : motions) {
      for (int seed = 0; seed < 3; seed++) {
        P p = player();
        wt g = new wt(w);
        place(g, 0.5 + off[0], 64.0, 0.5 + off[1]);
        set(g, "Z", new Random(seed));
        setMotion(p, m[0], m[1], m[2]);
        boolean hit = g.n(p);
        System.out.println("{\"case\":\"golem\",\"offset\":[" + off[0] + "," + off[1] + "],\"motion0\":" + Arrays.toString(m) + ",\"seed\":" + seed + ",\"hit\":" + hit + ",\"motion\":" + motion(p) + ",\"health\":" + num(p.aS()) + "}");
      }
    }

    // ---- arrow: EntityArrow.onUpdate on the player (the arrow starts 2 blocks away and flies in) --
    double[][] arrowStarts = { { -2, 0 }, { 2, 0.5 }, { 0.5, -2 } };
    for (double[] st : arrowStarts) for (int punch = 0; punch < 3; punch++) for (int shooterKind = 0; shooterKind < 2; shooterKind++) for (double[] m : motions) {
      P p = player();
      W.targets.clear(); W.targets.add(p);
      zc a = new zc(w, 0.5 + st[0], 65.0, 0.5 + st[1]);
      yq shooter = new yq(w);
      place(shooter, 0.5 + st[0] * 2, 64.0, 0.5 + st[1] * 2);
      if (shooterKind == 1) set(a, "c", shooter);
      a.a(punch);
      set(a, "Z", new Random(11));
      double sx = -st[0], sz = -st[1], len = Math.sqrt(sx * sx + sz * sz);
      setMotion(a, sx / len * 1.2, -0.05, sz / len * 1.2);
      setMotion(p, m[0], m[1], m[2]);
      double ax = MobMoveProbe.d(a, "v"), az = MobMoveProbe.d(a, "x");
      for (int t = 0; t < 4 && !MobMoveProbe.b(a, "K"); t++) a.h();
      System.out.println("{\"case\":\"arrow\",\"start\":[" + st[0] + "," + st[1] + "],\"punch\":" + punch + ",\"shooter\":" + (shooterKind == 1) + ",\"motion0\":" + Arrays.toString(m) + ",\"arrowMotion\":[" + num(ax) + "," + num(az) + "],\"dead\":" + MobMoveProbe.b(a, "K")
        + ",\"motion\":" + motion(p) + ",\"health\":" + num(p.aS()) + ",\"resist\":" + MobMoveProbe.field(sa.class, "ad").getInt(p) + "}");
    }
    W.targets.clear();

    // ---- blast: Explosion.doExplosionA with a living exploder (placed at distance) and without ----
    for (int kind = 0; kind < 2; kind++) for (double[] off : new double[][] { { 2, 0 }, { 0, 2 }, { -1.5, 1.5 }, { 3, 1 } }) for (double[] m : motions) for (float size : new float[] { 3f, 4f }) {
      P p = player();
      W.targets.clear(); W.targets.add(p);
      yq src = new yq(w);
      place(src, 0.5 + off[0], 64.0, 0.5 + off[1]);
      setMotion(p, m[0], m[1], m[2]);
      agw ex = new agw(w, kind == 0 ? src : null, 0.5 + off[0], 64.5, 0.5 + off[1], size);
      ex.a();
      System.out.println("{\"case\":\"blast\",\"exploder\":" + (kind == 0) + ",\"offset\":[" + off[0] + "," + off[1] + "],\"motion0\":" + Arrays.toString(m) + ",\"size\":" + size + ",\"motion\":" + motion(p) + ",\"health\":" + num(p.aS()) + "}");
    }
    W.targets.clear();

    // ---- attrs: potion attribute modifiers on the player ----------------------------------------
    int[] ids = { 1, 2, 5, 18 };
    for (int id : ids) for (int amp = 0; amp < 4; amp++) {
      P p = player();
      p.c(new rw(id, 600, amp));
      System.out.println("{\"case\":\"attrs\",\"effect\":" + id + ",\"amplifier\":" + amp + ",\"movementSpeed\":" + num(p.a(yj.d).e()) + ",\"attackDamage\":" + num(p.a(yj.e).e()) + "}");
    }
    { P p = player(); System.out.println("{\"case\":\"attrs\",\"effect\":0,\"amplifier\":0,\"movementSpeed\":" + num(p.a(yj.d).e()) + ",\"attackDamage\":" + num(p.a(yj.e).e()) + "}"); }
    { P p = player(); p.c(new rw(1, 600, 1)); p.c(new rw(2, 600, 0)); System.out.println("{\"case\":\"attrs\",\"effect\":\"speed2+slow1\",\"amplifier\":0,\"movementSpeed\":" + num(p.a(yj.d).e()) + ",\"attackDamage\":" + num(p.a(yj.e).e()) + "}"); }
    { P p = player(); p.c(new rw(5, 600, 1)); p.c(new rw(18, 600, 0)); System.out.println("{\"case\":\"attrs\",\"effect\":\"strength2+weakness1\",\"amplifier\":0,\"movementSpeed\":" + num(p.a(yj.d).e()) + ",\"attackDamage\":" + num(p.a(yj.e).e()) + "}"); }
  }
}
