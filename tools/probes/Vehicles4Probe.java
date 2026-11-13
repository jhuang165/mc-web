import java.util.*;
// Batch 58 (tag b58v4): three more records around the ridden client copy, all on the unchanged 1.7.10 classes (EntityBoat xi, EntityMinecart xm, the real EntityLivingBase.fall [sv.b] and
// updateFallState [sv.a(DZ)] through the BoatCopyProbe stand-in rider), on the remote world stand-in of BoatCopyProbe.
//  walk   The client world's entity walk order (World.updateEntities walks loadedEntityList front to back; a rider is updated right after its mount). Other entities are REAL xi / xm copies
//         that interpolate toward a position packet applied every tick (setPositionAndRotation2, 3 increments) in their own h(); `order` 0 lists them before the ridden boat (they move first),
//         1 after it (the boat sees their previous position).
//  cart   A rider on a minecart copy that falls: the copy (remote world, S18 packets) only interpolates, so no updateFallState runs; a server-side cart (control) does call the rider's fall.
//  dismount  The client player leaves a falling boat copy (sa.a(null): EntityPlayer.mountEntity, no dismountEntity on a client world) and falls on foot: stand-in motion (gravity 0.08, drag 0.98,
//         the player's move-then-gravity order), the REAL sv.a(double, boolean) updateFallState and the real fall (sv.b) with EntityPlayerSP.playSound.
// tools/verify-vehicles4.mjs writes public/research/vehicles4-reference.json; src/vehicles4-b58.test.js replays it.
public class Vehicles4Probe extends BoatCopyProbe {
  static void settle(sa e) { e.S = e.s; e.T = e.t; e.U = e.u; }
  // others: {type (0 boat copy, 1 cart copy), x, y, z, dx, dy, dz per tick, order}. The target of tick t is start + d * (t + 1).
  static void walk(String name, int[][] cells, double[] spawn, float boatYaw, double[][] inputs, double[][] others, int count) throws Exception {
    CW w = cw(cells);
    xi c = boat(w, spawn[0], spawn[1], spawn[2], boatYaw, spawn[3], spawn[4], spawn[5]);
    FRider p = frider(w);
    p.y = 0; w.entities.add(p);
    p.a((sa) c); c.a(false); c.ac();
    List<sa> os = new ArrayList<>();
    for (double[] o : others) {
      sa e;
      if ((int) o[0] == 0) e = boat(w, o[1], o[2], o[3], 0, 0, 0, 0); else { e = new xm(w, o[1], o[2], o[3]); w.entities.add(e); }
      os.add(e);
    }
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      for (double[] in : inputs) if ((int) in[0] <= t) { p.be = (float) in[1]; p.bd = (float) in[2]; p.y = (float) in[3]; }
      // the packets of the tick are handled before the entity walk
      for (int i = 0; i < os.size(); i++) {
        double[] o = others[i]; sa e = os.get(i);
        double tx = o[1] + o[4] * (t + 1), ty = o[2] + o[5] * (t + 1), tz = o[3] + o[6] * (t + 1);
        if (e instanceof xi) ((xi) e).a(tx, ty, tz, 0f, 0f, 3); else ((xm) e).a(tx, ty, tz, 0f, 0f, 3);
      }
      w.particles.clear(); w.sounds.clear(); w.cleared.clear(); w.played.clear(); p.attacks = 0;
      for (int pass = 0; pass < 3; pass++) {
        if (pass == 1) { if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); } if (p.m != null && !p.m.K) c.ac(); continue; }
        for (int i = 0; i < os.size(); i++) if ((int) others[i][7] == (pass == 0 ? 0 : 1)) { sa e = os.get(i); if (!e.K) { settle(e); e.h(); } }
      }
      if (t > 0) ticks.append(',');
      StringBuilder ov = new StringBuilder("[");
      for (int i = 0; i < os.size(); i++) { if (i > 0) ov.append(','); ov.append(vec(os.get(i))); }
      ticks.append("[").append(bstate(c)).append(',').append("[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "]").append(",").append(ov).append("]]");
    }
    ticks.append(']');
    StringBuilder in = new StringBuilder("[");
    for (double[] k : inputs) { if (in.length() > 1) in.append(','); in.append(Arrays.toString(k)); }
    StringBuilder ot = new StringBuilder("[");
    for (double[] k : others) { if (ot.length() > 1) ot.append(','); ot.append(Arrays.toString(k)); }
    System.out.println("{\"kind\":\"walk\",\"name\":\"" + name + "\",\"spawn\":" + Arrays.toString(spawn) + ",\"boatYaw\":" + boatYaw + ",\"inputs\":" + in + "],\"others\":" + ot + "],\"ticks\":" + ticks + "}");
  }
  // A rider on a minecart. server = false: the copy on the remote world stand-in, fed S18-style packets {tick, x, y, z} (3 increments); server = true: control, the same cart on a server world
  // (gravity moves it, Entity.moveEntity -> updateFallState -> the rider's fall).
  static void cart(String name, boolean server, double[] spawn, double[][] packets, int count) throws Exception {
    CW w = cw(new int[][] {});
    if (server) MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    xm c = new xm(w, spawn[0], spawn[1], spawn[2]); w.entities.add(c);
    FRider p = frider(w);
    p.y = 0; w.entities.add(p);
    p.a((sa) c); c.ac();
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      for (double[] k : packets) if ((int) k[0] == t) c.a(k[1], k[2], k[3], 0f, 0f, 3);
      w.played.clear(); p.attacks = 0;
      if (!c.K) { settle(c); c.h(); }
      if (p.m != null && !p.m.K) { c.ac(); }
      if (t > 0) ticks.append(',');
      ticks.append("[[" + num(c.s) + "," + num(c.t) + "," + num(c.u) + "," + num(c.w) + "," + c.D + "],[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + num(p.R) + "],[" + String.join(",", w.played) + "]," + p.attacks + "]");
    }
    ticks.append(']');
    StringBuilder pk = new StringBuilder("[");
    for (double[] k : packets) { if (pk.length() > 1) pk.append(','); pk.append(Arrays.toString(k)); }
    System.out.println("{\"kind\":\"cart\",\"name\":\"" + name + "\",\"server\":" + server + ",\"spawn\":" + Arrays.toString(spawn) + ",\"packets\":" + pk + "],\"ticks\":" + ticks + "}");
  }
  // dismountTick: the tick (before that tick's updates) the player leaves. After it the player falls on foot from the seat. `boatGround`: floor at y = 0 either way (the default world).
  static void dismount(String name, double y, int dismountTick, int count) throws Exception {
    CW w = cw(new int[][] {});
    xi c = boat(w, 0.5, y, 0.5, 0, 0, 0, 0);
    FRider p = frider(w);
    p.y = 0; w.entities.add(p);
    p.a((sa) c); c.a(false); c.ac();
    java.lang.reflect.Method fall = sv.class.getDeclaredMethod("a", double.class, boolean.class); fall.setAccessible(true);
    double vy = 0;
    boolean riding = true;
    StringBuilder ticks = new StringBuilder("[");
    for (int t = 0; t < count; t++) {
      w.played.clear(); p.attacks = 0;
      if (t == dismountTick) { p.a((sa) null); riding = false; }
      if (riding) {
        if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; c.h(); }
        if (p.m != null && !p.m.K) { c.ac(); p.R = 0; } // EntityLivingBase.updateRidden (sv.ab): fallDistance = 0 (bytecode-read)
      } else {
        // the player on foot: moveEntity (move by the motion, clipped to the floor at 0), updateFallState, then gravity and drag
        double dy = vy, ny = p.t + dy; boolean ground = false;
        if (ny <= 0) { dy = -p.t; ny = 0; ground = true; vy = 0; }
        p.b(p.s, ny, p.u);
        fall.invoke(p, dy, ground);
        if (!ground) vy = (vy - 0.08) * (double) 0.98f; // motionY *= 0.98F else vy = 0;
      }
      if (t > 0) ticks.append(',');
      ticks.append("[[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + num(p.R) + "]," + riding + ",[" + String.join(",", w.played) + "]," + num(c.t) + "]");
    }
    ticks.append(']');
    System.out.println("{\"kind\":\"dismount\",\"name\":\"" + name + "\",\"y\":" + y + ",\"dismountTick\":" + dismountTick + ",\"ticks\":" + ticks + "}");
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] open = join(water(-4, 24, -8, 8));
    double[][] east = {{0, 1, 0, -90}};
    double[] start = {0.5, 1.0, 0.5, 0, 0, 0};
    // the copy sails east along z 0.5; others cross its path (+z) or come at it (-x). order 0: moves before the boat in the list, 1: after.
    walk("wk-solo", open, start, -90, east, new double[][] {}, 100);
    walk("wk-boat-cross-first", open, start, -90, east, new double[][] {{0, 9.5, 1.0, -4.2, 0, 0, 0.12, 0}}, 120);
    walk("wk-boat-cross-last", open, start, -90, east, new double[][] {{0, 9.5, 1.0, -4.2, 0, 0, 0.12, 1}}, 120);
    walk("wk-cart-cross-first", open, start, -90, east, new double[][] {{1, 9.5, 1.35, -4.2, 0, 0, 0.12, 0}}, 120);
    walk("wk-cart-cross-last", open, start, -90, east, new double[][] {{1, 9.5, 1.35, -4.2, 0, 0, 0.12, 1}}, 120);
    walk("wk-boat-head-on-first", open, start, -90, east, new double[][] {{0, 14.5, 1.0, 0.5, -0.1, 0, 0, 0}}, 120);
    walk("wk-boat-head-on-last", open, start, -90, east, new double[][] {{0, 14.5, 1.0, 0.5, -0.1, 0, 0, 1}}, 120);
    walk("wk-boat-ahead-slow-first", open, start, -90, east, new double[][] {{0, 8.5, 1.0, 0.5, 0.02, 0, 0, 0}}, 120);
    walk("wk-boat-ahead-slow-last", open, start, -90, east, new double[][] {{0, 8.5, 1.0, 0.5, 0.02, 0, 0, 1}}, 120);
    walk("wk-two-crossers", open, start, -90, east, new double[][] {{0, 9.5, 1.0, -4.2, 0, 0, 0.12, 1}, {1, 7.5, 1.35, 4.2, 0, 0, -0.1, 0}}, 120);
    cart("cart-copy-fall-9", false, new double[] {0.5, 9.0, 0.5}, new double[][] {{0, 0.5, 9.0, 0.5}, {2, 0.5, 6.0, 0.5}, {4, 0.5, 3.0, 0.5}, {6, 0.5, 0.0, 0.5}}, 24);
    cart("cart-copy-fall-12-steady", false, new double[] {0.5, 12.0, 0.5}, new double[][] {{0, 0.5, 10.0, 0.5}, {2, 0.5, 7.0, 0.5}, {4, 0.5, 4.0, 0.5}, {6, 0.5, 1.0, 0.5}, {8, 0.5, 0.0, 0.5}}, 24);
    cart("cart-copy-still", false, new double[] {0.5, 9.0, 0.5}, new double[][] {}, 12);
    cart("cart-server-fall-9", true, new double[] {0.5, 9.0, 0.5}, new double[][] {}, 40);
    dismount("dm-from-9-at-0", 9.0, 0, 40);
    dismount("dm-from-9-at-3", 9.0, 3, 40);
    dismount("dm-from-12-at-4", 12.0, 4, 50);
    dismount("dm-from-2-at-0", 2.0, 0, 20);
    dismount("dm-never", 9.0, 100, 20);
  }
}
