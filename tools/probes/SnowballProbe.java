// Prints EntityThrowable.setThrowableHeading (zk.c) results for a seeded
// Entity.rand: the motion (v, w, x) and rotation (y, z) of a snowball (zj)
// built with the (world, x, y, z) constructor and no world. Arguments are
// groups of seven: seed dx dy dz velocity inaccuracy (and a spare slot, 0).
public class SnowballProbe {
  public static void main(String[] args) {
    for (int i = 0; i + 5 < args.length; i += 6) {
      zj ball = new zj(null, 0.0, 0.0, 0.0);
      ball.Z = new java.util.Random(Long.parseLong(args[i]));
      ball.c(Double.parseDouble(args[i + 1]), Double.parseDouble(args[i + 2]), Double.parseDouble(args[i + 3]),
        Float.parseFloat(args[i + 4]), Float.parseFloat(args[i + 5]));
      System.out.println("{\"seed\":" + args[i] + ",\"d\":[" + args[i + 1] + "," + args[i + 2] + "," + args[i + 3] + "],\"mx\":" + ball.v + ",\"my\":" + ball.w + ",\"mz\":" + ball.x
        + ",\"yaw\":" + ball.y + ",\"pitch\":" + ball.z + ",\"prevYaw\":" + ball.A + ",\"prevPitch\":" + ball.B + "}");
    }
  }
}
