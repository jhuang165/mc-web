import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 88 (horse88): the unchanged EntityHorse (wi) ticked through its whole server-side onUpdate (wi.h(): sv.h -> sv.e -> wi.e(FF), then the rear counter and bI)
// on HorseRearProbe's server world double (ahb.E false, stone below y 0), with HorseProbe's FakePlayer as the saddled rider (its moveForward / moveStrafing fixed per scenario,
// as the C0C leaves them). Between ticks the script calls wi.w(int) (what NetHandlerPlayServer does for C0B action 6), wi.cU() (makeHorseRear), or mounts / dismounts the
// rider (mountEntity). Per tick: position, motion, onGround, bt (jumpPower), bI (the held-rear flag), br (horseJumping), cn() (rearing), bF (rear counter), W (stepHeight),
// aQ (jumpMovementFactor), bP (gallop counter) and the sounds. src/horse88-b88.test.js replays it on the port's EntityWorld.
public class Horse88Probe {
  // HorseRearProbe.RW with a fixed light level: the unridden (or unsaddled) horse's wander task reads World.getLightBrightness through EntityAnimal.getBlockPathWeight.
  public static class W88 extends HorseRearProbe.RW { public float n(int x, int y, int z) { return 0.5f; } }
  static W88 world() throws Exception {
    W88 world = (W88) HorseProbe.u.allocateInstance(W88.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, false);
    HorseProbe.W = world;
    return world;
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  // name, saddled, forward, strafe, yaw, ticks, script rows { tick, action, arg } (action 0 = w(arg) before the tick, 1 = cU() before the tick, 2 = dismount, 3 = mount)
  static Object[][] scenarios = {
    { "tap", true, 0f, 0f, 0f, 40, new int[][] { { 4, 0, 0 } } },
    { "full", true, 0.98f, 0f, 0f, 50, new int[][] { { 4, 0, 100 } } },
    { "half", true, 0.98f, 0f, 30f, 50, new int[][] { { 4, 0, 45 } } },
    { "airRelease", true, 0.98f, 0f, 0f, 50, new int[][] { { 4, 0, 100 }, { 10, 0, 100 } } },
    { "rearAfter", true, 0.98f, 0f, 0f, 60, new int[][] { { 2, 0, 30 }, { 40, 1, 0 } } },
    { "backwardGallop", true, -0.98f, 0f, 0f, 20, new int[][] {} },
    { "dismountAir", true, 0.98f, 0f, 0f, 40, new int[][] { { 4, 0, 100 }, { 8, 0, 100 }, { 9, 2, 0 }, { 30, 3, 0 } } },
    { "unsaddled", false, 0.98f, 0f, 0f, 20, new int[][] { { 4, 0, 100 } } },
    { "bigYaw", true, 0.98f, 0.98f, 1000f, 30, new int[][] { { 4, 0, 100 } } },
  };

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    Method h = MobMoveProbe.method(wi.class, "h");
    Method rear = MobMoveProbe.method(wi.class, "cU");
    for (long seed : new long[] { 1, 6 }) for (Object[] s : scenarios) {
      HorseRearProbe.RW.cells.clear();
      world();
      HorseProbe.player = HorseProbe.makePlayer(false);
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(seed, (Boolean) s[1], (Float) s[4], 0f, (Float) s[2], (Float) s[3]);
      yz player = HorseProbe.player;
      // No AI tasks: they only run on the unridden or unsaddled ticks (sv.e skips updateAITasks while bh() holds) and need pathfinding over a chunk provider; the test
      // compares only the jump state on those ticks.
      for (Field f : sw.class.getDeclaredFields()) if (f.getType() == uj.class) { f.setAccessible(true); f.set(e, new uj(new qi())); }
      String speed = num(e.a(yj.d).e()), jump = num(e.ct());
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < (Integer) s[5]; i++) {
        for (int[] r : (int[][]) s[6]) if (r[0] == i) {
          if (r[1] == 0) e.w(r[2]);
          else if (r[1] == 1) rear.invoke(e);
          else if (r[1] == 2) player.a((sa) null);
          else player.a((sa) e);
        }
        HorseProbe.World.sounds.clear();
        h.invoke(e);
        rows.append(i > 0 ? "," : "").append("{\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
          + ",\"vx\":" + num(MobMoveProbe.d(e, "v")) + ",\"vy\":" + num(MobMoveProbe.d(e, "w")) + ",\"vz\":" + num(MobMoveProbe.d(e, "x")) + ",\"onGround\":" + MobMoveProbe.b(e, "D")
          + ",\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + ",\"held\":" + MobMoveProbe.b(e, "bI") + ",\"jumping\":" + e.cj() + ",\"rearing\":" + e.cn()
          + ",\"rearCounter\":" + MobMoveProbe.field(wi.class, "bF").getInt(e) + ",\"stepHeight\":" + num(MobMoveProbe.fl(e, "W")) + ",\"jumpFactor\":" + num(MobMoveProbe.fl(e, "aQ"))
          + ",\"gallop\":" + MobMoveProbe.field(wi.class, "bP").getInt(e) + ",\"yaw\":" + num(MobMoveProbe.fl(e, "y")) + ",\"rider\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null)
          + ",\"sounds\":" + soundList() + "}");
      }
      player.a((sa) null);
      HorseProbe.out("{\"case\":\"tick\",\"seed\":" + seed + ",\"name\":\"" + s[0] + "\",\"saddled\":" + s[1] + ",\"forward\":" + num((Float) s[2]) + ",\"strafe\":" + num((Float) s[3])
        + ",\"riderYaw\":" + num((Float) s[4]) + ",\"speed\":" + speed + ",\"jumpAttr\":" + jump + ",\"script\":" + java.util.Arrays.deepToString((int[][]) s[6]) + ",\"ticks\":[" + rows + "]}");
    }
  }

  static String soundList() {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < HorseProbe.World.sounds.size(); i++) b.append(i > 0 ? "," : "").append("\"" + HorseProbe.World.sounds.get(i) + "\"");
    return b.append("]").toString();
  }
}
