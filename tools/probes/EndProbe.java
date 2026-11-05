import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 End classes on SpringProbe's World double (real Chunk storage, real World.setBlock):
//   ChunkProviderEnd (ara)       terrain: density field, raw and final block arrays for several seeds and chunks
//   BiomeEndDecorator (aiy)      ChunkProviderEnd.populate on a lazily generated area, world random seeded per chunk
//   WorldGenSpikes (asl)         direct calls at many surface positions (successes and every failure branch)
//   EntityEnderCrystal (wz)      constructor facts, onUpdate fire rule per provider, attackEntityFrom with explosion capture
//   BlockDragonEgg (akp)         facts, fall check (updateTick), schedule hooks, teleport (server and client branches)
//   EntityDragon.createEnderPortal (xa.b(II)V) setBlock call list
// Prints one JSON object per line with a "case" key.
public class EndProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  static Field fd(Class<?> c, String n) throws Exception { return TerrainProbe.field(c, n); }
  static String num(double v) { return Double.toString(v); }
  static String sha(MessageDigest d) { return TerrainProbe.hex(d.digest()); }
  static void putLong(MessageDigest d, long v) { for (int s = 56; s >= 0; s -= 8) d.update((byte) (v >> s)); }
  static int id(aji b) { return aji.b(b); }

  public static class W extends SpringProbe.G {
    ara gen; boolean lazy;
    List<String> spawned = new ArrayList<>();
    List<String> explosions = new ArrayList<>();
    StringBuilder blockLog = new StringBuilder();
    MessageDigest partDigest; int partCount; String firstParts = "";
    public ahu a(int x, int z) { return ahu.x; }
    public apx e(int x, int z) {
      apx c = chunks.get(ck(x, z));
      if (c == null) {
        if (!lazy) throw new AssertionError("unloaded chunk " + x + "," + z);
        c = gen.d(x, z);
        chunks.put(ck(x, z), c);
      }
      return c;
    }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      boolean r = super.d(x, y, z, b, meta, flags);
      if (blockLog.length() > 0) blockLog.append(',');
      blockLog.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(id(b)).append(',').append(meta).append(',').append(flags).append(',').append(r ? 1 : 0).append(']');
      return r;
    }
    public boolean d(sa e) {
      String s;
      if (e instanceof wz) s = "[\"crystal\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + Float.floatToIntBits(e.y) + "," + Float.floatToIntBits(e.z) + "]";
      else if (e instanceof xa) s = "[\"dragon\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + Float.floatToIntBits(e.y) + "," + Float.floatToIntBits(e.z) + "]";
      else if (e instanceof xj) {
        int block = -1;
        try { for (Field f : xj.class.getDeclaredFields()) if (f.getType() == aji.class) { f.setAccessible(true); block = id((aji) f.get(e)); } } catch (Exception ex) { throw new RuntimeException(ex); }
        s = "[\"falling\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + block + "]";
      } else throw new AssertionError(e.getClass());
      spawned.add(s);
      return true;
    }
    public agw a(sa e, double x, double y, double z, float p, boolean flaming) {
      explosions.add("[" + (e == null ? "null" : "\"entity\"") + "," + num(x) + "," + num(y) + "," + num(z) + "," + Float.floatToIntBits(p) + "," + flaming + "]");
      return null;
    }
    public void a(String name, double x, double y, double z, double a, double b, double c) {
      partCount++;
      try {
        for (double v : new double[] {x, y, z, a, b, c}) putLong(partDigest, Double.doubleToLongBits(v));
        for (char ch : name.toCharArray()) partDigest.update((byte) ch);
      } catch (Exception ex) { throw new RuntimeException(ex); }
      if (partCount <= 2) firstParts += (firstParts.isEmpty() ? "" : ",") + "[" + EndProbe.q(name) + "," + num(x) + "," + num(y) + "," + num(z) + "," + num(a) + "," + num(b) + "," + num(c) + "]";
    }
    void resetLogs() throws Exception {
      spawned.clear(); explosions.clear(); blockLog.setLength(0); partCount = 0; firstParts = ""; partDigest = MessageDigest.getInstance("SHA-1");
      pending.setLength(0); pendingKeys.clear(); drops.setLength(0);
    }
  }

  static W world(long seed, long rand, boolean lazy) throws Exception {
    W w = SpringProbe.world(W.class, seed, rand);
    w.manager = new aie(ahu.x, 0.0F);
    w.spawned = new ArrayList<>(); w.explosions = new ArrayList<>(); w.blockLog = new StringBuilder();
    w.lazy = lazy;
    w.gen = new ara(w, seed);
    w.partDigest = MessageDigest.getInstance("SHA-1");
    return w;
  }
  static void setRand(W w, long seed) throws Exception { fd(ahb.class, "s").set(w, new Random(seed)); }
  static Random rand(W w) throws Exception { return (Random) fd(ahb.class, "s").get(w); }
  static void remote(W w, boolean r) throws Exception { fd(ahb.class, "E").setBoolean(w, r); }
  static void provider(W w, aqo p) throws Exception { fd(ahb.class, "t").set(w, p); }

  // Block id x<<11 | z<<7 | y order, one byte per cell (ids stay below 256), the layout of ChunkProviderEnd's array.
  static String chunkHash(apx c) throws Exception {
    MessageDigest d = MessageDigest.getInstance("SHA-1");
    for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) for (int y = 0; y < 128; y++) d.update((byte) id(c.a(x, y, z)));
    return sha(d);
  }
  static String arrayHash(aji[] a) throws Exception {
    MessageDigest d = MessageDigest.getInstance("SHA-1");
    for (aji b : a) d.update((byte) (b == null ? 0 : id(b)));
    return sha(d);
  }
  static String densityHash(double[] n) throws Exception {
    MessageDigest d = MessageDigest.getInstance("SHA-1");
    for (double v : n) putLong(d, Double.doubleToLongBits(v));
    return sha(d);
  }
  static String blockLogHash(W w) throws Exception {
    return TerrainProbe.hex(MessageDigest.getInstance("SHA-1").digest(w.blockLog.toString().getBytes("UTF-8")));
  }

  static void terrain(long seed, int cx, int cz) throws Exception {
    W w = world(seed, 0, true);
    ara gen = w.gen;
    ((Random) fd(ara.class, "i").get(gen)).setSeed((long) cx * 341873128712L + (long) cz * 132897987541L);
    aji[] blocks = new aji[32768];
    ahu[] biomes = w.manager.b(null, cx * 16, cz * 16, 16, 16);
    gen.a(cx, cz, blocks, biomes);
    String density = densityHash((double[]) fd(ara.class, "n").get(gen));
    double[] n = (double[]) fd(ara.class, "n").get(gen);
    String raw = arrayHash(blocks);
    int stone = 0, top = -1;
    for (aji b : blocks) if (b != null) stone++;
    gen.b(cx, cz, blocks, biomes);
    String fin = arrayHash(blocks);
    StringBuilder cols = new StringBuilder("[");
    for (int[] p : new int[][] {{0, 0}, {5, 9}, {8, 8}, {15, 15}, {3, 12}}) {
      int count = 0, high = -1, low = -1;
      for (int y = 0; y < 128; y++) if (blocks[p[0] << 11 | p[1] << 7 | y] != null) { count++; high = y; if (low < 0) low = y; }
      if (cols.length() > 1) cols.append(',');
      cols.append('[').append(p[0]).append(',').append(p[1]).append(',').append(low).append(',').append(high).append(',').append(count).append(']');
    }
    cols.append(']');
    apx chunk = gen.d(cx, cz);
    byte[] ids = chunk.m();
    MessageDigest bd = MessageDigest.getInstance("SHA-1");
    bd.update(ids);
    System.out.println("{\"case\":\"terrain\",\"seed\":" + q("" + seed) + ",\"x\":" + cx + ",\"z\":" + cz + ",\"densityLength\":" + n.length + ",\"densitySha1\":" + q(density)
      + ",\"rawSha1\":" + q(raw) + ",\"blocksSha1\":" + q(fin) + ",\"chunkSha1\":" + q(chunkHash(chunk)) + ",\"filled\":" + stone + ",\"columns\":" + cols
      + ",\"biomeSha1\":" + q(sha(bd)) + ",\"biomeFirst\":" + ids[0] + "}");
  }

  static void population(String label, long seed, int x0, int z0, int size) throws Exception {
    W w = world(seed, 0, true);
    w.lazy = true;
    List<String> steps = new ArrayList<>();
    for (int x = x0; x < x0 + size; x++) for (int z = z0; z < z0 + size; z++) {
      long rs = seed * 1000003L + x * 7919L + z * 104729L + 11L;
      setRand(w, rs);
      w.resetLogs();
      w.gen.a(w.gen, x, z);
      String ents = String.join(",", w.spawned);
      steps.add("{\"chunk\":[" + x + "," + z + "],\"randSeed\":" + q("" + rs) + ",\"entities\":[" + ents + "],\"writes\":" + countEntries(w.blockLog) + ",\"writeSha1\":" + q(blockLogHash(w))
        + ",\"calls\":" + w.callCount + ",\"nextLong\":" + q("" + rand(w).nextLong()) + "}");
    }
    List<Long> keys = new ArrayList<>(w.chunks.keySet());
    Collections.sort(keys);
    List<String> area = new ArrayList<>();
    for (long k : keys) area.add("[" + (int) (k >> 32) + "," + (int) k + "," + q(chunkHash(w.chunks.get(k))) + "]");
    System.out.println("{\"case\":\"population\",\"label\":" + q(label) + ",\"seed\":" + q("" + seed) + ",\"origin\":[" + x0 + "," + z0 + "],\"size\":" + size
      + ",\"steps\":[" + String.join(",", steps) + "],\"area\":[" + String.join(",", area) + "]}");
  }
  static int countEntries(StringBuilder s) {
    if (s.length() == 0) return 0;
    int n = 0;
    for (int i = 0; i < s.length(); i++) if (s.charAt(i) == '[') n++;
    return n;
  }

  // WorldGenSpikes called directly at random surface positions on an unpopulated 6x6 chunk area.
  static void spikes(long seed, int attempts) throws Exception {
    W w = world(seed, 0, true);
    for (int x = -3; x < 3; x++) for (int z = -3; z < 3; z++) w.e(x, z);
    asl spike = new asl(ajn.bs);
    Random pick = new Random(seed ^ 0x5eedL);
    List<String> rows = new ArrayList<>();
    int ok = 0;
    for (int i = 0; i < attempts; i++) {
      int x = pick.nextInt(80) - 40, z = pick.nextInt(80) - 40, mode = pick.nextInt(6);
      int y = w.i(x, z);
      if (mode == 0) y += 1; // floating spot: not on end stone
      else if (mode == 1) y -= 1; // inside the island
      w.resetLogs();
      long rs = seed * 31L + i;
      Random r = new Random(rs);
      boolean res = spike.a(w, r, x, y, z);
      if (res) ok++;
      rows.add("{\"pos\":[" + x + "," + y + "," + z + "],\"randSeed\":" + q("" + rs) + ",\"result\":" + res + ",\"entities\":[" + String.join(",", w.spawned) + "],\"writes\":" + countEntries(w.blockLog)
        + ",\"writeSha1\":" + q(blockLogHash(w)) + ",\"nextLong\":" + q("" + r.nextLong()) + "}");
    }
    List<Long> keys = new ArrayList<>(w.chunks.keySet());
    Collections.sort(keys);
    List<String> area = new ArrayList<>();
    for (long k : keys) area.add("[" + (int) (k >> 32) + "," + (int) k + "," + q(chunkHash(w.chunks.get(k))) + "]");
    System.out.println("{\"case\":\"spikes\",\"seed\":" + q("" + seed) + ",\"successes\":" + ok + ",\"rows\":[" + String.join(",", rows) + "],\"area\":[" + String.join(",", area) + "]}");
  }

  // ---- flat hand-built world for the entity and block scenarios ----
  static int hash3(int x, int y, int z) { return SpringProbe.h(x, y, z); }
  // pattern: 0 empty air, 1 scattered stone (every 4th cell), 2 solid stone
  static W flat(int pattern, int floorTop) throws Exception {
    W w = world(0, 1, false);
    for (int cx = -2; cx <= 2; cx++) for (int cz = -2; cz <= 2; cz++) {
      aji[] blocks = new aji[65536]; byte[] meta = new byte[65536];
      for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) for (int y = 0; y < 256; y++) {
        int wx = cx * 16 + x, wz = cz * 16 + z;
        boolean stone = y <= floorTop || (pattern == 1 && y < 100 && (hash3(wx, y, wz) & 3) == 0) || pattern == 2;
        blocks[(x * 16 + z) * 256 + y] = stone ? ajn.b : ajn.a;
      }
      SpringProbe.chunk(w, cx, cz, blocks, meta);
    }
    return w;
  }
  static String blockFacts(aji b) throws Exception {
    return "{\"bounds\":[" + num(fd(aji.class, "B").getDouble(b)) + "," + num(fd(aji.class, "C").getDouble(b)) + "," + num(fd(aji.class, "D").getDouble(b)) + "," + num(fd(aji.class, "E").getDouble(b))
      + "," + num(fd(aji.class, "F").getDouble(b)) + "," + num(fd(aji.class, "G").getDouble(b)) + "],\"light\":" + b.m() + ",\"opacity\":" + b.k() + ",\"opaque\":" + b.c() + ",\"normal\":" + b.d()
      + ",\"renderType\":" + b.b() + ",\"hardness\":" + num(fd(aji.class, "v").getFloat(b)) + ",\"resistance\":" + num(fd(aji.class, "w").getFloat(b)) + "}";
  }

  static void facts() throws Exception {
    aji egg = ajn.bt;
    W w = flat(0, 3);
    Random r = new Random(1);
    wz e = new wz(w);
    System.out.println("{\"case\":\"facts\",\"egg\":" + blockFacts(egg) + ",\"eggTickRate\":" + egg.a(w) + ",\"eggSideRendered\":" + egg.a((ahl) w, 0, 0, 0, 0) + ",\"eggPick\":" + (egg.d(w, 0, 0, 0) == null ? "null" : "\"present\"")
      + ",\"eggQuantity\":" + egg.a(r) + ",\"eggMaterialBlocksMovement\":" + egg.o().c() + ",\"eggMaterialSolid\":" + egg.o().b()
      + ",\"endStone\":" + blockFacts(ajn.bs) + ",\"obsidian\":" + blockFacts(ajn.Z) + ",\"bedrock\":" + blockFacts(ajn.h)
      + ",\"crystal\":{\"width\":" + num(e.M) + ",\"height\":" + num(e.N) + ",\"yOffset\":" + num(e.L) + ",\"shadow\":" + num(e.Y()) + ",\"health\":" + e.b + ",\"canBeCollidedWith\":" + e.R()
      + ",\"canTriggerWalking\":" + callBool(e, "g_") + ",\"preventEntitySpawning\":" + fd(sa.class, "k").getBoolean(e) + "}"
      + ",\"ids\":{\"endStone\":" + id(ajn.bs) + ",\"obsidian\":" + id(ajn.Z) + ",\"bedrock\":" + id(ajn.h) + ",\"fire\":" + id(ajn.ab) + ",\"egg\":" + id(egg) + ",\"endPortal\":" + id(ajn.bq) + ",\"torch\":" + id(ajn.aa) + ",\"stone\":" + id(ajn.b) + "}}");
    // innerRotation draw: Entity.rand is unseeded, only the range is observable
    int min = Integer.MAX_VALUE, max = -1;
    for (int i = 0; i < 300; i++) { wz c = new wz(w); min = Math.min(min, c.a); max = Math.max(max, c.a); }
    System.out.println("{\"case\":\"crystalRotation\",\"min\":" + min + ",\"max\":" + max + ",\"samples\":300}");
  }
  static boolean callBool(Object o, String name) throws Exception {
    Method m = null;
    for (Class<?> c = o.getClass(); c != null && m == null; c = c.getSuperclass()) try { m = c.getDeclaredMethod(name); } catch (NoSuchMethodException e) {}
    m.setAccessible(true);
    return (Boolean) m.invoke(o);
  }

  // EntityEnderCrystal.onUpdate and attackEntityFrom.
  static void crystal() throws Exception {
    for (int variant = 0; variant < 4; variant++) {
      boolean end = (variant & 1) != 0, hasFire = variant >= 2;
      W w = flat(0, 3);
      provider(w, end ? (aqo) TerrainProbe.unsafe.allocateInstance(aqr.class) : (aqo) TerrainProbe.unsafe.allocateInstance(aqq.class));
      double px = 5.5, py = 40.0, pz = -3.5;
      wz e = new wz(w, px, py, pz);
      int rot0 = e.a;
      if (hasFire) w.d(5, 40, -4, ajn.ab, 0, 0);
      w.resetLogs();
      StringBuilder ticks = new StringBuilder();
      for (int t = 0; t < 3; t++) {
        e.h();
        ticks.append(t > 0 ? "," : "").append("[").append(e.a - rot0).append(",").append(num(e.p)).append(",").append(num(e.q)).append(",").append(num(e.r)).append(",").append(e.b).append("]");
      }
      System.out.println("{\"case\":\"crystalTick\",\"end\":" + end + ",\"fireBelowFlag\":" + hasFire + ",\"pos\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "],\"ticks\":[" + ticks + "],\"writes\":[" + w.blockLog + "]}");
    }
    // attackEntityFrom: [remote, dead, invulnerable]
    boolean[][] cases = {{false, false, false}, {true, false, false}, {false, true, false}, {false, false, true}};
    for (boolean[] c : cases) {
      W w = flat(0, 3);
      remote(w, c[0]);
      wz e = new wz(w, 7.25, 41.0, 2.75);
      if (c[1]) fd(sa.class, "K").setBoolean(e, true);
      if (c[2]) fd(sa.class, "i").setBoolean(e, true);
      boolean inv = e.aw();
      w.resetLogs();
      boolean res = e.a(ro.k, 4.0F);
      System.out.println("{\"case\":\"crystalHit\",\"remote\":" + c[0] + ",\"dead\":" + c[1] + ",\"invulnerable\":" + inv + ",\"result\":" + res + ",\"healthAfter\":" + e.b + ",\"isDeadAfter\":" + fd(sa.class, "K").getBoolean(e) + ",\"explosions\":[" + String.join(",", w.explosions) + "]}");
    }
    // a second hit on a crystal that already exploded does nothing
    W w = flat(0, 3);
    wz e = new wz(w, 0.5, 40, 0.5);
    e.a(ro.k, 1.0F);
    w.resetLogs();
    boolean again = e.a(ro.k, 1.0F);
    System.out.println("{\"case\":\"crystalSecondHit\",\"result\":" + again + ",\"explosions\":" + w.explosions.size() + "}");
  }

  static void egg() throws Exception {
    aji egg = ajn.bt;
    // updateTick fall check: [name, pattern, floorTop, eggY, fallInstantly, eggX]
    Object[][] fall = {
      {"airBelow", 0, 3, 40, false, 0}, {"stoneBelow", 0, 39, 40, false, 0}, {"instant", 0, 9, 40, true, 0}, {"instantToFloor", 0, 3, 40, true, 3},
      {"unloadedRegion", 0, 3, 40, false, 44}, {"groundY0", 0, -1, 0, false, 0}, {"instantToBottom", 0, -1, 6, true, 0},
    };
    for (Object[] f : fall) {
      W w = flat((Integer) f[1], (Integer) f[2]);
      int x = (Integer) f[5], y = (Integer) f[3];
      if (y >= 0) w.d(x, y, 0, egg, 0, 0);
      w.resetLogs();
      boolean instant = (Boolean) f[4];
      fd(akx.class, "M").setBoolean(null, instant);
      egg.a(w, x, y, 0, new Random(1));
      fd(akx.class, "M").setBoolean(null, false);
      System.out.println("{\"case\":\"eggFall\",\"name\":" + q((String) f[0]) + ",\"pos\":[" + x + "," + y + ",0],\"fallInstantly\":" + instant + ",\"entities\":[" + String.join(",", w.spawned) + "],\"writes\":[" + w.blockLog + "]"
        + ",\"below\":" + id(w.a(x, Math.max(y - 1, 0), 0)) + ",\"after\":" + id(w.a(x, y, 0)) + "}");
    }
    // scheduling hooks
    W w = flat(0, 3);
    w.d(2, 20, 2, egg, 0, 0);
    w.resetLogs();
    egg.b(w, 2, 20, 2);
    String added = w.pending.toString();
    w.resetLogs();
    egg.a(w, 2, 20, 2, ajn.b);
    String neighbour = w.pending.toString();
    System.out.println("{\"case\":\"eggSchedule\",\"onBlockAdded\":[" + added + "],\"onNeighborChange\":[" + neighbour + "]}");
    // teleport: [name, pattern, floorTop, x, y, z, meta, remote, randSeed, absent]
    Object[][] tp = {
      {"open", 0, 3, 0, 40, 0, 0, false, 1L, false}, {"open", 0, 3, 0, 40, 0, 0, true, 1L, false}, {"openB", 0, 3, 3, 30, -5, 0, false, 99L, false}, {"openB", 0, 3, 3, 30, -5, 0, true, 99L, false},
      {"scattered", 1, 3, 1, 40, 1, 0, false, 5L, false}, {"scattered", 1, 3, 1, 40, 1, 0, true, 5L, false},
      {"scatteredMeta", 1, 3, -4, 60, 7, 6, false, 1234L, false}, {"scatteredMeta", 1, 3, -4, 60, 7, 6, true, 1234L, false},
      {"solid", 2, 3, 0, 40, 0, 0, false, 8L, false}, {"solid", 2, 3, 0, 40, 0, 0, true, 8L, false},
      {"absent", 0, 3, 0, 40, 0, 0, false, 3L, true}, {"nearBottom", 0, 3, 0, 2, 0, 0, false, 77L, false}, {"nearBottom", 0, 3, 0, 2, 0, 0, true, 77L, false},
      {"scattered", 1, 3, 1, 40, 1, 0, false, 6L, false}, {"scattered", 1, 3, 1, 40, 1, 0, true, 6L, false},
    };
    for (Object[] t : tp) {
      W tw = flat((Integer) t[1], (Integer) t[2]);
      int x = (Integer) t[3], y = (Integer) t[4], z = (Integer) t[5];
      if (!(Boolean) t[9]) tw.d(x, y, z, egg, (Integer) t[6], 0);
      else tw.d(x, y, z, ajn.b, 0, 0);
      tw.resetLogs();
      boolean rem = (Boolean) t[7];
      remote(tw, rem);
      setRand(tw, (Long) t[8]);
      egg.a(tw, x, y, z, (yz) null); // onBlockClicked
      long next = rand(tw).nextLong();
      System.out.println("{\"case\":\"eggTeleport\",\"name\":" + q((String) t[0]) + ",\"pos\":[" + x + "," + y + "," + z + "],\"meta\":" + t[6] + ",\"remote\":" + rem + ",\"randSeed\":" + q("" + t[8]) + ",\"absent\":" + t[9]
        + ",\"writes\":[" + tw.blockLog + "],\"particles\":" + tw.partCount + ",\"particleSha1\":" + q(sha(tw.partDigest)) + ",\"firstParticles\":[" + tw.firstParts + "],\"nextLong\":" + q("" + next) + "}");
    }
    // onBlockActivated runs the same teleport and returns true
    W aw = flat(1, 3);
    aw.d(0, 40, 0, egg, 0, 0);
    aw.resetLogs();
    setRand(aw, 42L);
    boolean r = egg.a(aw, 0, 40, 0, (yz) null, 0, 0.5F, 0.5F, 0.5F);
    System.out.println("{\"case\":\"eggActivate\",\"result\":" + r + ",\"writes\":[" + aw.blockLog + "],\"nextLong\":" + q("" + rand(aw).nextLong()) + "}");
  }

  // EntityDragon.createEnderPortal: the setBlock call list (BlockTorch.onBlockAdded then rewrites metadata, not recorded here).
  static void exitPortal() throws Exception {
    for (int[] p : new int[][] {{0, 0}, {13, -7}, {-40, 25}}) {
      W w = flat(0, 3);
      for (int cx = -4; cx <= 4; cx++) for (int cz = -4; cz <= 4; cz++) if (!w.chunks.containsKey(SpringProbe.G.ck(cx, cz))) SpringProbe.chunk(w, cx, cz, new aji[65536], new byte[65536]);
      final W fw = w;
      fd(ahb.class, "v").set(w, Proxy.newProxyInstance(EndProbe.class.getClassLoader(), new Class<?>[] {apu.class}, (proxy, method, a) -> method.getName().equals("d") && a != null && a.length == 2 ? fw.e((Integer) a[0], (Integer) a[1]) : null));
      xa dragon = (xa) TerrainProbe.unsafe.allocateInstance(xa.class);
      fd(sa.class, "o").set(dragon, w);
      w.resetLogs();
      Method m = xa.class.getDeclaredMethod("b", int.class, int.class);
      m.setAccessible(true);
      m.invoke(dragon, p[0], p[1]);
      boolean flagAfter = fd(akt.class, "a").getBoolean(null);
      System.out.println("{\"case\":\"exitPortal\",\"center\":[" + p[0] + "," + p[1] + "],\"writes\":" + countEntries(w.blockLog) + ",\"writeSha1\":" + q(blockLogHash(w)) + ",\"flagAfter\":" + flagAfter + ",\"calls\":[" + w.blockLog + "]}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    facts();
    long[] seeds = {0L, 1L, -1L, 8675309L, Long.MIN_VALUE, 123456789012345L};
    int[][] chunks = {{0, 0}, {1, 0}, {-1, -1}, {3, 2}, {-2, 5}, {7, -3}, {-5, -6}, {12, 9}, {-20, 13}, {31, 31}};
    for (long s : seeds) for (int[] c : chunks) terrain(s, c[0], c[1]);
    population("origin8", 0L, -4, -4, 8);
    population("shifted", 8675309L, -3, -5, 6);
    population("negative", -1L, -6, -2, 6);
    population("big", 42L, -5, -5, 10);
    for (long s : new long[] {0L, 7L, 8675309L, -3L}) spikes(s, 60);
    crystal();
    egg();
    exitPortal();
  }
}
