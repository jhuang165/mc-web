import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Random;

// Batch 54: the unchanged EntityHorse (wi) moveEntityWithHeading e(F,F) and updateRiderPosition ac() on a CLIENT world double (ahb.E true), the copy of a horse the local
// player rides. Reuses HorseProbe's world, horse and rider doubles. One JSON object per line:
//   steer   a saddled client horse with a rider of the given look and movement input (and a jump power set directly): per tick the position, motion, yaw, previous yaw,
//           pitch, body yaw, head yaw, jump power, and the rider's position after ac()
//   rear    ac() with a rearing amount: the rider's offset from the horse
public class HorseCopyProbe {
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) HorseProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    HorseProbe.W = world;
    HorseProbe.player = HorseProbe.makePlayer(false);
    MobMoveProbe.field(ahb.class, "E").setBoolean(world, true);
    // name, saddled, yaw start, yaw step per tick, pitch, forward, strafe, jumpPower (int, -9 none), ticks
    Object[][] sc = {
      { "forward", true, 0f, 0f, 0f, 0.98f, 0f, -9, 6 },
      { "turning", true, 350f, 25f, 40f, 0.98f, 0.98f, -9, 8 },
      { "lookUp", true, -170f, -45f, -80f, 0f, 0f, -9, 6 },
      { "jumpPowerSet", true, 90f, 0f, 10f, 0.98f, 0f, 100, 6 },
    };
    for (long seed : new long[] { 1, 6 }) for (Object[] s : sc) {
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(seed, (Boolean) s[1], (Float) s[2], (Float) s[4], (Float) s[5], (Float) s[6]);
      MobMoveProbe.set(e, "v", 0.0); MobMoveProbe.set(e, "w", 0.0); MobMoveProbe.set(e, "x", 0.0); // motion
      StringBuilder rows = new StringBuilder();
      float yaw = (Float) s[2];
      for (int i = 0; i < (Integer) s[8]; i++) {
        MobMoveProbe.set(e, "p", MobMoveProbe.d(e, "s"));
        MobMoveProbe.set(e, "q", MobMoveProbe.d(e, "t"));
        MobMoveProbe.set(e, "r", MobMoveProbe.d(e, "u"));
        MobMoveProbe.set(HorseProbe.player, "y", yaw);
        if (i == 0 && (Integer) s[7] != -9) e.w((Integer) s[7]);
        e.e((Float) s[6] * 0.98f, (Float) s[5]);
        e.ac();
        rows.append(i > 0 ? "," : "").append("{\"riderYaw\":" + num(yaw) + ",\"x\":" + num(MobMoveProbe.d(e, "s")) + ",\"y\":" + num(MobMoveProbe.d(e, "t")) + ",\"z\":" + num(MobMoveProbe.d(e, "u"))
          + ",\"mx\":" + num(MobMoveProbe.d(e, "v")) + ",\"my\":" + num(MobMoveProbe.d(e, "w")) + ",\"mz\":" + num(MobMoveProbe.d(e, "x"))
          + ",\"yaw\":" + num(MobMoveProbe.fl(e, "y")) + ",\"prevYaw\":" + num(MobMoveProbe.fl(e, "A")) + ",\"pitch\":" + num(MobMoveProbe.fl(e, "z"))
          + ",\"body\":" + num(MobMoveProbe.fl(e, "aM")) + ",\"head\":" + num(MobMoveProbe.fl(e, "aO")) + ",\"jumpPower\":" + num(MobMoveProbe.fl(e, "bt")) + "}");
        yaw += (Float) s[3];
      }
      HorseProbe.player.a((sa) null);
      HorseProbe.out("{\"case\":\"steer\",\"seed\":" + seed + ",\"name\":\"" + s[0] + "\",\"saddled\":" + s[1] + ",\"pitch\":" + num((Float) s[4]) + ",\"ticks\":[" + rows + "]}");
    }
    // ac(): rider position with a rearing amount (bM) and body yaw (aM)
    for (float bm : new float[] { 0f, 0.3f, 0.7f, 1f }) for (float body : new float[] { 0f, 45f, 90f, 200f, -135f }) {
      HorseProbe.clear();
      wi e = HorseProbe.mountedHorse(1, true, 0f, 0f, 0f, 0f);
      MobMoveProbe.set(e, "bM", bm);
      MobMoveProbe.set(e, "aM", body);
      e.ac();
      HorseProbe.out("{\"case\":\"rear\",\"rearAmount\":" + num(bm) + ",\"body\":" + num(body) + ",\"horse\":[" + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u"))
        + "],\"rider\":[" + num(MobMoveProbe.d(HorseProbe.player, "s")) + "," + num(MobMoveProbe.d(HorseProbe.player, "t")) + "," + num(MobMoveProbe.d(HorseProbe.player, "u")) + "]}");
      HorseProbe.player.a((sa) null);
    }
  }
}
