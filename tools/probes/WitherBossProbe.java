import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Runs the unchanged EntityWither (xc), EntityWitherSkull (zp) and EntityFireball (ze) of the 1.7.10 JAR on the MobMoveProbe world double.
// The double records spawned entities (spawnEntityInWorld), aux events (playAuxSFXAtEntity), level events (World.b(IIIII), 1013 spawn)
// and explosions (newExplosion). One JSON object per line:
//   facts       sizes, attributes, sounds, armour value, light, undead, shadow
//   spawn       xc.bZ() then xc.bn() per tick while invulnerable: invul countdown, health, explosion and level event at the end
//   headPos     the private head position methods u/v/w(head) for several body yaws, and the default head yaw/pitch
//   launch      xc.a(I,sv) / a(I,DDDZ): skull spawn position, motion, blue flag, aux events
//   skullFlight zp.h() per tick for the black and the blue skull (motion factor 0.95 / 0.73)
//   skullImpact zp.a(azu) on an entity per difficulty: damage, effect, explosion record
//   skullBlast  zp.a(agw,ahb,III,aji): block resistance with and without the blue flag
//   skullProps  size, collidable, hurt
//   hurt        xc.a(ro,F) rejections: drown, while invulnerable, armoured arrow
//   armored     xc.cb() over a range of health values
//   drops       xc.b(Z,I): the item stacks
//   nbt         Invul tag write/read
public class WitherBossProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> aux = new ArrayList<>();
    static List<String> events = new ArrayList<>();
    static List<sa> spawned = new ArrayList<>();
    static List<String> booms = new ArrayList<>();
    static List<String> items = new ArrayList<>();
    public boolean d(sa entity) {
      if (entity instanceof xk) { add s = ((xk) entity).f(); items.add("{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"); }
      else spawned.add(entity);
      return true;
    }
    public void a(yz p, int id, int x, int y, int z, int data) { aux.add("{\"id\":" + id + ",\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + "}"); }
    public void b(int id, int x, int y, int z, int data) { events.add("{\"id\":" + id + ",\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + "}"); }
    public yz b(sa e, double d) { return null; }
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
  static String quote(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static int in(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  static Object inv(Class<?> c, Object o, String n, Class<?>[] t, Object... a) throws Exception { return MobMoveProbe.method(c, n, t).invoke(o, a); }
  static Object inv(Class<?> c, Object o, String n) throws Exception { return MobMoveProbe.method(c, n).invoke(o); }
  static void setPos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static float box(sa e, boolean h) { azt b = e.C; return (float) (h ? b.e - b.b : b.d - b.a); }
  static void zeroYaw(sv e) throws Exception { for (String n : new String[] { "y", "A", "aM", "aN", "aO", "aP" }) MobMoveProbe.set(e, n, 0.0F); }

  static xc wither(World w, long seed, double x, double y, double z) throws Exception {
    xc e = new xc(w);
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
  static String skull(sa f) throws Exception {
    return "{\"blue\":" + ((zp) f).f() + ",\"x\":" + num(d(f, "s")) + ",\"y\":" + num(d(f, "t")) + ",\"z\":" + num(d(f, "u"))
      + ",\"vx\":" + num(d(f, "v")) + ",\"vy\":" + num(d(f, "w")) + ",\"vz\":" + num(d(f, "x"))
      + ",\"ax\":" + num(d(f, "b")) + ",\"ay\":" + num(d(f, "c")) + ",\"az\":" + num(d(f, "d"))
      + ",\"width\":" + num(box(f, false)) + ",\"height\":" + num(box(f, true)) + "}";
  }
  static String spawnedList() throws Exception {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < World.spawned.size(); i++) s.append(i > 0 ? "," : "").append(skull(World.spawned.get(i)));
    return s.append("]").toString();
  }
  static void setHealth(xc e, float h) throws Exception { ((te) MobMoveProbe.field(sa.class, "af").get(e)).b(6, Float.valueOf(h)); }

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

    xc w0 = wither(w, 1, 64.5, 20, 64.5);
    out("{\"case\":\"facts\",\"width\":" + num(box(w0, false)) + ",\"height\":" + num(box(w0, true)) + ",\"maxHealth\":" + num(((ti) w0.a(yj.a)).e())
      + ",\"movementSpeed\":" + num(((ti) w0.a(yj.d)).e()) + ",\"followRange\":" + num(((ti) w0.a(yj.b)).e())
      + ",\"armor\":" + w0.aV() + ",\"undead\":" + quote(String.valueOf(w0.bd())) + ",\"shadow\":" + num(w0.Y())
      + ",\"light\":" + w0.c(1.0F) + ",\"eye\":" + num(w0.g()) + ",\"immuneToFire\":" + w0.K()
      + ",\"living\":" + quote((String) inv(xc.class, w0, "t")) + ",\"hurt\":" + quote((String) inv(xc.class, w0, "aT")) + ",\"death\":" + quote((String) inv(xc.class, w0, "aU"))
      + ",\"xp\":" + in(w0, "b") + "}");

    for (long seed : new long[] { 1, 8 }) {
      xc e = wither(w, seed, 64.5, 20, 64.5);
      e.bZ();
      out("{\"case\":\"spawnStart\",\"seed\":" + seed + ",\"invul\":" + e.ca() + ",\"health\":" + num(e.aS()) + ",\"armored\":" + e.cb() + "}");
      for (int tick = 1; tick <= 225; tick++) {
        World.booms.clear(); World.events.clear(); World.aux.clear();
        MobMoveProbe.set(e, "aa", tick);
        int before = e.ca();
        inv(xc.class, e, "bn");
        out("{\"case\":\"spawn\",\"seed\":" + seed + ",\"tick\":" + tick + ",\"invulBefore\":" + before + ",\"invul\":" + e.ca() + ",\"health\":" + num(e.aS())
          + ",\"armored\":" + e.cb() + ",\"explosions\":" + World.booms + ",\"events\":" + World.events + "}");
        if (e.ca() == 0) break;
      }
    }

    for (float yaw : new float[] { 0, 45, 90, 180 }) {
      xc e = wither(w, 1, 10, 20, 10);
      MobMoveProbe.set(e, "aM", yaw);
      StringBuilder heads = new StringBuilder("[");
      for (int h = 0; h < 3; h++)
        heads.append(h > 0 ? "," : "").append("[").append(num((Double) inv(xc.class, e, "u", new Class<?>[] { int.class }, h))).append(",")
          .append(num((Double) inv(xc.class, e, "v", new Class<?>[] { int.class }, h))).append(",").append(num((Double) inv(xc.class, e, "w", new Class<?>[] { int.class }, h))).append("]");
      out("{\"case\":\"headPos\",\"bodyYaw\":" + num(yaw) + ",\"heads\":" + heads + "],\"defaultYaw\":[" + num(e.a(0)) + "," + num(e.a(1)) + "],\"defaultPitch\":[" + num(e.c(0)) + "," + num(e.c(1)) + "]}");
    }

    for (long seed : new long[] { 3, 77 }) {
      xc e = wither(w, seed, 10.5, 20, 10.5);
      we t = target(w, 20.5, 20, 25.5);
      World.spawned.clear(); World.aux.clear();
      inv(xc.class, e, "a", new Class<?>[] { int.class, sv.class }, 1, t);
      out("{\"case\":\"launchEntity\",\"seed\":" + seed + ",\"head\":1,\"aux\":" + World.aux + ",\"spawned\":" + spawnedList() + "}");
      for (boolean charged : new boolean[] { true, false }) {
        World.spawned.clear(); World.aux.clear();
        inv(xc.class, e, "a", new Class<?>[] { int.class, double.class, double.class, double.class, boolean.class }, 2, 15.0, 22.0, 5.0, charged);
        out("{\"case\":\"launchCoords\",\"seed\":" + seed + ",\"head\":2,\"charged\":" + charged + ",\"aux\":" + World.aux + ",\"spawned\":" + spawnedList() + "}");
      }
    }

    for (boolean blue : new boolean[] { false, true }) {
      xc shooter = wither(w, 1, 64.5, 40, 64.5);
      zp f = new zp(w, (sv) shooter, 10.0, -2.0, 20.0);
      f.a(blue);
      out("{\"case\":\"skullStart\",\"blue\":" + blue + ",\"skull\":" + skull(f) + "}");
      for (int tick = 1; tick <= 30; tick++) {
        f.h();
        out("{\"case\":\"skullFlight\",\"blue\":" + blue + ",\"tick\":" + tick + ",\"skull\":" + skull(f) + ",\"dead\":" + f.K + "}");
      }
    }

    xc owner = wither(w, 5, 64.5, 40, 64.5);
    for (rd diff : new rd[] { rd.a, rd.b, rd.c, rd.d }) {
      MobMoveProbe.set(w, "r", diff);
      for (boolean blue : new boolean[] { false, true }) {
        World.booms.clear();
        we victim = target(w, 70.5, 30, 70.5);
        zp f = new zp(w, (sv) owner, 0.0, -1.0, 0.0);
        f.a(blue);
        setPos(f, 70.5, 30.5, 70.5);
        float h0 = victim.aS();
        float oh = owner.aS();
        String err = "null";
        try { inv(zp.class, f, "a", new Class<?>[] { azu.class }, new azu(victim)); } catch (Throwable ex) { err = quote(String.valueOf(ex.getCause() != null ? ex.getCause() : ex)); }
        out("{\"case\":\"skullImpact\",\"difficulty\":" + diff.ordinal() + ",\"blue\":" + blue + ",\"damage\":" + num(h0 - victim.aS())
          + ",\"ownerHealed\":" + num(owner.aS() - oh) + ",\"explosions\":" + World.booms + ",\"dead\":" + f.K + ",\"error\":" + err + "}");
      }
    }
    MobMoveProbe.set(w, "r", rd.c);
    World.booms.clear();
    {
      zp f = new zp(w, (sv) owner, 0.0, -1.0, 0.0);
      setPos(f, 70.5, 30.25, 70.5);
      inv(zp.class, f, "a", new Class<?>[] { azu.class }, new azu(70, 29, 70, 1, azw.a(70.5, 30.0, 70.5)));
      out("{\"case\":\"skullImpact\",\"onBlock\":true,\"explosions\":" + World.booms + ",\"dead\":" + f.K + "}");
    }

    int[] ids = { 1, 3, 7, 49, 119, 120, 137, 0, 9, 10, 4, 98 };
    for (boolean blue : new boolean[] { false, true }) {
      zp f = new zp(w, (sv) owner, 0.0, 0.0, 0.0);
      f.a(blue);
      for (int id : ids) {
        aji b = aji.e(id);
        float base = b.a((sa) null);
        float r = f.a((agw) null, w, 0, 0, 0, b);
        out("{\"case\":\"skullBlast\",\"blue\":" + blue + ",\"block\":" + id + ",\"base\":" + num(base) + ",\"resistance\":" + num(r) + "}");
      }
    }
    {
      zp f = new zp(w);
      out("{\"case\":\"skullProps\",\"canBeCollided\":" + f.R() + ",\"hurt\":" + f.a(ro.a, 1.0F) + ",\"width\":" + num(box(f, false)) + ",\"height\":" + num(box(f, true)) + ",\"blueDefault\":" + f.f() + "}");
    }

    {
      xc e = wither(w, 1, 64.5, 20, 64.5);
      e.bZ();
      boolean r1 = e.a(ro.a((sv) owner), 4.0F);
      out("{\"case\":\"hurt\",\"kind\":\"invulnerable\",\"result\":" + r1 + ",\"health\":" + num(e.aS()) + "}");
      xc e2 = wither(w, 1, 64.5, 20, 64.5);
      e2.s(0);
      setHealth(e2, 300.0F);
      out("{\"case\":\"hurt\",\"kind\":\"drown\",\"result\":" + e2.a(ro.e, 4.0F) + ",\"health\":" + num(e2.aS()) + "}");
      zc arrow = (zc) u.allocateInstance(zc.class);
      MobMoveProbe.set(arrow, "o", w);
      xc e3 = wither(w, 1, 64.5, 20, 64.5);
      e3.s(0);
      setHealth(e3, 100.0F);
      boolean r3;
      try { r3 = e3.a(ro.a(arrow, (sa) owner), 4.0F); } catch (Throwable ex) { r3 = true; }
      out("{\"case\":\"hurt\",\"kind\":\"armoredArrow\",\"result\":" + r3 + ",\"health\":" + num(e3.aS()) + ",\"armored\":" + e3.cb() + "}");
    }
    for (float h : new float[] { 300, 151, 150, 149, 100, 1 }) {
      xc e = wither(w, 1, 64.5, 20, 64.5);
      setHealth(e, h);
      out("{\"case\":\"armored\",\"health\":" + num(h) + ",\"armored\":" + e.cb() + "}");
    }

    for (int looting = 0; looting <= 3; looting++) {
      World.items.clear();
      xc e = wither(w, 1, 64.5, 20, 64.5);
      inv(xc.class, e, "b", new Class<?>[] { boolean.class, int.class }, true, looting);
      out("{\"case\":\"drops\",\"looting\":" + looting + ",\"items\":" + World.items + "}");
    }

    {
      xc e = wither(w, 1, 64.5, 20, 64.5);
      e.s(123);
      dh tag = new dh();
      e.b(tag);
      xc e2 = wither(w, 1, 64.5, 20, 64.5);
      e2.a(tag);
      xc e3 = wither(w, 1, 64.5, 20, 64.5);
      e3.a(new dh());
      out("{\"case\":\"nbt\",\"written\":" + tag.f("Invul") + ",\"read\":" + e2.ca() + ",\"default\":" + e3.ca() + "}");
    }
  }
}
