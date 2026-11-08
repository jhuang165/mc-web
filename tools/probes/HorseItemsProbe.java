import java.util.*;

// Runs the unchanged EntityHorse.readEntityFromNBT (wi.a(dh)) and writeEntityToNBT (wi.b(dh)) on the HorseProbe world double and dumps the
// AnimalChest (zt) contents after loading saved "Items" stacks: Slot range, stack counts at and beyond the limits, unknown item ids, duplicate slots.
public class HorseItemsProbe {
  static dh stack(int slot, int id, int count, int damage) {
    dh c = new dh();
    c.a("Slot", (byte) slot); c.a("id", (short) id); c.a("Count", (byte) count); c.a("Damage", (short) damage);
    return c;
  }
  static String dump(zt chest) {
    StringJoiner j = new StringJoiner(",", "[", "]");
    for (int i = 0; i < chest.a(); i++) j.add(HorseProbe.stack(chest.a(i)));
    return j.toString();
  }
  static void run(String name, int type, boolean chested, int[][] items, java.util.List<String> out) throws Exception {
    wi e = HorseProbe.typed(5, type);
    dh in = new dh();
    in.a("ChestedHorse", (byte) (chested ? 1 : 0));
    in.a("Type", type);
    dq list = new dq();
    for (int[] s : items) list.a(stack(s[0], s[1], s[2], s[3]));
    in.a("Items", list);
    e.a(in);
    zt chest = (zt) MobMoveProbe.field(wi.class, "bG").get(e);
    StringJoiner given = new StringJoiner(",", "[", "]");
    for (int[] s : items) given.add(Arrays.toString(s));
    String saved = "null";
    try {
      dh o = new dh(); e.b(o);
      dq l = o.c("Items", 10);
      StringJoiner j = new StringJoiner(",", "[", "]");
      if (l != null) for (int i = 0; i < l.c(); i++) { dh c = l.b(i); j.add("[" + (c.d("Slot") & 255) + "," + c.e("id") + "," + c.d("Count") + "," + c.e("Damage") + "]"); }
      saved = j.toString();
    } catch (Throwable t) { saved = "\"" + t.getClass().getSimpleName() + "\""; }
    out.add("{\"name\":\"" + name + "\",\"type\":" + type + ",\"chested\":" + chested + ",\"items\":" + given + ",\"chest\":" + dump(chest) + ",\"size\":" + chest.a() + ",\"limit\":" + chest.d() + ",\"saved\":" + saved + "}");
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) HorseProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    HorseProbe.W = world;
    List<String> out = new ArrayList<>();
    int[] counts = {0, -1, -128, 1, 64, 65, 100, 127, 2, 63, -64, 32, 10, 5, 7};
    int[][] items = new int[15][];
    for (int i = 0; i < 15; i++) items[i] = new int[]{2 + i, i % 2 == 0 ? 280 : 296, counts[i], i == 4 ? -5 : 0};
    run("counts", 1, true, items, out);
    run("slots", 2, true, new int[][]{{0, 280, 3, 0}, {1, 280, 4, 0}, {2, 280, 5, 0}, {16, 280, 6, 0}, {17, 280, 7, 0}, {255, 280, 8, 0}, {-1, 280, 9, 0}, {5, 280, 10, 0}, {5, 296, 11, 0}, {3, 999, 12, 0}, {4, 0, 13, 0}, {6, 4096, 14, 0}}, out);
    run("notChested", 1, false, new int[][]{{2, 280, 5, 0}}, out);
    run("horseNoChest", 0, true, new int[][]{{2, 280, 5, 0}}, out);
    for (String l : out) System.out.println(l);
  }
}
