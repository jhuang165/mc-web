import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 91 (horse91): the sneak (dismount) tick of a real EntityPlayerMP riding the unchanged EntityBoat (xi) and EntityMinecartEmpty (xs), in the native order that
// Horse89Probe recorded for the horse. The world is BoatProbe's map-backed BW. Per tick, as the integrated server and the dedicated server do it:
//   the network tick's C0C: the real mw.a(FFZZ) (strafe, forward, jump, sneak; the 0.3 sneak slowdown included);
//   then the world tick: lastTickPos / prevRotation, the mount's onUpdate (xi.h / xl.h), and, while the rider is still linked and isSneaking, the real yz.ab()
//   (EntityPlayer.updateRidden: mountEntity(null) -> dismountEntity -> setPlayerLocation) which World.updateEntityWithOptionalForce (ahb.a(sa, Z), bytecode-read in b89)
//   calls right after the mount's onUpdate;
//   then, while still riding, the mount's updateRiderPosition (xi.ac / xl.ac: the network tick's riding branch seats the player).
// Per tick: the mount's position, motion, onGround, yaw, dead, the rider flag, whether updateRidden ran, the seat before the tick, the player's position after, isSneaking and
// the setPlayerLocation spots. The boat reads moveForward / yaw of its rider, a cart reads the rider's motion only.
public class Vehicle91Probe extends BoatProbe {
  static final float SNEAK = (float) (1.0F * 0.3D) * 0.98F; // MovementInputFromOptions (forward 1, sneak * 0.3), then EntityLivingBase.onLivingUpdate's * 0.98F

  public static class RecNet extends ServerPlayerProbe.Net {
    static List<String> spots = new ArrayList<>();
    static sa who;
    public void a(double x, double y, double z, float yaw, float pitch) {
      spots.add("[" + num(x) + "," + num(y) + "," + num(z) + "]");
      try { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(who, x, y, z); } catch (Exception ex) { throw new RuntimeException(ex); }
    }
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

  // kind, name, cells, spawn { x, y, z, vx, vy, vz }, mount yaw, rider yaw, forward, ticks, sneak tick (-1 none)
  static void run(boolean boat, String name, int[][] cells, double[] spawn, float mountYaw, float riderYaw, float forward, int ticks, int sneakTick) throws Exception {
    BW w = bw(cells);
    sa c;
    if (boat) c = boat(w, spawn[0], spawn[1], spawn[2], mountYaw, spawn[3], spawn[4], spawn[5]);
    else { xs k = new xs(w, spawn[0], spawn[1], spawn[2]); k.y = mountYaw; k.v = spawn[3]; k.w = spawn[4]; k.x = spawn[5]; PlayerStepProbe.field(sa.class, "c").setInt(k, 1); w.entities.add(k); c = k; }
    mw pl = ServerPlayerProbe.make(w, "probe");
    pl.a = (nh) MobMoveProbe.unsafe().allocateInstance(RecNet.class);
    RecNet.who = pl;
    pl.b(spawn[0], spawn[1], spawn[2]);
    MobMoveProbe.set(pl, "y", riderYaw);
    pl.a(c); // mw.a(sa): yz.a(sa) -> mount, S1B, setPlayerLocation at the seat
    c.ac();
    RecNet.spots.clear();
    Method h = MobMoveProbe.method(sa.class, "h");
    Method ride = MobMoveProbe.method(yz.class, "ab");
    Method sneaking = MobMoveProbe.method(sa.class, "an");
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < ticks; i++) {
      boolean riding = MobMoveProbe.field(sa.class, "m").get(pl) == c;
      String seat = triple(pl);
      boolean sneak = riding && i == sneakTick;
      if (riding) pl.a(0f, sneak ? SNEAK * forward : 0.98F * forward, false, sneak);
      RecNet.spots.clear();
      if (!c.K) { c.S = c.s; c.T = c.t; c.U = c.u; c.A = c.y; c.B = c.z; h.invoke(c); }
      boolean updated = false;
      if (riding && MobMoveProbe.field(sa.class, "m").get(pl) == c && (Boolean) sneaking.invoke(pl)) { ride.invoke(pl); updated = true; }
      if (MobMoveProbe.field(sa.class, "m").get(pl) == c && !c.K) c.ac();
      rows.append(i > 0 ? "," : "").append("{\"x\":" + num(c.s) + ",\"y\":" + num(c.t) + ",\"z\":" + num(c.u) + ",\"vx\":" + num(c.v) + ",\"vy\":" + num(c.w) + ",\"vz\":" + num(c.x)
        + ",\"onGround\":" + c.D + ",\"yaw\":" + c.y + ",\"dead\":" + c.K + ",\"riding\":" + riding + ",\"rider\":" + (MobMoveProbe.field(sa.class, "l").get(c) != null)
        + ",\"updateRidden\":" + updated + ",\"seatBefore\":" + seat + ",\"player\":" + triple(pl) + ",\"playerSneaking\":" + sneaking.invoke(pl) + ",\"spots\":" + RecNet.spots + "}");
    }
    System.out.println("{\"kind\":\"" + (boat ? "boat" : "cart") + "\",\"name\":\"" + name + "\",\"cells\":" + cells(cells) + ",\"spawn\":" + Arrays.toString(spawn) + ",\"mountYaw\":" + mountYaw
      + ",\"riderYaw\":" + riderYaw + ",\"forward\":" + num(forward) + ",\"sneakTick\":" + sneakTick + ",\"sneakForward\":" + num(SNEAK) + ",\"playerHeight\":" + num(MobMoveProbe.fl(pl, "N"))
      + ",\"yOffset\":" + num(MobMoveProbe.fl(pl, "L")) + ",\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] pool = water(-4, 44, -4, 4, 0);
    double[] rest = { 0.5, 1.0, 0.5, 0, 0, 0 };
    // boat: full forward, idle with coast, beside a bank, only water around, dismount spot blocked, never sneaking
    run(true, "forward", pool, rest, -90, -90, 1f, 24, 10);
    run(true, "coast", pool, new double[] { 0.5, 1.0, 0.5, 0.2, 0, 0 }, -90, -90, 0f, 16, 6);
    run(true, "bank", join(water(-4, 2, -4, 4, 0), stone(3, 12, 0, -4, 4), stone(3, 12, -1, -4, 4)), new double[] { 0.5, 1.0, 0.5, 0.15, 0, 0 }, -90, -90, 1f, 60, 40);
    run(true, "beached", join(water(-4, 2, -4, 4, 0), stone(3, 12, 0, -4, 4)), new double[] { 2.5, 1.0, 0.5, 0, 0, 0 }, -90, -90, 1f, 40, 25);
    run(true, "turn", pool, rest, 0, 45, 1f, 24, 10);
    run(true, "enclosed", join(pool, stone(-1, 2, 1, -1, 2), stone(-1, 2, 2, -1, 2)), rest, -90, -90, 0f, 12, 5);
    run(true, "never", pool, rest, -90, -90, 1f, 14, -1);
    // cart: on a straight rail, standing still, off the rails and falling, on a slope, in a pit, never sneaking
    int[][] rail = row(66, 1, -1, 30, 0, 0);
    run(false, "rail", rail, new double[] { 0.5, 0.5, 0.5, 0.25, 0, 0.05 }, 0, 0, 0f, 24, 10);
    run(false, "railStill", rail, new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, 0, 0, 0f, 12, 5);
    run(false, "fall", new int[][] {}, new double[] { 0.5, 8.5, 0.5, 0, 0, 0 }, 0, 0, 0f, 24, 4);
    run(false, "slope", join(row(66, 1, -4, -1, 0, 0), new int[][] { { 0, 0, 0, 66, 2 } }, row(66, 1, 1, 10, 1, 0), row(1, 0, 1, 10, 0, 0)), new double[] { -3.5, 0.5, 0.5, 0.3, 0, 0 }, 0, 0, 0f, 24, 12);
    run(false, "forwardKeys", rail, new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, -90, -90, 1f, 20, 8);
    run(false, "pit", join(rail, stone(-3, 3, 1, -3, 3)), new double[] { 0.5, 0.5, 0.5, 0, 0, 0 }, 0, 0, 0f, 12, 5);
    run(false, "never", rail, new double[] { 0.5, 0.5, 0.5, 0.25, 0, 0.05 }, 0, 0, 1f, 14, -1);
  }
}
