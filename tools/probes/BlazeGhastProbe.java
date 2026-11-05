import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// Runs the unchanged EntityBlaze (xx), EntityGhast (yd), EntityFireball (ze), EntityLargeFireball (zg) and EntitySmallFireball (zi) of the
// 1.7.10 JAR on the MobMoveProbe world double (stone below y 0, air above). The double records spawned entities (spawnEntityInWorld), level
// events (1007 ghast warn, 1008 ghast fire, 1009 blaze fire) and explosions (newExplosion). One JSON object per line:
//   facts          sizes, attribute bases, sounds, drop items, light, volume, fire immunity
//   xp             experienceValue of both mobs
//   blazeDrops     xx.b(Z,I) item stacks over seeded Entity.rand, recentlyHit and looting 0..3
//   ghastDrops     yd.b(Z,I) item stacks over seeded Entity.rand and looting 0..3
//   blazeVolley    xx.a(sa,F) once per tick (attackTime counted down by hand) at several distances: counter, delay, flag, fireball spawn
//   blazeMelee     xx.a(sa,F) within 2 blocks: the 20 tick delay and no fireball
//   blazeUpdate    xx.e() (onLivingUpdate): the hover push and the 0.6 fall damping, with and without a target above
//   ghastAi        yd.bq() with a player in view, then out of view: wander target, charge, fireballs
//   fireballFlight zg/zi.h() per tick: motion, position, accel
//   fireballImpact zg.a(azu) and zi.a(azu) on a block and on an entity
//   fireballHurt   ze.a(ro,F) from a player (deflect), yd.a(ro,F) from the player's own fireball and others
//   nbt            ExplosionPower and the direction tag
public class BlazeGhastProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> items = new ArrayList<>();
    static List<String> aux = new ArrayList<>();
    static List<sa> spawned = new ArrayList<>();
    static List<String> booms = new ArrayList<>();
    static yz player;
    public boolean d(sa entity) {
      if (entity instanceof xk) { add s = ((xk) entity).f(); items.add("{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"); }
      else spawned.add(entity);
      return true;
    }
    public void a(yz p, int id, int x, int y, int z, int data) { aux.add("{\"id\":" + id + ",\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + "}"); }
    public yz b(sa e, double d) { return player != null && ((sa) player).f(e) < d * d ? player : null; }
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) {
      booms.add("{\"x\":" + num(x) + ",\"y\":" + num(y) + ",\"z\":" + num(z) + ",\"power\":" + num(power) + ",\"flaming\":" + flaming + ",\"smoking\":" + smoking + "}");
      return null;
    }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    public azu a(azw a, azw b) { return null; }
    public azu a(azw a, azw b, boolean c) { return null; }
    public azu a(azw a, azw b, boolean c, boolean d) { return null; }
  }

  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static void out(String s) { System.out.println(s); }
  static long mix(int i) { return i * 1000003L + 17; }
  static String quote(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static float fl(Object o, String n) throws Exception { return MobMoveProbe.fl(o, n); }
  static int in(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  static Object inv(Class<?> c, Object o, String n, Class<?>[] t, Object... a) throws Exception { return MobMoveProbe.method(c, n, t).invoke(o, a); }
  static Object inv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.method(c, n).invoke(o); }
  static void setPos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static float box(sa e, boolean h) { azt b = e.C; return (float) (h ? b.e - b.b : b.d - b.a); }

  static void zeroYaw(sv e) throws Exception { for (String n : new String[] { "y", "A", "aM", "aN", "aO", "aP" }) MobMoveProbe.set(e, n, 0.0F); }
  static xx blaze(World w, long seed, double x, double y, double z) throws Exception {
    xx e = new xx(w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    setPos(e, x, y, z);
    MobMoveProbe.set(e, "D", true);
    zeroYaw(e);
    return e;
  }
  static yd ghast(World w, long seed, double x, double y, double z) throws Exception {
    yd e = new yd(w);
    MobMoveProbe.set(e, "Z", new Random(seed));
    setPos(e, x, y, z);
    zeroYaw(e);
    return e;
  }
  static we target(World w, double x, double y, double z) throws Exception {
    we t = new we(w);
    setPos(t, x, y, z);
    return t;
  }
  static yz player(World w, double x, double y, double z, float yaw, float pitch) throws Exception {
    yz p = (yz) u.allocateInstance(WolfProbe.FakePlayer.class);
    yx inv = (yx) u.allocateInstance(yx.class);
    inv.a = new add[40];
    inv.d = p;
    MobMoveProbe.set(p, "bm", inv);
    yw abilities = (yw) u.allocateInstance(yw.class);
    MobMoveProbe.set(p, "bE", abilities);
    MobMoveProbe.set(p, "ar", new UUID(1L, 2L));
    MobMoveProbe.set(p, "o", w);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
    MobMoveProbe.set(p, "Z", new Random(5));
    te watcher = new te(p);
    watcher.a(0, (byte) 0); watcher.a(1, (short) 300); watcher.a(16, (byte) 0); watcher.a(17, 0.0F); watcher.a(18, (Object) Integer.valueOf(0)); watcher.a(19, (Object) Integer.valueOf(0));
    MobMoveProbe.set(p, "af", watcher);
    MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "M", 0.6F);
    MobMoveProbe.set(p, "N", 1.8F);
    MobMoveProbe.set(p, "y", yaw);
    MobMoveProbe.set(p, "z", pitch);
    setPos(p, x, y, z);
    return p;
  }

  static String fireball(sa f) throws Exception {
    return "{\"kind\":" + quote(f instanceof zg ? "large" : "small") + ",\"x\":" + num(d(f, "s")) + ",\"y\":" + num(d(f, "t")) + ",\"z\":" + num(d(f, "u"))
      + ",\"vx\":" + num(d(f, "v")) + ",\"vy\":" + num(d(f, "w")) + ",\"vz\":" + num(d(f, "x"))
      + ",\"ax\":" + num(d(f, "b")) + ",\"ay\":" + num(d(f, "c")) + ",\"az\":" + num(d(f, "d"))
      + ",\"width\":" + num(box(f, false)) + ",\"height\":" + num(box(f, true))
      + (f instanceof zg ? ",\"power\":" + in(f, "e") : "") + "}";
  }
  static String spawnedList() throws Exception {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < World.spawned.size(); i++) s.append(i > 0 ? "," : "").append(fireball(World.spawned.get(i)));
    return s.append("]").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    for (java.lang.reflect.Field f : ays.class.getDeclaredFields())
      if (f.getType() == agy.class) { f.setAccessible(true); f.set(info, new agy()); }
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.c);
    WolfProbe.W = null;

    xx b0 = blaze(w, 1, 64, 20, 64);
    yd g0 = ghast(w, 1, 64, 20, 64);
    out("{\"case\":\"facts\",\"blaze\":{\"width\":" + num(box(b0, false)) + ",\"height\":" + num(box(b0, true)) + ",\"maxHealth\":" + num(((ti) b0.a(yj.a)).e())
      + ",\"attackDamage\":" + num(((ti) b0.a(yj.e)).e()) + ",\"movementSpeed\":" + num(((ti) b0.a(yj.d)).e()) + ",\"followRange\":" + num(((ti) b0.a(yj.b)).e())
      + ",\"immuneToFire\":" + b0.K() + ",\"light\":" + b0.c(1.0F) + ",\"brightness\":" + num(b0.d(1.0F))
      + ",\"living\":" + quote((String) inv(xx.class, b0, "t")) + ",\"hurt\":" + quote((String) inv(xx.class, b0, "aT")) + ",\"death\":" + quote((String) inv(xx.class, b0, "aU"))
      + ",\"dropItem\":" + adb.b((adb) inv(xx.class, b0, "u")) + ",\"volume\":" + num((Float) inv(xx.class, b0, "bf")) + ",\"talkInterval\":" + b0.q()
      + ",\"burning\":" + b0.bZ() + "},"
      + "\"ghast\":{\"width\":" + num(box(g0, false)) + ",\"height\":" + num(box(g0, true)) + ",\"maxHealth\":" + num(((ti) g0.a(yj.a)).e())
      + ",\"immuneToFire\":" + g0.K() + ",\"living\":" + quote((String) inv(yd.class, g0, "t")) + ",\"hurt\":" + quote((String) inv(yd.class, g0, "aT"))
      + ",\"death\":" + quote((String) inv(yd.class, g0, "aU")) + ",\"dropItem\":" + adb.b((adb) inv(yd.class, g0, "u"))
      + ",\"volume\":" + num((Float) inv(yd.class, g0, "bf")) + ",\"talkInterval\":" + g0.q() + ",\"maxSpawnedInChunk\":" + g0.bB()
      + ",\"charging\":" + g0.bP() + ",\"explosionPower\":" + in(g0, "bs") + "}}");
    out("{\"case\":\"xp\",\"blaze\":" + in(b0, "b") + ",\"ghast\":" + in(g0, "b") + "}");

    for (int looting = 0; looting <= 3; looting++)
      for (int seed = 0; seed < 40; seed++) {
        for (boolean hit : new boolean[] { true, false }) {
          World.items.clear();
          xx e = blaze(w, mix(seed), 64.5, 20, 64.5);
          inv(xx.class, e, "b", new Class<?>[] { boolean.class, int.class }, hit, looting);
          out("{\"case\":\"blazeDrops\",\"looting\":" + looting + ",\"seed\":" + seed + ",\"playerHit\":" + hit + ",\"items\":" + World.items + "}");
        }
        World.items.clear();
        yd e = ghast(w, mix(seed), 64.5, 20, 64.5);
        inv(yd.class, e, "b", new Class<?>[] { boolean.class, int.class }, true, looting);
        out("{\"case\":\"ghastDrops\",\"looting\":" + looting + ",\"seed\":" + seed + ",\"items\":" + World.items + "}");
      }

    // The volley: target 8 blocks away at the same height, on the ground; attackTime (sw.aB) counts down one a tick as EntityLivingBase.onUpdate does.
    for (double dist : new double[] { 6, 12, 25 }) {
      for (long seed : new long[] { 3, 77 }) {
        xx e = blaze(w, seed, 64.5, 20, 64.5);
        we t = target(w, 64.5 + dist, 20, 64.5 + dist * 0.5);
        out("{\"case\":\"blazeStart\",\"dist\":" + num(dist) + ",\"seed\":" + seed + "}");
        for (int tick = 1; tick <= 260; tick++) {
          World.spawned.clear();
          World.aux.clear();
          int at = in(e, "aB");
          if (at > 0) MobMoveProbe.set(e, "aB", at - 1);
          double dx = d(t, "s") - d(e, "s"), dz = d(t, "u") - d(e, "u"), dy = d(t, "t") - d(e, "t");
          float f = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
          MobMoveProbe.set(e, "bn", false);
          inv(xx.class, e, "a", new Class<?>[] { sa.class, float.class }, t, f);
          out("{\"case\":\"blazeVolley\",\"dist\":" + num(dist) + ",\"seed\":" + seed + ",\"tick\":" + tick + ",\"attackTime\":" + in(e, "aB") + ",\"shots\":" + in(e, "br")
            + ",\"burning\":" + e.bZ() + ",\"hasAttacked\":" + MobMoveProbe.b(e, "bn") + ",\"yaw\":" + num(fl(e, "y")) + ",\"aux\":" + World.aux + ",\"spawned\":" + spawnedList() + "}");
        }
      }
    }
    // Melee: a target within 2 blocks and overlapping vertically at attackTime 0 is hit (n(sa)), attackTime 20, no fireball.
    {
      xx e = blaze(w, 5, 64.5, 20, 64.5);
      we t = target(w, 65.0, 20, 64.5);
      World.spawned.clear();
      boolean hurt = false;
      float before = t.aS();
      inv(xx.class, e, "a", new Class<?>[] { sa.class, float.class }, t, 0.5F);
      out("{\"case\":\"blazeMelee\",\"attackTime\":" + in(e, "aB") + ",\"spawned\":" + spawnedList() + ",\"targetDamage\":" + num(before - t.aS()) + "}");
    }
    // onLivingUpdate: the hover push (bq countdown, bp offset) with a target above and the airborne fall damping.
    for (long seed : new long[] { 4, 9 }) {
      xx e = blaze(w, seed, 64.5, 20, 64.5);
      we t = target(w, 64.5, 30, 64.5);
      MobMoveProbe.set(e, "bm", t);
      MobMoveProbe.set(e, "D", false);
      for (int tick = 1; tick <= 220; tick++) {
        MobMoveProbe.set(e, "w", 0.0);
        inv(xx.class, e, "e");
        out("{\"case\":\"blazeUpdate\",\"seed\":" + seed + ",\"tick\":" + tick + ",\"vy\":" + num(d(e, "w")) + ",\"y\":" + num(d(e, "t")) + ",\"eye\":" + num(e.g()) + ",\"targetY\":" + num(d(t, "t")) + ",\"targetEye\":" + num(t.g()) + ",\"hover\":" + num(fl(e, "bp")) + ",\"delay\":" + in(e, "bq") + "}");
      }
      MobMoveProbe.set(e, "bm", null);
      MobMoveProbe.set(e, "w", -1.0);
      inv(xx.class, e, "e");
      out("{\"case\":\"blazeFall\",\"seed\":" + seed + ",\"vy\":" + num(d(e, "w")) + "}");
    }

    // The ghast's bq(): a player 20 blocks away in view, then dropped, then returned.
    for (long seed : new long[] { 11, 2024 }) {
      yd e = ghast(w, seed, 64.5, 40, 64.5);
      World.player = player(w, 64.5, 40, 84.5, 0, 0);
      out("{\"case\":\"ghastStart\",\"seed\":" + seed + "}");
      for (int tick = 1; tick <= 400; tick++) {
        World.spawned.clear();
        World.aux.clear();
        if (tick == 200) World.player = null;
        if (tick == 300) World.player = player(w, 64.5, 40, 74.5, 0, 0);
        sa tg = (sa) MobMoveProbe.field(yd.class, "bq").get(e);
        inv(yd.class, e, "bq");
        out("{\"case\":\"ghastAi\",\"seed\":" + seed + ",\"tick\":" + tick + ",\"waypoint\":[" + num(d(e, "i")) + "," + num(d(e, "bm")) + "," + num(d(e, "bn")) + "]"
          + ",\"vx\":" + num(d(e, "v")) + ",\"vy\":" + num(d(e, "w")) + ",\"vz\":" + num(d(e, "x")) + ",\"wander\":" + in(e, "h") + ",\"charge\":" + in(e, "bp") + ",\"prevCharge\":" + in(e, "bo")
          + ",\"targetDelay\":" + in(e, "br") + ",\"hasTarget\":" + (MobMoveProbe.field(yd.class, "bq").get(e) != null) + ",\"charging\":" + e.bP() + ",\"yaw\":" + num(fl(e, "y"))
          + ",\"aux\":" + World.aux + ",\"spawned\":" + spawnedList() + "}");
        // Stand in for sr.e(FF): friction only, the original motion step is not part of this record.
        MobMoveProbe.set(e, "v", d(e, "v") * 0.91F); MobMoveProbe.set(e, "w", d(e, "w") * 0.91F); MobMoveProbe.set(e, "x", d(e, "x") * 0.91F);
        setPos(e, d(e, "s") + d(e, "v"), d(e, "t") + d(e, "w"), d(e, "u") + d(e, "x"));
      }
    }
    World.player = null;

    // Flight: both fireballs from a shooter with a seeded Random, no gravity; the world is empty so only the acceleration acts.
    for (boolean large : new boolean[] { true, false }) {
      for (long seed : new long[] { 1, 6 }) {
        World.spawned.clear();
        yd shooter = ghast(w, seed, 64.5, 40, 64.5);
        sa f = large ? new zg(w, (sv) shooter, 10.0, -2.0, 20.0) : new zi(w, (sv) shooter, 10.0, -2.0, 20.0);
        out("{\"case\":\"fireballStart\",\"large\":" + large + ",\"seed\":" + seed + ",\"fireball\":" + fireball(f) + "}");
        for (int tick = 1; tick <= 40; tick++) {
          f.h();
          out("{\"case\":\"fireballFlight\",\"large\":" + large + ",\"seed\":" + seed + ",\"tick\":" + tick + ",\"fireball\":" + fireball(f) + ",\"dead\":" + f.K + "}");
        }
      }
    }
    // The constructor with an explicit acceleration (the dispenser form): ze(world, x, y, z, ax, ay, az).
    {
      zi f = new zi(w, 1.0, 2.0, 3.0, 3.0, 0.0, 4.0);
      out("{\"case\":\"fireballExplicit\",\"fireball\":" + fireball(f) + "}");
    }

    // Impacts.
    {
      yd shooter = ghast(w, 5, 64.5, 40, 64.5);
      for (int power : new int[] { 1, 3 }) {
        World.booms.clear();
        zg f = new zg(w, (sv) shooter, 0.0, -1.0, 0.0);
        MobMoveProbe.set(f, "e", power);
        setPos(f, 70.5, 30.25, 70.5);
        inv(zg.class, f, "a", new Class<?>[] { azu.class }, new azu(70, 29, 70, 1, azw.a(70.5, 30.0, 70.5)));
        out("{\"case\":\"largeImpact\",\"onEntity\":false,\"power\":" + power + ",\"explosions\":" + World.booms + ",\"dead\":" + f.K + "}");
      }
      World.booms.clear();
      we victim = target(w, 70.5, 30, 70.5);
      zg f = new zg(w, (sv) shooter, 0.0, -1.0, 0.0);
      setPos(f, 70.5, 30.5, 70.5);
      float h0 = victim.aS();
      inv(zg.class, f, "a", new Class<?>[] { azu.class }, new azu(victim));
      out("{\"case\":\"largeImpact\",\"onEntity\":true,\"power\":1,\"damage\":" + num(h0 - victim.aS()) + ",\"explosions\":" + World.booms + ",\"dead\":" + f.K + "}");
      // Small fireball on an entity: 5 damage and 5 s of fire unless it is immune; on a block it lights the cell next to the face.
      we v2 = target(w, 70.5, 30, 70.5);
      zi s = new zi(w, (sv) shooter, 0.0, -1.0, 0.0);
      float h1 = v2.aS();
      inv(zi.class, s, "a", new Class<?>[] { azu.class }, new azu(v2));
      out("{\"case\":\"smallImpact\",\"onEntity\":true,\"damage\":" + num(h1 - v2.aS()) + ",\"burning\":" + v2.al() + ",\"dead\":" + s.K + "}");
      xx immune = blaze(w, 1, 70.5, 30, 70.5);
      zi s2 = new zi(w, (sv) shooter, 0.0, -1.0, 0.0);
      float h2 = immune.aS();
      inv(zi.class, s2, "a", new Class<?>[] { azu.class }, new azu(immune));
      out("{\"case\":\"smallImpact\",\"onEntity\":\"immune\",\"damage\":" + num(h2 - immune.aS()) + ",\"dead\":" + s2.K + "}");
      out("{\"case\":\"smallProps\",\"canBeCollidedWith\":" + new zi(w).R() + ",\"largeCanBeCollidedWith\":" + new zg(w).R() + ",\"hurt\":" + new zi(w).a(ro.a, 1.0F) + ",\"collisionBorder\":" + num(new zg(w).af()) + ",\"largeBrightness\":" + num(new zg(w).d(1.0F)) + "}");
    }

    // A player's hit on a large fireball deflects it along the look vector; the ghast dies to its own deflected fireball.
    {
      yz p = player(w, 64.5, 40, 64.5, 90.0F, -10.0F);
      yd shooter = ghast(w, 5, 70.5, 40, 64.5);
      zg f = new zg(w, (sv) shooter, 10.0, 0.0, 0.0);
      setPos(f, 66.5, 41, 64.5);
      boolean hit = f.a(ro.a(p), 4.0F);
      out("{\"case\":\"fireballHurt\",\"deflected\":" + hit + ",\"fireball\":" + fireball(f) + ",\"lookX\":" + num(p.ag().a) + ",\"lookY\":" + num(p.ag().b) + ",\"lookZ\":" + num(p.ag().c) + ",\"ownerIsPlayer\":" + (MobMoveProbe.field(ze.class, "a").get(f) == p) + "}");
      yd victim = ghast(w, 5, 70.5, 40, 64.5);
      boolean dead;
      try { dead = victim.a(ro.a(f, p), 1.0F); } catch (NullPointerException ex) { dead = true; } // the kill credit (scoreboard) of the player double is missing; health is already set
      out("{\"case\":\"ghastHurt\",\"source\":\"playerFireball\",\"result\":" + dead + ",\"health\":" + num(victim.aS()) + "}");
      yd v2 = ghast(w, 5, 70.5, 40, 64.5);
      boolean r2;
      try { r2 = v2.a(ro.a(p), 4.0F); } catch (NullPointerException ex) { r2 = false; } // the player double has no DataWatcher: the ordinary path is not part of the record
      out("{\"case\":\"ghastHurt\",\"source\":\"player\",\"result\":" + r2 + ",\"health\":" + num(v2.aS()) + "}");
    }

    // NBT.
    {
      yd g = ghast(w, 1, 64.5, 40, 64.5);
      MobMoveProbe.set(g, "bs", 4);
      dh tag = new dh();
      g.b(tag);
      yd g2 = ghast(w, 1, 64.5, 40, 64.5);
      g2.a(tag);
      dh empty = new dh();
      yd g3 = ghast(w, 1, 64.5, 40, 64.5);
      g3.a(empty);
      zg f = new zg(w, (sv) g, 1.0, 2.0, 3.0);
      MobMoveProbe.set(f, "e", 7);
      dh t2 = new dh();
      f.b(t2);
      zg f2 = new zg(w);
      f2.a(t2);
      zg f3 = new zg(w);
      f3.a(new dh());
      out("{\"case\":\"nbt\",\"ghastWritten\":" + tag.f("ExplosionPower") + ",\"ghastRead\":" + in(g2, "bs") + ",\"ghastDefault\":" + in(g3, "bs")
        + ",\"fireballWritten\":" + t2.f("ExplosionPower") + ",\"fireballRead\":" + in(f2, "e") + ",\"fireballDefault\":" + in(f3, "e") + "}");
    }
  }
}
