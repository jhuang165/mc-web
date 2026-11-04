// Native evidence for src/piston-live.js: TileEntityPiston.func_145863_a entity pushing (aps.a(float, float) via
// updateEntity), the TileEntityPiston render offsets (aps.a/b/c/d(partialTicks), used by TileEntityRendererPiston bmq)
// and BlockPistonMoving.func_149964_a (apr.a(World, x, y, z, Block, progress, facing), the push box), driven through the
// piston scenario world of tools/probes/PistonProbe.java (real World, Chunk, BlockPistonBase, BlockPistonExtension,
// BlockPistonMoving, TileEntityPiston, real tile-entity loop). Scripted entities are EntityItem subclasses allocated without
// a constructor whose moveEntity (sa.d(double, double, double)) records the requested delta and shifts their scripted box,
// so the native getEntitiesWithinAABBExcludingEntity intersection and every func_145863_a move are observable.
// Per tick (same order as PistonProbe): events, world time + 1, tickUpdates, sendQueuedBlockEvents, World.updateEntities.
// stdin per scenario: "scenario name ox oy oz dx dy dz ticks seed", "grid id[:meta],...", then "event tick op args" lines
// (place x y z id meta | air x y z | use x y z | entity x y z label minx miny minz maxx maxy maxz, region-relative).
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class PistonLiveProbe {
  public static class Ent extends xk {
    public Ent() { super((ahb) null); }
    int label; double[] box; List<String> moves; long tick;
    public void d(double x, double y, double z) {
      moves.add("[" + tick + "," + label + "," + x + "," + y + "," + z + "]");
      box[0] += x; box[3] += x; box[1] += y; box[4] += y; box[2] += z; box[5] += z;
    }
  }
  static String q(String s) { return "\"" + s + "\""; }
  static Field field(Class<?> c, String n) throws Exception { return PistonProbe.field(c, n); }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); PistonProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    Field wireSet = field(ana.class, "b");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    final float[] partials = {0f, 0.25f, 0.5f, 0.75f, 1f};
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1];
      int ox = Integer.parseInt(h[2]), oy = Integer.parseInt(h[3]), oz = Integer.parseInt(h[4]);
      int dx = Integer.parseInt(h[5]), dy = Integer.parseInt(h[6]), dz = Integer.parseInt(h[7]), ticks = Integer.parseInt(h[8]);
      PistonProbe.W w = PistonProbe.world(Long.parseLong(h[9]));
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      List<String> moves = new ArrayList<>();
      StringBuilder tes = new StringBuilder(), boxes = new StringBuilder(), cellsOut = new StringBuilder();
      for (int t = 1; t <= ticks; t++) {
        w.tick = t; w.log.setLength(0);
        for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
          String op = e[2];
          int x = ox + Integer.parseInt(e[3]), y = oy + Integer.parseInt(e[4]), z = oz + Integer.parseInt(e[5]);
          switch (op) {
            case "place": w.d(x, y, z, aji.e(Integer.parseInt(e[6])), Integer.parseInt(e[7]), 3); break;
            case "air": w.f(x, y, z); break;
            case "use": w.a(x, y, z).a((ahb) w, x, y, z, (yz) null, 0, 0f, 0f, 0f); break;
            case "entity": {
              Ent ent = (Ent) PistonProbe.unsafe.allocateInstance(Ent.class);
              ent.label = Integer.parseInt(e[6]); ent.moves = moves;
              ent.box = new double[] {ox + Double.parseDouble(e[7]), oy + Double.parseDouble(e[8]), oz + Double.parseDouble(e[9]), ox + Double.parseDouble(e[10]), oy + Double.parseDouble(e[11]), oz + Double.parseDouble(e[12])};
              w.ents.add(new Object[] {ent, ent.box, new int[] {x, y, z}});
              break;
            }
            default: throw new IllegalArgumentException(op);
          }
        }
        for (Object[] o : w.ents) ((Ent) o[0]).tick = t;
        w.time++;
        w.add("T");
        w.tickUpdates();
        w.sendQueuedBlockEvents();
        w.h();
        StringBuilder te = new StringBuilder(), bx = new StringBuilder();
        for (Object o : (List) field(ahb.class, "g").get(w)) if (o instanceof aps) {
          aps p = (aps) o;
          StringBuilder samples = new StringBuilder();
          for (float pt : partials) samples.append(samples.length() > 0 ? "," : "").append("[").append(p.a(pt)).append(",").append(p.b(pt)).append(",").append(p.c(pt)).append(",").append(p.d(pt)).append("]");
          te.append(te.length() > 0 ? "," : "").append("[").append(p.c - ox).append(",").append(p.d - oy).append(",").append(p.e - oz).append(",").append(aji.b(p.a())).append(",").append(p.p()).append(",").append(p.c()).append(",").append(p.b() ? 1 : 0).append(",").append(p.d() ? 1 : 0).append(",").append(field(aps.class, "m").getFloat(p)).append(",").append(field(aps.class, "n").getFloat(p)).append(",[").append(samples).append("]]");
          float prog = field(aps.class, "m").getFloat(p), arg = p.b() ? 1.0f - prog : prog - 1.0f;
          azt box = ((apr) ajn.M).a((ahb) w, p.c, p.d, p.e, p.a(), arg, p.c());
          bx.append(bx.length() > 0 ? "," : "").append(box == null ? "null" : "[" + (box.a - ox) + "," + (box.b - oy) + "," + (box.c - oz) + "," + (box.d - ox) + "," + (box.e - oy) + "," + (box.f - oz) + "]");
        }
        tes.append(t > 1 ? "," : "").append("[").append(te).append("]");
        boxes.append(t > 1 ? "," : "").append("[").append(bx).append("]");
        StringBuilder ec = new StringBuilder();
        for (Object[] o : w.ents) { double[] b = (double[]) o[1]; ec.append(ec.length() > 0 ? "," : "").append("[").append(((Ent) o[0]).label).append(",").append(b[0] - ox).append(",").append(b[1] - oy).append(",").append(b[2] - oz).append("]"); }
        cellsOut.append(t > 1 ? "," : "").append("[").append(ec).append("]");
      }
      System.out.println("{\"name\":" + q(name) + ",\"te\":[" + tes + "],\"pushBoxes\":[" + boxes + "],\"entities\":[" + cellsOut + "],\"moves\":[" + String.join(",", moves) + "],\"sounds\":[" + String.join(",", w.sounds) + "]}");
    }
  }
}
