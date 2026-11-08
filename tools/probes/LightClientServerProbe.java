import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Batch 30: server light against client light, from the unchanged 1.7.10 World (ahb) and Chunk (apx) light code.
//
// Two worlds over the same blocks (chunks -3..3, x, z -48..63). The SERVER world is built as LightEngine3Probe does (generateSkylightMap, terrain
// populated, two settling ticks) and after every edit runs the WorldServer light work once per tick: Chunk.o() (enqueueRelightChecks) then
// Chunk.func_150804_b(false) (recheckGaps, light population) on every loaded chunk, isRemote false. The CLIENT world holds the same blocks
// and receives the server's light arrays chunk by chunk, as Chunk.fillChunk copies them from the packet (no resetRelightChecks on the Overworld),
// then generateHeightMap (a()); it never calls func_150804_b (NetHandlerPlayClient and WorldClient do not). Both worlds run the same
// World.setBlock(flag 2) edits (the client's block-change packet runs the same setBlock path). Two client variants:
//   "plain"  no per-tick work at all
//   "checks" Chunk.o() on every chunk every tick (the upper bound of the client's func_147467_a work: it runs it for newly active chunks)
// After each edit (and `T` ticks) the probe compares sky light, block light and the height map over x, z -48..63, y 0..255 and prints one JSON
// record per scenario: for each snapshot the number of differing cells, how many are brighter or darker on the client, the largest difference,
// the bounding box and five sample cells (x, y, z, server, client).
public class LightClientServerProbe {
  static sun.misc.Unsafe unsafe;
  static final int R = 3, LO = -48, HI = 64;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }

  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
  }
  public static class Provider implements apu {
    LinkedHashMap<Long, apx> chunks = new LinkedHashMap<>();
    ahb world;
    public boolean a(int x, int z) { return chunks.containsKey(agu.a(x, z)); }
    public apx d(int x, int z) { apx c = chunks.get(agu.a(x, z)); return c != null ? c : new apw(world, x, z); }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) {}
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return false; }
    public String f() { return "probe"; }
    public List a(sx t, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return chunks.size(); }
    public void e(int x, int z) {}
    public void c() {}
  }
  static class Sim { W world; Provider prov; }

  static Sim newSim() throws Exception {
    Sim s = new Sim();
    s.world = (W) unsafe.allocateInstance(W.class);
    set(s.world, "t", unsafe.allocateInstance(aqq.class));
    set(s.world, "C", new qi());
    set(s.world, "I", new int[32768]);
    set(s.world, "E", true);
    set(s.world, "u", new ArrayList<Object>());
    s.prov = new Provider();
    s.prov.world = s.world;
    set(s.world, "v", s.prov);
    return s;
  }
  static List<int[]> fills;
  static void fill(int x0, int y0, int z0, int x1, int y1, int z1, int id, int meta) { fills.add(new int[] {x0, y0, z0, x1, y1, z1, id, meta}); }
  static apx build(Sim s, int cx, int cz, boolean sky) {
    aji[] blocks = new aji[65536];
    byte[] meta = new byte[65536];
    for (int[] f : fills) {
      int xa = Math.max(f[0], cx * 16), xb = Math.min(f[3], cx * 16 + 15), za = Math.max(f[2], cz * 16), zb = Math.min(f[5], cz * 16 + 15);
      for (int x = xa; x <= xb; x++) for (int z = za; z <= zb; z++) for (int y = f[1]; y <= f[4]; y++) {
        int i = ((x & 15) * 16 + (z & 15)) * 256 + y;
        blocks[i] = f[6] == 0 ? null : aji.e(f[6]);
        meta[i] = (byte) f[7];
      }
    }
    apx c = new apx(s.world, blocks, meta, cx, cz);
    if (sky) c.b(); // server: generateSkylightMap
    s.prov.chunks.put(agu.a(cx, cz), c);
    return c;
  }
  static void tick(Sim s, boolean server, boolean checks) throws Exception {
    set(s.world, "E", !server);
    if (server || checks) for (apx c : new ArrayList<>(s.prov.chunks.values())) { c.o(); if (server) c.b(false); }
    set(s.world, "E", true);
  }

  static Sim server, client;
  static void begin() throws Exception { fills = new ArrayList<>(); }
  static void flat() {
    fill(LO, 0, LO, HI - 1, 0, HI - 1, 7, 0);
    fill(LO, 1, LO, HI - 1, 58, HI - 1, 1, 0);
    fill(LO, 59, LO, HI - 1, 59, HI - 1, 3, 0);
    fill(LO, 60, LO, HI - 1, 60, HI - 1, 2, 0);
  }
  static void anchors() { for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) fill(cx * 16 + 15, 100, cz * 16 + 15, cx * 16 + 15, 100, cz * 16 + 15, 1, 0); }
  static void cavern() {
    fill(-12, 30, -12, 28, 58, 28, 0, 0);
    fill(0, 59, 0, 3, 60, 3, 0, 0);
    fill(14, 59, 8, 17, 60, 11, 0, 0);
  }
  // A hillside: a staircase of stone ledges and a wall, so height maps differ strongly between neighbouring columns.
  static void hill() {
    for (int i = 0; i < 12; i++) fill(-30 + i * 2, 61, -30, -29 + i * 2, 61 + i * 2, 30, 1, 0);
    fill(10, 61, 10, 12, 90, 12, 3, 0);
  }

  // Copies the server's world into a client world: same blocks, the server's light arrays (Chunk.fillChunk), generateHeightMap.
  static void makeClient() throws Exception {
    client = newSim();
    for (Map.Entry<Long, apx> e : server.prov.chunks.entrySet()) {
      apx sc = e.getValue();
      apx cc = build(client, sc.g, sc.h, false); // g, h: chunkX, chunkZ (xPosition, zPosition)
      cc.a(); // generateHeightMap
      apz[] ss = sc.i(), cs = cc.i();
      for (int sec = 0; sec < 16; sec++) {
        if (ss[sec] == null || ss[sec].a()) continue; // an empty section is not in a full chunk packet (S21PacketChunkData skips isEmpty storages)
        if (cs[sec] == null) throw new IllegalStateException("section " + sec + " of " + sc.g + "," + sc.h + " missing on the client");
        for (int x = 0; x < 16; x++) for (int y = 0; y < 16; y++) for (int z = 0; z < 16; z++) {
          cs[sec].b(x, y, z, ss[sec].c(x, y, z));
          cs[sec].c(x, y, z, ss[sec].d(x, y, z));
        }
      }
    }
  }

  static java.util.HashSet<Long> base = null; // cells that already differ right after the chunk packet (empty sections are not sent)
  static String diff(String label) {
    boolean first = base == null || label.equals("initial");
    if (first) base = new java.util.HashSet<>();
    long extra = 0;
    long sky = 0, blk = 0, hm = 0, skyBright = 0, skyDark = 0, blkBright = 0, blkDark = 0;
    int maxSky = 0, maxBlk = 0, x0 = 999, x1 = -999, y0 = 999, y1 = -999, z0 = 999, z1 = -999;
    StringBuilder samples = new StringBuilder();
    int ns = 0;
    for (int x = LO; x < HI; x++) for (int z = LO; z < HI; z++) {
      if (server.world.f(x, z) != client.world.f(x, z)) hm++;
      for (int y = 0; y < 256; y++) {
        int s1 = server.world.b(ahn.a, x, y, z), c1 = client.world.b(ahn.a, x, y, z);
        int s2 = server.world.b(ahn.b, x, y, z), c2 = client.world.b(ahn.b, x, y, z);
        boolean d = false;
        if (s1 != c1) { sky++; d = true; if (c1 > s1) skyBright++; else skyDark++; maxSky = Math.max(maxSky, Math.abs(c1 - s1)); }
        if (s2 != c2) { blk++; d = true; if (c2 > s2) blkBright++; else blkDark++; maxBlk = Math.max(maxBlk, Math.abs(c2 - s2)); }
        if (d && first) base.add(((long) (x + 64) << 40) | ((long) (z + 64) << 20) | y);
        if (d && !first && !base.contains(((long) (x + 64) << 40) | ((long) (z + 64) << 20) | y)) {
          extra++;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
          if (ns < 5) { samples.append(ns++ > 0 ? "," : "").append("[").append(x).append(",").append(y).append(",").append(z).append(",").append(s1).append(",").append(c1).append(",").append(s2).append(",").append(c2).append("]"); }
        }
      }
    }
    return "{\"label\":\"" + label + "\",\"sky\":" + sky + ",\"skyClientBrighter\":" + skyBright + ",\"skyClientDarker\":" + skyDark + ",\"maxSky\":" + maxSky
      + ",\"block\":" + blk + ",\"blockClientBrighter\":" + blkBright + ",\"blockClientDarker\":" + blkDark + ",\"maxBlock\":" + maxBlk + ",\"heights\":" + hm
      + ",\"beyondInitial\":" + extra + ",\"box\":" + (sky + blk == 0 ? "null" : "[" + x0 + "," + y0 + "," + z0 + "," + x1 + "," + y1 + "," + z1 + "]") + ",\"samples\":[" + samples + "]}";
  }

  // An edit script: [x, y, z, id, meta, label]; runs it on the server (set + one tick) and on a client copy (set, optionally o() per tick).
  static void run(String name, boolean checks, Object[][] edits) throws Exception {
    server = newSim();
    for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) build(server, cx, cz, true);
    for (apx c : server.prov.chunks.values()) c.k = true;
    tick(server, true, true); tick(server, true, true);
    makeClient();
    List<String> out = new ArrayList<>();
    out.add(diff("initial"));
    for (Object[] e : edits) {
      int x = (Integer) e[0], y = (Integer) e[1], z = (Integer) e[2], id = (Integer) e[3], meta = (Integer) e[4];
      server.world.d(x, y, z, aji.e(id), meta, 2);
      client.world.d(x, y, z, aji.e(id), meta, 2);
      tick(server, true, true);
      tick(client, false, checks);
      out.add(diff((String) e[5]));
    }
    for (int t = 0; t < 3; t++) { tick(server, true, true); tick(client, false, checks); }
    out.add(diff("after 3 more ticks"));
    System.out.println("{\"case\":\"" + name + "\",\"clientChecks\":" + checks + ",\"snaps\":[" + String.join(",", out) + "]}");
  }
  static Object[] e(int x, int y, int z, int id, int meta, String label) { return new Object[] {x, y, z, id, meta, label}; }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    for (boolean checks : new boolean[] {false, true}) {
      // Flat ground: a pillar (height map rises), the same pillar removed, a one-block pit (height map falls), a torch.
      begin(); flat(); anchors();
      run("flat-pillar", checks, new Object[][] {e(5, 61, 5, 1, 0, "pillar 61"), e(5, 62, 5, 1, 0, "pillar 62"), e(5, 63, 5, 1, 0, "pillar 63"), e(5, 63, 5, 0, 0, "remove 63"), e(5, 62, 5, 0, 0, "remove 62"), e(5, 61, 5, 0, 0, "remove 61"),
        e(-10, 60, -10, 0, 0, "pit"), e(-10, 59, -10, 0, 0, "deeper pit"), e(-10, 60, -10, 1, 0, "cover pit"), e(8, 61, 8, 50, 5, "torch"), e(8, 61, 8, 0, 0, "remove torch")});
      // A floating roof slab over a lit field and its removal (the height map of 25 columns jumps), then a tree-like trunk and canopy.
      begin(); flat(); anchors();
      run("roof-slab", checks, new Object[][] {e(0, 70, 0, 1, 0, "slab 0"), e(1, 70, 0, 1, 0, "slab 1"), e(2, 70, 0, 1, 0, "slab 2"), e(0, 70, 1, 1, 0, "slab 3"), e(1, 70, 1, 1, 0, "slab 4"), e(2, 70, 1, 1, 0, "slab 5"), e(0, 70, 2, 1, 0, "slab 6"), e(1, 70, 2, 1, 0, "slab 7"), e(2, 70, 2, 1, 0, "slab 8"),
        e(1, 70, 1, 0, 0, "slab hole"), e(0, 70, 0, 0, 0, "remove corner"), e(1, 70, 0, 0, 0, "remove edge"), e(2, 70, 0, 0, 0, "remove 2"), e(0, 70, 1, 0, 0, "remove 3"), e(2, 70, 1, 0, 0, "remove 4"), e(0, 70, 2, 0, 0, "remove 5"), e(1, 70, 2, 0, 0, "remove 6"), e(2, 70, 2, 0, 0, "remove 7")});
      // A cavern roof with sky holes: dig new shafts and plug them, torches inside.
      begin(); flat(); anchors(); cavern();
      run("cavern", checks, new Object[][] {e(10, 59, 2, 0, 0, "shaft 59"), e(10, 60, 2, 0, 0, "shaft 60"), e(10, 59, 2, 1, 0, "plug 59"), e(2, 59, 1, 1, 0, "plug existing hole"), e(2, 59, 1, 0, 0, "reopen hole"), e(15, 59, 9, 3, 0, "plug hole 2"), e(15, 59, 9, 0, 0, "reopen hole 2"),
        e(0, 40, 0, 89, 0, "cave glowstone"), e(0, 40, 0, 0, 0, "remove glowstone")});
      // A hillside of ledges with walls: dig into it and build on it.
      begin(); flat(); anchors(); hill();
      run("hillside", checks, new Object[][] {e(-20, 61, 0, 0, 0, "dig ledge"), e(-20, 62, 0, 0, 0, "dig ledge 2"), e(-14, 70, 0, 0, 0, "dig wall"), e(-8, 80, 0, 1, 0, "cap ledge"), e(11, 91, 11, 1, 0, "top of tower"), e(11, 60, 11, 0, 0, "dig tower foot"), e(11, 91, 11, 0, 0, "remove top"),
        e(-30, 70, -8, 1, 0, "ledge block"), e(-30, 70, -8, 0, 0, "remove ledge block")});
    }
  }
}
