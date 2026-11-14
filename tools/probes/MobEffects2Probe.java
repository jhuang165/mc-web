import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 54 (effects2). The unchanged 1.7.10 EntityLivingBase / PotionEffect / Potion classes on the MobEffectsProbe world double:
//   b54order  random sequences of put (the NBT reader's map.put), addPotionEffect (sv.c(rw)) and updatePotionEffects (sv.aO) on a Pig; the effect list
//             Entity.writeToNBTOptional writes afterwards, in the HashMap's own iteration order ([id, amplifier, duration, ambient] rows)
//   b54import hand-built ActiveEffects lists (order, duplicates, ids outside 1..23, duration 0 and below) read by EntityList.createEntityFromNBT:
//             the loaded map in iteration order, and the list the loaded mob writes
//   b54inst   instant health (6) and instant damage (7) effects put into the map (as a load does) on living and undead kinds, ticked four times: health,
//             and the map, after each tick
//   b54hb     health boost (21) added with addPotionEffect (onNewPotionEffect applies the maxHealth modifier), re-added, put by a load, and ticked to its end:
//             getMaxHealth and health after each step, and the Attributes the mob writes
//   b54jump   EntityLivingBase.jump (sv.bj, yf.bj for the magma cube) with Jump Boost: motionY, and the fall damage a fall of each distance does
//
// Batch 55 (effects3):
//   b55attr   per kind (EntityHorse by Type 0..4): getCreatureAttribute (sv.bd), isEntityUndead (sv.aR) and isPotionApplicable (sv.d(rw)) for ids 0..24
//   b55comb   random sequences of addPotionEffect (sv.c(rw), PotionEffect.combine) with ambient flags on Pig (and Zombie / Spider / WitherBoss for the refusal rules):
//             the effect rows [id, amplifier, duration, ambient] after every call
//   b55inst   Potion.affectEntity (rv.a(thrower, target, amplifier, factor), the splash potion's instant branch, no thrower) on every kind
public class MobEffects2Probe {
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static HorseProbe.World W;
  static Field MAP;
  static boolean J7; // batch 65: swap each new mob's activePotionsMap for the Java 7 HashMap port (Java7Map) before anything is put in it
  static Method UPDATE;
  static String hex(dh tag) throws Exception { return MobEffectsProbe.hex(tag); }
  static sa make(String kind) throws Exception {
    sa m = sg.a(kind, W);
    if (m == null) throw new IllegalStateException("no mob " + kind);
    if (J7) MAP.set(m, new Java7Map());
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(m, 100.5, 64.0, -20.25);
    return m;
  }
  static HashMap map(sa m) throws Exception { return (HashMap) MAP.get(m); }
  static void put(sa m, int id, int amp, int dur, boolean amb) throws Exception { map(m).put(Integer.valueOf(id), new rw(id, dur, amp, amb)); }
  static void tick(sa m) throws Exception { UPDATE.invoke(m); }
  // [[id, amplifier, duration, ambient], ...] in the map's iteration order
  static String effects(sa m) throws Exception {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : map(m).values()) {
      rw p = (rw) o;
      s.append(first ? "" : ",").append("[").append(p.a()).append(",").append(p.c()).append(",").append(p.b()).append(",").append(p.e() ? 1 : 0).append("]");
      first = false;
    }
    return s.append("]").toString();
  }
  static String written(sa m) throws Exception {
    dh t = new dh();
    m.c(t);
    return hex(t);
  }
  static String error(Throwable x) { Throwable c = x.getCause() != null ? x.getCause() : x; return "\"" + c.toString().replace("\"", "'") + "\""; }

  // ---- b54order
  static void order(int seed, int ops, boolean wide) throws Exception {
    Random r = new Random(seed);
    sa m = make("Pig");
    StringBuilder log = new StringBuilder("[");
    String err = "null";
    try {
      for (int i = 0; i < ops; i++) {
        int kind = wide && i < 14 ? 0 : r.nextInt(5);
        int id = wide && i < 14 ? i + 1 : 1 + r.nextInt(23), amp = r.nextInt(3), dur = 1 + r.nextInt(wide ? 14 : 6);
        if (id == 6 || id == 7 || id == 20) id = 1 + (id % 5); // no hurting or healing: this scenario is about order
        if (kind <= 1) { put(m, id, amp, dur, false); log.append(i == 0 ? "" : ",").append("[\"put\",").append(id).append(",").append(amp).append(",").append(dur).append("]"); }
        else if (kind <= 3) { ((sv) m).c(new rw(id, dur, amp)); log.append(i == 0 ? "" : ",").append("[\"add\",").append(id).append(",").append(amp).append(",").append(dur).append("]"); }
        else { int n = 1 + r.nextInt(wide ? 6 : 3); for (int k = 0; k < n; k++) tick(m); log.append(i == 0 ? "" : ",").append("[\"tick\",").append(n).append("]"); }
      }
    } catch (Throwable x) { err = error(x); }
    String w = written(m);
    System.out.println("{\"tag\":\"b54order\",\"seed\":" + seed + ",\"ops\":" + log + "],\"nbt\":\"" + w + "\",\"effects\":" + effects(m) + ",\"error\":" + err + "}");
  }

  // ---- b54import
  static dh effectTag(int id, int amp, int dur, boolean amb) {
    dh e = new dh();
    e.a("Id", (byte) id);
    e.a("Amplifier", (byte) amp);
    e.a("Duration", dur);
    e.a("Ambient", amb);
    return e;
  }
  static final int[][][] IMPORTS = {
    { { 18, 0, 50, 0 }, { 2, 0, 60, 0 }, { 6, 0, 3, 0 }, { 22, 1, 70, 0 } },
    { { 2, 0, 60, 0 }, { 18, 1, 50, 0 }, { 2, 3, 90, 0 }, { 18, 0, 10, 1 } },
    { { 7, 0, 5, 0 }, { 6, 2, 5, 0 }, { 7, 1, 1, 0 } },
    { { 0, 0, 50, 0 }, { 24, 0, 50, 0 }, { 31, 0, 50, 0 }, { 32, 0, 50, 0 }, { -1, 0, 50, 0 }, { 5, 0, 50, 0 } },
    { { 1, 0, 0, 0 }, { 2, 0, -5, 0 }, { 3, 255, 50, 0 }, { 4, 200, 2147483647, 0 }, { 5, -128, 7, 0 } },
    { { 23, 0, 9, 0 }, { 22, 0, 9, 0 }, { 21, 0, 9, 0 }, { 20, 0, 9, 0 }, { 19, 0, 9, 0 }, { 18, 0, 9, 0 }, { 17, 0, 9, 0 }, { 16, 0, 9, 0 }, { 15, 0, 9, 0 },
      { 14, 0, 9, 0 }, { 13, 0, 9, 0 }, { 12, 0, 9, 0 }, { 11, 0, 9, 0 } },
    { { 23, 0, 9, 0 }, { 7, 0, 9, 0 }, { 21, 0, 9, 0 }, { 8, 0, 9, 0 }, { 19, 0, 9, 0 }, { 18, 0, 9, 0 }, { 17, 0, 9, 0 }, { 16, 0, 9, 0 }, { 15, 0, 9, 0 },
      { 14, 0, 9, 0 }, { 13, 0, 9, 0 }, { 12, 0, 9, 0 }, { 11, 0, 9, 0 }, { 10, 0, 9, 0 }, { 9, 0, 9, 0 }, { 1, 0, 9, 0 }, { 2, 0, 9, 0 } }
  };
  static void imports(String kind, int ci) throws Exception {
    sa fresh = make(kind);
    dh t = new dh();
    fresh.c(t);
    dq list = new dq();
    for (int[] e : IMPORTS[ci]) list.a(effectTag(e[0], e[1], e[2], e[3] != 0));
    t.a("ActiveEffects", list);
    sa loaded = sg.a(t, W);
    if (loaded == null) throw new IllegalStateException("not loaded: " + kind);
    String before = effects(loaded), nbt = written(loaded);
    tick(loaded);
    System.out.println("{\"tag\":\"b54import\",\"kind\":\"" + kind + "\",\"case\":" + ci + ",\"effects\":" + before + ",\"nbt\":\"" + nbt + "\",\"afterTick\":" + effects(loaded) + "}");
  }

  // ---- b54inst
  static void instant(String kind, int id, int amp, int dur, float health) throws Exception {
    sa m = make(kind);
    ((sv) m).g(health);
    put(m, id, amp, dur, false);
    StringBuilder s = new StringBuilder("{\"tag\":\"b54inst\",\"kind\":\"" + kind + "\",\"id\":" + id + ",\"amp\":" + amp + ",\"dur\":" + dur + ",\"health0\":" + ((sv) m).aS() + ",\"ticks\":[");
    String err = "null";
    try {
      for (int i = 0; i < 4; i++) {
        tick(m);
        s.append(i == 0 ? "" : ",").append("{\"health\":").append(((sv) m).aS()).append(",\"effects\":").append(effects(m)).append("}");
      }
    } catch (Throwable x) { err = error(x); }
    System.out.println(s.append("],\"error\":" + err + "}"));
  }

  // ---- b54hb
  static String hb(String kind, String mode, int amp, int dur) throws Exception {
    sa m = make(kind);
    sv l = (sv) m;
    StringBuilder s = new StringBuilder("{\"tag\":\"b54hb\",\"kind\":\"" + kind + "\",\"mode\":\"" + mode + "\",\"amp\":" + amp + ",\"dur\":" + dur + ",\"max0\":" + l.aY() + ",\"steps\":[");
    String err = "null";
    int n = 0;
    try {
      if (mode.equals("put")) put(m, 21, amp, dur, false);
      else l.c(new rw(21, dur, amp));
      s.append(step(m, "add", n++));
      l.g(l.aY()); // as far up as the maximum allows
      s.append(",").append(step(m, "fill", n++));
      if (mode.equals("readd")) { l.c(new rw(21, dur + 2, amp + 1)); s.append(",").append(step(m, "readd", n++)); l.g(l.aY()); l.c(new rw(21, dur + 10, 0)); s.append(",").append(step(m, "readdLower", n++)); l.g(l.aY()); s.append(",").append(step(m, "fill", n++)); }
      for (int i = 0; i < dur + 14 && map(m).containsKey(Integer.valueOf(21)); i++) {
        tick(m);
        if (i < 3 || ((rw) map(m).get(Integer.valueOf(21))) == null || ((rw) map(m).get(Integer.valueOf(21))).b() < 3) s.append(",").append(step(m, "tick", n++));
      }
      s.append(",").append(step(m, "end", n++));
    } catch (Throwable x) { err = error(x); }
    String nbt = written(m);
    return s.append("],\"nbt\":\"" + nbt + "\",\"error\":" + err + "}").toString();
  }
  static String step(sa m, String what, int i) throws Exception {
    sv l = (sv) m;
    return "{\"what\":\"" + what + "\",\"max\":" + l.aY() + ",\"health\":" + l.aS() + ",\"effects\":" + effects(m) + "}";
  }

  // ---- b54jump
  static void jump(String kind, int amp) throws Exception {
    sa m = make(kind);
    Field motionY = MobMoveProbe.field(sa.class, "w");
    motionY.set(m, 0.0);
    MobMoveProbe.method(sv.class, "bj").invoke(m);
    double plain = (Double) motionY.get(m);
    motionY.set(m, 0.0);
    if (amp != -1000) put(m, 8, amp, 100, false);
    MobMoveProbe.method(sv.class, "bj").invoke(m);
    double vy = (Double) motionY.get(m);
    StringBuilder s = new StringBuilder("{\"tag\":\"b54jump\",\"kind\":\"" + kind + "\",\"amp\":" + amp + ",\"plain\":" + plain + ",\"vy\":" + vy + ",\"falls\":[");
    boolean first = true;
    for (float d : new float[] { 3.5f, 5f, 8f, 12.5f, 30f }) {
      sa f = make(kind);
      if (amp != -1000) put(f, 8, amp, 100, false);
      float health = ((sv) f).aS();
      String err = "null";
      try { MobMoveProbe.method(sv.class, "b", float.class).invoke(f, d); } catch (Throwable x) { err = error(x); }
      s.append(first ? "" : ",").append("{\"distance\":").append(d).append(",\"health\":").append(((sv) f).aS()).append(",\"error\":").append(err).append("}");
      first = false;
    }
    System.out.println(s.append("]}"));
  }


  // ---- b55 (effects3)
  static sa makeHorse(int type) throws Exception {
    sa h = make("EntityHorse");
    dh t = new dh();
    h.c(t);
    t.a("Type", type);
    sa l = sg.a(t, W);
    if (l == null) throw new IllegalStateException("horse not loaded");
    return l;
  }
  static void attr(String label, sa m) throws Exception {
    sv l = (sv) m;
    StringBuilder s = new StringBuilder("{\"tag\":\"b55attr\",\"kind\":\"" + label + "\",\"attribute\":\"" + l.bd() + "\",\"undead\":" + l.aR() + ",\"applicable\":[");
    for (int id = 0; id <= 24; id++) s.append(id == 0 ? "" : ",").append(l.d(new rw(id, 100, 0)) ? 1 : 0);
    System.out.println(s.append("]}"));
  }
  static void comb(String kind, int seed) throws Exception {
    Random r = new Random(seed);
    sa m = make(kind);
    StringBuilder s = new StringBuilder("{\"tag\":\"b55comb\",\"kind\":\"" + kind + "\",\"seed\":" + seed + ",\"ops\":[");
    String err = "null";
    try {
      for (int i = 0; i < 14; i++) {
        int id = kind.equals("Pig") ? 1 + r.nextInt(4) : new int[] { 10, 19, 1, 2 }[r.nextInt(4)];
        if (id == 6 || id == 7) id = 1;
        int amp = r.nextInt(3), dur = 1 + r.nextInt(6);
        boolean amb = r.nextInt(2) == 0;
        ((sv) m).c(new rw(id, dur, amp, amb));
        s.append(i == 0 ? "" : ",").append("{\"add\":[").append(id).append(",").append(amp).append(",").append(dur).append(",").append(amb ? 1 : 0).append("],\"effects\":").append(effects(m)).append("}");
        if (r.nextInt(4) == 0) { tick(m); s.append(",{\"tick\":1,\"effects\":").append(effects(m)).append("}"); }
      }
    } catch (Throwable x) { err = error(x); }
    System.out.println(s.append("],\"error\":" + err + "}"));
  }
  static void affect(String label, sa make, int id, int amp, double factor, float health) throws Exception {
    sv l = (sv) make;
    l.g(health);
    String err = "null";
    try { rv.a[id].a(null, l, amp, factor); } catch (Throwable x) { err = error(x); }
    System.out.println("{\"tag\":\"b55inst\",\"kind\":\"" + label + "\",\"id\":" + id + ",\"amp\":" + amp + ",\"factor\":" + factor + ",\"health0\":" + health + ",\"health\":" + l.aS() + ",\"error\":" + err + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(world, info);
    W = world;
    HorseProbe.W = world;
    MAP = MobMoveProbe.field(sv.class, "f");
    UPDATE = MobMoveProbe.method(sv.class, "aO");
    for (int seed = 1; seed <= 40; seed++) order(seed, 6 + seed % 14, false);
    for (int seed = 101; seed <= 112; seed++) order(seed, 40, true);
    for (String k : new String[] { "Pig", "Zombie", "EntityHorse" })
      for (int c = 0; c < IMPORTS.length; c++) {
        try { imports(k, c); } catch (Throwable x) { System.out.println("{\"tag\":\"b54import\",\"kind\":\"" + k + "\",\"case\":" + c + ",\"error\":" + error(x) + "}"); }
      }
    for (String k : new String[] { "Pig", "Zombie", "Skeleton", "PigZombie", "Villager", "Spider" })
      for (int id = 6; id <= 7; id++) for (int amp = 0; amp <= 2; amp++) for (int dur : new int[] { 1, 3 }) for (float h : new float[] { 8f, 20f })
        try { instant(k, id, amp, dur, h); } catch (Throwable x) { System.out.println("{\"tag\":\"b54inst\",\"kind\":\"" + k + "\",\"error\":" + error(x) + "}"); }
    for (String k : new String[] { "Pig", "Zombie", "Sheep", "Wolf", "Villager", "Slime", "EntityHorse" })
      for (String mode : new String[] { "add", "put", "readd" }) for (int amp : new int[] { 0, 2, -1 })
        try { System.out.println(hb(k, mode, amp, 4)); } catch (Throwable x) { System.out.println("{\"tag\":\"b54hb\",\"kind\":\"" + k + "\",\"error\":" + error(x) + "}"); }
    for (String k : new String[] { "Pig", "Zombie", "Villager", "Spider", "LavaSlime", "Wolf", "Ozelot", "Chicken", "Bat", "Cow", "Squid", "Blaze", "SnowMan" })
      for (int amp : new int[] { -1000, 0, 1, 2, 4, 126, -3 })
        try { jump(k, amp); } catch (Throwable x) { System.out.println("{\"tag\":\"b54jump\",\"kind\":\"" + k + "\",\"amp\":" + amp + ",\"error\":" + error(x) + "}"); }
    String[] kinds = { "Creeper", "Skeleton", "Spider", "Giant", "Zombie", "Slime", "Ghast", "PigZombie", "Enderman", "CaveSpider", "Silverfish", "Blaze", "LavaSlime", "EnderDragon", "WitherBoss", "Bat", "Witch", "Pig", "Sheep", "Cow", "Chicken", "Squid", "Wolf", "MushroomCow", "SnowMan", "Ozelot", "VillagerGolem", "Villager" };
    for (String k : kinds) try { attr(k, make(k)); } catch (Throwable x) { System.out.println("{\"tag\":\"b55attr\",\"kind\":\"" + k + "\",\"error\":" + error(x) + "}"); }
    for (int t = 0; t <= 4; t++) try { attr("Horse" + t, makeHorse(t)); } catch (Throwable x) { System.out.println("{\"tag\":\"b55attr\",\"kind\":\"Horse" + t + "\",\"error\":" + error(x) + "}"); }
    for (String k : new String[] { "Pig", "Zombie", "Spider", "CaveSpider", "Skeleton", "WitherBoss" }) for (int seed = 1; seed <= 12; seed++) try { comb(k, seed); } catch (Throwable x) { System.out.println("{\"tag\":\"b55comb\",\"kind\":\"" + k + "\",\"error\":" + error(x) + "}"); }
    for (String k : new String[] { "Pig", "Zombie", "Skeleton", "PigZombie", "Spider", "WitherBoss", "Villager", "Giant", "Horse0", "Horse3", "Horse4" })
      for (int id = 6; id <= 7; id++) for (int amp = 0; amp <= 2; amp++) for (double factor : new double[] { 1.0, 0.6, 0.13 }) for (float h : new float[] { 8f, 20f })
        try { affect(k, k.startsWith("Horse") ? makeHorse(k.charAt(5) - '0') : make(k), id, amp, factor, h); } catch (Throwable x) { System.out.println("{\"tag\":\"b55inst\",\"kind\":\"" + k + "\",\"error\":" + error(x) + "}"); }
  }
}
