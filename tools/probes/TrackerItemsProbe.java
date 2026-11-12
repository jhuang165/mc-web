import java.lang.reflect.Field;
import java.util.*;

// Batch 42: the non-living tracked entities. The unchanged EntityTrackerEntry (my) tracks a real server entity (EntityItem xk,
// EntityXPOrb sq, EntityArrow zc, EntitySnowball zj, EntityFallingBlock xj, EntityTNTPrimed xw) that runs its own unchanged onUpdate
// on a server world double (tools/probes/MobMoveProbe.ProbeWorld: a stone floor at y < 0, empty entity lists), and the packets it
// sends are handled by a client entity of the same unchanged class on a remote world double (World.isRemote), created the way
// NetHandlerPlayClient.a(fw) (S0E spawn object) and a(fx) (S11 spawn experience orb) create it (bytecode-read in bjb), then moved by
// Entity.setPositionAndRotation2 (S14, S18), setVelocity (S12) and the entity's own onUpdate, once per client tick after the packets.
// Row t of a scenario: the server entity after its update (nothing at t = 0, the spawn state), the tracker pass of the tick, the client's
// packets and update. The tick driver and player/chunk doubles are TrackerProbe's. One JSON object per line (tools/verify-tracker-items.mjs).
public class TrackerItemsProbe {
  static sun.misc.Unsafe U;
  static ChickenProbe.World server, client;
  static yz clientPlayer;
  static final int ID_BASE = 1000;


  static ChickenProbe.World world(Class<?> c, boolean remote) throws Exception {
    ChickenProbe.World w = (ChickenProbe.World) U.allocateInstance(c);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == ArrayList.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); } // World.collidingBoundingBoxes scratch
    MobMoveProbe.set(w, "t", U.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    return w;
  }
  public static class SW extends ChickenProbe.World {
    static int[] sand; // the falling block's own cell holds the block until the entity's first update takes it away (EntityFallingBlock.onUpdate, fallTime 1)
    public int e(int x, int y, int z) { return 0; }
    public aji a(int x, int y, int z) { return sand != null && sand[0] == x && sand[1] == y && sand[2] == z ? aji.e(12) : super.a(x, y, z); }
    public boolean f(int x, int y, int z) { return true; } // setBlockToAir
    public boolean d(int x, int y, int z, aji b, int m, int f) { return true; } // setBlock (the landing)
  }
  public static class CW2 extends TrackerProbe.CW { public int e(int x, int y, int z) { return 0; } }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static boolean b(Object o, String n) throws Exception { return MobMoveProbe.b(o, n); }
  static float fl(Object o, String n) throws Exception { return MobMoveProbe.fl(o, n); }

  // the entity a scenario tracks
  interface Maker { sa make(ChickenProbe.World w, double[] spawn) throws Exception; }
  static void motion(sa e, double vx, double vy, double vz) throws Exception { MobMoveProbe.set(e, "v", vx); MobMoveProbe.set(e, "w", vy); MobMoveProbe.set(e, "x", vz); }

  // bjb.a(fw) and bjb.a(fx), bytecode-read: the client entity of the spawn packet
  static sa spawn(Object p) throws Exception {
    if (p instanceof fx) {
      fx s = (fx) p;
      sq e = new sq(client, s.d(), s.e(), s.f(), s.g()); // the packet carries the position in 1/32 and the value; the constructor takes them unscaled (bytecode: d()/e()/f() as doubles)
      return e;
    }
    fw s = (fw) p;
    double x = s.d() / 32.0, y = s.e() / 32.0, z = s.f() / 32.0;
    sa e;
    switch (s.l()) {
      case 2: { xk it = new xk(client, x, y, z); e = it; break; }
      case 60: e = new zc(client, x, y, z); break;
      case 61: e = new zj(client, x, y, z); break;
      case 62: e = new zl(client, x, y, z); break; // batch 44: egg and ender pearl
      case 65: e = new zm(client, x, y, z); break;
      case 50: e = new xw(client, x, y, z, null); break;
      case 70: e = new xj(client, x, y, z, aji.e(s.m() & 65535), s.m() >> 16); break;
      case 72: e = new zd(client, x, y, z); break; // batch 43: eye of ender, firework rocket, potion, fishing hook (bjb.a(fw))
      case 76: e = new zf(client, x, y, z, null); break;
      case 73: e = new zo(client, x, y, z, s.m()); break;
      case 90: e = new xe(client, x, y, z, clientPlayer); break;
      default: throw new IllegalStateException("type " + s.l());
    }
    return e;
  }
  static sa handle(sa c, Object p) throws Exception {
    if (p instanceof fw || p instanceof fx) {
      c = spawn(p);
      if (clientSpawned != null) clientSpawned.accept(c);
      c.d(p instanceof fw ? ((fw) p).c() : ((fx) p).c()); // Entity.setEntityId: the client entity has the server's id (the orb's homing check uses id % 100)
      if (spawnedPacket != null) spawnedPacket.accept(c, p); // batch 45: the arrow's shooter lookup (bjb.a(fw) after addEntityToWorld)
      MobMoveProbe.field(sa.class, "bZ").setInt(c, p instanceof fw ? ((fw) p).d() : ((fx) p).d());
      MobMoveProbe.field(sa.class, "ca").setInt(c, p instanceof fw ? ((fw) p).e() : ((fx) p).e());
      MobMoveProbe.field(sa.class, "cb").setInt(c, p instanceof fw ? ((fw) p).f() : ((fx) p).f());
      if (p instanceof fw) {
        fw s = (fw) p;
        MobMoveProbe.field(sa.class, "z").setFloat(c, (float) (s.j() * 360) / 256.0f);
        MobMoveProbe.field(sa.class, "y").setFloat(c, (float) (s.k() * 360) / 256.0f);
        int t = s.l(); // bjb.a(fw) calls fw.g(0) after building a falling block, potion, experience bottle and fishing hook: no velocity from the packet
        if (s.m() > 0 && t != 70 && t != 73 && t != 75 && t != 90) c.i(s.g() / 8000.0, s.h() / 8000.0, s.i() / 8000.0); // sa.i = setVelocity; also zc.c: the arrow's shooter is not needed here
        if (c instanceof xk && !metaMode) ((xk) c).a(stack());
      } else {
        MobMoveProbe.field(sa.class, "y").setFloat(c, 0f);
        MobMoveProbe.field(sa.class, "z").setFloat(c, 0f);
      }
      return c;
    } else if (c == null) return c;
    else if (p instanceof hf) {
      hf s = (hf) p;
      int bx = MobMoveProbe.field(sa.class, "bZ").getInt(c) + s.c(), by = MobMoveProbe.field(sa.class, "ca").getInt(c) + s.d(), bz = MobMoveProbe.field(sa.class, "cb").getInt(c) + s.e();
      MobMoveProbe.field(sa.class, "bZ").setInt(c, bx); MobMoveProbe.field(sa.class, "ca").setInt(c, by); MobMoveProbe.field(sa.class, "cb").setInt(c, bz);
      float yaw = s.h() ? (float) (s.f() * 360) / 256.0f : fl(c, "y"), pitch = s.h() ? (float) (s.g() * 360) / 256.0f : fl(c, "z");
      c.a(bx / 32.0, by / 32.0, bz / 32.0, yaw, pitch, 3);
    } else if (p instanceof ik) {
      ik s = (ik) p;
      MobMoveProbe.field(sa.class, "bZ").setInt(c, s.d()); MobMoveProbe.field(sa.class, "ca").setInt(c, s.e()); MobMoveProbe.field(sa.class, "cb").setInt(c, s.f());
      c.a(s.d() / 32.0, s.e() / 32.0 + 0.015625, s.f() / 32.0, (float) (s.g() * 360) / 256.0f, (float) (s.h() * 360) / 256.0f, 3);
    } else if (p instanceof hy) {
      hy s = (hy) p;
      c.i(s.d() / 8000.0, s.e() / 8000.0, s.f() / 8000.0);
    } else if (p instanceof gt) {
      c.a(MobMoveProbe.field(gt.class, "b").getByte(p)); // bjb.a(gt): Entity.handleHealthUpdate (batch 44)
    } else if (p instanceof hw) {
      c.z().a(((hw) p).c()); // bjb.a(hw): DataWatcher.updateWatchedObjectsFromList
    }
    return c;
  }
  static yz serverPlayer; // the tracked player of the scenario (batch 43: the fishing hook's angler)
  static java.util.function.Consumer<yz> playerSetup;
  static Class<?> serverWorldClass = SW.class;
  static boolean metaMode; // batch 43: the client's item stack comes only from S1C
  static String watchValue(Object v) throws Exception {
    if (v instanceof add) { add a = (add) v; return "\"I:" + adb.b(a.b()) + ":" + a.b + ":" + a.k() + (a.d != null ? ":tag" : "") + "\""; }
    return v == null ? "null" : v instanceof String ? "\"" + v + "\"" : String.valueOf(v);
  }
  static String metaOf(sa e) throws Exception { // the entity's whole DataWatcher: [index, type, value]
    StringBuilder b = new StringBuilder("[");
    List l = e.z().c();
    for (Object o : l) { tf w = (tf) o; b.append(b.length() > 1 ? "," : "").append("[" + w.c() + "," + w.a() + "," + watchValue(w.b()) + "]"); }
    return b + "]";
  }
  static java.util.function.Function<sa, String> serverExtra, clientExtra; // per-tick extras of a scenario (entity state beyond the common fields)
  static java.util.function.BiConsumer<sa, Integer> serverHook; // runs before the server entity's update of tick t
  static add stack() { return new add(ade.G, 1); } // a feather: the stack only has to exist (EntityItem.onUpdate kills an item without one)

  static String fmt(Object p) {
    if (p instanceof fw) { fw s = (fw) p; return "[\"S0E\"," + s.d() + "," + s.e() + "," + s.f() + "," + s.g() + "," + s.h() + "," + s.i() + "," + s.j() + "," + s.k() + "," + s.l() + "," + s.m() + "]"; }
    if (p instanceof fx) { fx s = (fx) p; return "[\"S11\"," + s.d() + "," + s.e() + "," + s.f() + "," + s.g() + "]"; }
    if (p instanceof hy) { hy s = (hy) p; return "[\"S12\"," + s.d() + "," + s.e() + "," + s.f() + "]"; }
    if (p instanceof hg) { hf s = (hf) p; return "[\"S15\"," + s.c() + "," + s.d() + "," + s.e() + "]"; }
    if (p instanceof hh) { hf s = (hf) p; return "[\"S17\"," + s.c() + "," + s.d() + "," + s.e() + "," + s.f() + "," + s.g() + "]"; }
    if (p instanceof hi) { hf s = (hf) p; return "[\"S16\"," + s.f() + "," + s.g() + "]"; }
    if (p instanceof ik) { ik s = (ik) p; return "[\"S18\"," + s.d() + "," + s.e() + "," + s.f() + "," + s.g() + "," + s.h() + "]"; }
    if (p instanceof gt) { try { return "[\"S1A\"," + MobMoveProbe.field(gt.class, "a").getInt(p) + "," + MobMoveProbe.field(gt.class, "b").getByte(p) + "]"; } catch (Exception ex) { throw new RuntimeException(ex); } }
    if (p instanceof ht) return "[\"S19\"," + ((ht) p).c() + "]";
    if (p instanceof hw) { try { hw s = (hw) p; StringBuilder b = new StringBuilder("[\"S1C\"," + s.d() + ",["); for (Object o : s.c()) { tf w = (tf) o; b.append(b.charAt(b.length() - 1) == '[' ? "" : ",").append("[" + w.c() + "," + w.a() + "," + watchValue(w.b()) + "]"); } return b + "]]"; } catch (Exception ex) { throw new RuntimeException(ex); } }
    return "[\"" + p.getClass().getName() + "\"]";
  }

  // One scenario. `serverTicks` rows are produced by the real server entity's onUpdate; the player stands at (px, 0, pz).
  static String run(String name, Maker maker, double[] start, int range, int freq, boolean vel, int n, double px, double pz, boolean pull, int dieAt) throws Exception {
    server = (ChickenProbe.World) world(serverWorldClass, false);
    client = (ChickenProbe.World) world(clientWorldClass, true);
    tickLog.clear();
    TrackerProbe.chunkLoaded = true;
    TrackerProbe.clientWorld = client;
    TrackerProbe.NH net = (TrackerProbe.NH) U.allocateInstance(TrackerProbe.NH.class);
    TrackerProbe.TW tw = (TrackerProbe.TW) U.allocateInstance(TrackerProbe.TW.class); tw.mq = (TrackerProbe.MQ) U.allocateInstance(TrackerProbe.MQ.class);
    TrackerProbe.PMP p = (TrackerProbe.PMP) U.allocateInstance(TrackerProbe.PMP.class); p.world = tw; p.a = net;
    MobMoveProbe.field(mw.class, "f").set(p, new ArrayList<>());
    MobMoveProbe.field(sa.class, "af").set(p, new te(p));
    MobMoveProbe.field(sa.class, "as").set(p, se.b);
    TrackerProbe.set(p, "s", px); TrackerProbe.set(p, "t", 0.0); TrackerProbe.set(p, "u", pz);
    // the client's own player entity, for the orb's xpTarget search
    clientPlayer = (yz) U.allocateInstance(bjk.class) /* EntityClientPlayerMP: EntityPlayer.getEyeHeight (0.12F), unlike the server player's 1.62F */;
    MobMoveProbe.field(sa.class, "af").set(clientPlayer, new te(clientPlayer));
    TrackerProbe.set(clientPlayer, "s", px); TrackerProbe.set(clientPlayer, "t", 0.0); TrackerProbe.set(clientPlayer, "u", pz);
    MobMoveProbe.field(sa.class, "J").setBoolean(clientPlayer, true);
    MobMoveProbe.field(sa.class, "C").set(clientPlayer, azt.a(px - 0.3, 0, pz - 0.3, px + 0.3, 1.8, pz + 0.3));
    MobMoveProbe.field(sa.class, "C").set(p, azt.a(px - 0.3, 0, pz - 0.3, px + 0.3, 1.8, pz + 0.3));
    MobMoveProbe.field(sa.class, "o").set(p, server);
    MobMoveProbe.field(sa.class, "o").set(clientPlayer, client);
    serverPlayer = p;
    if (playerSetup != null) playerSetup.accept(p);
    if (pull) { ((List) MobMoveProbe.field(ahb.class, "h").get(server)).add(p); ((List) MobMoveProbe.field(ahb.class, "h").get(client)).add(clientPlayer); }
    my pe = new my(p, 512, 2, false);
    TrackerProbe.watchX = 0; TrackerProbe.watchZ = 0; TrackerProbe.watchRadius = 10; TrackerProbe.watching = true;
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear();
    List players = new ArrayList(); players.add(p);
    sa e = maker.make(server, start);
    my me = new my(e, range, freq, vel);
    entry = me;
    me.b(players); // EntityTracker.addEntityToTracker -> updatePlayerList: the spawn packets
    StringBuilder out = new StringBuilder("{\"case\":\"" + name + "\",\"id\":" + e.y() + ",\"range\":" + range + ",\"freq\":" + freq + ",\"vel\":" + vel + ",\"width\":" + num(fl(e, "M")) + ",\"height\":" + num(fl(e, "N")) + ",\"player\":[" + num(px) + "," + num(pz) + "],\"pull\":" + pull + ",\"rows\":[");
    StringBuilder inputs = new StringBuilder(), clientRows = new StringBuilder();
    sa c = null;
    boolean dead = false;
    for (int t = 0; t < n; t++) {
      if (serverHook != null) serverHook.accept(e, t);
      if (t > 0 && !dead) { e.h(); }
      if (t == dieAt) { e.B(); } // setDead: Entity.func_70106_y is B() (checked below through K)
      boolean gone = b(e, "K");
      inputs.append(t > 0 ? "," : "").append("[" + num(d(e, "s")) + "," + num(d(e, "t")) + "," + num(d(e, "u")) + "," + num(d(e, "v")) + "," + num(d(e, "w")) + "," + num(d(e, "x")) + "," + num(fl(e, "y")) + "," + num(fl(e, "z")) + "," + (b(e, "D") ? 1 : 0) + "," + (b(e, "H") ? 1 : 0) + "," + (gone ? 1 : 0) + (serverExtra != null ? "," + serverExtra.apply(e) : "") + "]");
      // EntityTracker.updateTrackedEntities
      if (gone && !dead) { dead = true; me.a(p); } // removeEntityFromAllTrackingPlayers: the destroy packet
      if (!dead) me.a(players);
      pe.a(players);
      if (pe.n && !dead) me.b(p);
      List<Object> q = new ArrayList<>(TrackerProbe.queue);
      TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
      StringBuilder pk = new StringBuilder();
      for (Object o : q) pk.append(pk.length() > 0 ? "," : "").append(o instanceof ft && TrackerProbe.sent.isEmpty() ? fmt(o) : fmt(o));
      boolean destroyed = false;
      // the client tick: packets in order (a destroy, queued by func_152339_d, takes effect with the player's next update, one tick later)
      for (Object o : q) c = handle(c, o);
      if (c != null && pendingDestroy) { c = null; pendingDestroy = false; }
      if (dead && c != null) pendingDestroy = true;
      if (c != null) {
        TrackerProbe.set(c, "S", d(c, "s")); TrackerProbe.set(c, "T", d(c, "t")); TrackerProbe.set(c, "U", d(c, "u"));
        c.h();
        if (removeDead && b(c, "K")) c = null; // World.updateEntities removes an entity that setDead itself during its update (batch 46: a client arrow that hit a collidable)
      }
      if (tickHook != null) tickLog.add(tickHook.get());
      clientRows.append(t > 0 ? "," : "").append(c == null ? "[0]" : "[1," + num(d(c, "s")) + "," + num(d(c, "t")) + "," + num(d(c, "u")) + "," + num(d(c, "v")) + "," + num(d(c, "w")) + "," + num(d(c, "x")) + "," + num(d(c, "S")) + "," + num(d(c, "T")) + "," + num(d(c, "U")) + "," + (b(c, "D") ? 1 : 0) + "," + num(fl(c, "y")) + "," + num(fl(c, "z")) + (clientExtra != null ? "," + clientExtra.apply(c) : "") + "]");
      if (pk.length() > 0) out.append(out.charAt(out.length() - 1) == '[' ? "" : ",").append("[" + t + ",[" + pk + "]]");
    }
    out.append("],\"inputs\":[" + inputs + "],\"client\":[" + clientRows + "]" + (tickHook != null ? ",\"log\":[" + String.join(",", tickLog) + "]" : "") + "}");
    return out.toString();
  }
  static boolean pendingDestroy, removeDead;
  static Class<?> clientWorldClass = CW2.class; // batch 44: a client world double that records spawnParticle and makeFireworks
  static java.util.function.BiConsumer<sa, Object> spawnedPacket; // batch 45: runs after the client entity has its id
  static java.util.function.Consumer<sa> clientSpawned; // batch 44: runs right after the client entity is built (reseeds Entity.rand)
  static java.util.function.Supplier<String> tickHook; // batch 44: one entry per client tick (the particles of the tick)
  static List<String> tickLog = new ArrayList<>();
  static my entry; // batch 44: the tracker entry of the scenario (a server world double sends S1A through it)

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true; // getCollidingBoundingBoxes keeps only the floor cells whose box intersects the query (Block.addCollisionBoxesToList); Entity.setPositionAndRotation2 tests the list for emptiness
    // an item dropped from y = 6 with a small sideways motion falls, lands and bounces (EntityItem.onUpdate: motionY * -0.5 on the ground)
    System.out.println(run("itemDrop", (w, s) -> { xk e = new xk(w, s[0], s[1], s[2], stack()); motion(e, 0.07, 0.2, -0.04); return e; }, new double[]{5.3, 6.0, 5.7}, 64, 20, true, 140, 0.5, 0.5, false, -1));
    // an item tossed along +x at 0.3 per tick: it slides over the floor (0.98 * 0.6 drag) and the 4/32 move rule decides the packets
    System.out.println(run("itemToss", (w, s) -> { xk e = new xk(w, s[0], s[1], s[2], stack()); motion(e, 0.45, 0.25, 0.1); return e; }, new double[]{3.5, 1.3, 2.5}, 64, 20, true, 160, 0.5, 0.5, false, -1));
    // an item thrown 70 blocks: it leaves the 64 block range square while the player stands still (the tracking list drops it)
    System.out.println(run("itemFar", (w, s) -> { xk e = new xk(w, s[0], s[1], s[2], stack()); motion(e, 1.2, 0.0, 0.0); return e; }, new double[]{50.5, 0.125, 2.5}, 64, 20, true, 120, 0.5, 0.5, false, -1));
    // an experience orb 4 blocks from the player is pulled toward them on both sides (the server player's eye height 1.62, the client's 0.12)
    System.out.println(run("orbPull", (w, s) -> { sq e = new sq(w, s[0], s[1], s[2], 5); motion(e, 0.05, 0.1, -0.05); return e; }, new double[]{4.5, 1.0, 1.5}, 160, 20, true, 120, 0.5, 0.5, true, -1));
    // an orb dropped from a mob, away from any player
    System.out.println(run("orbDrop", (w, s) -> { sq e = new sq(w, s[0], s[1], s[2], 3); motion(e, -0.12, 0.3, 0.08); return e; }, new double[]{20.5, 3.0, 20.5}, 160, 20, true, 120, 0.5, 0.5, false, -1));
    // an arrow shot up and across: the flight arc, then it sticks in the floor
    System.out.println(run("arrowShot", (w, s) -> { zc e = new zc(w, s[0], s[1], s[2]); e.c(1.0, 0.6, 0.3, 1.6f, 0.0f); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 20, false, 100, 0.5, 0.5, false, -1));
    // a snowball thrown along +x: the server entity hits the floor and dies, the client's one flies on until the destroy packet
    System.out.println(run("snowball", (w, s) -> { zj e = new zj(w, s[0], s[1], s[2]); motion(e, 0.9, 0.3, 0.2); return e; }, new double[]{2.5, 1.5, 2.5}, 64, 10, true, 100, 0.5, 0.5, false, -1));
    // a falling block dropped from y = 20 (no sideways motion)
    System.out.println(run("fallingBlock", (w, s) -> { SW.sand = new int[]{4, 19, 4}; xj e = new xj(w, s[0], s[1], s[2], aji.e(12), 0); return e; }, new double[]{4.5, 19.99, 4.5}, 160, 20, true, 70, 0.5, 0.5, false, -1));
    // primed TNT with the constructor's random upward hop
    System.out.println(run("tntHop", (w, s) -> { xw e = new xw(w, s[0], s[1], s[2], null); motion(e, 0.015, 0.2, -0.012); return e; }, new double[]{4.5, 2.0, 4.5}, 160, 10, true, 75, 0.5, 0.5, false, -1));
  }
}
