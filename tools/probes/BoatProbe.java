import java.util.*;
// Unchanged EntityBoat [xi], ItemBoat [abj] and the sa.h() entity update (water push, fall state)
// from the 1.7.10 client. BW is the VehicleProbe map-backed world [ahb] with setBlock, setBlockToAir
// and func_147480_a recording into the cell map (snow layers and lily pads cleared by the boat) and
// spawnParticle logging every call. Boat.rand [sa.Z] is replaced by Random(7) so the splash
// particle positions replay; EntityItem constructor motion uses Math.random and is excluded from
// replay (as in VehicleProbe). Rider moveForward/moveStrafing/yaw are fixed inputs.
// tools/verify-boats.mjs writes public/research/boat-reference.json; src/boats.test.js replays it.
public class BoatProbe extends VehicleProbe {
  static class BW extends VW {
    BW() { super(); }
    List<String> particles = new ArrayList<>();
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { put(x, y, z, aji.b(b), meta); return true; }
    public boolean f(int x, int y, int z) { put(x, y, z, 0, 0); return true; }
    public boolean a(int x, int y, int z, boolean drop) { put(x, y, z, 0, 0); return true; }
    public void a(String name, double x, double y, double z, double mx, double my, double mz) {
      particles.add("[\"" + name + "\"," + num(x) + "," + num(y) + "," + num(z) + "," + num(mx) + "," + num(my) + "," + num(mz) + "]");
    }
  }
  static BW bw(int[][] cells) throws Exception {
    MW base = world(cells);
    BW w = (BW) PlantProbe.unsafe.allocateInstance(BW.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.particles = new ArrayList<>();
    return w;
  }
  static double mult(xi c) throws Exception { return PlayerStepProbe.field(xi.class, "b").getDouble(c); }
  static xi boat(BW w, double x, double y, double z, float yaw, double vx, double vy, double vz) throws Exception {
    xi c = new xi(w, x, y, z); c.y = yaw; c.A = yaw; c.v = vx; c.w = vy; c.x = vz;
    PlayerStepProbe.set(c, "Z", new Random(7));
    PlayerStepProbe.field(sa.class, "c").setInt(c, 1);
    w.entities.add(c);
    return c;
  }
  static String bstate(xi c) throws Exception {
    return "[" + num(c.s) + "," + num(c.t) + "," + num(c.u) + "," + num(c.v) + "," + num(c.w) + "," + num(c.x) + "," + c.y + "," + c.D + "," + c.E + "," + c.K
      + "," + c.f() + "," + c.e() + "," + c.i() + "," + num(mult(c)) + "," + c.R + "," + num(c.C.a) + "," + num(c.C.b) + "," + num(c.C.c) + "]";
  }
  static String drops(BW w) throws Exception {
    StringBuilder d = new StringBuilder("[");
    for (sa s : w.spawned) { if (d.length() > 1) d.append(','); d.append(item(s)); }
    return d.append(']').toString();
  }
  static void travel(String name, int[][] cells, double[] spawn, float boatYaw, float yaw, float forward, float strafe, boolean ridden, int count) throws Exception {
    BW w = bw(cells);
    xi c = boat(w, spawn[0], spawn[1], spawn[2], boatYaw, spawn[3], spawn[4], spawn[5]);
    Rider p = rider(w, yaw, forward); p.bd = strafe;
    boolean mounted = ridden && c.c(p); if (ridden) c.ac();
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      w.particles.clear();
      if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); }
      if (p.m != null && !p.m.K) { c.ac(); p.R = 0; }
      if (t > 0) ticks.append(',');
      ticks.append("[").append(bstate(c)).append(',').append(ps(p)).append(",[").append(String.join(",", w.particles)).append("],").append(w.spawned.size()).append(']');
    }
    ticks.append(']');
    String before = ps(p); if (p.m != null) p.a((sa) null);
    System.out.println("{\"kind\":\"travel\",\"name\":\"" + name + "\",\"cells\":" + cells(cells) + ",\"spawn\":" + Arrays.toString(spawn) + ",\"boatYaw\":" + boatYaw + ",\"yaw\":" + yaw + ",\"forward\":" + forward + ",\"strafe\":" + strafe
      + ",\"ridden\":" + ridden + ",\"mounted\":" + mounted + ",\"ticks\":" + ticks + ",\"drops\":" + drops(w) + ",\"beforeDismount\":" + before + ",\"dismount\":" + ps(p) + "}");
  }
  // Hit sequences: attackEntityFrom(player source, amount), `gap` boat ticks between hits.
  static void hits(String name, boolean creative, float[] amounts, int gap, boolean ridden) throws Exception {
    BW w = bw(new int[][] {}); xi c = boat(w, 0.5, 0.5, 0.5, 0, 0, 0, 0);
    Rider p = rider(w, 0, 0); p.bE.d = creative; Rider q = rider(w, 0, 0); q.bE.d = creative;
    if (ridden) { c.c(q); c.ac(); }
    StringBuilder seq = new StringBuilder("[");
    for (int i = 0; i < amounts.length; i++) {
      boolean ret = c.a(ro.a((yz) p), amounts[i]);
      if (i > 0) seq.append(',');
      seq.append("[").append(ret).append(',').append(c.K).append(',').append(c.f()).append(',').append(c.e()).append(',').append(c.i()).append(',').append(w.spawned.size()).append(',').append(q.m != null).append(']');
      for (int g = 0; g < gap && !c.K; g++) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); }
      seq.append(",[").append(c.f()).append(',').append(c.e()).append(']');
    }
    seq.append(']');
    System.out.println("{\"kind\":\"hits\",\"name\":\"" + name + "\",\"creative\":" + creative + ",\"amounts\":" + Arrays.toString(amounts) + ",\"gap\":" + gap + ",\"ridden\":" + ridden + ",\"seq\":" + seq + ",\"drops\":" + drops(w) + "}");
  }
  static void mount() throws Exception {
    BW w = bw(new int[][] {}); xi c = boat(w, 0.5, 0.5, 0.5, 30, 0, 0, 0);
    Rider p = rider(w, 0, 0), q = rider(w, 0, 0);
    boolean first = c.c(p), second = c.c(q); c.ac();
    System.out.println("{\"kind\":\"mount\",\"first\":" + first + ",\"occupied\":" + second + ",\"firstRider\":" + (c.l == p) + ",\"secondMounted\":" + (q.m != null) + ",\"position\":" + ps(p) + ",\"offset\":" + num(c.ae())
      + ",\"size\":[" + c.M + "," + c.N + "],\"yOffset\":" + c.L + ",\"box\":[" + num(c.C.a) + "," + num(c.C.b) + "," + num(c.C.c) + "," + num(c.C.d) + "," + num(c.C.e) + "," + num(c.C.f) + "]}");
  }
  static void placement(int block, int meta, float yaw, boolean sideBlock, boolean creative) throws Exception {
    int[][] base = {{2, 1, 4, block, meta}};
    if (sideBlock) base = new int[][] {{2, 1, 4, block, meta}, {3, 2, 4, 1, 0}};
    BW w = bw(base); Rider p = rider(w, yaw, 0); p.b(2.5, 3, 4.5); p.z = 90; p.B = 90; p.A = yaw; p.S = 2.5; p.T = 3; p.U = 4.5; p.bE.d = creative;
    add stack = new add(adb.d(333), 2, 0);
    add result = ((abj) stack.b()).a(stack, w, p);
    sa b = w.spawned.isEmpty() ? null : w.spawned.get(0);
    System.out.println("{\"kind\":\"placement\",\"block\":" + block + ",\"meta\":" + meta + ",\"yaw\":" + yaw + ",\"side\":" + sideBlock + ",\"creative\":" + creative + ",\"count\":" + result.b + ",\"boat\":"
      + (b == null ? "null" : "[" + num(b.s) + "," + num(b.t) + "," + num(b.u) + "," + b.y + "]") + "}");
  }
  static int[][] water(int x0, int x1, int z0, int z1) {
    List<int[]> c = new ArrayList<>();
    for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) { c.add(new int[] {x, -1, z, 9, 0}); c.add(new int[] {x, 0, z, 9, 0}); }
    return c.toArray(new int[0][]);
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe(); mount();
    int[][] pool = water(-4, 44, -4, 4);
    double[] rest = {0.5, 1.0, 0.5, 0, 0, 0};
    travel("floating-idle", pool, rest, 0, 0, 0, 0, false, 80);
    travel("drop-into-water", pool, new double[] {0.5, 6.0, 0.5, 0, 0, 0}, 0, 0, 0, 0, false, 60);
    travel("ridden-forward-x", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, -90, 1, 0, true, 140);
    travel("ridden-forward-diagonal", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, 0, -45, 1, 0, true, 80);
    travel("ridden-strafe", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, 0, -90, 1, 1, true, 60);
    travel("ridden-reverse", pool, new double[] {10.5, 1.0, 0.5, 0, 0, 0}, 0, -90, -1, 0, true, 60);
    travel("coast-drag", pool, new double[] {0.5, 1.0, 0.5, 0.2, 0, 0}, -90, -90, 0, 0, false, 80);
    travel("turn-while-coasting", pool, new double[] {0.5, 1.0, 0.5, 0.0, 0, 0.2}, 0, -90, 0, 0, false, 60);
    int[][] beach = join(water(-4, 7, -4, 4), row(1, 0, 8, 20, -1, 0), row(1, 0, 8, 20, -1, 1), row(1, 0, 8, 20, -1, -1));
    travel("beaching-glide", beach, new double[] {0.5, 1.0, 0.0, 0.15, 0, 0}, -90, 0, 0, 0, false, 120);
    travel("beaching-ridden", beach, new double[] {0.5, 1.0, 0.0, 0, 0, 0}, -90, -90, 1, 0, true, 120);
    int[][] wall = join(water(-4, 24, -4, 4), col(1, 0, -4, 4, 0, 25), col(1, 0, -4, 4, 1, 25), col(1, 0, -4, 4, 2, 25));
    travel("crash-break-fast", wall, new double[] {0.5, 1.0, 0.0, 0, 0, 0}, -90, -90, 1, 0, true, 160);
    travel("crash-slow-no-break", wall, new double[] {22.0, 1.0, 0.0, 0.12, 0, 0}, -90, 0, 0, 0, false, 40);
    travel("fall-break", new int[][] {}, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, 0, 0, 0, false, 40);
    travel("fall-small-no-break", new int[][] {}, new double[] {0.5, 2.5, 0.5, 0, 0, 0}, 0, 0, 0, 0, false, 30);
    travel("fall-ridden-break", new int[][] {}, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, 0, 0, 0, true, 40);
    travel("clear-snow-and-lilypad", join(water(-4, 14, -4, 4), new int[][] {{3, 1, 0, 78, 0}, {5, 0, 0, 111, 0}}, new int[][] {{6, 1, 0, 78, 0}, {8, 0, 0, 111, 0}}), new double[] {0.5, 1.0, 0.0, 0.3, 0, 0}, -90, 0, 0, 0, false, 40);
    travel("flowing-water-push", join(water(-4, 14, -4, 4), row(8, 3, 0, 12, 0, 0), row(8, 3, 0, 12, -1, 0)), new double[] {0.5, 1.0, 0.0, 0, 0, 0}, 0, 0, 0, 0, false, 50);
    hits("fist-hits", false, new float[] {1, 1, 1, 1, 1, 1}, 0, false);
    hits("fist-hits-decay", false, new float[] {1, 1, 1, 1, 1, 1}, 12, false);
    hits("sword-hits", false, new float[] {5, 5}, 0, false);
    hits("axe-hit-ridden", false, new float[] {4, 4, 4}, 0, true);
    hits("creative-hit", true, new float[] {1}, 0, false);
    hits("creative-hit-ridden", true, new float[] {1}, 0, true);
    for (int[] b : new int[][] {{1, 0}, {9, 0}, {9, 3}, {78, 0}, {111, 0}, {0, 0}, {8, 0}})
      for (float yaw : new float[] {0, 90, 135, 200, -45}) placement(b[0], b[1], yaw, false, false);
    placement(1, 0, 0, true, false); placement(9, 0, 0, true, false);
    placement(9, 0, 0, false, true);
  }
}
