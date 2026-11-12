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
  }
  static CW cw(int[][] cells) throws Exception {
    BW base = bw(cells);
    CW w = (CW) PlantProbe.unsafe.allocateInstance(CW.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.particles = new ArrayList<>(); w.sounds = new ArrayList<>();
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
    copy("dry-fall", new int[][] {}, new double[] {0.5, 6.0, 0.5}, new double[][] {{0, 0, 0.1, 0, 0}}, 20);
  }
}
