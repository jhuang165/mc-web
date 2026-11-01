import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// Records the unchanged 1.7.10 server chunk lifecycle: ChunkProviderServer (ms) load, provide, populate,
// unload queue, save cadence; PlayerManager (mq) and PlayerInstance (mr) watcher squares, the spiral
// send queue, view-distance changes and inhabited time; WorldServer (mt) saveAllChunks. The tick
// order is WorldServer.tick's: chunkProvider.unloadQueuedChunks, totalWorldTime + 1, PlayerManager
// update. The prepare op is MinecraftServer.initialWorldChunkLoad's loop. A stub IChunkLoader stores
// TerrainPopulated/LightPopulated/InhabitedTime/hasEntities; a stub generator logs provide, populate
// and recreateStructures. WorldServer, PlayerManager and players are allocated without constructors;
// the provider has no sky, so Chunk.func_150809_p skips lighting. Also records the iteration order
// of Collections.newSetFromMap(new ConcurrentHashMap()) (the unload queue) over seeded op lists.
public class ChunkProviderProbe {
  static sun.misc.Unsafe unsafe;
  static List<String> events = new ArrayList<>();

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static void setIn(Class<?> c, Object o, String name, Object v) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); f.set(o, v); }
  static Object getIn(Class<?> c, Object o, String name) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(o); }

  public static class WS extends mt {
    WS() { super(null, null, null, 0, null, null); } // never run
    protected void a() {} // saveLevel: level.dat is out of scope
  }
  public static class Provider extends aqq {
    boolean respawn = true;
    public boolean e() { return respawn; }
  }
  public static class C extends apx {
    C(ahb w, int x, int z) { super(w, x, z); }
    public void c() { events.add("+ " + g + " " + h); super.c(); }
    public void d() { events.add("- " + g + " " + h); super.d(); }
  }
  public static class Loader implements aqc {
    Map<Long, long[]> saved = new HashMap<>();
    public apx a(ahb w, int x, int z) {
      long[] s = saved.get(agu.a(x, z));
      events.add("L " + x + " " + z + " " + (s != null ? 1 : 0));
      if (s == null) return null;
      C c = new C(w, x, z);
      c.k = s[0] != 0; c.l = s[1] != 0; c.s = s[2]; c.o = s[3] != 0;
      return c;
    }
    public void a(ahb w, apx c) { events.add("S " + c.g + " " + c.h); saved.put(agu.a(c.g, c.h), new long[] {c.k ? 1 : 0, c.l ? 1 : 0, c.s, c.o ? 1 : 0}); }
    public void b(ahb w, apx c) { events.add("X " + c.g + " " + c.h); }
    public void a() { events.add("T"); }
    public void b() { events.add("E"); }
  }
  public static class Gen implements apu {
    ahb world;
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) { events.add("G " + x + " " + z); return new C(world, x, z); }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) { events.add("P " + x + " " + z); }
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return true; }
    public String f() { return "gen"; }
    public List a(sx t, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return 0; }
    public void e(int x, int z) { events.add("R " + x + " " + z); }
    public void c() {}
  }

  static WS world;
  static ms provider;
  static mq manager;
  static ays info;
  static Loader loader;
  static Map<Integer, mw> players = new HashMap<>();

  static void setup(boolean respawn, int view, int spawnX, int spawnZ) throws Exception {
    world = (WS) unsafe.allocateInstance(WS.class);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList<>()); }
    Provider p = new Provider();
    p.respawn = respawn; p.g = true; p.b = world;
    setIn(ahb.class, world, "t", p);
    info = (ays) unsafe.allocateInstance(ays.class);
    setIn(ays.class, info, "d", spawnX); setIn(ays.class, info, "e", 64); setIn(ays.class, info, "f", spawnZ);
    setIn(ays.class, info, "g", 0L);
    setIn(ahb.class, world, "x", info);
    loader = new Loader();
    Gen gen = new Gen();
    gen.world = world;
    provider = new ms(world, loader, gen);
    setIn(ahb.class, world, "v", provider);
    setIn(mt.class, world, "b", provider);
    manager = (mq) unsafe.allocateInstance(mq.class);
    setIn(mq.class, manager, "b", world);
    setIn(mq.class, manager, "c", new ArrayList<>());
    setIn(mq.class, manager, "d", new qd());
    setIn(mq.class, manager, "e", new ArrayList<>());
    setIn(mq.class, manager, "f", new ArrayList<>());
    setIn(mq.class, manager, "i", new int[][] {{1, 0}, {0, 1}, {-1, 0}, {0, -1}});
    setIn(mq.class, manager, "g", view);
    setIn(mt.class, world, "L", manager);
    players.clear();
    events.clear();
    previous = new String[4];
  }

  static long time() throws Exception { return (long) getIn(ays.class, info, "g"); }
  // Entity.equals compares entityId (sa.c), so every probe player gets its own.
  static mw player(int id, double x, double z) throws Exception {
    mw p = (mw) unsafe.allocateInstance(mw.class);
    setIn(sa.class, p, "c", id);
    setIn(mw.class, p, "f", new LinkedList<>());
    p.s = x; p.u = z;
    return p;
  }

  static String ints(List<Long> v) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < v.size(); i++) s.append(i > 0 ? "," : "").append(v.get(i));
    return s.append("]").toString();
  }
  static String str(List<String> v) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < v.size(); i++) s.append(i > 0 ? "," : "").append('"').append(v.get(i)).append('"');
    return s.append("]").toString();
  }

  static String[] previous = new String[4];

  @SuppressWarnings("unchecked")
  static String snapshot(String op) throws Exception {
    List<Long> loaded = new ArrayList<>();
    for (Object o : provider.a()) {
      apx c = (apx) o;
      loaded.add((long) c.g); loaded.add((long) c.h);
      loaded.add((long) ((c.k ? 1 : 0) | (c.l ? 2 : 0) | (c.n ? 4 : 0) | (c.o ? 8 : 0) | (c.d ? 16 : 0)));
      loaded.add(c.p); loaded.add(c.s);
    }
    List<Long> queue = new ArrayList<>();
    for (Object o : (Set<Long>) getIn(ms.class, provider, "c")) { long k = (Long) o; queue.add((long) (int) k); queue.add((long) (int) (k >> 32)); }
    List<Long> watchers = new ArrayList<>();
    for (Object o : (List<Object>) getIn(mq.class, manager, "f")) {
      agu c = (agu) getIn(mr.class, o, "c");
      watchers.add((long) c.a); watchers.add((long) c.b);
      watchers.add((long) ((List<Object>) getIn(mr.class, o, "b")).size());
      watchers.add((long) getIn(mr.class, o, "g"));
    }
    List<String> sends = new ArrayList<>();
    List<Integer> ids = new ArrayList<>(players.keySet());
    Collections.sort(ids);
    for (int id : ids) {
      List<Long> q = new ArrayList<>();
      for (Object o : players.get(id).f) { agu c = (agu) o; q.add((long) c.a); q.add((long) c.b); }
      sends.add(id + ":" + ints(q));
    }
    String[] now = {ints(loaded), ints(queue), ints(watchers), "{" + String.join(",", sends.stream().map(s -> "\"" + s.replaceFirst(":", "\":")).toList()) + "}"};
    for (int i = 0; i < 4; i++) { String v = now[i]; if (v.equals(previous[i])) now[i] = "null"; else previous[i] = v; } // null: unchanged
    String out = "{\"op\":" + op + ",\"time\":" + time() + ",\"events\":" + str(events) + ",\"loaded\":" + now[0]
      + ",\"queue\":" + now[1] + ",\"watchers\":" + now[2] + ",\"sends\":" + now[3]
      + ",\"players\":" + ((List<Object>) getIn(mq.class, manager, "c")).size() + ",\"radius\":" + getIn(mq.class, manager, "g") + "}";
    events.clear();
    return out;
  }

  static void tick() throws Exception {
    provider.d();
    setIn(ays.class, info, "g", time() + 1);
    manager.b();
  }

  // Op list: [name, args...]. Mirrors chunk-provider.test.js's replay.
  static void run(String name, boolean respawn, int view, int spawnX, int spawnZ, Object[][] ops) throws Exception {
    setup(respawn, view, spawnX, spawnZ);
    List<String> steps = new ArrayList<>();
    for (Object[] op : ops) {
      String kind = (String) op[0];
      StringBuilder js = new StringBuilder("[\"" + kind + "\"");
      for (int i = 1; i < op.length; i++) js.append(",").append(op[i]);
      js.append("]");
      switch (kind) {
        case "prepare": {
          r spawn = world.K();
          for (int k = -192; k <= 192; k += 16) for (int l = -192; l <= 192; l += 16) provider.c(spawn.a + k >> 4, spawn.c + l >> 4);
          break;
        }
        case "add": { mw p = player((Integer) op[1], ((Number) op[2]).doubleValue(), ((Number) op[3]).doubleValue()); players.put((Integer) op[1], p); manager.a(p); break; }
        case "move": { mw p = players.get(op[1]); p.s = ((Number) op[2]).doubleValue(); p.u = ((Number) op[3]).doubleValue(); manager.d(p); break; }
        case "remove": manager.c(players.remove(op[1])); break;
        case "view": manager.a((Integer) op[1]); break;
        case "tick": for (int i = 0; i < (Integer) op[1]; i++) tick(); break;
        case "save": world.a((Integer) op[1] != 0, null); break;
        case "unloadAll": provider.b(); break;
        case "queue": provider.b((Integer) op[1], (Integer) op[2]); break;
        case "load": provider.c((Integer) op[1], (Integer) op[2]); break;
        case "provide": {
          apx c = provider.d((Integer) op[1], (Integer) op[2]);
          events.add(c instanceof apw ? "empty" : "chunk " + c.g + " " + c.h);
          break;
        }
        case "loadOnRequest": provider.a = (Integer) op[1] != 0; break;
        case "modify": provider.d((Integer) op[1], (Integer) op[2]).e(); break;
        case "entities": provider.d((Integer) op[1], (Integer) op[2]).o = (Integer) op[3] != 0; break;
        case "saving": world.c = (Integer) op[1] != 0; break;
        case "spawnRespawn": ((Provider) world.t).respawn = (Integer) op[1] != 0; break;
        default: throw new IllegalArgumentException(kind);
      }
      steps.add(snapshot(js.toString()));
    }
    System.out.println("{\"kind\":\"scenario\",\"name\":\"" + name + "\",\"respawn\":" + respawn + ",\"view\":" + view + ",\"spawn\":[" + spawnX + "," + spawnZ + "],\"steps\":[" + String.join(",", steps) + "]}");
  }

  static Object[] o(Object... v) { return v; }

  // Long keys as ChunkCoordIntPair.chunkXZ2Int; op 0 add, 1 remove, 2 remove iterator().next().
  // Shapes: 0 a square of keys, 1 a few repeated hashes (x ^ z of 0, 32, 64: tree bins), 2 hashes
  // sharing their low six bits; 3 mostly random keys plus a cluster on x ^ z of 5, 69, 133 or 197,
  // so small tree bins split unevenly as the table grows.
  static void stress(String name, long seed, int count, int span, int shape) {
    Random r = new Random(seed);
    Set<Long> set = Collections.newSetFromMap(new ConcurrentHashMap<>());
    List<String> ops = new ArrayList<>(), orders = new ArrayList<>();
    List<Long> live = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      int roll = r.nextInt(10), op, x = 0, z = 0;
      if (roll < 6 || live.isEmpty()) {
        op = 0;
        if (shape == 1) { int d = r.nextInt(span) - span / 2; x = d; z = r.nextInt(4) == 0 ? d : (d ^ (r.nextInt(3) << 5)); }
        else if (shape == 3 && r.nextInt(10) < 3) { x = r.nextInt(span) - span / 2; z = x ^ (5 + (r.nextInt(4) << 6)); }
        else if (shape == 2) { x = r.nextInt(span) - span / 2; z = x ^ (r.nextInt(3) + (r.nextInt(16) << 6)); }
        else { x = r.nextInt(span) - span / 2; z = r.nextInt(span) - span / 2; }
        long k = agu.a(x, z);
        if (set.add(k)) live.add(k);
      } else if (roll < 8) {
        op = 1;
        long k = live.remove(r.nextInt(live.size()));
        x = (int) k; z = (int) (k >> 32);
        set.remove(k);
      } else {
        op = 2;
        Iterator<Long> it = set.iterator();
        long k = it.next();
        x = (int) k; z = (int) (k >> 32);
        set.remove(k);
        live.remove(Long.valueOf(k));
      }
      ops.add("[" + op + "," + x + "," + z + "]");
      if (i % 250 == 249 || i == count - 1) {
        List<Long> order = new ArrayList<>();
        for (long k : set) { order.add((long) (int) k); order.add((long) (int) (k >> 32)); }
        orders.add("[" + i + "," + ints(order) + "]");
      }
    }
    System.out.println("{\"kind\":\"set\",\"name\":\"" + name + "\",\"ops\":[" + String.join(",", ops) + "],\"orders\":[" + String.join(",", orders) + "]}");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);

    stress("wide", 101, 3000, 400, 0);
    stress("square", 102, 3000, 40, 0);
    stress("collide", 103, 4000, 600, 1);
    stress("split", 104, 4000, 2000, 2);
    for (int i = 0; i < 6; i++) stress("cluster" + i, 105 + i, 1500, 2000, 3);

    // Spawn preparation, then a player walks away from spawn and the far chunks drain 100 per tick.
    run("spawn", true, 10, -180, 263, new Object[][] {
      o("prepare"), o("add", 1, -180.5, 263.5), o("tick", 1), o("move", 1, 620.5, 263.5), o("tick", 1), o("tick", 1), o("tick", 3),
      o("save", 0), o("save", 1), o("tick", 1), o("move", 1, -180.5, 263.5), o("tick", 2),
    });
    // Walking: each move of 8+ blocks shifts the watcher square; the send queue re-spirals.
    List<Object[]> walk = new ArrayList<>();
    walk.add(o("add", 1, 8.5, 8.5));
    for (int i = 1; i <= 24; i++) { walk.add(o("move", 1, 8.5 + i * 3, 8.5 + (i > 12 ? (i - 12) * 5 : 0))); walk.add(o("tick", 1)); }
    walk.add(o("move", 1, -3.2, -40.7)); walk.add(o("tick", 1));
    walk.add(o("move", 1, -9.9, -47.1)); walk.add(o("tick", 3));
    run("walk", true, 5, 100000, 100000, walk.toArray(new Object[0][]));
    // Teleports: more than 100 chunks queue at once (ConcurrentHashMap order), then going back rescues
    // the chunks still queued; reloaded chunks keep TerrainPopulated and skip population.
    run("teleport", true, 10, 100000, 100000, new Object[][] {
      o("add", 1, 0.5, 0.5), o("tick", 1), o("move", 1, 1000.5, -1000.5), o("tick", 1), o("tick", 1), o("move", 1, 0.5, 0.5),
      o("tick", 1), o("tick", 4), o("move", 1, 1000.5, -1000.5), o("tick", 6), o("move", 1, 0.5, 0.5), o("tick", 6),
    });
    // A dimension without respawn: queues regardless of spawn, and an empty world unloads everything each tick.
    run("noRespawn", false, 4, 0, 0, new Object[][] {
      o("add", 1, 40.5, 40.5), o("tick", 2), o("move", 1, 140.5, 40.5), o("tick", 1), o("remove", 1), o("tick", 1), o("tick", 2),
      o("add", 2, -60.5, 7.5), o("tick", 1), o("load", 30, 30), o("tick", 1),
    });
    // View distance up and down with two overlapping players; shrinking creates (and loads) missing
    // watchers it removes the player from.
    run("view", true, 10, 100000, 100000, new Object[][] {
      o("add", 1, 0.5, 0.5), o("add", 2, 90.5, -30.5), o("tick", 1), o("view", 4), o("tick", 2), o("view", 15), o("tick", 1),
      o("view", 3), o("tick", 2), o("view", 25), o("view", 1), o("move", 2, -60.5, 70.5), o("tick", 1), o("remove", 1), o("tick", 2),
      o("view", 7), o("remove", 2), o("tick", 3),
    });
    // Save cadence: 24 chunks per incremental save, hasEntities chunks every 600 ticks, the full save,
    // and saving chunks no player watches queues them; level saving blocks saves and unloading.
    run("save", true, 3, 100000, 100000, new Object[][] {
      o("add", 1, 0.5, 0.5), o("tick", 1), o("load", 9, 9), o("load", 9, 10), o("load", 10, 9), o("load", 10, 10),
      o("modify", 0, 0), o("modify", 1, 1), o("entities", 2, 2, 1), o("entities", -3, 1, 1), o("save", 0), o("save", 0), o("save", 0),
      o("tick", 599), o("save", 0), o("tick", 1), o("save", 0), o("tick", 1), o("modify", 3, -3), o("save", 1), o("save", 1),
      o("saving", 1), o("queue", 0, 0), o("tick", 1), o("save", 0), o("saving", 0), o("tick", 1),
      o("move", 1, 300.5, 0.5), o("tick", 1), o("move", 1, 0.5, 0.5), o("tick", 1),
    });
    // Provide/load edge cases and inhabited time over the 8000-tick PlayerManager sweep.
    run("inhabit", true, 3, 100000, 100000, new Object[][] {
      o("add", 1, -20.5, 70.5), o("tick", 100), o("provide", 40, 40), o("loadOnRequest", 0), o("provide", 41, 41), o("provide", 40, 40),
      o("loadOnRequest", 1), o("queue", 40, 40), o("provide", 40, 40), o("tick", 7950), o("tick", 100), o("move", 1, 60.5, 70.5),
      o("tick", 1), o("tick", 8000), o("save", 1), o("remove", 1), o("tick", 1), o("add", 1, -20.5, 70.5), o("tick", 1),
    });
  }
}
