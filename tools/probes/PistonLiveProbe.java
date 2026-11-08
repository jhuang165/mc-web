// Native evidence for src/piston-live.js: TileEntityPiston.func_145863_a entity pushing (aps.a(float, float) via
// updateEntity), the TileEntityPiston render offsets (aps.a/b/c/d(partialTicks), used by TileEntityRendererPiston bmq)
// and BlockPistonMoving.func_149964_a (apr.a(World, x, y, z, Block, progress, facing), the push box), driven through the
// piston scenario world of tools/probes/PistonProbe.java (real World, Chunk, BlockPistonBase, BlockPistonExtension,
// BlockPistonMoving, TileEntityPiston, real tile-entity loop). Scripted entities are EntityItem subclasses allocated without
// a constructor whose moveEntity (sa.d(double, double, double)) records the requested delta and shifts their scripted box,
// so the native getEntitiesWithinAABBExcludingEntity intersection and every func_145863_a move are observable.
// Per tick (same order as PistonProbe): events, world time + 1, tickUpdates, sendQueuedBlockEvents, World.updateEntities.
// stdin per scenario: "scenario name ox oy oz dx dy dz ticks seed", "grid id[:meta],...", then "event tick op args" lines
// (place x y z id meta | air x y z | use x y z | entity x y z label minx miny minz maxx maxy maxz | live x y z label kind vx vy vz
// | watch x y z, region-relative). Real entities ("live": EntityPig, EntityMinecartEmpty, EntityBoat, EntityItem, EntityTNTPrimed,
// EntityFallingBlock, EntityXPOrb) give per-tick
// [label, posX, minY, posZ, motionX, motionY, motionZ, onGround, isCollidedHorizontally, fallDistance] and their move deltas;
// watched cells [x, y, z, id, meta] after every tick (a detector rail's powered bit).
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
  // Real entities (constructed in the probe world): their own Entity.moveEntity runs (collision with the World's block boxes,
  // BlockPistonMoving.getCollisionBoundingBoxFromPool, other entities' boxes, step, flags, fall state, block collisions); the
  // subclasses only record the requested delta first. No onUpdate runs (the probe World has no loaded entities).
  interface Live { int label(); }
  static List<String> liveMoves; static long liveTick;
  static void rec(int label, double x, double y, double z) { liveMoves.add("[" + liveTick + "," + label + "," + x + "," + y + "," + z + "]"); }
  public static class Pig extends wo implements Live { int label; public Pig(ahb w) { super(w); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  public static class Cart extends xm implements Live { int label; public Cart(ahb w, double x, double y, double z) { super(w, x, y, z); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  // Batch 25: the entities that have no moveEntity override and no tick here (EntityItem, EntityTNTPrimed, EntityFallingBlock,
  // EntityXPOrb), recording the requested delta like the others.
  public static class Item extends xk implements Live { int label; public Item(ahb w, double x, double y, double z) { super(w, x, y, z, new add(aji.e(1))); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  public static class Tnt extends xw implements Live { int label; public Tnt(ahb w, double x, double y, double z) { super(w, x, y, z, null); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  public static class Falling extends xj implements Live { int label; public Falling(ahb w, double x, double y, double z) { super(w, x, y, z, aji.e(12)); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  public static class Orb extends sq implements Live { int label; public Orb(ahb w, double x, double y, double z) { super(w, x, y, z, 3); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
  public static class Boat extends xi implements Live { int label; public Boat(ahb w, double x, double y, double z) { super(w, x, y, z); } public int label() { return label; } public void d(double x, double y, double z) { rec(label, x, y, z); super.d(x, y, z); } }
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
      field(ahb.class, "L").set(w, new ArrayList()); // World.collidingBoundingBoxes scratch list
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      List<String> moves = new ArrayList<>(); liveMoves = new ArrayList<>();
      StringBuilder liveOut = new StringBuilder(), watchOut = new StringBuilder();
      List<int[]> watch = new ArrayList<>();
      StringBuilder tes = new StringBuilder(), boxes = new StringBuilder(), cellsOut = new StringBuilder(), collOut = new StringBuilder();
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
            case "live": { // live x y z label kind vx vy vz: kind 0 pig, 1 empty minecart, 2 boat, 3 item, 4 item with noClip set, 5 primed TNT, 6 falling sand, 7 XP orb, at feet (x+0.5, y, z+0.5)
              int label = Integer.parseInt(e[6]), kind = Integer.parseInt(e[7]);
              double px = x + 0.5, py = y, pz = z + 0.5;
              sa ent;
              if (kind == 0) { Pig g = new Pig(w); g.label = label; g.b(px, py, pz); ent = g; }
              else if (kind == 1) { Cart c = new Cart(w, px, py, pz); c.b(px, py + c.L, pz); c.label = label; ent = c; } // EntityMinecart(w, x, y, z) takes posY; feet + yOffset
              else if (kind == 2) { Boat b = new Boat(w, px, py, pz); b.label = label; ent = b; }
              else if (kind == 3 || kind == 4) { Item i = new Item(w, px, py, pz); i.b(px, py + i.L, pz); i.label = label; i.X = kind == 4; ent = i; } // noClip (sa.X) as EntityItem.onUpdate's pushOutOfBlocks leaves it
              else if (kind == 5) { Tnt n = new Tnt(w, px, py, pz); n.b(px, py + n.L, pz); n.label = label; ent = n; }
              else if (kind == 6) { Falling f = new Falling(w, px, py, pz); f.b(px, py + f.L, pz); f.label = label; ent = f; }
              else { Orb o = new Orb(w, px, py, pz); o.b(px, py + o.L, pz); o.label = label; ent = o; }
              ent.v = Double.parseDouble(e[8]); ent.w = Double.parseDouble(e[9]); ent.x = Double.parseDouble(e[10]);
              ent.D = true;
              w.ents.add(new Object[] {ent, null, new int[] {x, y, z}});
              break;
            }
            case "watch": watch.add(new int[] {x, y, z}); break; // watch x y z: the cell's block id and metadata after every tick
            default: throw new IllegalArgumentException(op);
          }
        }
        for (Object[] o : w.ents) if (o[0] instanceof Ent) ((Ent) o[0]).tick = t;
        liveTick = t;
        w.time++;
        w.add("T");
        w.tickUpdates();
        w.sendQueuedBlockEvents();
        w.h();
        StringBuilder te = new StringBuilder(), bx = new StringBuilder(), cl = new StringBuilder();
        for (Object o : (List) field(ahb.class, "g").get(w)) if (o instanceof aps) {
          aps p = (aps) o;
          StringBuilder samples = new StringBuilder();
          for (float pt : partials) samples.append(samples.length() > 0 ? "," : "").append("[").append(p.a(pt)).append(",").append(p.b(pt)).append(",").append(p.c(pt)).append(",").append(p.d(pt)).append("]");
          te.append(te.length() > 0 ? "," : "").append("[").append(p.c - ox).append(",").append(p.d - oy).append(",").append(p.e - oz).append(",").append(aji.b(p.a())).append(",").append(p.p()).append(",").append(p.c()).append(",").append(p.b() ? 1 : 0).append(",").append(p.d() ? 1 : 0).append(",").append(field(aps.class, "m").getFloat(p)).append(",").append(field(aps.class, "n").getFloat(p)).append(",[").append(samples).append("]]");
          // World.getCollidingBoundingBoxes(null, the tile's cell inset by 0.001): only the moving block's own box can intersect it. The mover is an unconstructed Ent (World asks the other entities h(mover)).
          w.blocksOnly = true;
          List<azt> hits = w.a((sa) PistonProbe.unsafe.allocateInstance(Ent.class), azt.a(p.c + 0.001, p.d + 0.001, p.e + 0.001, p.c + 0.999, p.d + 0.999, p.e + 0.999));
          w.blocksOnly = false;
          StringBuilder hb = new StringBuilder();
          for (azt hh : hits) hb.append(hb.length() > 0 ? "," : "").append("[").append(hh.a - ox).append(",").append(hh.b - oy).append(",").append(hh.c - oz).append(",").append(hh.d - ox).append(",").append(hh.e - oy).append(",").append(hh.f - oz).append("]");
          cl.append(cl.length() > 0 ? "," : "").append("[").append(hb).append("]");
          float prog = field(aps.class, "m").getFloat(p), arg = p.b() ? 1.0f - prog : prog - 1.0f;
          azt box = ((apr) ajn.M).a((ahb) w, p.c, p.d, p.e, p.a(), arg, p.c());
          bx.append(bx.length() > 0 ? "," : "").append(box == null ? "null" : "[" + (box.a - ox) + "," + (box.b - oy) + "," + (box.c - oz) + "," + (box.d - ox) + "," + (box.e - oy) + "," + (box.f - oz) + "]");
        }
        tes.append(t > 1 ? "," : "").append("[").append(te).append("]");
        boxes.append(t > 1 ? "," : "").append("[").append(bx).append("]");
        StringBuilder ec = new StringBuilder();
        StringBuilder lv = new StringBuilder();
        for (Object[] o : w.ents) if (o[0] instanceof Live) {
          sa a = (sa) o[0];
          lv.append(lv.length() > 0 ? "," : "").append("[").append(((Live) a).label()).append(",").append(a.s - ox).append(",").append(a.C.b - oy).append(",").append(a.u - oz).append(",").append(a.v).append(",").append(a.w).append(",").append(a.x).append(",").append(a.D ? 1 : 0).append(",").append(a.E ? 1 : 0).append(",").append(a.R).append("]");
        }
        liveOut.append(t > 1 ? "," : "").append("[").append(lv).append("]");
        StringBuilder wo = new StringBuilder();
        for (int[] c : watch) wo.append(wo.length() > 0 ? "," : "").append("[").append(c[0] - ox).append(",").append(c[1] - oy).append(",").append(c[2] - oz).append(",").append(aji.b(w.a(c[0], c[1], c[2]))).append(",").append(w.e(c[0], c[1], c[2])).append("]");
        watchOut.append(t > 1 ? "," : "").append("[").append(wo).append("]");
        for (Object[] o : w.ents) if (o[0] instanceof Ent) { double[] b = (double[]) o[1]; ec.append(ec.length() > 0 ? "," : "").append("[").append(((Ent) o[0]).label).append(",").append(b[0] - ox).append(",").append(b[1] - oy).append(",").append(b[2] - oz).append("]"); }
        collOut.append(t > 1 ? "," : "").append("[").append(cl).append("]");
        cellsOut.append(t > 1 ? "," : "").append("[").append(ec).append("]");
      }
      System.out.println("{\"name\":" + q(name) + ",\"te\":[" + tes + "],\"pushBoxes\":[" + boxes + "],\"collide\":[" + collOut + "],\"entities\":[" + cellsOut + "],\"moves\":[" + String.join(",", moves) + "],\"live\":[" + liveOut + "],\"liveMoves\":[" + String.join(",", liveMoves) + "],\"watch\":[" + watchOut + "],\"sounds\":[" + String.join(",", w.sounds) + "]}");
    }
  }
}
