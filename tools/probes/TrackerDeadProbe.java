import java.util.*;
import java.lang.invoke.*;
import java.lang.reflect.Proxy;

// Batch 63 (mobcopies3): the tracker's HashSet when entities die during a run of ticks. The REAL World.updateEntities (ahb.h) runs a list of probe entities (a sa subclass whose h()
// sets isDead after its life, and may spawn children through the real ahb.d); the real IWorldAccess hook (ahh.a = onEntityCreate, ahh.b = onEntityDestroy) is where EntityTracker (mn)
// trackEntity / untrackEntity run, and there a real EntityTrackerEntry `my` (hashCode = entity id) is added to / removed from a real java.util.HashSet, exactly the mn bookkeeping
// (bytecode-read: mn.a(sa) adds a new my, mn.b(sa) removes it, updateTrackedEntities walks the set after updateEntities). Output per scenario: the set's order after every tick.
// A dead entity is removed inside the same World.updateEntities pass that ran its last h(), so the tracker of that tick no longer holds it.
public class TrackerDeadProbe {
  public static class W extends MobMoveProbe.ProbeWorld {} // ProbeWorld does not stub d(sa): the real spawnEntityInWorld runs
  static ahb build() throws Exception { // as HorseCopyProbe.build, server side, for a world whose own d(sa) is kept
    ahb world = (ahb) HorseProbe.u.allocateInstance(W.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", HorseProbe.u.allocateInstance(aqq.class));
    apx chunk = (apx) HorseProbe.u.allocateInstance(apx.class);
    chunk.d = true;
    java.lang.reflect.InvocationHandler ih = (proxy, m, a) -> m.getName().equals("d") && a != null && a.length == 2 ? chunk : m.getReturnType() == boolean.class ? (Object) false : m.getReturnType() == int.class ? (Object) 0 : null;
    MobMoveProbe.set(world, "v", Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, ih));
    return world;
  }
  public static class Dummy extends sa {
    Dummy() { super(null); }
    int life, k; long[][] spawns; ahb world;
    protected void c() {}
    protected void a(dh d) {}
    protected void b(dh d) {}
    public void h() {
      k++;
      if (spawns != null) for (long[] s : spawns) if (s[0] == k) world.d(make(world, (int) s[1], (int) s[2], null));
      if (k >= life) K = true;
    }
  }
  static Dummy make(ahb world, int id, int life, long[][] spawns) {
    try {
      Dummy e = (Dummy) HorseProbe.u.allocateInstance(Dummy.class);
      MobMoveProbe.set(e, "o", world);
      e.d(id); e.life = life; e.spawns = spawns; e.world = world; e.n = true; // sa.n: forceSpawn (d() adds it without asking whether the chunk is loaded)
      MobMoveProbe.field(sa.class, "s").setDouble(e, 3.0); MobMoveProbe.field(sa.class, "u").setDouble(e, 3.0); // above the loaded chunk (0, 0)
      return e;
    } catch (Exception x) { throw new RuntimeException(x); }
  }
  static String keys(Set<my> set) { StringBuilder b = new StringBuilder("["); boolean f = true; for (my m : set) { if (!f) b.append(','); f = false; b.append(m.a.y()); } return b.append(']').toString(); }
  // initial: {id, life}; spawns: per initial entity index, {ownKTick, childId, childLife}
  static String run(String name, int ticks, long[][] initial, long[][][] spawns) throws Exception {
    ahb world = build();
    Object provider = MobMoveProbe.field(ahb.class, "v").get(world);
    Object chunk = provider.getClass().getMethod("d", int.class, int.class).invoke(provider, 0, 0);
    List[] lists = new List[16]; for (int k = 0; k < 16; k++) lists[k] = new ArrayList();
    MobMoveProbe.set(chunk, "j", lists); MobMoveProbe.set(chunk, "u", new apz[16]); MobMoveProbe.set(chunk, "e", world);
    Set<my> set = new HashSet<>(); Map<Integer, my> live = new HashMap<>();
    ahh hook = (ahh) Proxy.newProxyInstance(ahh.class.getClassLoader(), new Class[] { ahh.class }, (p, m, a) -> {
      if (a != null && a.length == 1 && a[0] instanceof sa) {
        sa e = (sa) a[0];
        if (m.getName().equals("a")) { my t = new my(e, 80, 3, true); live.put(e.y(), t); set.add(t); }
        else if (m.getName().equals("b")) { my t = live.remove(e.y()); if (t != null) set.remove(t); }
      }
      return null;
    });
    ((List) MobMoveProbe.field(ahb.class, "u").get(world)).add(hook);
    for (int i = 0; i < initial.length; i++) world.d(make(world, (int) initial[i][0], (int) initial[i][1], spawns == null ? null : spawns[i]));
    StringBuilder orders = new StringBuilder("[" + keys(set));
    for (int t = 0; t < ticks; t++) { world.h(); orders.append(',').append(keys(set)); }
    StringBuilder ini = new StringBuilder("[");
    for (int i = 0; i < initial.length; i++) ini.append(i > 0 ? "," : "").append("[" + initial[i][0] + "," + initial[i][1] + "]");
    StringBuilder sp = new StringBuilder("[");
    if (spawns != null) for (int i = 0; i < initial.length; i++) { sp.append(i > 0 ? "," : "").append("["); if (spawns[i] != null) for (int j = 0; j < spawns[i].length; j++) sp.append(j > 0 ? "," : "").append(Arrays.toString(spawns[i][j])); sp.append("]"); }
    return "{\"case\":\"" + name + "\",\"javaVersion\":\"" + System.getProperty("java.version") + "\",\"ticks\":" + ticks + ",\"initial\":" + ini + "],\"spawns\":" + (spawns == null ? "null" : sp + "]") + ",\"orders\":" + orders + "]}";
  }
  static long[][] ent(long... v) { long[][] o = new long[v.length / 2][]; for (int i = 0; i < o.length; i++) o[i] = new long[] { v[2 * i], v[2 * i + 1] }; return o; }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    // 14 ids in one table that already grew; some die at different ticks
    System.out.println(run("dying", 12, ent(3, 9, 18, 4, 35, 7, 2, 12, 19, 3, 51, 12, 1, 5, 20, 12, 36, 12, 5, 12, 6, 12, 7, 12, 8, 12, 9, 12), null));
    // an entity that dies in its first tick (never present after a tick) among 12 live ones: the 13th entry doubled the table (16 to 32) and the order of the ids above 15 changed for good
    System.out.println(run("transient12", 6, ent(1, 99, 17, 99, 2, 99, 18, 99, 3, 99, 19, 99, 4, 99, 20, 99, 5, 99, 21, 99, 6, 99, 22, 99), new long[][][] { null, null, null, null, null, null, null, null, null, null, null, { { 1, 33, 1 } } }));
    // spawn during the run: children appear in the same tick (appended to the list) and die later; one is still alive at the end
    System.out.println(run("spawned", 14, ent(40, 99, 41, 99, 42, 99), new long[][][] { { { 2, 43, 4 }, { 3, 60, 99 } }, { { 4, 44, 3 }, { 4, 77, 2 } }, null }));
    // wave: many entities spawn, then die in a different order (ids sharing buckets)
    long[][] init = new long[20][]; for (int i = 0; i < 20; i++) init[i] = new long[] { 1 + 16 * i, 3 + (i * 7) % 11 };
    System.out.println(run("wave", 14, init, null));
  }
}
