// Drives the unchanged original BlockHopper (aln, 154) and TileEntityHopper (api) in the RedstoneProbe World/Chunk fixture
// with real chests (54, aow), furnaces (61, apg), droppers/dispensers (158/23), hoppers and scripted EntityItems (xk), and
// records, per tick, every container slot change, hopper cooldown, hopper metadata (enabled bit), item entity and comparator
// output (Block.getComparatorInputOverride). Furnace progress is not ticked (TileEntityFurnace.updateEntity is not called).
// Input per scenario (stdin):
//   scenario NAME TICKS
//   set X Y Z ID META            raw block (tile entities are created lazily and ticked in the order of the set lines)
//   slot X Y Z SLOT ITEM COUNT DAMAGE
//   entity X Y Z ITEM COUNT DAMAGE   (doubles; the EntityItem's real bounding box)
//   event TICK KIND ARGS...      place X Y Z ID META | air X Y Z | slot ... | entity ... | notify X Y Z ID
// Output: one JSON line per scenario plus a first "facts" line (block facts of 154).
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class HopperProbe {
  static class L extends RedstoneProbe.W {
    public void a(sa e, String name, float volume, float pitch) {}
    public boolean d(sa e) { return true; }
  }
  static L world(long seed) throws Exception {
    L w = (L) RedstoneProbe.unsafe.allocateInstance(L.class);
    RedstoneProbe.Provider provider = new RedstoneProbe.Provider(); provider.g = false;
    RedstoneProbe.field(ahb.class, "t").set(w, provider);
    RedstoneProbe.field(ahb.class, "j").setInt(w, 0);
    RedstoneProbe.field(ahb.class, "s").set(w, new Random(seed));
    RedstoneProbe.field(ahb.class, "u").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "C").set(w, new qi());
    RedstoneProbe.field(ahb.class, "v").set(w, new RedstoneProbe.Chunks(w));
    RedstoneProbe.field(ahb.class, "a").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "g").set(w, new ArrayList());
    w.sky = 15; w.angle = 0f;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    return w;
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String stack(add s) { return s == null ? "0" : adb.b(s.b()) + ":" + s.b + ":" + s.k(); }
  static String inv(rb i) {
    StringBuilder sb = new StringBuilder();
    for (int k = 0; k < i.a(); k++) sb.append(k > 0 ? "," : "").append(stack(i.a(k)));
    return sb.toString();
  }
  static final int[] TILES = {23, 54, 61, 62, 154, 158};
  static boolean tracked(int id) { for (int t : TILES) if (t == id) return true; return id == 149 || id == 150; }
  static String boxes(List l) {
    StringBuilder sb = new StringBuilder();
    for (Object o : l) { azt b = (azt) o; sb.append(sb.length() > 0 ? "," : "").append("[").append(b.a).append(",").append(b.b).append(",").append(b.c).append(",").append(b.d).append(",").append(b.e).append(",").append(b.f).append("]"); }
    return sb.toString();
  }
  static void spawn(L w, double x, double y, double z, int item, int count, int damage) {
    xk e = new xk(w, x, y, z, new add(adb.d(item), count, damage));
    azt b = e.C;
    w.ents.add(new Object[] {e, new double[] {b.a, b.b, b.c, b.d, b.e, b.f}, new int[] {0, 0, 0}});
  }
  static void slot(L w, int x, int y, int z, int slot, int item, int count, int damage) throws Exception {
    Object i = w.o(x, y, z);
    i.getClass().getMethod("a", int.class, add.class).invoke(i, slot, count > 0 ? new add(adb.d(item), count, damage) : null);
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); RedstoneProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    aln hopper = (aln) aji.e(154);
    // Block facts: class, hardness, resistance field, bounds fields, collision boxes, placement metadata per clicked side.
    L fw = world(0); fw.raw(0, 1, 0, hopper, 0);
    StringBuilder place = new StringBuilder();
    for (int side = 0; side < 6; side++) place.append(side > 0 ? "," : "").append(hopper.a((ahb) fw, 0, 1, 0, side, 0.5f, 0.5f, 0.5f, 0));
    List list = new ArrayList();
    String bounds = "[" + hopper.B + "," + hopper.C + "," + hopper.D + "," + hopper.E + "," + hopper.F + "," + hopper.G + "]";
    hopper.a((ahb) fw, 0, 1, 0, azt.a(-1, -1, -1, 2, 3, 2), list, (sa) null);
    String after = "[" + hopper.B + "," + hopper.C + "," + hopper.D + "," + hopper.E + "," + hopper.F + "," + hopper.G + "]";
    System.out.println("{\"kind\":\"facts\",\"class\":" + q(hopper.getClass().getName()) + ",\"hardness\":" + hopper.f((ahb) fw, 0, 1, 0) + ",\"resistance\":" + hopper.w
      + ",\"bounds\":" + bounds + ",\"boundsAfterCollision\":" + after + ",\"collision\":[" + boxes(list) + "],\"placed\":[" + place + "],\"opaque\":" + (hopper.c() ? 1 : 0)
      + ",\"normal\":" + (hopper.r() ? 1 : 0) + ",\"renderType\":" + hopper.b() + ",\"comparatorOverride\":" + (hopper.M() ? 1 : 0)
      + ",\"itemStack\":" + adb.d(154).m() + ",\"hopperItem\":" + q(adb.d(154).getClass().getName()) + "}");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1]; int ticks = Integer.parseInt(h[2]);
      L w = world(1);
      List<int[]> order = new ArrayList<>();
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && !line.startsWith("scenario "); line = in.readLine()) {
        String[] c = line.split(" ");
        if (c.length == 0 || c[0].isEmpty()) continue;
        switch (c[0]) {
          case "set": {
            int x = Integer.parseInt(c[1]), y = Integer.parseInt(c[2]), z = Integer.parseInt(c[3]), id = Integer.parseInt(c[4]);
            w.raw(x, y, z, aji.e(id), Integer.parseInt(c[5]));
            if (tracked(id)) order.add(new int[] {x, y, z});
            break;
          }
          case "slot": slot(w, Integer.parseInt(c[1]), Integer.parseInt(c[2]), Integer.parseInt(c[3]), Integer.parseInt(c[4]), Integer.parseInt(c[5]), Integer.parseInt(c[6]), Integer.parseInt(c[7])); break;
          case "entity": spawn(w, Double.parseDouble(c[1]), Double.parseDouble(c[2]), Double.parseDouble(c[3]), Integer.parseInt(c[4]), Integer.parseInt(c[5]), Integer.parseInt(c[6])); break;
          case "event": events.add(c); break;
          default: throw new IllegalArgumentException(line);
        }
      }
      Map<String, String> prev = new LinkedHashMap<>();
      StringBuilder frames = new StringBuilder();
      Field cd = RedstoneProbe.field(api.class, "j"), dead = RedstoneProbe.field(sa.class, "K");
      for (int t = 1; t <= ticks; t++) {
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          switch (e[2]) {
            case "place": { int x = Integer.parseInt(e[3]), y = Integer.parseInt(e[4]), z = Integer.parseInt(e[5]), id = Integer.parseInt(e[6]);
              w.d(x, y, z, aji.e(id), Integer.parseInt(e[7]), 3);
              boolean known = false; for (int[] o : order) if (o[0] == x && o[1] == y && o[2] == z) known = true;
              if (tracked(id) && !known) order.add(new int[] {x, y, z});
              break; }
            case "air": w.f(Integer.parseInt(e[3]), Integer.parseInt(e[4]), Integer.parseInt(e[5])); break;
            case "slot": slot(w, Integer.parseInt(e[3]), Integer.parseInt(e[4]), Integer.parseInt(e[5]), Integer.parseInt(e[6]), Integer.parseInt(e[7]), Integer.parseInt(e[8]), Integer.parseInt(e[9])); break;
            case "entity": spawn(w, Double.parseDouble(e[3]), Double.parseDouble(e[4]), Double.parseDouble(e[5]), Integer.parseInt(e[6]), Integer.parseInt(e[7]), Integer.parseInt(e[8])); break;
            case "notify": w.e(Integer.parseInt(e[3]), Integer.parseInt(e[4]), Integer.parseInt(e[5]), aji.e(Integer.parseInt(e[6]))); break;
            default: throw new IllegalArgumentException(e[2]);
          }
        }
        w.time++;
        // World.updateEntities: the tile-entity loop in list order (the order the blocks were set).
        for (int[] o : order) {
          aor te = null;
          int id = aji.b(w.a(o[0], o[1], o[2]));
          for (int tt : TILES) if (tt == id) te = w.o(o[0], o[1], o[2]);
          if (te instanceof api) te.h();
        }
        w.add("T");
        w.tickUpdates();
        w.ents.removeIf(o -> { try { return dead.getBoolean(o[0]); } catch (Exception ex) { return false; } });
        StringBuilder diff = new StringBuilder();
        Map<String, String> now = new LinkedHashMap<>();
        for (int[] o : order) {
          int x = o[0], y = o[1], z = o[2], id = aji.b(w.a(x, y, z));
          String k = x + "," + y + "," + z, st = id + ":" + w.e(x, y, z);
          boolean has = false; for (int tt : TILES) if (tt == id) has = true;
          if (id == 149 || id == 150) now.put(k + "#cmp", String.valueOf(((aoz) w.o(x, y, z)).a()));
          if (has) {
            Object te = w.o(x, y, z);
            st += "|" + inv((rb) te) + (te instanceof api ? "|cd" + cd.getInt(te) : "");
            now.put(k + "#sig", String.valueOf(aji.e(id).g((ahb) w, x, y, z, 0)));
          }
          now.put(k, st);
        }
        int n = 0;
        for (Object[] o : w.ents) {
          xk e = (xk) o[0];
          now.put("e" + n++, adb.b(e.f().b()) + ":" + e.f().b + ":" + e.f().k());
        }
        for (Map.Entry<String, String> en : now.entrySet()) if (!en.getValue().equals(prev.get(en.getKey()))) diff.append(diff.length() > 0 ? "," : "").append("[").append(q(en.getKey())).append(",").append(q(en.getValue())).append("]");
        for (String k : prev.keySet()) if (!now.containsKey(k)) diff.append(diff.length() > 0 ? "," : "").append("[").append(q(k)).append(",").append(q("-")).append("]");
        prev = now;
        frames.append(t > 1 ? "," : "").append("[").append(diff).append("]");
      }
      System.out.println("{\"kind\":\"scenario\",\"name\":" + q(name) + ",\"frames\":[" + frames + "],\"rng\":" + w.s.nextInt() + "}");
    }
  }
}
