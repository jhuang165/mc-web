import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

// Batch 71 hudfx71: the shared bounds of the unchanged BlockBrewingStand [ajq] in the order the client queries them.
// Block fields B..G are minX, minY, minZ, maxX, maxY, maxZ. Queries: aji.a(World,x,y,z) = getCollisionBoundingBoxFromPool,
// aji.g(World,x,y,z) = getSelectedBoundingBoxFromPool (both read only the shared fields, so the world is null),
// aji.a(World,x,y,z,mask,list,entity) = addCollisionBoxesToList.
public class BrewingBoundsProbe {
  static final String[] F = {"B", "C", "D", "E", "F", "G"};
  static StringBuilder out = new StringBuilder();

  static String fields(aji b) throws Exception {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < 6; i++) {
      Field f = aji.class.getDeclaredField(F[i]); f.setAccessible(true);
      s.append(i > 0 ? "," : "").append(f.getDouble(b));
    }
    return s.append("]").toString();
  }
  static String box(azt a) { return a == null ? "null" : "[" + a.a + "," + a.b + "," + a.c + "," + a.d + "," + a.e + "," + a.f + "]"; }
  static void rec(String step, aji b, String extra) throws Exception {
    out.append("{\"step\":\"").append(step).append("\",\"bounds\":").append(fields(b))
       .append(",\"selected\":").append(box(b.g(null, 5, 6, 7)))
       .append(",\"collision\":").append(box(b.a(null, 5, 6, 7)))
       .append(extra).append("}\n");
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    aji stand = aji.e(117), glow = aji.e(89), stone = aji.e(1);
    out.append("{\"class\":\"").append(stand.getClass().getName()).append("\",\"ids\":[").append(stand == aji.e(117)).append("]}\n");
    rec("fresh stand (before any collision pass)", stand, "");
    List<azt> list = new ArrayList<>();
    azt mask = azt.a(5, 6, 7, 6, 7, 8);
    stand.a(null, 5, 6, 7, mask, list, null);
    StringBuilder l = new StringBuilder(",\"list\":[");
    for (int i = 0; i < list.size(); i++) l.append(i > 0 ? "," : "").append(box(list.get(i)));
    rec("after one addCollisionBoxesToList pass", stand, l.append("]").toString());
    // A mask that misses the stand still runs both setBlockBounds calls.
    azt far = azt.a(50, 60, 70, 51, 61, 71);
    stand.a(null, 5, 6, 7, far, new ArrayList<azt>(), null);
    rec("after a second pass whose mask misses the stand", stand, "");
    out.append("{\"step\":\"control: stone\",\"bounds\":").append(fields(stone)).append("}\n");
    System.out.print(out);
  }
}
