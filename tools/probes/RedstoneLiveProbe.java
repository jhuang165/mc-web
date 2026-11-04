// Runs the unchanged original BlockDoor (akn, ids 64 and 71) and BlockTNT (aob, id 46) with the redstone
// blocks that power them (wire, lever, repeater, torch, redstone block, lamp, comparator via RedstoneProbe's
// harness) inside the same real World (ahb) / Chunk (apx) fixture as RedstoneProbe.java. Only the world's
// entity spawn and sound/aux-effect calls are overridden so they are recorded:
//   - spawnEntityInWorld(EntityTNTPrimed xw) is logged as "g,x,y,z" (the entity's real position);
//   - playSoundAtEntity logs "p,name"; playAuxSFXAtEntity logs "a,id,x,y,z" (door effect 1003).
// Everything else (setBlock, setBlockMetadataWithNotify, notifications, power queries, scheduled ticks,
// drops) is RedstoneProbe.W. Scenarios arrive on stdin in the same format as tools/verify-redstone.mjs;
// one JSON line per scenario goes to stdout, first a "blocks" line with the class names.
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class RedstoneLiveProbe {
  static class L extends RedstoneProbe.W {
    public boolean d(sa e) {
      if (e instanceof xw) { add("g," + (int) Math.floor(e.s) + "," + (int) Math.floor(e.t) + "," + (int) Math.floor(e.u)); return true; }
      return super.d(e);
    }
    public void a(sa e, String name, float volume, float pitch) {}
    public void a(yz player, int id, int x, int y, int z, int data) { add("a," + id + "," + x + "," + y + "," + z); }
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
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); RedstoneProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    Field wireSet = RedstoneProbe.field(ana.class, "b");
    StringBuilder cls = new StringBuilder();
    for (int id : new int[] {46, 64, 71}) cls.append(cls.length() > 0 ? "," : "").append(q(String.valueOf(id))).append(":").append(q(aji.e(id).getClass().getName()));
    System.out.println("{\"kind\":\"blocks\",\"classes\":{" + cls + "}}");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1];
      int ox = Integer.parseInt(h[2]), oy = Integer.parseInt(h[3]), oz = Integer.parseInt(h[4]);
      int dx = Integer.parseInt(h[5]), dy = Integer.parseInt(h[6]), dz = Integer.parseInt(h[7]), ticks = Integer.parseInt(h[8]);
      long seed = Long.parseLong(h[9]);
      L w = world(seed);
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      int[][] prev = RedstoneProbe.snapshot(w, ox, oy, oz, dx, dy, dz);
      StringBuilder frames = new StringBuilder(), logs = new StringBuilder();
      for (int t = 1; t <= ticks; t++) {
        w.tick = t; w.log.setLength(0);
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          int x = ox + Integer.parseInt(e[3]), y = oy + Integer.parseInt(e[4]), z = oz + Integer.parseInt(e[5]);
          w.add("E," + e[2]);
          switch (e[2]) {
            case "place": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            case "air": w.f(x, y, z); break;
            case "use": w.a(x, y, z).a((ahb) w, x, y, z, (yz) null, 0, 0f, 0f, 0f); break;
            case "notify": w.e(x, y, z, aji.e(Integer.parseInt(e[6]))); break;
            default: throw new IllegalArgumentException(e[2]);
          }
        }
        w.time++;
        w.add("T");
        w.tickUpdates();
        int[][] now = RedstoneProbe.snapshot(w, ox, oy, oz, dx, dy, dz);
        StringBuilder diff = new StringBuilder();
        for (int i = 0; i < now.length; i++) if (now[i][0] != prev[i][0] || now[i][1] != prev[i][1]) {
          int x = i / (dy * dz), y = i / dz % dy, z = i % dz;
          diff.append(diff.length() > 0 ? "," : "").append("[").append(x).append(",").append(y).append(",").append(z).append(",").append(now[i][0]).append(",").append(now[i][1]).append("]");
        }
        prev = now;
        frames.append(t > 1 ? "," : "").append("[").append(diff).append("]");
        logs.append(t > 1 ? "," : "").append(q(w.log.toString()));
      }
      StringBuilder pend = new StringBuilder();
      for (ahs e : w.N) pend.append(pend.length() > 0 ? "," : "").append("[").append(e.a - ox).append(",").append(e.b - oy).append(",").append(e.c - oz).append(",").append(aji.b(e.a())).append(",").append(e.d - w.time).append(",").append(e.e).append("]");
      StringBuilder fin = new StringBuilder();
      for (int[] c : prev) fin.append(fin.length() > 0 ? "," : "").append(c[0]).append(c[1] != 0 ? ":" + c[1] : "");
      System.out.println("{\"kind\":\"scenario\",\"name\":" + q(name) + ",\"frames\":[" + frames + "],\"calls\":[" + logs + "],\"final\":" + q(fin.toString()) + ",\"pending\":[" + pend + "],\"drops\":[" + String.join(",", w.drops) + "],\"rng\":" + w.s.nextInt() + "}");
    }
  }
}
