import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged EntityTrackerEntry (my) of the 1.7.10 JAR: which packets one tracked entity sends a watching player tick by
// tick (spawn, relative move, look, look and move, teleport, head look), when the player starts and stops tracking it, and the
// entity's encoded position. The tick driver follows EntityTracker.updateTrackedEntities (mn.a(), read from bytecode): every entry
// first runs sendLocationToAllClients (my.a(List)), then each player entry that flagged itself (my.n) makes every other entry run
// tryStartWachingThis (my.b(mw)). Test doubles: the player (mw subclass without its constructor: position, a recording network
// handler, a world that answers isPlayerWatchingChunk with a square around the managed chunk) and a real new wg(world) chicken for
// the tracked entity. The class names and packet fields are the original ones. One JSON object per line; see tools/verify-tracker.mjs.
public class TrackerProbe {
  static sun.misc.Unsafe U;
  static final List<String> sent = new ArrayList<>();
  static final List<Object> queue = new ArrayList<>(); // the packets of the tick as objects, for the client probe
  static boolean clientMode;
  static ChickenProbe.World clientWorld;
  static int watchX, watchZ, watchRadius;
  static boolean watching = true;

  static String num(double d) { return Double.toString(d); }
  static String fields(Object p) throws Exception {
    StringBuilder b = new StringBuilder();
    for (Class<?> c = p.getClass(); c != null && c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
        Class<?> t = f.getType();
        if (t != int.class && t != byte.class && t != boolean.class) continue;
        f.setAccessible(true);
        b.append(b.length() > 0 ? "," : "").append(f.get(p));
      }
    return b.toString();
  }
  // the client world: a loaded chunk answers World.getChunkFromBlockCoords (EntityLivingBase.moveEntityWithHeading reads isChunkLoaded on a client)
  static boolean chunkLoaded = true;
  static int unloadFrom = -1, unloadTo = -1;
  public static class CW extends ChickenProbe.World {
    public apx d(int x, int z) {
      try { apx c = (apx) U.allocateInstance(apx.class); MobMoveProbe.field(apx.class, "d").setBoolean(c, chunkLoaded); return c; } catch (Exception e) { throw new RuntimeException(e); }
    }
  }
  public static class NH extends nh {
    NH() { super(null, null, null); }
    public void a(ft p) {
      try {
        String n = p.getClass().getName();
        queue.add(p);
        if (p instanceof hf || p instanceof ik || p instanceof ht || p instanceof hy) sent.add("[\"" + n + "\"," + fields(p) + "]");
        else if (p instanceof fz) sent.add("[\"spawn\"," + ((fz) p).f() + "," + ((fz) p).g() + "," + ((fz) p).h() + "," + ((fz) p).i() + "," + ((fz) p).j() + "," + ((fz) p).k() + "]");
        else sent.add("[\"" + n + "\"]");
      } catch (Exception e) { throw new RuntimeException(e); }
    }
  }
  public static class MQ extends mq {
    MQ() { super(null); }
    public boolean a(mw p, int cx, int cz) { return watching && Math.abs(cx - watchX) <= watchRadius && Math.abs(cz - watchZ) <= watchRadius; }
  }
  public static class TW extends mt {
    TW() { super(null, null, null, 0, null, null); }
    MQ mq;
    public mq t() { return mq; }
  }
  public static class PMP extends mw {
    PMP() { super(null, null, null, null); }
    TW world;
    public mt r() { return world; }
    public void d(sa e) { sent.add("[\"destroy\"]"); }
  }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static void setI(Object o, String n, int v) throws Exception { MobMoveProbe.field(o.getClass(), n).setInt(o, v); }

  static void place(sa e, double x, double y, double z, float yaw, float pitch, float head) throws Exception {
    set(e, "s", x); set(e, "t", y); set(e, "u", z);
    MobMoveProbe.field(sa.class, "y").setFloat(e, yaw);
    MobMoveProbe.field(sa.class, "z").setFloat(e, pitch);
    ((sv) e).e(head);
  }
  static void chunk(sa e) throws Exception {
    setI(e, "ah", (int) Math.floor(MobMoveProbe.d(e, "s") / 16.0));
    setI(e, "aj", (int) Math.floor(MobMoveProbe.d(e, "u") / 16.0));
  }

  static wg chicken(ChickenProbe.World world) throws Exception {
    wg e = new wg(world);
    return e;
  }

  // One scenario row: x y z yaw pitch head airBorne changed | player x y z | managedChunkX managedChunkZ watching
  static String run(String name, ChickenProbe.World world, int range, int freq, boolean vel, int viewRadius, double[][] rows, boolean arrowLike) throws Exception {
    wg e = chicken(world);
    NH net = (NH) U.allocateInstance(NH.class);
    TW tw = (TW) U.allocateInstance(TW.class); tw.mq = (MQ) U.allocateInstance(MQ.class);
    PMP p = (PMP) U.allocateInstance(PMP.class); p.world = tw; p.a = net;
    MobMoveProbe.field(mw.class, "f").set(p, new ArrayList<>());
    // the entity: row 0 holds the spawn state
    double[] r0 = rows[0];
    place(e, r0[0], r0[1], r0[2], (float) r0[3], (float) r0[4], (float) r0[5]); chunk(e);
    MobMoveProbe.field(sa.class, "al").setBoolean(e, false);
    motion(e, r0);
    // the player's own tracker entry (range 512, every 2 ticks), tracked entity of its own
    set(p, "s", r0[8]); set(p, "t", r0[9]); set(p, "u", r0[10]);
    MobMoveProbe.field(sa.class, "af").set(p, new te(p));
    MobMoveProbe.field(sa.class, "as").set(p, se.b);
    my pe = new my(p, 512, 2, false);
    watchX = (int) r0[11]; watchZ = (int) r0[12]; watchRadius = viewRadius; watching = r0[13] != 0;
    sent.clear(); queue.clear();
    List players = new ArrayList(); players.add(p);
    wg client = null;
    StringBuilder clientRows = new StringBuilder(), inputRows = new StringBuilder();
    if (clientMode) {
      clientWorld = (ChickenProbe.World) U.allocateInstance(CW.class);
      MobMoveProbe.set(clientWorld, "s", new Random(2));
      MobMoveProbe.set(clientWorld, "C", new qi());
      for (Field f : ahb.class.getDeclaredFields())
        if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(clientWorld, new ArrayList()); }
      MobMoveProbe.set(clientWorld, "t", U.allocateInstance(aqq.class));
      MobMoveProbe.field(ahb.class, "E").setBoolean(clientWorld, true); // World.isRemote: the client world
    }
    // EntityTracker.addEntityToTracker(e): new my(...), then updatePlayerList(world.playerEntities) at once
    my me = new my(e, range, freq, vel);
    me.b(players);
    StringBuilder out = new StringBuilder();
    out.append("{\"case\":" + "\"" + name + "\",\"range\":" + range + ",\"freq\":" + freq + ",\"rows\":[");
    boolean first = true;
    for (int t = 0; t < rows.length; t++) {
      double[] r = rows[t];
      if (t > 0) {
        place(e, r[0], r[1], r[2], (float) r[3], (float) r[4], (float) r[5]); chunk(e);
        MobMoveProbe.field(sa.class, "al").setBoolean(e, r[6] != 0);
        motion(e, r);
        if (r[7] != 0) MobMoveProbe.field(te.class, "e").setBoolean(e.z(), true);
        set(p, "s", r[8]); set(p, "t", r[9]); set(p, "u", r[10]);
        managed(r[8], r[10]);
      }
      // EntityTracker.updateTrackedEntities
      me.a(players);
      boolean flagged = false;
      pe.a(players);
      if (pe.n) flagged = true;
      if (flagged) me.b(p);
      boolean tracking = me.o.contains(p);
      String ev = String.join(",", sent);
      sent.clear();
      if (clientMode) {
        inputRows.append(t > 0 ? "," : "").append("[" + num(r[0]) + "," + num(r[1]) + "," + num(r[2]) + "," + num(r[14]) + "," + num(r[15]) + "," + num(r[16]) + "," + (int) r[6] + "," + (int) r[17] + "]");
        // NetHandlerPlayClient (bjb, bytecode-read) handles the tick's packets in order, then the client world ticks the entity
        chunkLoaded = !(t >= unloadFrom && t < unloadTo);
        for (Object q : queue) client = handle(client, q);
        queue.clear();
        if (client != null) {
          set(client, "p", MobMoveProbe.d(client, "s")); set(client, "q", MobMoveProbe.d(client, "t")); set(client, "r", MobMoveProbe.d(client, "u"));
          client.e(); // EntityChicken.onLivingUpdate (wg.e() -> sv.e()): increments, 0.98 drag, moveEntityWithHeading, the slow fall
        }
        clientRows.append(t > 0 ? "," : "").append(client == null ? "[0]" : "[1," + num(MobMoveProbe.d(client, "s")) + "," + num(MobMoveProbe.d(client, "t")) + "," + num(MobMoveProbe.d(client, "u")) + "," + num(MobMoveProbe.d(client, "v")) + "," + num(MobMoveProbe.d(client, "w")) + "," + num(MobMoveProbe.d(client, "x")) + "," + MobMoveProbe.b(client, "D") + "," + num(MobMoveProbe.d(client, "p")) + "," + num(MobMoveProbe.d(client, "q")) + "," + num(MobMoveProbe.d(client, "r")) + "]");
      }
      if (t == 0 || !ev.isEmpty() || tracking != lastTracking || pe.n) {
        out.append(first ? "" : ",").append("[" + t + "," + (tracking ? 1 : 0) + "," + me.d + "," + me.e + "," + me.f + "," + (pe.n ? 1 : 0) + ",[" + ev + "]]");
        first = false;
      }
      lastTracking = tracking;
    }
    out.append("]");
    if (clientMode) out.append(",\"inputs\":[" + inputRows + "],\"client\":[" + clientRows + "]");
    out.append("}");
    return out.toString();
  }
  // The client's packet handlers (bjb S0F a(fz), S14 a(hf), S18 a(ik), S12 a(hy)) on one client chicken; the entity methods are the executed classes.
  static wg handle(wg c, Object p) throws Exception {
    if (p instanceof fz) {
      fz s = (fz) p;
      c = new wg(clientWorld);
      setI(c, "bZ", s.f()); setI(c, "ca", s.g()); setI(c, "cb", s.h());
      c.a(s.f() / 32.0, s.g() / 32.0, s.h() / 32.0, 0f, 0f); // setLocationAndAngles
      set(c, "v", (double) ((float) s.i() / 8000.0f)); set(c, "w", (double) ((float) s.j() / 8000.0f)); set(c, "x", (double) ((float) s.k() / 8000.0f));
    } else if (c == null) return c;
    else if (p instanceof hf) {
      hf s = (hf) p;
      setI(c, "bZ", ((Integer) get(c, "bZ")) + s.c()); setI(c, "ca", ((Integer) get(c, "ca")) + s.d()); setI(c, "cb", ((Integer) get(c, "cb")) + s.e());
      c.a(((Integer) get(c, "bZ")) / 32.0, ((Integer) get(c, "ca")) / 32.0, ((Integer) get(c, "cb")) / 32.0, 0f, 0f, 3);
    } else if (p instanceof ik) {
      ik s = (ik) p;
      setI(c, "bZ", s.d()); setI(c, "ca", s.e()); setI(c, "cb", s.f());
      c.a(s.d() / 32.0, s.e() / 32.0 + 0.015625, s.f() / 32.0, 0f, 0f, 3);
    } else if (p instanceof hy) {
      hy s = (hy) p;
      c.i(s.d() / 8000.0, s.e() / 8000.0, s.f() / 8000.0);
    }
    return c;
  }
  static boolean lastTracking = false;
  // PlayerManager.updateMountedMovingPlayer (mq.d(mw), bytecode-read): the watched chunk square is centred on the chunk of the managed
  // position ((int) x >> 4); it moves when the player is 8 blocks from the managed position and in another chunk.
  static double mx, mz;
  static void managed(double px, double pz) {
    int i = ((int) px) >> 4, j = ((int) pz) >> 4;
    if (first0) { first0 = false; watchX = ((int) mx) >> 4; watchZ = ((int) mz) >> 4; return; }
    double dx = mx - px, dz = mz - pz;
    if (dx * dx + dz * dz < 64.0) return;
    int k = ((int) mx) >> 4, l = ((int) mz) >> 4;
    if (i - k == 0 && j - l == 0) return;
    mx = px; mz = pz; watchX = i; watchZ = j;
  }
  static boolean first0;

  static double[] row(double x, double y, double z, double yaw, double pitch, double head, int air, int chg, double px, double py, double pz, int wx, int wz, int w) {
    return new double[]{x, y, z, yaw, pitch, head, air, chg, px, py, pz, wx, wz, w, 0, 0, 0, 0};
  }
  // a row with the entity's motion (columns 14..16) and Entity.velocityChanged (17)
  static double[] rowV(double x, double y, double z, double vx, double vy, double vz, int air, int velChanged) {
    return new double[]{x, y, z, 0, 0, 0, air, 0, 0.5, 0, 0.5, 0, 0, 1, vx, vy, vz, velChanged};
  }
  static void motion(sa e, double[] r) throws Exception {
    set(e, "v", r[14]); set(e, "w", r[15]); set(e, "x", r[16]);
    MobMoveProbe.field(sa.class, "H").setBoolean(e, r[17] != 0);
  }
  static int cx(double v) { return (int) Math.floor(v / 16.0); }
  // managed chunk follows mq.d(mw): the chunk of (int) x >> 4 once the player moved 8 blocks from the managed position and changed chunk
  static double[][] build(int n, java.util.function.IntFunction<double[]> f) { double[][] r = new double[n][]; for (int i = 0; i < n; i++) r[i] = f.apply(i); return r; }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    U = MobMoveProbe.unsafe();
    ChickenProbe.World world = (ChickenProbe.World) U.allocateInstance(ChickenProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", U.allocateInstance(aqq.class));

    // size rounding (Entity.EnumEntitySize.getXPosition): se.a(double) over a grid
    StringBuilder sizes = new StringBuilder("{\"case\":\"sizes\",\"values\":[");
    for (int i = 0; i < 40; i++) { double v = -3.0 + i * 0.1625 + (i % 3) * 0.0104; sizes.append(i > 0 ? "," : "").append(num(v)); }
    sizes.append("],\"rows\":[");
    for (int s = 0; s < 6; s++) {
      sizes.append(s > 0 ? "," : "").append("[");
      for (int i = 0; i < 40; i++) { double v = -3.0 + i * 0.1625 + (i % 3) * 0.0104; sizes.append(i > 0 ? "," : "").append(se.values()[s].a(v)); }
      sizes.append("]");
    }
    System.out.println(sizes.append("]}"));

    // Scenario 1: a chicken walks away along +x at 0.12 blocks per tick and comes back; the player stands still at the origin.
    System.out.println(run("walkAway", world, 80, 3, true, 10, build(1400, t -> {
      double x = t < 700 ? 10.3 + 0.12 * t : 10.3 + 0.12 * 700 - 0.12 * (t - 700);
      return row(x, 64, 5.7, 90, 0, 90, 0, 0, 0.5, 64, 0.5, 0, 0, 1);
    }), false));
    // Scenario 2: negative coordinates (the integer division by 32 truncates toward zero) and both axes, a diagonal walk
    System.out.println(run("negative", world, 80, 3, true, 10, build(1500, t -> {
      double x = -10.3 - 0.07 * t, z = -9.6 - 0.09 * t;
      return row(x, 64, z, 45, 0, 45, 0, 0, -0.5, 64, -0.5, 0, 0, 1);
    }), false));
    // Scenario 3: jumps (airBorne), a health change, a yaw change, a 12 block teleport and the 400 tick forced teleport of a standing mob
    System.out.println(run("events", world, 80, 3, true, 10, build(1000, t -> {
      double x = 4.5, y = 64, z = 4.5, yaw = 0;
      int air = 0, chg = 0;
      if (t >= 100 && t < 110) { y = 64 + 0.4 * (t - 100) * (110 - t) / 25.0; air = t == 100 ? 1 : 0; }
      if (t == 150) chg = 1;
      if (t >= 200) yaw = 3;
      if (t >= 220) yaw = 40;
      if (t >= 300) x = 16.5;
      if (t >= 330 && t < 335) { x = 16.5 + 0.9 * (t - 329); }
      if (t >= 335) x = 21.0;
      return row(x, y, z, yaw, 0, yaw, air, chg, 0.5, 64, 0.5, 0, 0, 1);
    }), false));
    // Scenario 4: the player walks toward a still mob and away again (player entry flags every 4+ blocks)
    System.out.println(run("playerWalks", world, 80, 3, true, 10, build(1600, t -> {
      double px = t < 800 ? -150 + 0.2 * t : -150 + 0.2 * 800 - 0.2 * (t - 800);
      int mcx = cx(px), w = 1;
      return row(0.5, 64, 0.5, 0, 0, 0, 0, 0, px, 64, 0.5, mcx, 0, w);
    }), false));
    // Scenario 5: squid-like range 64 and a 160 range clamped to the integrated server's 144 limit (mn.e = 10 * 16 - 16)
    System.out.println(run("range144", world, 144, 3, true, 10, build(1300, t -> row(10.3 + 0.2 * t, 64, 5.7, 0, 0, 0, 0, 0, 0.5, 64, 0.5, 0, 0, 1)), false));
    // Scenario 6: the chunk watching gate (view radius 2 chunks): a still mob 60 blocks away is inside the range square but outside the
    // watched chunks until the player has walked close enough, then the player walks past it
    System.out.println(run("chunkGate", world, 80, 3, true, 2, build(900, t -> {
      double px = 0.5 + 0.2 * t;
      return row(60.5, 64, 0.5, 0, 0, 0, 0, 0, px, 64, 0.5, 0, 0, 1);
    }), false));

    // Client scenarios (the S12 velocity packet and the client entity's own movement). A scripted server chicken moves on a floor at
    // y = 0 (stone below); every row is recorded with the executed client chicken's position, motion and previous position.
    clientMode = true;
    // clientWalk: accelerate to 0.2 per tick along +x, then stop with the ground friction 0.546 (motion changes by more than 0.02: S12)
    System.out.println(run("clientWalk", world, 80, 3, true, 10, serverScript(120, (t, st) -> {
      if (t < 40) st[3] = Math.min(0.2, 0.01 * t); else st[3] *= 0.546;
      st[0] += st[3];
    }, 0.0, 8.5), false));
    // clientKnock: a standing chicken is hit at tick 30 (velocityChanged, motion 0.4 up and 0.4 along x), then flies and lands
    System.out.println(run("clientKnock", world, 80, 3, true, 10, serverScript(100, (t, st) -> {
      if (t == 30) { st[3] = 0.4; st[4] = 0.4; st[7] = 1; } else st[7] = 0;
      physics(st);
    }, 0.0, 8.5), false));
    // clientFall: a chicken spawned 12 blocks up falls (the chicken's slow fall is part of both sides), lands, hops with isAirBorne
    System.out.println(run("clientFall", world, 80, 3, true, 10, serverScript(120, (t, st) -> {
      if (t == 70) { st[4] = 0.42; st[6] = 1; } else st[6] = 0;
      physics(st);
      if (st[1] > 0 && st[4] < 0) st[4] *= 0.6;
    }, 12.0, 8.5), false));
    // clientTeleport: a 9 block jump (a teleport packet), then a walk at 0.1 per tick with a turn back
    System.out.println(run("clientTeleport", world, 80, 3, true, 10, serverScript(100, (t, st) -> {
      if (t == 20) st[0] += 9.0;
      if (t >= 30 && t < 60) { st[3] = 0.1; st[0] += 0.1; } else if (t >= 60) { st[3] = -0.1; st[0] -= 0.1; } else st[3] = 0;
      if (t == 60) st[3] = -0.1;
    }, 0.0, 8.5), false));
    // clientSpawn: tracking starts while the chicken is in the air moving (the spawn packet carries the motion)
    System.out.println(run("clientSpawn", world, 80, 3, true, 10, serverScript(80, (t, st) -> {
      physics(st);
    }, 6.0, 8.5, 0.3, 0.1), false));
    // clientUnloaded: the client's chunk is not loaded for ticks 35..59 (moveEntityWithHeading hovers: motionY -0.1 above y 0, else 0)
    unloadFrom = 35; unloadTo = 60;
    System.out.println(run("clientUnloaded", world, 80, 3, true, 10, serverScript(100, (t, st) -> {
      if (t == 30) { st[3] = 0.4; st[4] = 0.6; st[7] = 1; } else st[7] = 0;
      physics(st);
    }, 0.0, 8.5), false));
    unloadFrom = unloadTo = -1;
    clientMode = false;
  }
  // server chicken state: x y z vx vy vz air velocityChanged
  interface Script { void step(int t, double[] st); }
  static void physics(double[] st) {
    st[1] += st[4]; st[0] += st[3]; st[2] += st[5];
    st[4] = (st[4] - 0.08) * 0.98;
    boolean ground = false;
    if (st[1] <= 0) { st[1] = 0; st[4] = 0; ground = true; }
    double f = ground ? 0.546 : 0.91;
    st[3] *= f; st[5] *= f;
  }
  static double[][] serverScript(int n, Script s, double y0, double x0) { return serverScript(n, s, y0, x0, 0.0, 0.0); }
  static double[][] serverScript(int n, Script s, double y0, double x0, double vx0, double vy0) {
    double[] st = {x0, y0, 5.5, vx0, vy0, 0, 0, 0};
    double[][] rows = new double[n][];
    for (int t = 0; t < n; t++) {
      if (t > 0) s.step(t, st);
      rows[t] = rowV(st[0], st[1], st[2], st[3], st[4], st[5], (int) st[6], (int) st[7]);
    }
    return rows;
  }
}
