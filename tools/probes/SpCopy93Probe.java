import java.lang.invoke.*;
import java.lang.reflect.*;
import java.util.*;

// Batch 93 spcopy93 (extends the batch 92 probe; entities now have distinct ids, Entity.equals / hashCode compare them, and the tracker mn / PlayerManager mq are real):
// Batch 92 spcopy92: the tick a portal moves the integrated server's player between WorldServers, executed on the unchanged 1.7.10 classes: World.updateEntities (ahb.h) walking
// loadedEntityList, Entity.onEntityUpdate's call into ServerConfigurationManager.transferPlayerToDimension (replayed from oi.a(mw,int), bytecode offsets 0-99, minus its packets:
// ap := new, mt.f(sa) = World.removePlayerEntityDangerously on the old world, K := false, then the real transferEntityToWorld oi.a(sa,int,mt,mt) which places the entity with the real
// Teleporter and spawns it in the new world via the real ahb.d / ahb.a(sa,Z)), and World.removeEntity (ahb.e) for the End exit. WorldServer doubles (mt allocated without its
// constructor, as EntityPortalProbe) with real ahb list handling and stub chunks; a logging IWorldAccess records onEntityCreate / onEntityDestroy (WorldManager mp forwards them to
// EntityTracker mn.a / mn.b). One JSON object per line: case, order of updates, both worlds' lists after the tick, flags.
public class SpCopy93Probe {
  static sun.misc.Unsafe U;
  static StringBuilder log = new StringBuilder();
  static void ev(String s) { if (log.length() > 0) log.append(','); log.append(s); }
  static Field fld(Class<?> c, String n) throws Exception { for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} throw new NoSuchFieldException(n); }
  static String q(String s) { return "\"" + s + "\""; }
  static int nextId = 100;
  static final Map<sa, String> names = new IdentityHashMap<>();
  static String nm(sa e) { return names.getOrDefault(e, "?"); }

  public static class TS extends net.minecraft.server.MinecraftServer {
    TS() { super(null, null); }
    protected boolean e() { return true; } public boolean h() { return false; } public ahk i() { return null; } public rd j() { return null; }
    public boolean k() { return false; } public int l() { return 0; } public boolean m() { return false; } public boolean X() { return false; }
    public boolean ad() { return false; } public String a(ahk k, boolean b) { return ""; }
    public boolean w() { return true; }
  }
  public static class TC extends oi { TC() { super(null); } }
  // Sparse WorldServer: real list handling (ahb.d spawn, ahb.f, ahb.e, ahb.h), one stub chunk per column; air above `floor`.
  public static class TW extends mt {
    TW() { super(null, null, null, 0, null, null); }
    int dim, floor; long seed; Map<String, Integer> cells = new HashMap<>(); ahp tele; Map<String, apx> chunks = new HashMap<>();
    int id(int x, int y, int z) { Integer v = cells.get(x + "," + y + "," + z); if (v != null) return v; if (y < 0) return 0; return y <= floor ? 1 : 0; }
    public aji a(int x, int y, int z) { int i = id(x, y, z); return i == 0 ? ajn.a : aji.e(i); }
    public int e(int x, int y, int z) { return 0; }
    protected boolean c(int x, int z) { return true; }
    public boolean b(int a, int b, int c, int d, int e, int f) { return true; }
    public java.util.List b(sa e, azt box) { return new ArrayList<Object>(); }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { cells.put(x + "," + y + "," + z, aji.b(b)); return true; }
    public boolean b(int x, int y, int z, aji b) { return d(x, y, z, b, 0, 3); }
    public void d(int x, int y, int z, aji b) {}
    public ays N() { return INFO; }
    public long H() { return seed; } public long I() { return 0; }
    public ahp u() { return tele; }
    public r K() { return new r(3, 64, -5); }
    public r l() { return t.h(); }
    public int i(int x, int z) { return 64 + Math.floorMod(x * 7 + z * 13, 9); }
    public apx e(int cx, int cz) {
      String k = cx + "," + cz; apx c = chunks.get(k);
      if (c == null) { try { c = (apx) U.allocateInstance(apx.class); fld(apx.class, "g").set(c, cx); fld(apx.class, "h").set(c, cz); List[] l = new List[16]; for (int i = 0; i < 16; i++) l[i] = new ArrayList(); fld(apx.class, "j").set(c, l); } catch (Exception x) { throw new RuntimeException(x); } chunks.put(k, c); }
      return c;
    }
    List<sa> lists(int cx, int cz) throws Exception { List<sa> out = new ArrayList<>(); for (List l : (List[]) fld(apx.class, "j").get(e(cx, cz))) out.addAll(l); return out; }
  }
  static ays INFO;
  // IWorldAccess: onEntityCreate / onEntityDestroy are what the tracker hears.
  static Object access(int dim, TW w) {
    return java.lang.reflect.Proxy.newProxyInstance(SpCopy93Probe.class.getClassLoader(), new Class[]{ahh.class}, (p, m, a) -> {
      if (m.getParameterTypes().length == 1 && m.getParameterTypes()[0] == sa.class) {
        boolean create = m.getName().equals("a"); sa e = (sa) a[0];
        ev("{\"op\":" + q(create ? "track" : "untrack") + ",\"dim\":" + dim + ",\"e\":" + q(nm(e)) + "}");
        // WorldManager (mp) forwards to EntityTracker: a(sa) = trackEntity, b(sa) = untrackEntity
        mn t = (mn) fld(mt.class, "K").get(w);
        int before = sent.size();
        try { if (create) { if (nm(e).startsWith("d")) t.a(e, 64, 3, true); else t.a(e); } else t.b(e); } catch (Throwable x) { ev("{\"op\":\"trackerThrew\",\"on\":" + q(nm(e)) + ",\"x\":" + q(x.getClass().getSimpleName()) + "}"); }
        ev("{\"op\":\"trackerDone\",\"dim\":" + dim + ",\"e\":" + q(nm(e)) + ",\"create\":" + create + ",\"entries\":" + ((java.util.Set) fld(mn.class, "c").get(t)).size() + "}");
      }
      return null;
    });
  }
  static final List<String> sent = new ArrayList<>();
  public static class TE extends sa {
    TE(ahb w) { super(w); } TE() { super((ahb) null); }
    protected void c() {} protected void a(dh d) {} protected void b(dh d) {}
    public boolean N() { return false; } public boolean P() { return false; } protected void E() {} protected void G() {}
    public void a(int i, boolean b) {} public boolean ao() { return false; }
    public void h() { ev("{\"op\":\"update\",\"e\":" + q(nm(this)) + ",\"dim\":" + ap + "}"); }
  }
  public static class CS extends zs { CS() { super(); } public boolean a(yz p) { return true; } public void b(yz p) { ev("{\"op\":\"closeContainer\"}"); } }
  static Runnable onPlayerUpdate;
  public static class TP extends mw {
    TP() { super(null, null, null, null); }
    public void a(fj f) {} public boolean a(int i, String t) { return true; } public r f_(){ return null; }
    public boolean N() { return false; } public boolean P() { return false; } protected void E() {} protected void G() {}
    public void a(int i, boolean b) {} public boolean ao() { return false; }
    public void h() { ev("{\"op\":\"update\",\"e\":\"player\",\"dim\":" + ap + "}"); if (onPlayerUpdate != null) { Runnable r = onPlayerUpdate; onPlayerUpdate = null; r.run(); } }
  }
  static TW world(int dim, long seed, int floor) throws Exception {
    TW w = (TW) U.allocateInstance(TW.class); w.dim = dim; w.seed = seed; w.floor = floor; w.cells = new HashMap<>(); w.chunks = new HashMap<>();
    aqo p = (aqo) U.allocateInstance(dim == -1 ? aqp.class : dim == 1 ? aqr.class : aqq.class); fld(aqo.class, "h").set(p, new float[16]); fld(aqo.class, "j").set(p, new float[4]); fld(ahb.class, "t").set(w, p); p.a(w);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    fld(ahb.class, "C").set(w, new qi()); fld(ahb.class, "L").set(w, new ArrayList<Object>()); fld(ahb.class, "E").set(w, false); w.tele = new ahp(w);
    fld(mt.class, "W").set(w, new pz());
    mn tr = (mn) U.allocateInstance(mn.class); fld(mn.class, "b").set(tr, w); fld(mn.class, "c").set(tr, new LinkedHashSet<Object>()); fld(mn.class, "d").set(tr, new pz()); fld(mn.class, "e").set(tr, 10); fld(mt.class, "K").set(w, tr);
    mq pm = (mq) U.allocateInstance(mq.class); fld(mq.class, "b").set(pm, w); fld(mq.class, "c").set(pm, new ArrayList<Object>()); fld(mq.class, "d").set(pm, new qd()); fld(mt.class, "L").set(w, pm);
    ((List) fld(ahb.class, "u").get(w)).add(access(dim, w));
    return w;
  }
  static void bindServer(TW over, TW nether, TW end) throws Exception {
    TS s = (TS) U.allocateInstance(TS.class);
    fld(net.minecraft.server.MinecraftServer.class, "c").set(s, new mt[]{over, nether, end});
    fld(net.minecraft.server.MinecraftServer.class, "u").set(s, U.allocateInstance(TC.class));
    fld(net.minecraft.server.MinecraftServer.class, "j").set(null, s);
    for (TW w : new TW[]{over, nether, end}) fld(mt.class, "J").set(w, s);
  }
  static <T extends sa> T entity(Class<T> c, TW w, String name, double x, double y, double z) throws Exception {
    sa e = (sa) U.allocateInstance(c); fld(sa.class, "C").set(e, azt.a(0, 0, 0, 0, 0, 0)); fld(sa.class, "Z").set(e, new Random(5));
    fld(sa.class, "o").set(e, w); e.ap = w.dim; e.s = x; e.t = y; e.u = z; e.p = x; e.q = y; e.r = z;
    fld(sa.class, "c").set(e, nextId++); fld(sa.class, "ar").set(e, UUID.nameUUIDFromBytes(name.getBytes()));
    te dw = new te(e); dw.a(0, Byte.valueOf((byte) 0)); dw.a(1, Short.valueOf((short) 300)); fld(sa.class, "af").set(e, dw);
    names.put(e, name); return c.cast(e);
  }
  static yz player(TW w, double x, double y, double z) throws Exception {
    TP e = entity(TP.class, w, "player", x, y, z);
    te dw = new te(e); dw.a(0, Byte.valueOf((byte) 0)); dw.a(1, Short.valueOf((short) 300)); dw.a(6, Float.valueOf(20f)); dw.a(7, Integer.valueOf(0)); dw.a(8, Byte.valueOf((byte) 0)); dw.a(9, Byte.valueOf((byte) 0)); dw.a(10, ""); dw.a(11, Byte.valueOf((byte) 0)); dw.a(16, Byte.valueOf((byte) 0)); dw.a(17, Float.valueOf(0f)); dw.a(18, Integer.valueOf(0));
    fld(sa.class, "af").set(e, dw); fld(sv.class, "f").set(e, new HashMap<Object, Object>()); yw cap = new yw(); fld(yz.class, "bE").set(e, cap); fld(mw.class, "f").set(e, new ArrayList<Object>()); Object cs = U.allocateInstance(CS.class); fld(yz.class, "bn").set(e, cs);
    return e;
  }
  static String names(List l) { StringBuilder b = new StringBuilder("["); for (Object o : l) { if (b.length() > 1) b.append(','); b.append(q(nm((sa) o))); } return b + "]"; }
  static String chunkNames(TW w, sa e) throws Exception { return names(w.lists(((int) Math.floor(e.s)) >> 4, ((int) Math.floor(e.u)) >> 4)); }
  static String state(TW w) throws Exception {
    return "{\"loaded\":" + names((List) fld(ahb.class, "e").get(w)) + ",\"players\":" + names((List) fld(ahb.class, "h").get(w)) + "}";
  }
  static void add(TW w, sa e) throws Exception { w.d(e); }

  // One trip: `before` entities ahead of the player in loadedEntityList, `after` behind it. mode "transfer" = oi.a(mw,int), "exit" = End exit (World.removeEntity).
  static void trip(String label, String mode, int before, int after, int from, int to) throws Exception {
    TW over = world(0, 1, 60), nether = world(-1, 1, 31), end = world(1, 1, 40); bindServer(over, nether, end);
    TW src = from == 0 ? over : from == -1 ? nether : end, dst = to == 0 ? over : to == -1 ? nether : end;
    List<sa> ents = new ArrayList<>();
    double base = src.floor + 1;
    for (int i = 0; i < before; i++) { TE e = entity(TE.class, src, "b" + i, 2.5 + i, base, 2.5); add(src, e); ents.add(e); }
    yz p = player(src, 40.5, base, 40.5); add(src, p);
    for (int i = 0; i < after; i++) { TE e = entity(TE.class, src, "a" + i, 4.5 + i, base, 2.5); add(src, e); ents.add(e); }
    TE d0 = entity(TE.class, dst, "d0", 10.5, dst.floor + 1, 10.5); add(dst, d0);
    log.setLength(0);
    String s0 = state(src);
    final int ocx = ((int) Math.floor(p.s)) >> 4, ocz = ((int) Math.floor(p.u)) >> 4; // the chunk the player stood in when the trip began
    onPlayerUpdate = () -> {
      try {
        ev("{\"op\":\"portal\",\"inPlayersUpdate\":true}");
        if (mode.equals("transfer")) {
          // oi.a(mw, int) offsets 0-99: ap := new dimension; mt.f(sa); K := false; oi.a(sa, int, mt, mt)
          p.ap = to; src.f(p); ev("{\"op\":\"afterRemove\",\"srcPlayers\":" + names((List) fld(ahb.class, "h").get(src)) + ",\"srcLoaded\":" + names((List) fld(ahb.class, "e").get(src)) + ",\"isDead\":" + p.K + ",\"addedToChunk\":" + p.ag + "}");
          p.K = false;
          oi m = (oi) fld(net.minecraft.server.MinecraftServer.class, "u").get(fld(net.minecraft.server.MinecraftServer.class, "j").get(null));
          m.a(p, from, src, dst);
        } else {
          // mw.b(1) in the End: this.o.e(this): World.removeEntity (setDead, out of playerEntities, onEntityRemoved); the entry stays in loadedEntityList
          p.ap = to; src.e(p);
          ev("{\"op\":\"afterRemoveEntity\",\"srcPlayers\":" + names((List) fld(ahb.class, "h").get(src)) + ",\"srcLoaded\":" + names((List) fld(ahb.class, "e").get(src)) + ",\"isDead\":" + p.K + ",\"addedToChunk\":" + p.ag + "}");
        }
      } catch (Exception x) { throw new RuntimeException(x); }
    };
    src.h(); // World.updateEntities of the old world: the portal tick
    String tick1 = log.toString(); log.setLength(0);
    String s1 = state(src), n1 = state(dst);
    boolean dead = p.K;
    src.h(); // the old world's next tick
    String tick2 = log.toString(); log.setLength(0);
    dst.h(); // the new world's first tick
    mn tr = (mn) fld(mt.class, "K").get(dst);
    // PlayerManager.addPlayer has queued the chunk and EntityPlayerMP.onUpdate has sent it: the player is a watcher, loadedChunks no longer holds it. mn.a(mw, apx) = EntityTracker.func_85172_a
    mq pm = (mq) fld(mt.class, "L").get(dst);
    int dcx = d0.ah, dcz = d0.aj;
    java.lang.reflect.Constructor<?> mrc = mr.class.getDeclaredConstructors()[0]; mrc.setAccessible(true);
    Object inst = U.allocateInstance(mr.class); List<Object> watchers = new ArrayList<>(); watchers.add(p); fld(mr.class, "b").set(inst, watchers); fld(mr.class, "c").set(inst, new agu(dcx, dcz));
    ((qd) fld(mq.class, "d").get(pm)).a(((long) dcx + 2147483647L) | (((long) dcz + 2147483647L) << 32), inst);
    List<Object> pending = new ArrayList<>(); pending.add(new agu(dcx, dcz)); ((List) fld(mw.class, "f").get(p)).addAll(pending);
    boolean watchingBefore = pm.a((mw) p, dcx, dcz);
    ((List) fld(mw.class, "f").get(p)).clear();
    boolean watchingAfter = pm.a((mw) p, dcx, dcz);
    String sendThrew = "null";
    try { tr.a((mw) p, dst.e(dcx, dcz)); } catch (Throwable x) { sendThrew = q(x.getClass().getSimpleName()); }
    ev("{\"op\":\"chunkSent\",\"chunk\":[" + dcx + "," + dcz + "],\"watchingWhilePending\":" + watchingBefore + ",\"watchingAfterSend\":" + watchingAfter + ",\"spawnAttemptThrew\":" + sendThrew + "}");
    String tick3 = log.toString();
    System.out.println("{\"case\":" + q(label) + ",\"mode\":" + q(mode) + ",\"from\":" + from + ",\"to\":" + to + ",\"before\":" + before + ",\"after\":" + after
      + ",\"srcBefore\":" + s0 + ",\"portalTick\":[" + tick1 + "],\"srcAfter\":" + s1 + ",\"dstAfter\":" + n1 + ",\"isDeadAfter\":" + dead + ",\"playerWorldDim\":" + p.ap
      + ",\"srcNextTick\":[" + tick2 + "],\"dstFirstTick\":[" + tick3 + "],\"departureChunk\":[" + ocx + "," + ocz + "],\"srcDepartureChunkHolds\":" + names(src.lists(ocx, ocz)) + ",\"addedToChunkAfter\":" + p.ag + ",\"srcChunkOfPlayer\":" + chunkNames(src, p) + ",\"dstChunkOfPlayer\":" + chunkNames(dst, p) + "}");
  }
  public static void main(String[] args) throws Throwable {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l(); INFO = (ays) U.allocateInstance(ays.class);
    trip("middle", "transfer", 2, 3, 0, -1);
    trip("first", "transfer", 0, 3, 0, -1);
    trip("last", "transfer", 3, 0, 0, -1);
    trip("only", "transfer", 0, 0, 0, -1);
    trip("netherToOver", "transfer", 2, 2, -1, 0);
    trip("endExit", "exit", 2, 2, 1, 0);
  }
}
