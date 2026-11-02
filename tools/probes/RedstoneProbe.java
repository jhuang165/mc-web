// Runs the unchanged original BlockRedstoneWire (ana), BlockRedstoneTorch (anc),
// BlockTorch (aoc), BlockLever (alv), BlockButton (ajs/anx/aon),
// BlockRedstoneLight (anb) and BlockCompressedPowered (ams) inside a real
// World (ahb) whose chunk provider hands out real Chunk (apx) objects. The
// World subclass is allocated without its constructor (as TerrainProbe does)
// and keeps the native World.setBlock, setBlockMetadataWithNotify,
// notifyBlocksOfNeighborChange, notifyBlockOfNeighborChange, power queries
// (getBlockPowerInput, getIndirectPowerLevelTo, isBlockIndirectlyGettingPowered,
// getStrongestIndirectPower), doesBlockHaveSolidTopSurface and
// isBlockNormalCubeDefault. Only these are replaced:
//   - scheduleBlockUpdate / WithPriority / func_147446_b / isBlockTickScheduledThisTick:
//     copies of the WorldServer pending-tick code (HashSet + TreeSet of the
//     original NextTickListEntry (ahs), 1000-entry cap, this-tick list);
//   - getTotalWorldTime, getGameRules, playSoundEffect (recorded),
//     spawnParticle (dropped), spawnEntityInWorld (EntityItem recorded),
//     getEntitiesWithinAABB (no entities);
//   - lighting updates (func_147451_t / updateLightByType return false: no
//     redstone rule reads light).
// The call log wraps (and then calls) the native setBlock, setBlockMetadataWithNotify
// and notifyBlockOfNeighborChange and records scheduled ticks and updateTick
// calls. Scenarios arrive on stdin (see tools/verify-redstone.mjs); one JSON
// line per scenario goes to stdout.
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class RedstoneProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String n) throws Exception { for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} throw new NoSuchFieldException(n); }
  static class Provider extends aqo { public String l() { return "probe"; } }
  static class Chunks implements apu {
    final ahb world; final Map<Long, apx> map = new HashMap<>();
    Chunks(ahb w) { world = w; }
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) { return map.computeIfAbsent(((long) x << 32) ^ (z & 0xffffffffL), k -> new apx(world, x, z)); }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) {}
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return true; }
    public String f() { return "probe"; }
    public List a(sx s, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return map.size(); }
    public void e(int x, int z) {}
    public void c() {}
  }
  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    long time; agy rules; StringBuilder log; int calls; long tick;
    List<String> sounds, drops;
    Set<ahs> M; TreeSet<ahs> N; List<ahs> V;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    void add(String s) { if (log.length() > 0) log.append(' '); log.append(s); calls++; }
    public long I() { return time; }
    public agy O() { return rules; }
    public boolean t(int x, int y, int z) { return false; }
    public boolean c(ahn type, int x, int y, int z) { return false; }
    public void a(double x, double y, double z, String name, float volume, float pitch) {
      sounds.add("[" + tick + "," + x + "," + y + "," + z + ",\"" + name + "\"," + volume + "," + pitch + "]");
      add("p," + name);
    }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    public List a(Class c, azt box) { return new ArrayList(); }
    public boolean d(sa e) {
      xk item = (xk) e; add stack = item.f();
      drops.add("[" + tick + "," + e.s + "," + e.t + "," + e.u + "," + adb.b(stack.b()) + "," + stack.b + "," + stack.k() + "]");
      add("e," + adb.b(stack.b()));
      return true;
    }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      add("s," + x + "," + y + "," + z + "," + aji.b(b) + "," + meta + "," + flags);
      return super.d(x, y, z, b, meta, flags);
    }
    public boolean a(int x, int y, int z, int meta, int flags) {
      add("m," + x + "," + y + "," + z + "," + meta + "," + flags);
      return super.a(x, y, z, meta, flags);
    }
    public void e(int x, int y, int z, aji src) {
      add("n," + x + "," + y + "," + z + "," + aji.b(src));
      super.e(x, y, z, src);
    }
    // WorldServer.func_147477_a.
    public boolean a(int x, int y, int z, aji b) { return V.contains(new ahs(x, y, z, b)); }
    // WorldServer.scheduleBlockUpdate -> scheduleBlockUpdateWithPriority(.., 0).
    public void a(int x, int y, int z, aji b, int delay) { a(x, y, z, b, delay, 0); }
    // WorldServer.scheduleBlockUpdateWithPriority with scheduledUpdatesAreImmediate false;
    // checkChunksExist is always true here.
    public void a(int x, int y, int z, aji b, int delay, int priority) {
      add("t," + x + "," + y + "," + z + "," + aji.b(b) + "," + delay + "," + priority);
      ahs e = new ahs(x, y, z, b);
      if (b.o() != awt.a) { e.a((long) delay + time); e.a(priority); }
      if (!M.contains(e)) { M.add(e); N.add(e); }
    }
    public void b(int x, int y, int z, aji b, int delay, int priority) {
      ahs e = new ahs(x, y, z, b); e.a(priority);
      if (b.o() != awt.a) e.a((long) delay + time);
      if (!M.contains(e)) { M.add(e); N.add(e); }
    }
    // WorldServer.tickUpdates(false), after the total world time has advanced.
    void tickUpdates() {
      int n = N.size();
      if (n != M.size()) throw new IllegalStateException("TickNextTick list out of synch");
      if (n > 1000) n = 1000;
      for (int i = 0; i < n; i++) {
        ahs e = N.first();
        if (e.d > time) break;
        N.remove(e); M.remove(e); V.add(e);
      }
      for (Iterator<ahs> it = V.iterator(); it.hasNext(); ) {
        ahs e = it.next(); it.remove();
        aji b = a(e.a, e.b, e.c);
        if (b.o() == awt.a || !aji.a(b, e.a())) continue;
        add("u," + e.a + "," + e.b + "," + e.c + "," + aji.b(b));
        b.a((ahb) this, e.a, e.b, e.c, s);
      }
      V.clear();
    }
    // Raw section write used only for the initial terrain (no callbacks).
    void raw(int x, int y, int z, aji b, int meta) {
      apx c = e(x >> 4, z >> 4); apz[] st = c.i();
      if (st[y >> 4] == null) st[y >> 4] = new apz(y >> 4 << 4, !t.g);
      st[y >> 4].a(x & 15, y & 15, z & 15, b); st[y >> 4].a(x & 15, y & 15, z & 15, meta);
    }
  }
  static W world(long seed) throws Exception {
    W w = (W) unsafe.allocateInstance(W.class);
    field(ahb.class, "t").set(w, new Provider());
    field(ahb.class, "s").set(w, new Random(seed));
    field(ahb.class, "u").set(w, new ArrayList());
    field(ahb.class, "C").set(w, new qi());
    field(ahb.class, "v").set(w, new Chunks(w));
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    return w;
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    // The wire's blocksNeedingUpdate set lives on the single Blocks.redstone_wire instance.
    Field wireSet = field(ana.class, "b");
    // Native block properties: material opaque, renderAsNormalBlock, canProvidePower,
    // isNormalCube, and doesBlockHaveSolidTopSurface for metadata 0..15 (bitmask).
    StringBuilder props = new StringBuilder();
    W probe = world(0);
    for (int id = 0; id < 256; id++) {
      aji b = aji.e(id); if (b == null || (id != 0 && b == ajn.a)) continue;
      int top = 0;
      for (int m = 0; m < 16; m++) { probe.raw(0, 1, 0, b, m); if (ahb.a(probe, 0, 1, 0)) top |= 1 << m; }
      props.append(props.length() > 0 ? "," : "").append("[").append(id).append(",").append(b.o().k() ? 1 : 0).append(",").append(b.d() ? 1 : 0).append(",").append(b.f() ? 1 : 0).append(",").append(b.r() ? 1 : 0).append(",").append(top).append("]");
    }
    // Blocks fields the ported rules compare against.
    String[] names = {"af", "aN", "aR", "aS", "aJ", "bk", "w", "bK", "az", "aA", "bu", "bv"};
    StringBuilder ids = new StringBuilder();
    for (String n : names) ids.append(ids.length() > 0 ? "," : "").append(q(n)).append(":").append(aji.b((aji) ajn.class.getField(n).get(null)));
    System.out.println("{\"kind\":\"blocks\",\"props\":[" + props + "],\"fields\":{" + ids + "},\"items\":{\"redstone\":" + adb.b(ade.ax) + "}}");
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    for (String line = in.readLine(); line != null; ) {
      String[] h = line.split(" ");
      if (!h[0].equals("scenario")) { line = in.readLine(); continue; }
      String name = h[1];
      int ox = Integer.parseInt(h[2]), oy = Integer.parseInt(h[3]), oz = Integer.parseInt(h[4]);
      int dx = Integer.parseInt(h[5]), dy = Integer.parseInt(h[6]), dz = Integer.parseInt(h[7]), ticks = Integer.parseInt(h[8]);
      long seed = Long.parseLong(h[9]);
      W w = world(seed);
      wireSet.set(ajn.af, new HashSet());
      String[] cells = in.readLine().substring(5).split(",");
      for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
        String[] c = cells[(x * dy + y) * dz + z].split(":");
        int id = Integer.parseInt(c[0]), meta = c.length > 1 ? Integer.parseInt(c[1]) : 0;
        if (id != 0) w.raw(ox + x, oy + y, oz + z, aji.e(id), meta);
      }
      List<String[]> events = new ArrayList<>();
      for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
      int[][] prev = snapshot(w, ox, oy, oz, dx, dy, dz);
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
            default: throw new IllegalArgumentException(e[2]);
          }
        }
        w.time++;
        w.add("T");
        w.tickUpdates();
        int[][] now = snapshot(w, ox, oy, oz, dx, dy, dz);
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
      System.out.println("{\"kind\":\"scenario\",\"name\":" + q(name) + ",\"frames\":[" + frames + "],\"calls\":[" + logs + "],\"final\":" + q(fin.toString()) + ",\"pending\":[" + pend + "],\"sounds\":[" + String.join(",", w.sounds) + "],\"drops\":[" + String.join(",", w.drops) + "],\"rng\":" + w.s.nextInt() + "}");
    }
  }
  static int[][] snapshot(W w, int ox, int oy, int oz, int dx, int dy, int dz) {
    int[][] r = new int[dx * dy * dz][];
    for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++)
      r[(x * dy + y) * dz + z] = new int[] {aji.b(w.a(ox + x, oy + y, oz + z)), w.e(ox + x, oy + y, oz + z)};
    return r;
  }
}
