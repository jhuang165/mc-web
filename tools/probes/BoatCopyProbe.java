import java.util.*;
// Batch 54 (tag b54bc): an unridden EntityBoat [xi] ticked as the client copy of a boat: the world is flagged remote (ahb.E, World.isRemote), so xi.h runs the
// interpolation branch (setPositionAndRotation2 [xi.a(DDDFFI)] targets, the S12 motion [xi.i(DDD)] coasting) after Entity.onUpdate [sa.h], whose
// handleWaterMovement [sa.N] pushes the copy in flowing water and, entering water, plays the splash sound (logged by the world stand-in) and spawns the bubbles and splashes.
// Entity.rand [sa.Z] is Random(7). Stand-ins: BoatProbe's map-backed world with the sound call logged; nothing here copies game code.
// tools/verify-boatcopy.mjs writes public/research/boat-copy-reference.json; src/boat-copy-b54.test.js replays it against ObjectClient.waterMovement.
public class BoatCopyProbe extends BoatProbe {
  static class CW extends BW {
    CW() { super(); }
    List<String> sounds = new ArrayList<>();
    public void a(sa e, String name, float volume, float pitch) { sounds.add("[\"" + name + "\"," + volume + "," + pitch + "]"); }
    List<String> cleared = new ArrayList<>();
    public boolean f(int x, int y, int z) { cleared.add("[" + x + "," + y + "," + z + ",\"air\"]"); return super.f(x, y, z); }
    public boolean a(int x, int y, int z, boolean drop) { cleared.add("[" + x + "," + y + "," + z + ",\"break\"]"); return super.a(x, y, z, drop); }
  }
  static CW cw(int[][] cells) throws Exception {
    BW base = bw(cells);
    CW w = (CW) PlantProbe.unsafe.allocateInstance(CW.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.particles = new ArrayList<>(); w.sounds = new ArrayList<>(); w.cleared = new ArrayList<>();
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, true);
    return w;
  }
  static String cstate(xi c) {
    return "[" + num(c.s) + "," + num(c.t) + "," + num(c.u) + "," + num(c.v) + "," + num(c.w) + "," + num(c.x) + "," + c.y + "," + c.z + "," + c.D + "]";
  }
  // packets: {tick, 0, vx, vy, vz} is an S12; {tick, 1, x, y, z, yaw, pitch} is an S18-style setPositionAndRotation2 with 3 increments.
  static void copy(String name, int[][] cells, double[] spawn, double[][] packets, int count) throws Exception {
    CW w = cw(cells);
    xi c = boat(w, spawn[0], spawn[1], spawn[2], 0, 0, 0, 0);
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      for (double[] p : packets) if ((int) p[0] == t) { if (p[1] == 0) c.i(p[2], p[3], p[4]); else c.a(p[2], p[3], p[4], (float) p[5], (float) p[6], 3); }
      w.particles.clear(); w.sounds.clear();
      c.h();
      if (t > 0) ticks.append(',');
      ticks.append("[").append(cstate(c)).append(",[").append(String.join(",", w.sounds)).append("],[").append(String.join(",", w.particles)).append("]]");
    }
    ticks.append(']');
    StringBuilder pk = new StringBuilder("[");
    for (double[] p : packets) { if (pk.length() > 1) pk.append(','); pk.append(Arrays.toString(p)); }
    System.out.println("{\"kind\":\"copy\",\"name\":\"" + name + "\",\"cells\":" + cells(cells) + ",\"spawn\":" + Arrays.toString(spawn) + ",\"packets\":" + pk + "],\"ticks\":" + ticks + "}");
  }
  // Batch 56 (tag b56bc): the boat the client player rides. NetHandlerPlayClient.a(S1B) mounts the client player (sa.a(sa), the Rider stand-in's mountEntity; interactFirst xi.c(yz) does
  // nothing on a client world) and calls setIsBoatEmpty(false) [xi.a(Z)], so xi.h skips its `isRemote && isBoatEmpty` interpolation branch and runs the full physics on the client world
  // from the rider's own moveForward [p.be], moveStrafing [p.bd] and yaw [p.y]. `inputs` rows {fromTick, forward, strafe, yaw}; `packets` as in copy() (S12 xi.i, S18 xi.a(DDDFFI)).
  // Rows record the boat state, the rider's feet after updateRiderPosition [xi.ac], the world's particle, sound and clear calls, and the rider's fall distance [Rider.fallen].
  static void ride(String name, int[][] cells, double[] spawn, float boatYaw, double[][] inputs, double[][] packets, int count) throws Exception {
    CW w = cw(cells);
    xi c = boat(w, spawn[0], spawn[1], spawn[2], boatYaw, spawn[3], spawn[4], spawn[5]);
    Rider p = rider(w, 0, 0);
    p.a((sa) c); c.a(false); c.ac();
    boolean seated = p.m == c;
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      for (double[] in : inputs) if ((int) in[0] <= t) { p.be = (float) in[1]; p.bd = (float) in[2]; p.y = (float) in[3]; }
      for (double[] k : packets) if ((int) k[0] == t) { if (k[1] == 0) c.i(k[2], k[3], k[4]); else c.a(k[2], k[3], k[4], (float) k[5], (float) k[6], 3); }
      w.particles.clear(); w.sounds.clear(); w.cleared.clear();
      if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); }
      if (p.m != null && !p.m.K) { c.ac(); p.R = 0; }
      if (t > 0) ticks.append(',');
      ticks.append("[").append(bstate(c)).append(',').append(ps(p)).append(",[").append(String.join(",", w.sounds)).append("],[").append(String.join(",", w.particles)).append("],[").append(String.join(",", w.cleared)).append("]]");
    }
    ticks.append(']');
    String before = ps(p); if (p.m != null) p.a((sa) null);
    StringBuilder pk = new StringBuilder("[");
    for (double[] k : packets) { if (pk.length() > 1) pk.append(','); pk.append(Arrays.toString(k)); }
    StringBuilder in = new StringBuilder("[");
    for (double[] k : inputs) { if (in.length() > 1) in.append(','); in.append(Arrays.toString(k)); }
    System.out.println("{\"kind\":\"ride\",\"name\":\"" + name + "\",\"cells\":" + cells(cells) + ",\"spawn\":" + Arrays.toString(spawn) + ",\"boatYaw\":" + boatYaw + ",\"seated\":" + seated + ",\"inputs\":" + in + "],\"packets\":" + pk
      + "],\"ticks\":" + ticks + ",\"beforeDismount\":" + before + ",\"dismount\":" + ps(p) + "}");
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] pool = water(-4, 44, -4, 4);
    int[][] flow = join(water(-4, 14, -4, 4), row(8, 3, 0, 12, 0, 0), row(8, 3, 0, 12, -1, 0));
    int[][] flow2 = join(water(-4, 14, -4, 4), row(8, 1, 0, 12, 0, 0), row(8, 5, 0, 12, 0, 1), row(8, 2, -2, 12, 0, -1));
    copy("flow-drift", flow, new double[] {0.5, 0.0, 0.0}, new double[][] {}, 40);
    copy("flow-drift-s12", flow, new double[] {0.5, 0.0, 0.0}, new double[][] {{0, 0, 0.05, 0, 0.02}}, 40);
    copy("fall-into-flow", flow, new double[] {2.5, 2.0, 0.0}, new double[][] {{3, 0, 0.1, -0.3, 0}}, 40);
    copy("fall-into-still", pool, new double[] {2.5, 2.0, 0.5}, new double[][] {{3, 0, 0.1, -0.3, 0.05}}, 40);
    copy("teleport-in-flow", flow, new double[] {0.5, 0.0, 0.0}, new double[][] {{0, 1, 3.5, 1.1, 0.3, 40, 5}, {12, 1, 8.5, 1.0, -0.2, -90, 0}, {24, 0, 0.2, 0, 0}}, 40);
    copy("flow-gradient", flow2, new double[] {1.5, 0.0, 0.5}, new double[][] {{0, 0, 0, 0, 0}}, 40);
    copy("fast-splash", pool, new double[] {0.5, 0.0, 0.5}, new double[][] {{0, 0, 0.5, 0, 0.1}}, 24);
    int[][] beach = join(water(-4, 7, -4, 4), row(1, 0, 8, 20, -1, 0), row(1, 0, 8, 20, -1, 1), row(1, 0, 8, 20, -1, -1));
    int[][] wall = join(water(-4, 24, -4, 4), col(1, 0, -4, 4, 0, 25), col(1, 0, -4, 4, 1, 25), col(1, 0, -4, 4, 2, 25));
    ride("ride-forward", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, new double[][] {{0, 1, 0, -90}}, new double[][] {}, 140);
    ride("ride-diagonal-strafe", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 1, 0, -45}, {30, 1, 1, -45}, {60, 1, -1, 0}}, new double[][] {}, 100);
    ride("ride-reverse-coast", pool, new double[] {10.5, 1.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, -1, 0, -90}, {30, 0, 0, -90}}, new double[][] {}, 100);
    ride("ride-turning", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, new double[][] {{0, 1, 0, -90}, {20, 1, 0, -20}, {40, 1, 0, 60}, {60, 1, 0, 170}, {80, 0, 0, 170}}, new double[][] {}, 110);
    ride("ride-beach", beach, new double[] {0.5, 1.0, 0.0, 0, 0, 0}, -90, new double[][] {{0, 1, 0, -90}}, new double[][] {}, 120);
    ride("ride-crash-fast", wall, new double[] {0.5, 1.0, 0.0, 0, 0, 0}, -90, new double[][] {{0, 1, 0, -90}}, new double[][] {}, 160);
    ride("ride-fall-high", new int[][] {}, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40);
    ride("ride-fall-into-water", pool, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 1, 0, -90}}, new double[][] {}, 60);
    ride("ride-clear-snow-lilypad", join(water(-4, 14, -4, 4), new int[][] {{3, 1, 0, 78, 0}, {5, 0, 0, 111, 0}}, new int[][] {{6, 1, 0, 78, 0}, {8, 0, 0, 111, 0}}), new double[] {0.5, 1.0, 0.0, 0.3, 0, 0}, -90, new double[][] {{0, 0, 0, -90}}, new double[][] {}, 40);
    ride("ride-clear-lilypads", join(water(-4, 14, -4, 4), new int[][] {{3, 1, 0, 111, 0}, {5, 1, 0, 111, 0}, {6, 1, 1, 111, 0}, {8, 1, 0, 111, 0}, {9, 1, 0, 78, 0}}), new double[] {0.5, 1.0, 0.0, 0.25, 0, 0}, -90, new double[][] {{0, 1, 0, -90}}, new double[][] {}, 50);
    ride("ride-flowing-water", flow, new double[] {0.5, 1.0, 0.0, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}, {20, 1, 0, 0}}, new double[][] {}, 60);
    ride("ride-packets", pool, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, new double[][] {{0, 1, 0, -90}}, new double[][] {{5, 0, 0.05, 0.01, 0.02}, {10, 1, 5.5, 1.0, 0.5, -90, 0}, {11, 1, 0.9, 1.0, 0.5, -90, 0}, {20, 1, 30.5, 1.2, 4.5, 20, 3}, {30, 0, 0.3, 0, 0}, {31, 1, 31.0, 1.0, 5.0, 90, 0}}, 60);
    copy("dry-fall", new int[][] {}, new double[] {0.5, 6.0, 0.5}, new double[][] {{0, 0, 0.1, 0, 0}}, 20);
  }
}
