import java.lang.reflect.Field;
import java.util.*;

// Batch 52 (trackerflush): the REAL EntityTracker (mn) with its one HashSet<EntityTrackerEntry>, driven the way WorldServer drives it. Real entities of five classes are added in loadedEntityList
// order through the real mn.a(sa) (the instanceof table picks range and frequency): chickens (wg), items (xk), arrows (zc), snowballs (zj), experience orbs (sq) and an EntityPlayerMP stand-in (mw
// without its constructor, a recording NetHandler). Every tick runs a World.updateEntities stand-in over the entity list: the entity's scripted position is set at its index, an entity that dies
// this tick is removed at its index through the real EntityTracker.untrackEntity (mn.b(sa) -> my.a() -> EntityPlayerMP.func_152339_d, which queues the id in destroyedItemsNetCache), and the
// player's slot in the list runs the first thing EntityPlayerMP.onUpdate does (mw.h, bytecode-read at offsets 74-179): send the queued ids in one S13. Then the real mn.a() runs
// (updateTrackedEntities: every entry's sendLocationToAllClients in HashSet order, then the second loop of a flagged player) and its packets follow. One JSON object per line.
// Executed: mn, my, the entity and packet classes, java.util.HashSet. Bytecode-read stand-ins: the loadedEntityList loop (ahb.h, removal at the dead entity's own index) and the player's flush.
public class TrackerJointProbe {
  static sun.misc.Unsafe U;
  static ChickenProbe.World server;
  static TrackerProbe.PMP angler;
  static String tag = null; // "b53tj" on the batch 53 cases (the batch 52 cases carry none, so their records stay as they were)
  static boolean hangs(String k) { return k.equals("painting") || k.equals("frame") || k.equals("knot"); }
  // Batch 54 (b54rt): kinds whose scripted motion rides in the S12 like an item's (a rocket, a falling block, primed TNT, a thrown potion); they keep yaw 0
  static boolean drifts(String k) { return k.equals("firework") || k.equals("falling") || k.equals("tnt") || k.equals("potion"); }
  // kinds whose scripted motion rides in the S12 and whose yaw turns with the tick (the batch 52 kinds keep their own rules below)
  static boolean flies(String k) { return k.equals("boat") || k.startsWith("cart") || k.equals("eye") || k.equals("hook"); }
  static final List<Integer> pending = new ArrayList<>();
  static String num(double v) { return Double.toString(v); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }

  static class Item { String name, kind; sa e; double[] start, vel; int born, dies = -1; float yaw0, yawStep; boolean player; }

  static sa make(String kind, double[] s) throws Exception {
    switch (kind) {
      case "chicken": return new wg(server);
      case "item": return new xk(server, s[0], s[1], s[2], new add(ade.G, 1));
      case "arrow": return new zc(server, s[0], s[1], s[2]);
      case "snowball": return new zj(server, s[0], s[1], s[2]);
      case "orb": return new sq(server, s[0], s[1], s[2], 5);
      // Batch 53 (b53tj): vehicles, hanging entities, an eye of ender and a fish hook (the angler is the player stand-in; its id rides in the S0E data)
      case "boat": return new xi(server, s[0], s[1], s[2]);
      case "cart0": return xl.a(server, s[0], s[1], s[2], 0);
      case "cart1": return xl.a(server, s[0], s[1], s[2], 1);
      case "painting": return new tb(server, (int) s[0], (int) s[1], (int) s[2], (int) s[3], "Kebab");
      case "frame": return new st(server, (int) s[0], (int) s[1], (int) s[2], (int) s[3]);
      case "eye": return new zd(server, s[0], s[1], s[2]);
      case "hook": return new xe(server, s[0], s[1], s[2], angler);
      // Batch 54 (b54rt): a leash knot (su, tile in s[0..2]), a firework rocket (zf), a falling sand block (xj), primed TNT (xw) and a thrown potion (zo, damage 16388)
      case "knot": return new su(server, (int) s[0], (int) s[1], (int) s[2]);
      case "firework": return new zf(server, s[0], s[1], s[2], new add(ade.G, 1));
      case "falling": return new xj(server, s[0], s[1], s[2], aji.e(12), 0);
      case "tnt": return new xw(server, s[0], s[1], s[2], null);
      case "potion": return new zo(server, s[0], s[1], s[2], 16388);
      default: throw new IllegalStateException(kind);
    }
  }
  static Item item(String name, String kind, double[] start, double[] vel, int born, int dies, float yawStep) throws Exception {
    Item i = new Item(); i.name = name; i.kind = kind; i.start = start; i.vel = vel; i.born = born; i.dies = dies; i.yawStep = yawStep;
    return i;
  }
  static String kindOf(Object p) {
    if (p instanceof fz || p instanceof fw || p instanceof fx || p instanceof ga) return "spawn"; // ga: S10SpawnPainting
    if (p instanceof hg) return "move";
    if (p instanceof hh) return "moveLook";
    if (p instanceof hi) return "look";
    if (p instanceof ik) return "teleport";
    if (p instanceof hy) return "velocity";
    if (p instanceof ht) return "head";
    if (p instanceof hw) return "meta";
    if (p instanceof gt) return "status";
    return p.getClass().getName();
  }
  static int idOf(Object p) throws Exception { return MobMoveProbe.field(p.getClass(), "a").getInt(p); }
  static String ints(Object p) throws Exception {
    // the packet's own int/byte fields after the id (positions in 1/32, motion in 1/8000, angles), in declaration order
    StringBuilder b = new StringBuilder();
    boolean first = true;
    for (Field f : p.getClass().getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      Class<?> t = f.getType();
      if (t != int.class && t != byte.class) continue;
      f.setAccessible(true);
      if (first) { first = false; continue; } // the id
      b.append(',').append(f.get(p));
    }
    return b.toString();
  }

  static String run(String name, long counterStart, int ticks, Item[] script, int playerAt) throws Exception {
    server = (ChickenProbe.World) TrackerItemsProbe.world(TrackerItemsProbe.SW.class, false);
    Field counter = null; for (Class<?> c = sa.class; counter == null; c = c.getSuperclass()) try { counter = c.getDeclaredField("b"); } catch (NoSuchFieldException x) {}
    counter.setAccessible(true); counter.setInt(null, (int) counterStart);
    TrackerProbe.queueDestroy = true; TrackerProbe.clientMode = false; TrackerProbe.chunkLoaded = true;
    TrackerProbe.NH net = (TrackerProbe.NH) U.allocateInstance(TrackerProbe.NH.class);
    TrackerProbe.TW tw = (TrackerProbe.TW) U.allocateInstance(TrackerProbe.TW.class); tw.mq = (TrackerProbe.MQ) U.allocateInstance(TrackerProbe.MQ.class);
    TrackerProbe.PMP p = (TrackerProbe.PMP) U.allocateInstance(TrackerProbe.PMP.class); p.world = tw; p.a = net;
    MobMoveProbe.field(mw.class, "f").set(p, new ArrayList<>());
    MobMoveProbe.field(sa.class, "af").set(p, new te(p));
    MobMoveProbe.field(sa.class, "as").set(p, se.b);
    MobMoveProbe.field(sa.class, "o").set(p, tw);
    TrackerProbe.set(p, "s", 0.5); TrackerProbe.set(p, "t", 0.0); TrackerProbe.set(p, "u", 0.5);
    TrackerProbe.watchX = 0; TrackerProbe.watchZ = 0; TrackerProbe.watchRadius = 10; TrackerProbe.watching = true;
    angler = p;
    List<Object> players = new ArrayList<>(); // mt.h: the player joins it at its own place in the list (below)
    // the world's player list (mt.h = ahb.playerEntities) and the real EntityTracker: mn's constructor needs a MinecraftServer, so the object is allocated and its four fields set
    MobMoveProbe.field(ahb.class, "h").set(tw, players);
    mn tracker = (mn) U.allocateInstance(mn.class);
    MobMoveProbe.field(mn.class, "b").set(tracker, tw);
    MobMoveProbe.field(mn.class, "c").set(tracker, new HashSet<my>());
    MobMoveProbe.field(mn.class, "d").set(tracker, new pz());
    MobMoveProbe.field(mn.class, "e").setInt(tracker, 144);
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear(); pending.clear();
    List<Item> list = new ArrayList<>(); // loadedEntityList
    StringBuilder ids = new StringBuilder("{"), ticks_ = new StringBuilder("[");
    int[] pid = {0};
    // the entities and the player take their ids in list order (the Entity constructor draws from the one counter), then every one is added to the tracker at once
    boolean firstId = true;
    List<Item> initial = new ArrayList<>();
    for (Item it : script) if (it.born == 0) initial.add(it);
    int idx = 0;
    StringBuilder setup = new StringBuilder("[");
    for (int k = 0; k <= initial.size(); k++) {
      if (k == playerAt) {
        Item pl = new Item(); pl.name = "player"; pl.kind = "player"; pl.player = true; pl.e = p;
        MobMoveProbe.field(sa.class, "c").setInt(p, counter.getInt(null)); counter.setInt(null, counter.getInt(null) + 1);
        list.add(pl); players.add(p); tracker.a((sa) p); // addEntityToTracker (the sa overload; a(mw) is another method)
        ids.append(firstId ? "" : ",").append("\"player\":" + p.y()); firstId = false;
        flushSent(setup, 0);
      }
      if (k == initial.size()) break;
      Item it = initial.get(k);
      it.e = make(it.kind, it.start); position(it, 0);
      list.add(it); tracker.a(it.e);
      ids.append(firstId ? "" : ",").append("\"" + it.name + "\":" + it.e.y()); firstId = false;
      flushSent(setup, 0);
    }
    ids.append("}");
    StringBuilder out = new StringBuilder("{\"case\":\"" + name + "\"" + (tag != null ? ",\"tag\":\"" + tag + "\"" : "") + ",\"ids\":" + ids + ",\"setup\":" + setup + "],\"ticks\":[");
    for (int t = 1; t <= ticks; t++) {
      StringBuilder ev = new StringBuilder("[");
      // World.updateEntities: the loop over loadedEntityList by index
      for (int i = 0; i < list.size(); i++) {
        Item it = list.get(i);
        if (it.player) { // EntityPlayerMP.onUpdate: the queued destroys leave in one S13 (up to 127 ids)
          if (!pending.isEmpty()) {
            for (Integer id : pending) ev.append(ev.length() > 1 ? "," : "").append("[\"destroy\"," + id + "]");
            pending.clear();
          }
          continue;
        }
        position(it, t);
        if (it.dies == t) { // Entity.setDead, then World.updateEntities removes it at its own index (onEntityRemoved -> EntityTracker.untrackEntity)
          tracker.b(it.e);
          list.remove(i--);
          for (Object q : TrackerProbe.queue) if (q instanceof Integer) pending.add((Integer) q);
          TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
        }
      }
      // entities spawned this tick join the end of the list (World.spawnEntityInWorld -> EntityTracker.addEntityToTracker: updatePlayerList sends the spawn packets at once)
      for (Item it : script) if (it.born == t) {
        it.e = make(it.kind, it.start); position(it, t); list.add(it); tracker.a(it.e);
        ids.setLength(ids.length() - 1); ids.append(",\"" + it.name + "\":" + it.e.y() + "}");
        flushTo(ev);
      }
      tracker.a(); // EntityTracker.updateTrackedEntities
      flushTo(ev);
      out.append(t > 1 ? "," : "").append("[" + t + "," + ev + "]]");
    }
    out.append("],\"inputs\":" + inputs(script, ticks) + ",\"ids2\":" + ids + "}");
    return out.toString();
  }
  static void flushSent(StringBuilder setup, int t) throws Exception {
    StringBuilder ev = new StringBuilder("[");
    flushTo(ev);
    if (ev.length() > 1) setup.append(setup.length() > 1 ? "," : "").append(ev).append("]");
  }
  static void flushTo(StringBuilder ev) throws Exception {
    for (Object q : TrackerProbe.queue) {
      if (q instanceof Integer) { pending.add((Integer) q); continue; }
      ev.append(ev.length() > 1 ? "," : "").append("[\"" + kindOf(q) + "\"," + idOf(q) + ints(q) + "]");
    }
    TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
  }
  // the scripted state of an entity at tick t: position, motion, angles
  static void position(Item it, int t) throws Exception {
    sa e = it.e;
    if (hangs(it.kind)) { TrackerProbe.chunk(e); return; } // paintings and frames never move: their tile and box come from the constructor
    double x = it.start[0] + it.vel[0] * t, y = it.start[1] + it.vel[1] * t, z = it.start[2] + it.vel[2] * (double) t;
    if (it.kind.equals("arrow")) y = it.start[1] + it.vel[1] * t - 0.002 * t * t;
    TrackerProbe.set(e, "s", x); TrackerProbe.set(e, "t", y); TrackerProbe.set(e, "u", z);
    MobMoveProbe.set(e, "v", 0.0); MobMoveProbe.set(e, "w", 0.0); MobMoveProbe.set(e, "x", 0.0); MobMoveProbe.field(sa.class, "H").setBoolean(e, false);
    if (it.kind.equals("item") || it.kind.equals("snowball") || it.kind.equals("orb") || flies(it.kind) || drifts(it.kind)) {
      MobMoveProbe.set(e, "v", it.vel[0] * (1 + (t % 5) * 0.1)); MobMoveProbe.set(e, "w", it.vel[1]); MobMoveProbe.set(e, "x", it.vel[2]);
    }
    float yaw = it.kind.equals("chicken") || flies(it.kind) ? (float) (it.yawStep * t) : it.kind.equals("arrow") || it.kind.equals("snowball") ? 90f : 0f;
    MobMoveProbe.field(sa.class, "y").setFloat(e, yaw);
    MobMoveProbe.field(sa.class, "z").setFloat(e, it.kind.equals("arrow") ? -10f : 0f);
    if (e instanceof sv) ((sv) e).e(yaw);
    TrackerProbe.chunk(e);
    MobMoveProbe.field(sa.class, "al").setBoolean(e, false);
  }
  static String inputs(Item[] script, int ticks) throws Exception {
    StringBuilder b = new StringBuilder("{");
    boolean f = true;
    for (Item it : script) {
      StringBuilder r = new StringBuilder("[");
      for (int t = 0; t <= ticks; t++) {
        // the states are recomputed from the script on a throwaway entity-free path: position() reads only the script, so replay the same arithmetic
        double x = it.start[0] + it.vel[0] * t, y = it.start[1] + it.vel[1] * t, z = it.start[2] + it.vel[2] * (double) t;
        if (it.kind.equals("arrow")) y = it.start[1] + it.vel[1] * t - 0.002 * t * t;
        boolean motion = it.kind.equals("item") || it.kind.equals("snowball") || it.kind.equals("orb") || flies(it.kind) || drifts(it.kind);
        double vx = motion ? it.vel[0] * (1 + (t % 5) * 0.1) : 0, vy = motion ? it.vel[1] : 0, vz = motion ? it.vel[2] : 0;
        float yaw = it.kind.equals("chicken") || flies(it.kind) ? (float) (it.yawStep * t) : it.kind.equals("arrow") || it.kind.equals("snowball") ? 90f : 0f;
        r.append(t > 0 ? "," : "").append("[" + num(x) + "," + num(y) + "," + num(z) + "," + num(vx) + "," + num(vy) + "," + num(vz) + "," + yaw + "," + (it.kind.equals("arrow") ? -10 : 0) + "]");
      }
      b.append(f ? "" : ",").append("\"" + it.name + "\":{\"kind\":\"" + it.kind + "\",\"born\":" + it.born + ",\"dies\":" + it.dies + ",\"rows\":" + r + "]" + (hangs(it.kind) ? ",\"dir\":" + (int) it.start[3] : "") + "}"); f = false;
    }
    return b + "}";
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    U = MobMoveProbe.unsafe();
    TrackerItemsProbe.U = U;
    MobMoveProbe.ProbeWorld.exact = true;
    double[] z = {0, 0, 0};
    // The player sits in the middle of the list (slot 8 of 12): the entities that die before it flush in their own tick, those after it one tick later
    Item[] mix = {
      item("c1", "chicken", new double[]{2.5, 0, 3.5}, new double[]{0.09, 0, 0.01}, 0, -1, 2.5f),
      item("i1", "item", new double[]{4.5, 1.125, 2.5}, new double[]{0.05, 0, 0.02}, 0, 20, 0),
      item("c2", "chicken", new double[]{5.0, 0, 1.0}, new double[]{-0.07, 0, 0.03}, 0, -1, 3.0f),
      item("a1", "arrow", new double[]{1.5, 2.0, 1.5}, new double[]{0.4, -0.05, 0.1}, 0, 31, 0),
      item("i2", "item", new double[]{3.5, 1.125, 5.5}, new double[]{-0.04, 0, -0.03}, 0, -1, 0),
      item("c3", "chicken", new double[]{6.5, 0, 6.5}, new double[]{0.0, 0, -0.1}, 0, 41, 1.5f),
      item("s1", "snowball", new double[]{2.5, 1.5, 2.5}, new double[]{0.3, 0.05, -0.2}, 0, 25, 0),
      item("o1", "orb", new double[]{5.5, 1.0, 5.5}, new double[]{0.02, 0, 0.02}, 0, -1, 0),
      item("c4", "chicken", new double[]{7.5, 0, 2.5}, new double[]{-0.08, 0, 0.02}, 0, 22, 4.0f),
      item("i4", "item", new double[]{1.5, 1.125, 7.5}, new double[]{0.03, 0, -0.05}, 0, 35, 0),
      item("c5", "chicken", new double[]{3.5, 0, 3.0}, new double[]{0.1, 0, 0.05}, 12, -1, 2.0f),
      item("i5", "item", new double[]{4.0, 1.125, 4.0}, new double[]{-0.06, 0, 0.04}, 12, -1, 0),
      item("a2", "arrow", new double[]{2.5, 1.5, 6.5}, new double[]{0.35, -0.04, -0.1}, 18, 44, 0),
      item("c6", "chicken", new double[]{6.0, 0, 3.5}, new double[]{-0.09, 0, -0.02}, 30, 38, 1.0f),
    };
    System.out.println(run("mix", 1, 60, mix, 8));
    // the same entities with ids in the 16-bit fold range and the player first / last in the list: the flush then lands one tick late for everything (first) or in the same tick for everything (last)
    System.out.println(run("playerFirst", 65530, 60, mix, 0));
    System.out.println(run("playerLast", 65530, 60, mix, 10));
    // Batch 53: the kinds the batch 52 record left out. Boats, minecarts (empty and chest), paintings, item frames, an eye of ender and a fish hook among chickens and items, the
    // player mid-list; the hanging entities and the hook are removed before and after the player's slot, entities of every kind are born during the run. The hanging tile is in start[0..2], its direction in start[3].
    tag = "b53tj";
    Item[] veh = {
      item("c1", "chicken", new double[]{2.5, 0, 3.5}, new double[]{0.09, 0, 0.01}, 0, -1, 2.5f),
      item("b1", "boat", new double[]{5.5, 0.0, 5.5}, new double[]{0.12, 0, 0.06}, 0, 33, 3.0f),
      item("p1", "painting", new double[]{4, 2, 6, 1}, z, 0, 40, 0),
      item("k1", "cart0", new double[]{3.5, 0.35, 2.5}, new double[]{0.1, 0, -0.04}, 0, -1, 2.0f),
      item("e1", "eye", new double[]{1.5, 3.0, 1.5}, new double[]{0.25, 0.05, 0.3}, 0, 26, 5.0f),
      item("f1", "frame", new double[]{6, 2, 3, 2}, z, 0, -1, 0),
      item("i1", "item", new double[]{4.5, 1.125, 2.5}, new double[]{0.05, 0, 0.02}, 0, 20, 0),
      item("k2", "cart1", new double[]{6.5, 0.35, 6.5}, new double[]{-0.1, 0, 0.05}, 0, 48, 1.5f),
      item("p2", "painting", new double[]{2, 3, 7, 3}, z, 0, -1, 0),
      item("b2", "boat", new double[]{1.5, 0.0, 6.5}, new double[]{0.07, 0, -0.1}, 9, 55, 4.0f),
      item("h1", "hook", new double[]{3.0, 1.0, 3.0}, new double[]{0.04, 0, 0.03}, 14, 45, 0.5f),
      item("f2", "frame", new double[]{5, 4, 1, 0}, z, 21, 50, 0),
      item("p3", "painting", new double[]{7, 2, 5, 2}, z, 24, -1, 0),
      item("e2", "eye", new double[]{2.5, 2.0, 4.5}, new double[]{-0.2, 0.1, 0.15}, 30, 52, 2.0f),
      item("k3", "cart0", new double[]{4.5, 0.35, 4.5}, new double[]{0.08, 0, 0.08}, 36, -1, 3.5f),
    };
    System.out.println(run("vehicles", 1, 60, veh, 6));
    // ids in the 16-bit fold range, the player last: the entities loaded with the chunks come first, the player joins and is sent the lot in the set's order
    System.out.println(run("vehiclesLast", 65530, 60, veh, 9));
    // Batch 54: leash knots, firework rockets, falling blocks, primed TNT and thrown potions among chickens, an item and a painting, the player mid-list (and last in the 16-bit fold range).
    // The knot's tile is in start[0..2]; entities of every kind die before and after the player's slot and are born during the run.
    tag = "b54rt";
    Item[] ext = {
      item("c1", "chicken", new double[]{2.5, 0, 3.5}, new double[]{0.09, 0, 0.01}, 0, -1, 2.5f),
      item("n1", "knot", new double[]{4, 3, 6, 0}, z, 0, 36, 0),
      item("w1", "firework", new double[]{3.5, 2.0, 2.5}, new double[]{0.04, 0.2, 0.03}, 0, 28, 0),
      item("t1", "tnt", new double[]{5.5, 1.0, 4.5}, new double[]{0.03, 0, -0.02}, 0, 44, 0),
      item("g1", "falling", new double[]{1.5, 3.0, 5.5}, new double[]{0.0, -0.05, 0.02}, 0, -1, 0),
      item("p1", "painting", new double[]{6, 2, 3, 2}, z, 0, -1, 0),
      item("v1", "potion", new double[]{2.5, 2.5, 1.5}, new double[]{0.2, 0.1, 0.15}, 0, 22, 0),
      item("n2", "knot", new double[]{7, 3, 2, 0}, z, 0, -1, 0),
      item("i1", "item", new double[]{4.5, 1.125, 2.5}, new double[]{0.05, 0, 0.02}, 0, 20, 0),
      item("t2", "tnt", new double[]{6.5, 1.0, 6.5}, new double[]{-0.04, 0, 0.03}, 9, 40, 0),
      item("w2", "firework", new double[]{2.0, 1.5, 6.0}, new double[]{-0.03, 0.15, -0.02}, 13, 50, 0),
      item("g2", "falling", new double[]{5.5, 4.0, 1.5}, new double[]{0.02, -0.04, 0.0}, 17, -1, 0),
      item("v2", "potion", new double[]{3.5, 3.0, 5.5}, new double[]{-0.15, 0.05, -0.1}, 21, 47, 0),
      item("n3", "knot", new double[]{1, 4, 4, 0}, z, 26, 54, 0),
      item("t3", "tnt", new double[]{4.0, 1.0, 4.0}, new double[]{0.05, 0, 0.05}, 31, -1, 0),
      item("w3", "firework", new double[]{5.0, 2.5, 3.0}, new double[]{0.06, 0.1, -0.05}, 37, 58, 0),
    };
    System.out.println(run("extras", 1, 60, ext, 7));
    System.out.println(run("extrasLast", 65530, 60, ext, 8));
  }
}
