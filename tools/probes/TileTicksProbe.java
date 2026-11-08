import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged WorldServer (mt) scheduleBlockUpdateFromLoad (func_147446_b) and getPendingBlockUpdates, and the unchanged private
// AnvilChunkLoader payload reader and writer, on a constructor-free WorldServer whose tick sets are real. Prints one JSON object per scenario.
public class TileTicksProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) { try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} }
    throw new NoSuchFieldException(name);
  }
  static mt world(long time, boolean sky) throws Exception {
    mt w = (mt) unsafe.allocateInstance(mt.class);
    ays info = (ays) unsafe.allocateInstance(ays.class);
    field(ays.class, "g").setLong(info, time);
    field(ahb.class, "x").set(w, info);
    field(mt.class, "M").set(w, new HashSet());
    field(mt.class, "N").set(w, new TreeSet());
    field(mt.class, "V").set(w, new ArrayList());
    aqo provider = (aqo) unsafe.allocateInstance(aqq.class); provider.g = !sky;
    field(ahb.class, "t").set(w, provider);
    return w;
  }
  static String dump(mt w, long time) throws Exception {
    StringJoiner j = new StringJoiner(",", "[", "]");
    for (Object o : (TreeSet) field(mt.class, "N").get(w)) {
      ahs t = (ahs) o;
      j.add("[" + aji.b(t.a()) + "," + t.a + "," + t.b + "," + t.c + "," + (t.d - time) + "," + t.e + "]");
    }
    return j.toString();
  }
  static int[] tick(int i, int x, int y, int z, int t, int p) { return new int[]{i, x, y, z, t, p}; }
  static String json(List<int[]> l) {
    StringJoiner j = new StringJoiner(",", "[", "]");
    for (int[] a : l) j.add(Arrays.toString(a));
    return j.toString();
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    aqk loader = new aqk(new File("unused-probe-path"));
    Method writer = aqk.class.getDeclaredMethod("a", apx.class, ahb.class, dh.class); writer.setAccessible(true);
    Method reader = aqk.class.getDeclaredMethod("a", ahb.class, dh.class); reader.setAccessible(true);
    int[] pool = {0, 1, 2, 8, 9, 10, 11, 12, 13, 51, 54, 93, 94, 149, 23, 28, 122, 145, 175, 200, 999};
    Random r = new Random(1710);
    // ---- read side: chunks loaded in sequence into one world; the pending list is dumped in tree order.
    List<String> out = new ArrayList<>();
    for (int s = 0; s < 14; s++) {
      long time = new long[]{0, 100, 5000, 123456789L, 24000, 1, 7, 99999, 2147483000L, 3, 40, 1000, 50, 0}[s];
      mt w = world(time, true);
      List<String> loads = new ArrayList<>();
      int chunks = 1 + s % 3;
      for (int c = 0; c < chunks; c++) {
        int cx = c - 1, cz = (s % 2) - c;
        List<int[]> ticks = new ArrayList<>();
        int n = s == 0 ? 0 : 3 + r.nextInt(12);
        for (int k = 0; k < n; k++) {
          int id = pool[r.nextInt(pool.length)];
          int x = cx * 16 + r.nextInt(20) - 2, z = cz * 16 + r.nextInt(20) - 2, y = s == 5 && k % 3 == 0 ? new int[]{-5, 256, 300}[k % 3] : 1 + r.nextInt(120);
          if (s >= 2 && k % 4 == 1 && !ticks.isEmpty()) { int[] prev = ticks.get(r.nextInt(ticks.size())); x = prev[1]; y = prev[2]; z = prev[3]; id = r.nextBoolean() ? prev[0] : id; }
          int t = s == 4 ? new int[]{-1, 0, 1, Integer.MAX_VALUE, Integer.MIN_VALUE, 2147483000}[k % 6] : r.nextInt(40) - 3;
          int p = s == 6 ? new int[]{-1, 0, 1, 2, -5, Integer.MIN_VALUE}[k % 6] : r.nextInt(3) - 1;
          ticks.add(tick(id, x, y, z, t, p));
          if (s == 3 && k % 5 == 0) ticks.add(tick(id, x, y, z, t, p)); // exact duplicate in one list
        }
        mt scratch = world(time, true);
        apx chunk = new apx(scratch, cx, cz);
        dh level = new dh(), root = new dh(); writer.invoke(loader, chunk, scratch, level);
        dq list = new dq();
        for (int[] a : ticks) {
          dh e = new dh();
          String[] keys = {"i", "x", "y", "z", "t", "p"};
          for (int q = 0; q < 6; q++) {
            if (s == 7 && k0(a, q)) continue; // absent keys read as 0
            e.a(keys[q], a[q]);
          }
          list.a(e);
        }
        level.a("TileTicks", list);
        reader.invoke(loader, w, level);
        loads.add("{\"cx\":" + cx + ",\"cz\":" + cz + ",\"ticks\":" + json(ticks) + (s == 7 ? ",\"absentWhenZero\":true" : "") + "}");
      }
      out.add("{\"kind\":\"read\",\"index\":" + s + ",\"time\":" + time + ",\"loads\":[" + String.join(",", loads) + "],\"pending\":" + dump(w, time) + "}");
    }
    // ---- write side: tick sets filled directly (as scheduling does); the unchanged writer saves one chunk through getPendingBlockUpdates.
    for (int s = 0; s < 10; s++) {
      long time = new long[]{0, 100, 5000, 77, 24000, 1, 123456789L, 9, 3000, 12}[s];
      mt w = world(time, true);
      TreeSet tree = (TreeSet) field(mt.class, "N").get(w); Set hash = (Set) field(mt.class, "M").get(w); List thisTick = (List) field(mt.class, "V").get(w);
      List<int[]> pending = new ArrayList<>(), pendingThis = new ArrayList<>();
      int cx = s % 3 - 1, cz = s % 2 - 1, n = 8 + r.nextInt(14);
      for (int k = 0; k < n; k++) {
        int id = new int[]{8, 10, 11, 12, 51, 93, 94, 54, 1}[r.nextInt(9)];
        int x = cx * 16 + r.nextInt(26) - 5, z = cz * 16 + r.nextInt(26) - 5, y = 1 + r.nextInt(100);
        if (k % 6 == 0) { x = cx * 16 + new int[]{-3, -2, -1, 0, 15, 16, 17, 18}[r.nextInt(8)]; }
        if (k % 6 == 1) { z = cz * 16 + new int[]{-3, -2, 17, 18}[r.nextInt(4)]; }
        int delay = s == 5 ? new int[]{0, 1, -4, 2147483647, -2147483647, 5}[k % 6] : r.nextInt(30) - 2, pr = (id == 93 || id == 94) ? r.nextInt(5) - 2 : 0; // only diodes pass a priority (bytecode scan of every class)
        ahs e = new ahs(x, y, z, aji.e(id)); e.a(time + delay); e.a(pr);
        if (hash.contains(e)) continue;
        hash.add(e); tree.add(e); pending.add(tick(id, x, y, z, delay, pr));
        if (s >= 7 && k % 4 == 0) { // an entry already moved to the tick-this-tick list (saving mid tick)
          tree.remove(e); hash.remove(e); thisTick.add(e); pendingThis.add(pending.remove(pending.size() - 1));
        }
      }
      apx chunk = new apx(w, cx, cz);
      dh level = new dh(); writer.invoke(loader, chunk, w, level);
      dq saved = level.c("TileTicks", 10);
      StringJoiner j = new StringJoiner(",", "[", "]");
      if (saved != null) for (int k = 0; k < saved.c(); k++) { dh e = saved.b(k); j.add("[" + e.f("i") + "," + e.f("x") + "," + e.f("y") + "," + e.f("z") + "," + e.f("t") + "," + e.f("p") + "]"); }
      out.add("{\"kind\":\"write\",\"index\":" + s + ",\"time\":" + time + ",\"cx\":" + cx + ",\"cz\":" + cz + ",\"pending\":" + json(pending) + ",\"pendingThisTick\":" + json(pendingThis) + ",\"saved\":" + (saved == null ? "null" : j.toString()) + "}");
    }
    for (String l : out) System.out.println(l);
  }
  static boolean k0(int[] a, int q) { return a[q] == 0; }
}
