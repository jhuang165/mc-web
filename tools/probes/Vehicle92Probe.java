import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 92 (horse92): Vehicle91Probe plus the two things its harness lacked. (1) The player's own updates after the release, in both entity-list orders: `order` "playerFirst" / "playerLast" runs the world
// loop in that list order (a linked rider is skipped, as World.updateEntities does with `continue`; a released or unmounted player gets the real mw.h(), EntityPlayerMP.onUpdate, which has no
// super call), then the network tick's C03 runs the real mw.i() (onUpdateEntity: yz.h -> EntityLivingBase.onLivingUpdate -> collideWithNearbyEntities, the push that moves a boat or cart) for a
// player who is not riding. The rows record the vehicle after the world part and after the network part, so the push of a released rider is seen in its own phase. (2) the C0C that arrives in the
// mounting tick: `mountBeforeInput` mounts with the real mw.a(sa) and then sends the C0C (the client's order: C02 first), `inputBeforeMount` sends the C0C first, which mw.a(FFZZ) drops while
// ridingEntity is null (the boat then reads the rider's old moveForward). The released player's moveForward / moveStrafing are cleared before mw.i() (the riding C0C's keys are not a walk).
public class Vehicle92Probe extends BoatProbe {
  static final float SNEAK = (float) (1.0F * 0.3D) * 0.98F; // MovementInputFromOptions (forward 1, sneak * 0.3), then EntityLivingBase.onLivingUpdate's * 0.98F

  public static class RecNet extends ServerPlayerProbe.Net {
    static List<String> spots = new ArrayList<>();
    static sa who;
    public void a(double x, double y, double z, float yaw, float pitch) {
      spots.add("[" + num(x) + "," + num(y) + "," + num(z) + "]");
      try { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(who, x, y, z); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
  }

  public static class BW2 extends BW { // no chunk provider: the biome lookup of mw.j() (the biome achievement) finds none and returns
    public ahu a(int x, int z) { return null; }
  }
  static BW2 bw2(int[][] cells) throws Exception {
    MW base = world(cells);
    BW2 w = (BW2) PlantProbe.unsafe.allocateInstance(BW2.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells = base.cells; w.entities = base.entities; w.spawned = base.spawned; w.particles = new ArrayList<>();
    return w;
  }

  static String triple(sa p) { return "[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "]"; }

  static int[][] water(int x0, int x1, int z0, int z1, int top) {
    List<int[]> c = new ArrayList<>();
    for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) { c.add(new int[] { x, -1, z, 9, 0 }); c.add(new int[] { x, top, z, 9, 0 }); if (top > 0) c.add(new int[] { x, 0, z, 9, 0 }); }
    return c.toArray(new int[0][]);
  }
  static int[][] stone(int x0, int x1, int y, int z0, int z1) {
    List<int[]> c = new ArrayList<>();
    for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) c.add(new int[] { x, y, z, 1, 0 });
    return c.toArray(new int[0][]);
  }

  static String state(sa c) { return "{\"x\":" + num(c.s) + ",\"y\":" + num(c.t) + ",\"z\":" + num(c.u) + ",\"vx\":" + num(c.v) + ",\"vy\":" + num(c.w) + ",\"vz\":" + num(c.x) + ",\"yaw\":" + c.y + "}"; }

  // kind, name, cells, spawn { x, y, z, vx, vy, vz }, mount yaw, rider yaw, forward, ticks, sneak tick (-1 none), list order, input order
  // inputOrder: 0 the player is aboard before tick 0 (Vehicle91Probe); 1 the player mounts at the start of tick 0 and the same tick's C0C follows (the client's order: C02, then C0C);
  // 2 the tick's C0C comes first and the player mounts after it (mw.a(FFZZ) drops it: ridingEntity is null)
  static void run(boolean boat, String name, int[][] cells, double[] spawn, float mountYaw, float riderYaw, float forward, int ticks, int sneakTick, boolean playerFirst, int inputOrder) throws Exception {
    BW w = bw2(cells);
    ays info = (ays) MobMoveProbe.unsafe().allocateInstance(ays.class); // the world info FoodStats.onUpdate reads the game rules from
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList<Object>()); // worldAccesses (nobody listens)
    MobMoveProbe.field(ahb.class, "D").set(w, new bac()); // the scoreboard mw.a(...) reads
    sa c;
    if (boat) c = boat(w, spawn[0], spawn[1], spawn[2], mountYaw, spawn[3], spawn[4], spawn[5]);
    else { xs k = new xs(w, spawn[0], spawn[1], spawn[2]); k.y = mountYaw; k.v = spawn[3]; k.w = spawn[4]; k.x = spawn[5]; PlayerStepProbe.field(sa.class, "c").setInt(k, 1); w.entities.add(k); c = k; }
    mw pl = ServerPlayerProbe.make(w, "probe");
    for (java.lang.reflect.Field sf : mw.class.getDeclaredFields()) if (pq.class.isAssignableFrom(sf.getType())) { sf.setAccessible(true); Object st = sf.get(pl); if (st != null) MobMoveProbe.field(pq.class, "a").set(st, new java.util.HashMap()); } // the Unsafe-built StatisticsFile has no map
    pl.a = (nh) MobMoveProbe.unsafe().allocateInstance(RecNet.class);
    RecNet.who = pl;
    pl.b(spawn[0], spawn[1], spawn[2]);
    MobMoveProbe.set(pl, "y", riderYaw);
    if (playerFirst) w.entities.add(0, pl); else w.entities.add(pl);
    Method mount = MobMoveProbe.method(mw.class, "a", sa.class);
    if (inputOrder == 0) { mount.invoke(pl, c); c.ac(); }
    RecNet.spots.clear();
    Method h = MobMoveProbe.method(sa.class, "h");
    Method ride = MobMoveProbe.method(yz.class, "ab");
    Method sneaking = MobMoveProbe.method(sa.class, "an");
    Method update = MobMoveProbe.method(mw.class, "i");
    Method ownTick = MobMoveProbe.method(mw.class, "h");
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < ticks; i++) {
      if (inputOrder == 1 && i == 0) { mount.invoke(pl, c); c.ac(); }
      boolean riding = MobMoveProbe.field(sa.class, "m").get(pl) == c;
      String seat = triple(pl);
      boolean sneak = riding && i == sneakTick;
      boolean dropped = false;
      if (riding) pl.a(0f, sneak ? SNEAK * forward : 0.98F * forward, false, sneak);
      else if (inputOrder == 2 && i == 0) { pl.a(0f, 0.98F * forward, false, false); dropped = true; } // C0C before the mount: mw.a(FFZZ) does nothing
      if (inputOrder == 2 && i == 0) { mount.invoke(pl, c); c.ac(); riding = true; }
      RecNet.spots.clear();
      boolean updated = false;
      for (sa e : new ArrayList<sa>(w.entities)) {
        if (e == c) {
          if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; h.invoke(c); }
          if (MobMoveProbe.field(sa.class, "l").get(c) == pl && MobMoveProbe.field(sa.class, "m").get(pl) == c && (Boolean) sneaking.invoke(pl)) { ride.invoke(pl); updated = true; }
          if (MobMoveProbe.field(sa.class, "m").get(pl) == c && !c.K) c.ac();
        } else if (e == pl && MobMoveProbe.field(sa.class, "m").get(pl) == null) {
          pl.S = pl.s; pl.T = pl.t; pl.U = pl.u; pl.A = pl.y; pl.B = pl.z; ownTick.invoke(pl);
        }
      }
      String afterWorld = state(c);
      boolean network = MobMoveProbe.field(sa.class, "m").get(pl) == null && (i >= sneakTick) && sneakTick >= 0;
      if (network) { MobMoveProbe.set(pl, "be", 0f); MobMoveProbe.set(pl, "bd", 0f); update.invoke(pl); } // the released client's C03 carries its position; the riding C0C's input (be / bd) is not walked again // the C03 of a player who is no longer riding: mw.i() -> EntityLivingBase.onLivingUpdate -> collideWithNearbyEntities
      rows.append(i > 0 ? "," : "").append("{\"x\":" + num(c.s) + ",\"y\":" + num(c.t) + ",\"z\":" + num(c.u) + ",\"vx\":" + num(c.v) + ",\"vy\":" + num(c.w) + ",\"vz\":" + num(c.x)
        + ",\"onGround\":" + c.D + ",\"yaw\":" + c.y + ",\"dead\":" + c.K + ",\"riding\":" + riding + ",\"rider\":" + (MobMoveProbe.field(sa.class, "l").get(c) != null)
        + ",\"updateRidden\":" + updated + ",\"seatBefore\":" + seat + ",\"player\":" + triple(pl) + ",\"playerSneaking\":" + sneaking.invoke(pl) + ",\"spots\":" + RecNet.spots
        + ",\"afterWorld\":" + afterWorld + ",\"network\":" + network + ",\"c0cDropped\":" + dropped + "}");
    }
    System.out.println("{\"kind\":\"" + (boat ? "boat" : "cart") + "\",\"name\":\"" + name + "\",\"cells\":" + cells(cells) + ",\"spawn\":" + Arrays.toString(spawn) + ",\"mountYaw\":" + mountYaw
      + ",\"riderYaw\":" + riderYaw + ",\"forward\":" + num(forward) + ",\"sneakTick\":" + sneakTick + ",\"playerFirst\":" + playerFirst + ",\"inputOrder\":" + inputOrder + ",\"sneakForward\":" + num(SNEAK)
      + ",\"playerHeight\":" + num(MobMoveProbe.fl(pl, "N")) + ",\"yOffset\":" + num(MobMoveProbe.fl(pl, "L")) + ",\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] pool = water(-4, 44, -4, 4, 0);
    double[] rest = { 0.5, 1.0, 0.5, 0, 0, 0 };
    int[][] rail = row(66, 1, -1, 30, 0, 0);
    for (boolean first : new boolean[] { true, false }) {
      run(true, "forward", pool, rest, -90, -90, 1f, 16, 6, first, 0);
      run(true, "coast", pool, new double[] { 0.5, 1.0, 0.5, 0.2, 0, 0 }, -90, -90, 0f, 12, 5, first, 0);
      run(true, "bank", join(water(-4, 2, -4, 4, 0), stone(3, 12, 0, -4, 4), stone(3, 12, -1, -4, 4)), new double[] { 0.5, 1.0, 0.5, 0.15, 0, 0 }, -90, -90, 1f, 50, 40, first, 0);
      run(false, "rail", rail, new double[] { 0.5, 0.5, 0.5, 0.25, 0, 0.05 }, 0, 0, 0f, 16, 6, first, 0);
      run(false, "railStill", rail, new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, 0, 0, 0f, 12, 5, first, 0);
    }
    // the mounting tick's C0C: key after the mount (the client's order), key before it (dropped), boat and cart
    run(true, "mountKey", pool, rest, -90, -90, 1f, 8, -1, false, 1);
    run(true, "keyBeforeMount", pool, rest, -90, -90, 1f, 8, -1, false, 2);
    run(false, "mountKey", rail, new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, -90, -90, 1f, 8, -1, false, 1);
    run(false, "keyBeforeMount", rail, new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, -90, -90, 1f, 8, -1, false, 2);
  }
}
