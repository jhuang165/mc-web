import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Random;

// RendererLivingEntity.func_85093_e (boh.e(sv, F): renderArrowsStuckInEntity) with the unchanged ModelBiped (bhm) and
// ModelBase.getRandomModelBox (bhr.a(Random)): for entity ids and arrow counts it records the box each arrow picks, its
// translation (model pixels / 16) and the yaw and pitch the arrow entity is given. The GL calls are not run.
// Also records the model's boxes (boxList order, rotation points, cube fields) and the arrow counter rules.
public class StuckArrowProbe {
  static Object get(Object o, String name) throws Exception {
    Class<?> c = o.getClass();
    while (c != null) {
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(o); } catch (NoSuchFieldException e) { c = c.getSuperclass(); }
    }
    throw new NoSuchFieldException(name);
  }
  static float fl(Object o, String n) throws Exception { return ((Number) get(o, n)).floatValue(); }

  public static void main(String[] args) throws Exception {
    Object model = Class.forName("bhm").getConstructor(float.class).newInstance(0.0f);
    List<?> boxes = (List<?>) get(model, "r");
    Method random = Class.forName("bhr").getMethod("a", Random.class);
    StringBuilder parts = new StringBuilder();
    for (Object part : boxes) {
      List<?> cubes = (List<?>) get(part, "l");
      StringBuilder cs = new StringBuilder();
      for (Object cube : cubes) {
        if (cs.length() > 0) cs.append(',');
        cs.append('[').append(fl(cube, "a")).append(',').append(fl(cube, "b")).append(',').append(fl(cube, "c")).append(',')
          .append(fl(cube, "d")).append(',').append(fl(cube, "e")).append(',').append(fl(cube, "f")).append(']');
      }
      parts.append(parts.length() > 0 ? "," : "").append("{\"point\":[").append(fl(part, "c")).append(',').append(fl(part, "d")).append(',').append(fl(part, "e"))
        .append("],\"cubes\":[").append(cs).append("]}");
    }
    System.out.println("{\"case\":\"model\",\"parts\":[" + parts + "]}");
    int[] ids = {0, 1, 2, 7, 100, 1234, 65535, 123456789, -5};
    for (int id : ids) {
      Random rand = new Random((long) id);
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 12; i++) {
        Object part = random.invoke(model, rand);
        List<?> cubes = (List<?>) get(part, "l");
        Object cube = cubes.get(rand.nextInt(cubes.size()));
        float f9 = rand.nextFloat(), f10 = rand.nextFloat(), f11 = rand.nextFloat();
        float x = (fl(cube, "a") + (fl(cube, "d") - fl(cube, "a")) * f9) / 16.0f;
        float y = (fl(cube, "b") + (fl(cube, "e") - fl(cube, "b")) * f10) / 16.0f;
        float z = (fl(cube, "c") + (fl(cube, "f") - fl(cube, "c")) * f11) / 16.0f;
        f9 = f9 * 2.0f - 1.0f; f10 = f10 * 2.0f - 1.0f; f11 = f11 * 2.0f - 1.0f;
        f9 *= -1.0f; f10 *= -1.0f; f11 *= -1.0f;
        float f15 = (float) Math.sqrt(f9 * f9 + f11 * f11);
        float yaw = (float) (Math.atan2((double) f9, (double) f11) * 180.0 / 3.1415927410125732);
        float pitch = (float) (Math.atan2((double) f10, (double) f15) * 180.0 / 3.1415927410125732);
        rows.append(rows.length() > 0 ? "," : "").append("{\"part\":").append(boxes.indexOf(part)).append(",\"pos\":[").append(x).append(',').append(y).append(',').append(z)
          .append("],\"yaw\":").append(yaw).append(",\"pitch\":").append(pitch).append('}');
      }
      System.out.println("{\"case\":\"arrows\",\"id\":" + id + ",\"rows\":[" + rows + "]}");
    }
  }
}
