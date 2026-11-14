// Batch 68 pistons5: carts and riders under a piston, with the entities' own onUpdate running (PistonLiveProbe never ticks entities).
// Same scenario protocol as PistonLiveProbe ("scenario name ox oy oz dx dy dz ticks seed", "grid ...", "event tick op args"), same real
// TileEntityPiston / BlockPistonBase / BlockPistonMoving and World.updateEntities, but live entities are put into World.loadedEntityList
// (World.e) so the native loop runs: entities first (EntityMinecart.onUpdate, rail snapping, riders through updateRidden), then the
// tile entity loop (TileEntityPiston.func_145863_a pushes with Entity.moveEntity).
// Per tick (as PistonLiveProbe): events, world time + 1, tickUpdates, sendQueuedBlockEvents, World.updateEntities.
// live kinds: 0 pig, 1 empty minecart, 2 boat, 8 minecart with a pig rider (rider label = label + 100), 9 boat with a pig rider (label + 100).
// Output per tick, per entity: [label, posX, minY, posZ, motionX, motionY, motionZ, onGround, isCollidedHorizontally, fallDistance, ridingLabel (-1 none)].
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class PistonCartProbe {
  // EntityMinecartEmpty (xs, type 0): PistonLiveProbe.Cart is xm, the chest cart (its drag is the container formula).
  public static class ECart extends xs implements PistonLiveProbe.Live { int label; public ECart(ahb w, double x, double y, double z) { super(w, x, y, z); } public int label() { return label; } public void d(double x, double y, double z) { PistonLiveProbe.rec(label, x, y, z); super.d(x, y, z); } }
  static String q(String s) { return "\"" + s + "\""; }
  static Field field(Class<?> c, String n) throws Exception { return PistonProbe.field(c, n); }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); PistonProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    Field wireSet = field(ana.class, "b");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1];
      int ox = Integer.parseInt(h[2]), oy = Integer.parseInt(h[3]), oz = Integer.parseInt(h[4]);
      int dx = Integer.parseInt(h[5]), dy = Integer.parseInt(h[6]), dz = Integer.parseInt(h[7]), ticks = Integer.parseInt(h[8]);
      PistonProbe.W w = PistonProbe.world(Long.parseLong(h[9]));
      field(ahb.class, "L").set(w, new ArrayList());
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      PistonLiveProbe.liveMoves = new ArrayList<>();
      List<sa> loaded = (List<sa>) field(ahb.class, "e").get(w);
      Map<sa, Integer> rider = new LinkedHashMap<>();
      StringBuilder liveOut = new StringBuilder();
      for (int t = 1; t <= ticks; t++) {
        w.tick = t; w.log.setLength(0);
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          String op = e[2];
          int x = ox + Integer.parseInt(e[3]), y = oy + Integer.parseInt(e[4]), z = oz + Integer.parseInt(e[5]);
          switch (op) {
            case "place": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            case "air": w.f(x, y, z); break;
            case "live": {
              int label = Integer.parseInt(e[6]), kind = Integer.parseInt(e[7]);
              double px = x + 0.5, py = y, pz = z + 0.5;
              sa ent;
              if (kind == 0) { PistonLiveProbe.Pig g = new PistonLiveProbe.Pig(w); g.label = label; g.b(px, py, pz); ent = g; }
              else if (kind == 1 || kind == 8) { ECart c = new ECart(w, px, py, pz); c.b(px, py + c.L, pz); c.label = label; ent = c; }
              else { PistonLiveProbe.Boat b = new PistonLiveProbe.Boat(w, px, py, pz); b.label = label; ent = b; }
              ent.v = Double.parseDouble(e[8]); ent.w = Double.parseDouble(e[9]); ent.x = Double.parseDouble(e[10]);
              ent.D = true; ent.ag = true; // onGround, addedToChunk
              loaded.add(ent); w.ents.add(new Object[] {ent, null, new int[] {x, y, z}});
              if (kind == 8 || kind == 9) {
                PistonLiveProbe.Pig g = new PistonLiveProbe.Pig(w); g.label = label + 100;
                g.b(px, py + ent.L + 0.5, pz); g.ag = true; g.m = ent; ent.l = g; // ridingEntity / riddenByEntity (what Entity.mountEntity sets)
                loaded.add(g); w.ents.add(new Object[] {g, null, new int[] {x, y, z}}); rider.put(g, label);
              }
              break;
            }
            default: throw new IllegalArgumentException(op);
          }
        }
        PistonLiveProbe.liveTick = t;
        w.time++;
        w.add("T");
        w.tickUpdates();
        w.sendQueuedBlockEvents();
        w.h();
        StringBuilder lv = new StringBuilder();
        for (Object[] o : w.ents) if (o[0] instanceof PistonLiveProbe.Live) {
          sa a = (sa) o[0];
          Integer r = a.m == null ? Integer.valueOf(-1) : ((PistonLiveProbe.Live) a.m).label();
          lv.append(lv.length() > 0 ? "," : "").append("[").append(((PistonLiveProbe.Live) a).label()).append(",").append(a.s - ox).append(",").append(a.C.b - oy).append(",").append(a.u - oz).append(",").append(a.v).append(",").append(a.w).append(",").append(a.x).append(",").append(a.D ? 1 : 0).append(",").append(a.E ? 1 : 0).append(",").append(a.R).append(",").append(r).append("]");
        }
        liveOut.append(t > 1 ? "," : "").append("[").append(lv).append("]");
      }
      System.out.println("{\"name\":" + q(name) + ",\"live\":[" + liveOut + "],\"liveMoves\":[" + String.join(",", PistonLiveProbe.liveMoves) + "]}");
    }
  }
}
