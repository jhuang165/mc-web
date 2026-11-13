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
    // WorldClient.playSound(x, y, z, name, volume, pitch, distanceDelay) [ahb.a(DDDString,F,F,Z), a bare return in World]: what EntityPlayerSP.playSound calls (bytecode-read).
    List<String> played = new ArrayList<>();
    public void a(double x, double y, double z, String name, float volume, float pitch, boolean delay) { played.add("[\"" + name + "\"," + num(x) + "," + num(y) + "," + num(z) + "," + volume + "," + pitch + "]"); }
    List<String> cleared = new ArrayList<>();
    public boolean f(int x, int y, int z) { cleared.add("[" + x + "," + y + "," + z + ",\"air\"]"); return super.f(x, y, z); }
    public boolean a(int x, int y, int z, boolean drop) { cleared.add("[" + x + "," + y + "," + z + ",\"break\"]"); return super.a(x, y, z, drop); }
  }
  static CW cw(int[][] cells) throws Exception {
    BW base = bw(cells);
    CW w = (CW) PlantProbe.unsafe.allocateInstance(CW.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.particles = new ArrayList<>(); w.sounds = new ArrayList<>(); w.cleared = new ArrayList<>(); w.played = new ArrayList<>();
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
  // Batch 57 (tag b57bx): the real EntityLivingBase.fall [sv.b(F)] on the rider. The client player (EntityClientPlayerMP, bjk) keeps EntityPlayerSP.playSound [blk.a(String,F,F): World.playSound at
  // the feet with distanceDelay false, so the fall and step sounds ARE played locally] and its attackEntityFrom [bjk.a(ro,F)] is `return false`; the stand-in below keeps blk's playSound and
  // answers false the same way (counting the calls), everything else is the unchanged sv.b: the potion lookup, ceil(distance - 3 - boost), "game.neutral.hurt.fall.*" (sv.o(I)), the block under
  // the feet and its step sound at volume * 0.5, pitch * 0.75.
  static class FRider extends Target {
    FRider() { super(); }
    int attacks; float amount;
    public boolean a(ro source, float a) { attacks++; amount = a; return false; }
  }
  static FRider frider(CW w) throws Exception {
    FRider p = (FRider) PlantProbe.unsafe.allocateInstance(FRider.class);
    PlayerStepProbe.set(p, "o", w); PlayerStepProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    PlayerStepProbe.set(p, "M", 0.6f); PlayerStepProbe.set(p, "N", 1.8f); PlayerStepProbe.set(p, "L", 0f);
    PlayerStepProbe.set(p, "bE", new yw()); PlayerStepProbe.set(p, "Z", new Random(1));
    { java.lang.reflect.Field f = sv.class.getDeclaredField("f"); f.setAccessible(true); f.set(p, new HashMap<>()); }
    te watcher = new te(p); PlayerStepProbe.set(p, "af", watcher); watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    p.b(0.5, 0.2, 0.5);
    return p;
  }
  static int[][] floor(int id) { List<int[]> c = new ArrayList<>(); for (int x = -3; x <= 4; x++) for (int z = -3; z <= 4; z++) c.add(new int[] {x, -1, z, id, 0}); return c.toArray(new int[0][]); }
  static String vec(sa e) { return "[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "]"; }
  // Other entities in the client world's list: {type, x, y, z, vx, vy, vz} with type 0 boat, 1 minecart, 2 a second player stand-in, 3 an item; they move by (vx, vy, vz) per tick (scripted,
  // before the copy's update) and are never updated by themselves. The client player is in the list too (World.loadedEntityList), like natively. `fall` seats a real-fall rider.
  static void ride2(String name, String world, int[][] cells, double[] spawn, float boatYaw, double[][] inputs, double[][] others, int count, boolean fall) throws Exception {
    CW w = cw(cells);
    xi c = boat(w, spawn[0], spawn[1], spawn[2], boatYaw, spawn[3], spawn[4], spawn[5]);
    FRider p = frider(w);
    p.y = 0; w.entities.add(p);
    p.a((sa) c); c.a(false); c.ac();
    List<sa> os = new ArrayList<>();
    for (double[] o : others) {
      sa e;
      int t = (int) o[0];
      if (t == 0) e = boat(w, o[1], o[2], o[3], 0, 0, 0, 0);
      else if (t == 1) { e = new xm(w, o[1], o[2], o[3]); w.entities.add(e); }
      else if (t == 2) { e = rider(w, 0, 0); e.b(o[1], o[2], o[3]); w.entities.add(e); }
      else { e = new xk(w, o[1], o[2], o[3], new add(adb.d(1), 1, 0)); e.v = 0; e.w = 0; e.x = 0; w.entities.add(e); }
      os.add(e);
    }
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      for (double[] in : inputs) if ((int) in[0] <= t) { p.be = (float) in[1]; p.bd = (float) in[2]; p.y = (float) in[3]; }
      for (int i = 0; i < os.size(); i++) { double[] o = others[i]; sa e = os.get(i); if (o[4] != 0 || o[5] != 0 || o[6] != 0) e.b(e.s + o[4], e.t + o[5], e.u + o[6]); }
      w.particles.clear(); w.sounds.clear(); w.cleared.clear(); w.played.clear(); p.attacks = 0;
      if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); }
      if (p.m != null && !p.m.K) { c.ac(); }
      if (t > 0) ticks.append(',');
      StringBuilder ov = new StringBuilder("[");
      for (int i = 0; i < os.size(); i++) { if (i > 0) ov.append(','); ov.append(vec(os.get(i))); }
      ticks.append("[").append(bstate(c)).append(',').append("[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + p.y + "," + (p.m != null) + "," + num(p.R) + "]").append(",[").append(String.join(",", w.sounds)).append("],[").append(String.join(",", w.particles)).append("],[").append(String.join(",", w.cleared)).append("],")
        .append("[").append(String.join(",", w.played)).append("],").append(p.attacks).append(',').append(ov).append("]]");
    }
    ticks.append(']');
    StringBuilder in = new StringBuilder("[");
    for (double[] k : inputs) { if (in.length() > 1) in.append(','); in.append(Arrays.toString(k)); }
    StringBuilder ot = new StringBuilder("[");
    for (double[] k : others) { if (ot.length() > 1) ot.append(','); ot.append(Arrays.toString(k)); }
    System.out.println("{\"kind\":\"ride2\",\"name\":\"" + name + "\",\"world\":\"" + world + "\",\"spawn\":" + Arrays.toString(spawn) + ",\"boatYaw\":" + boatYaw + ",\"inputs\":" + in + "],\"others\":" + ot + "],\"ticks\":" + ticks + "}");
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
    // Batch 57 (b57bx): other entities as obstacles for the ridden copy, and the rider's real fall.
    int[][] open = join(water(-4, 24, -8, 8));
    double[][] east = {{0, 1, 0, -90}};
    ride2("bx-solo", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {}, 100, false);
    ride2("bx-boat-ahead", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 6.5, 1.0, 0.5, 0, 0, 0}}, 110, false);
    ride2("bx-boat-ahead-offset", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 6.5, 1.0, 1.7, 0, 0, 0}}, 110, false);
    ride2("bx-boat-ahead-edge", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 6.5, 1.0, 1.99, 0, 0, 0}}, 110, false);
    ride2("bx-boat-ahead-touch", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 6.5, 1.0, 2.0, 0, 0, 0}}, 110, false);
    ride2("bx-boat-ahead-miss", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 6.5, 1.0, 2.01, 0, 0, 0}}, 110, false);
    ride2("bx-cart-ahead", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{1, 6.5, 1.35, 0.5, 0, 0, 0}}, 110, false);
    ride2("bx-player-ahead", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{2, 6.5, 0.9, 0.5, 0, 0, 0}}, 110, false);
    ride2("bx-item-ahead", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{3, 6.5, 1.1, 0.5, 0, 0, 0}}, 110, false);
    ride2("bx-boat-behind", "open", open, new double[] {6.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 3.0, 1.0, 0.5, 0, 0, 0}}, 80, false);
    ride2("bx-boat-crossing", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 9.5, 1.0, -4.2, 0, 0, 0.12}}, 120, false);
    ride2("bx-cart-crossing", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{1, 9.5, 1.35, -4.2, 0, 0, 0.12}}, 120, false);
    ride2("bx-beside-moving-boat", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, -1.0, 1.0, 2.1, 0.2, 0, 0}}, 100, false);
    ride2("bx-beside-moving-boat-near", "open", open, new double[] {0.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, -1.0, 1.0, 2.05, 0.2, 0, 0}}, 100, false);
    ride2("bx-boat-ramming-copy", "open", open, new double[] {6.5, 1.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {{0, 0.5, 1.0, 0.5, 0.08, 0, 0}}, 100, false);
    ride2("bx-boat-from-above", "open", open, new double[] {0.5, 3.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {{0, 0.5, 1.0, 0.5, 0, 0, 0}}, 40, false);
    ride2("bx-two-boats-pinch", "open", open, new double[] {6.5, 1.0, 0.5, 0, 0, 0}, -90, east, new double[][] {{0, 9.0, 1.0, 0.5, 0, 0, 0}, {0, 4.0, 1.0, 0.5, 0, 0, 0}}, 80, false);
    // the rider's real fall: from 4, 5 and 9 blocks onto stone, sand, glass and into a pool, and a drop under 3
    ride2("bx-fall-stone-9", "empty", new int[][] {}, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-stone-5", "empty", new int[][] {}, new double[] {0.5, 5.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-stone-4", "empty", new int[][] {}, new double[] {0.5, 4.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-stone-3", "empty", new int[][] {}, new double[] {0.5, 3.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-sand-6", "floor12", floor(12), new double[] {0.5, 6.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-glass-6", "floor20", floor(20), new double[] {0.5, 6.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 40, true);
    ride2("bx-fall-water-9", "pool", join(water(-4, 4, -4, 4)), new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {}, 60, true);
    ride2("bx-fall-onto-boat-below", "empty", new int[][] {}, new double[] {0.5, 9.0, 0.5, 0, 0, 0}, 0, new double[][] {{0, 0, 0, 0}}, new double[][] {{0, 0.5, 0.0, 0.5, 0, 0, 0}}, 40, true);
    copy("dry-fall", new int[][] {}, new double[] {0.5, 6.0, 0.5}, new double[][] {{0, 0, 0.1, 0, 0}}, 20);
  }
}
