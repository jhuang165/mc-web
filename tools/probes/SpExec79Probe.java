import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 executed checks of batch 79 (spexec79), run on the unchanged original classes. No class is patched. Extends SpExec78Probe's pattern.
//  - milk79: EntityCow.interact (wh.a) and EntityMooshroom.interact (wm.a) with a BOWL held by a calf (age -6000), on a server and a client world (SpExec78Milk's doubles). Batch 78 ran the bowl
//    only on adults.
//  - pearl79: EntityEnderPearl flights (EntityThrowable.onUpdate, zk.h) through water (still, flowing) and lava (still, flowing) over a stone floor, both worlds, a connected owner: every tick
//    records the position, motion, fire counter, inWater flag, death and the world events of that tick (bubbles, splash, portal particles, the teleport and fall damage of the impact).
//  - fire79: a dispenser (akm.a, updateTick) holding a fire charge facing each side on a server and a client world: the aux/sound log, the spawned EntitySmallFireball (position, motion,
//    acceleration) and its first three updates (EntityFireball.onUpdate, ze.h) with the particles of each tick.
// Records (JSON lines): kind milk79 / pearl79 / fire79.
public class SpExec79Probe {
  static String q(String s) { return SpExec78Probe.q(s); }
  static String num(double v) { return Double.toString(v); }
  static String jlist(List<String> l) { return SpExec78Probe.jlist(l); }

  // ---------------------------------------------------------------- milk79
  static void milk() throws Exception {
    SpExec78Milk.setup();
    PrintStream real = System.out;
    ByteArrayOutputStream buf = new ByteArrayOutputStream();
    System.setOut(new PrintStream(buf, true));
    try {
      for (int remote = 0; remote < 2; remote++) for (String mob : new String[] {"mooshroom", "cow"}) {
        boolean r = remote == 1;
        SpExec78Milk.interact("bowl", mob, ade.z, 1, false, false, -6000, 0, r);
        SpExec78Milk.interact("bowl", mob, ade.z, 2, false, false, -6000, 0, r);
        SpExec78Milk.interact("bowl", mob, ade.z, 2, true, false, -6000, 0, r);
        SpExec78Milk.interact("bowl", mob, ade.z, 2, false, true, -6000, 0, r);
        SpExec78Milk.interact("bowl", mob, ade.z, 1, false, false, -1, 0, r);
        SpExec78Milk.interact("bowl", mob, ade.z, 1, false, false, 0, 0, r); // adult baseline
        SpExec78Milk.interact("shear", mob, ade.aZ, 1, false, false, -1, 0, r);
        SpExec78Milk.interact("stew", mob, ade.A, 1, false, false, -6000, 0, r);
      }
    } finally { System.setOut(real); }
    for (String l : buf.toString().split("\n")) if (l.startsWith("{")) real.println(l.replace("\"kind\":\"milk\"", "\"kind\":\"milk79\""));
  }

  // ---------------------------------------------------------------- pearl79
  static int liquidId, liquidMeta, floorY, topY;
  public static class LW extends SpExec78Probe.W {
    LW() { super(); }
    public aji a(int x, int y, int z) { return y <= floorY ? aji.e(1) : (y <= topY && y > floorY && liquidId != 0 ? aji.e(liquidId) : aji.e(0)); }
    public int e(int x, int y, int z) { return y == topY ? liquidMeta : 0; } // only the top layer is a flowing level; below it are sources (World.handleMaterialAcceleration reads the cell's own level)
    public boolean c(int x, int y, int z) { return false; } // isAirBlock
  }
  static LW liquidWorld(boolean remote) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    LW w = (LW) u.allocateInstance(LW.class);
    w.ev = new ArrayList<>(); w.spawned = new ArrayList<>(); w.solid = new HashSet<>(); w.rules = new agy();
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "u", new ArrayList<Object>());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    return w;
  }
  static void pearl(String name, int id, int meta, boolean remote, double mx, double my, double mz, double startY) throws Exception {
    liquidId = id; liquidMeta = meta; floorY = 19; topY = 22;
    MobMoveProbe.ProbeWorld.water = true; // World.handleMaterialAcceleration / isMaterialInBB are the real ones
    LW w = liquidWorld(remote);
    zm pearl = new zm(w);
    SpExec78Probe.place(pearl, w, 10.5, startY, 30.5);
    pearl.b(10.5, startY, 30.5); // Entity.setPosition: the 0.25 box (place() gives a 0.6 x 1.8 box)
    MobMoveProbe.set(pearl, "Z", new Random(9));
    pearl.v = mx; pearl.w = my; pearl.x = mz;
    SpExec78Probe.Owner o = SpExec78Probe.alloc(SpExec78Probe.Owner.class); o.w = w; o.ball = pearl;
    SpExec78Probe.place(o, w, 3, 64, 3);
    SpExec78Probe.Net net = SpExec78Probe.alloc(SpExec78Probe.Net.class); net.open = true;
    SpExec78Probe.Handler h = SpExec78Probe.alloc(SpExec78Probe.Handler.class); h.net = net;
    MobMoveProbe.set(o, "a", h);
    o.R = 12f;
    MobMoveProbe.set(pearl, "g", o);
    List<String> ticks = new ArrayList<>();
    String err = "null";
    for (int t = 0; t < 36; t++) {
      int before = w.ev.size();
      try { pearl.h(); } catch (Throwable x) { err = q(SpSounds77Probe.errOf(x)); }
      List<String> ev = new ArrayList<>(w.ev.subList(before, w.ev.size()));
      ticks.add("{\"tick\":" + t + ",\"pos\":[" + num(pearl.s) + "," + num(pearl.t) + "," + num(pearl.u) + "],\"motion\":[" + num(pearl.v) + "," + num(pearl.w) + "," + num(pearl.x) + "],\"fire\":" + MobMoveProbe.field(sa.class, "e").getInt(pearl) + ",\"inWater\":" + pearl.M() + ",\"dead\":" + pearl.K + ",\"fall\":" + o.R + ",\"events\":" + jlist(ev) + "}");
      if (pearl.K || err != "null") break;
    }
    System.out.println("{\"kind\":\"pearl79\",\"name\":" + q(name) + ",\"liquid\":" + id + ",\"meta\":" + meta + ",\"remote\":" + remote + ",\"start\":[10.5," + startY + ",30.5],\"launch\":[" + num(mx) + "," + num(my) + "," + num(mz) + "],\"floorTop\":" + floorY + ",\"liquidTop\":" + topY + ",\"error\":" + err + ",\"ticks\":[" + String.join(",", ticks) + "]}");
  }
  static void pearls() throws Exception {
    Object[][] liquids = {{"still-water", 9, 0}, {"flowing-water", 8, 3}, {"flowing-water-low", 8, 7}, {"still-lava", 11, 0}, {"flowing-lava", 10, 2}, {"none", 0, 0}};
    for (Object[] l : liquids) for (int remote = 0; remote < 2; remote++) {
      if (remote == 1 && !(l[0].equals("still-water") || l[0].equals("still-lava") || l[0].equals("none"))) continue; // the client copy of a flowing liquid is the still one's twin (a flowing layer matters to neither the drag nor the fire)
      pearl(l[0] + "-drop", (int) l[1], (int) l[2], remote == 1, 0, -0.2, 0, 26.0);
      pearl(l[0] + "-arc", (int) l[1], (int) l[2], remote == 1, 0.3, 0.1, 0, 23.0);
      pearl(l[0] + "-slow", (int) l[1], (int) l[2], remote == 1, 0.02, 0, 0.02, 22.3); // creeps down through the liquid: the handleLavaMovement window (frac y in [0.15, 0.6)) is hit
      pearl(l[0] + "-inside", (int) l[1], (int) l[2], remote == 1, 0.05, 0, 0.05, 21.0); // starts inside the liquid
    }
  }

  // ---------------------------------------------------------------- fire79
  public static class FW extends DispenseProbe.W {
    List<String> pl = new ArrayList<>();
    FW() { super(); }
    public void a(String kind, double x, double y, double z, double mx, double my, double mz) { pl.add(SpExec79Probe.q("particle " + kind + " " + x + " " + y + " " + z + " " + mx + " " + my + " " + mz)); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public List b(sa e, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public boolean a(azt box, awt material) { return false; }
    public boolean c(int x, int y, int z) { return blocks.getOrDefault(key(x, y, z), 0) == 0; }
  }
  static void fire(int facing, boolean remote, long seed) throws Exception {
    sun.misc.Unsafe u = DispenseProbe.U;
    FW w = (FW) u.allocateInstance(FW.class);
    w.blocks = new HashMap<>(); w.metas = new HashMap<>(); w.tiles = new HashMap<>(); w.log = new ArrayList<>(); w.spawned = new ArrayList<>(); w.rules = new agy(); w.powered = new HashSet<>(); w.pl = new ArrayList<>();
    DispenseProbe.field(ahb.class, "t").set(w, new DispenseProbe.Provider());
    DispenseProbe.field(ahb.class, "s").set(w, new Random(seed));
    DispenseProbe.field(ahb.class, "C").set(w, new qi());
    DispenseProbe.field(ahb.class, "u").set(w, new ArrayList<Object>());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    DispenseProbe.field(ahb.class, "E").setBoolean(w, remote);
    int X = DispenseProbe.X, Y = DispenseProbe.Y, Z = DispenseProbe.Z;
    w.put(X, Y, Z, 23, facing);
    apb t = new apb();
    t.a(0, DispenseProbe.stack("385:2:0"));
    DispenseProbe.field(apb.class, "j").set(t, new Random(555));
    w.tiles.put(DispenseProbe.W.key(X, Y, Z), t);
    String err = "null";
    try { aji.e(23).a(w, X, Y, Z, new Random(1)); } catch (Throwable e) { err = q(SpSounds77Probe.errOf(e)); }
    StringBuilder o = new StringBuilder("{\"kind\":\"fire79\",\"facing\":" + facing + ",\"remote\":" + remote + ",\"seed\":\"" + seed + "\",\"error\":" + err + ",\"after\":[");
    for (int i = 0; i < t.a(); i++) { if (i > 0) o.append(','); o.append(DispenseProbe.enc(t.a(i))); }
    o.append("],\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(SpDispense77Probe.entity(w.spawned.get(i))); }
    o.append("],\"flight\":[");
    boolean first = true;
    if (!w.spawned.isEmpty()) {
      sa ball = w.spawned.get(0);
      for (int k = 0; k < 3; k++) {
        w.pl.clear();
        String e2 = "null";
        try { ball.h(); } catch (Throwable e) { e2 = q(SpSounds77Probe.errOf(e)); }
        if (!first) o.append(','); first = false;
        o.append("{\"tick\":" + k + ",\"pos\":[" + num(ball.s) + "," + num(ball.t) + "," + num(ball.u) + "],\"motion\":[" + num(ball.v) + "," + num(ball.w) + "," + num(ball.x) + "],\"dead\":" + ball.K + ",\"error\":" + e2 + ",\"particles\":" + jlist(new ArrayList<>(w.pl)) + "}");
      }
    }
    o.append("],\"worldNext\":").append(w.s.nextInt(1000000)).append('}');
    System.out.println(o);
  }
  static void fires() throws Exception {
    for (int f = 0; f < 6; f++) for (int remote = 0; remote < 2; remote++) for (long seed : new long[] {5, 6}) fire(f, remote == 1, seed);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DispenseProbe.U = MobMoveProbe.unsafe();
    kl.a();
    String only = args.length > 0 ? args[0] : "all";
    if (only.equals("all") || only.equals("milk")) milk();
    if (only.equals("all") || only.equals("pearl")) pearls();
    if (only.equals("all") || only.equals("fire")) fires();
  }
}
