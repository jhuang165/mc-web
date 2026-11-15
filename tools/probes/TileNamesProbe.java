// b74 tilenames: the unchanged 1.7.10 tile entities' CustomName handling. For each tile (TileEntityChest aow, Dispenser apb, Dropper apc,
// EnchantmentTable apd, Furnace apg, Hopper api, BrewingStand aov) and InventoryLargeChest (ra): the name and flag before and after
// setCustomName, writeToNBT (b(dh)) output keys, and readFromNBT (a(dh)) of a compound with CustomName, with an empty name and without.
import java.lang.reflect.*;
public class TileNamesProbe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Object call(Object o, String n, Class<?>[] t, Object... a) throws Exception { Method m = find(o.getClass(), n, t); m.setAccessible(true); return m.invoke(o, a); }
  static Method find(Class<?> c, String n, Class<?>[] t) throws Exception { for (Class<?> k = c; k != null; k = k.getSuperclass()) { try { return k.getDeclaredMethod(n, t); } catch (NoSuchMethodException e) {} } throw new NoSuchMethodException(n); }
  static String keys(Object tag) throws Exception { Method m = find(Class.forName("dh"), "c", new Class[0]); return String.valueOf(m.invoke(tag)); }
  public static void main(String[] x) throws Exception {
    Class<?> dh = Class.forName("dh");
    String[][] tiles = { {"Chest","aow"}, {"Trap","apb"}, {"Dropper","apc"}, {"EnchantTable","apd"}, {"Furnace","apg"}, {"Hopper","api"}, {"Cauldron","aov"} };
    for (String[] t : tiles) {
      boolean ench = t[1].equals("apd");
      Class<?> c = Class.forName(t[1]);
      Object tile = c.getDeclaredConstructor().newInstance();
      String nameM = ench ? "a" : "b", flagM = ench ? "b" : "k_";
      Class<?>[] none = new Class[0], str = { String.class }, nbt = { dh };
      StringBuilder sb = new StringBuilder("{\"tile\":" + q(t[0]));
      sb.append(",\"defaultName\":").append(q((String) call(tile, nameM, none))).append(",\"defaultFlag\":").append(call(tile, flagM, none));
      Object w0 = dh.getConstructor().newInstance(); call(tile, "b", nbt, w0);
      sb.append(",\"unnamedHasCustomName\":").append(String.valueOf(w0).contains("CustomName"));
      call(tile, "a", str, "Stash");
      sb.append(",\"name\":").append(q((String) call(tile, nameM, none))).append(",\"flag\":").append(call(tile, flagM, none));
      Object w1 = dh.getConstructor().newInstance(); call(tile, "b", nbt, w1);
      Method gs = dh.getMethod("j", String.class);
      sb.append(",\"writtenCustomName\":").append(q((String) gs.invoke(w1, "CustomName")));
      call(tile, "a", str, "");
      Object w2 = dh.getConstructor().newInstance(); call(tile, "b", nbt, w2);
      sb.append(",\"emptyFlag\":").append(call(tile, flagM, none)).append(",\"emptyWritten\":").append(String.valueOf(w2).contains("CustomName"));
      Object r = c.getDeclaredConstructor().newInstance();
      Object in = dh.getConstructor().newInstance(); dh.getMethod("a", String.class, String.class).invoke(in, "CustomName", "Loot");
      dh.getMethod("a", String.class, int.class).invoke(in, "x", 1);
      call(r, "a", nbt, in);
      sb.append(",\"readName\":").append(q((String) call(r, nameM, none))).append(",\"readFlag\":").append(call(r, flagM, none));
      Object r2 = c.getDeclaredConstructor().newInstance();
      Object in2 = dh.getConstructor().newInstance(); dh.getMethod("a", String.class, int.class).invoke(in2, "CustomName", 5); // wrong tag type
      call(r2, "a", nbt, in2);
      sb.append(",\"wrongTypeFlag\":").append(call(r2, flagM, none)).append("}");
      System.out.println(sb);
    }
    // InventoryLargeChest(ra): first (b) then second (c) name, else the constructor's name.
    Class<?> ra = Class.forName("ra"), rb = Class.forName("rb"), aow = Class.forName("aow");
    String[][] cases = { {null, null}, {"A", null}, {null, "B"}, {"A", "B"} };
    for (String[] cs : cases) {
      Object a = aow.getDeclaredConstructor().newInstance(), b = aow.getDeclaredConstructor().newInstance();
      if (cs[0] != null) call(a, "a", new Class[]{String.class}, cs[0]);
      if (cs[1] != null) call(b, "a", new Class[]{String.class}, cs[1]);
      Object large = ra.getConstructor(String.class, rb, rb).newInstance("container.chestDouble", a, b);
      System.out.println("{\"large\":[" + q(cs[0]) + "," + q(cs[1]) + "],\"name\":" + q((String) call(large, "b", new Class[0])) + ",\"flag\":" + call(large, "k_", new Class[0]) + "}");
    }
  }
}
