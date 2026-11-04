import java.lang.reflect.Field;

// Exercises the pinned native EntityEnderPearl/EntityThrowable constructors,
// heading, dimensions and NBT writer. Impact is class-hash/control-flow
// inspected by the verifier because an actual 1.7.10 WorldServer/player stack
// requires a running server and connection manager.
public class EnderPearlProbe {
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  public static void main(String[] args) throws Exception {
    for (String seedText : args) {
      long seed = Long.parseLong(seedText);
      zm pearl = new zm(null, 2.0, 4.0, 6.0);
      pearl.Z = new java.util.Random(seed);
      pearl.c(0.0, 0.0, 1.0, 1.5F, 1.0F);
      Field width = sa.class.getDeclaredField("M"), height = sa.class.getDeclaredField("N");
      width.setAccessible(true); height.setAccessible(true);
      dh nbt = new dh(); pearl.e(nbt);
      System.out.println("{\"seed\":" + q(seedText) + ",\"width\":" + width.getFloat(pearl) + ",\"height\":" + height.getFloat(pearl)
        + ",\"x\":" + pearl.s + ",\"y\":" + pearl.t + ",\"z\":" + pearl.u + ",\"mx\":" + pearl.v + ",\"my\":" + pearl.w + ",\"mz\":" + pearl.x
        + ",\"yaw\":" + pearl.y + ",\"pitch\":" + pearl.z + ",\"nbt\":" + q(nbt.toString()) + "}");
    }
  }
}
