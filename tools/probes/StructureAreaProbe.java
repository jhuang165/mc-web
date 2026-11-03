import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged ChunkProviderGenerate over a whole size x size chunk area, all four structure maps on.
// Like ChunkProviderServer: every chunk is provided first (terrain, surface, caves/ravines, the four
// range-8 start searches) in x-outer/z-inner order, then every chunk is populated in the same order
// with ChunkProviderGenerate.populate (population reseed, lakes, dungeons, map features, decoration
// tail). Unprovided neighbours come from an unpopulated lazy halo (PopulationWorldProbe.W).
// Per populated chunk: ordered World calls/writes, the provider Random and World.rand after the step.
// Per chunk after the whole area: final block hash, tile entities (chest, dispenser, spawner, flower pot),
// entities (villagers, witches). Light remains the PopulationWorldProbe fixture (no propagation).
// Args: label:seed:originChunkX:originChunkZ:size (type default).
public class StructureAreaProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  static String slots(Object inv, int n) throws Exception {
    List<String> out = new ArrayList<>();
    Method get = inv.getClass().getMethod("a", int.class);
    for (int i = 0; i < n; i++) out.add(MineshaftProbe.stack((add) get.invoke(inv, i)));
    return "[" + String.join(",", out) + "]";
  }
  static String tile(PopulationWorldProbe.W w, aor t) throws Exception {
    String head = "[" + t.c + "," + t.d + "," + t.e + ",";
    if (t instanceof apj) return head + "\"spawner\"," + q(((apj) t).a().e()) + "]";
    if (t instanceof aow) return head + "\"chest\"," + w.e(t.c, t.d, t.e) + "," + slots(t, 27) + "]";
    if (t instanceof apb) return head + "\"dispenser\"," + w.e(t.c, t.d, t.e) + "," + slots(t, 9) + "]";
    if (t instanceof apg) return head + "\"furnace\"," + w.e(t.c, t.d, t.e) + "," + slots(t, 3) + "]";
    if (t instanceof apf) { apf p = (apf) t; return head + "\"flowerPot\"," + (p.a() == null ? -1 : adb.b(p.a())) + "," + p.b() + "]"; }
    throw new AssertionError(t.getClass());
  }
  static String entity(sa e) {
    String name = e instanceof yv ? "Villager" : e instanceof yp ? "Witch" : PopulationTailProbe.NAMES.get(e.getClass());
    if (name == null) throw new AssertionError(e.getClass());
    int profession = e instanceof yv ? ((yv) e).bZ() : -1;
    return "[" + q(name) + "," + e.s + "," + e.t + "," + e.u + "," + Float.floatToIntBits(e.y) + "," + profession + "]";
  }
  static void run(String label, long seed, int cx0, int cz0, int size) throws Exception {
    ahm type = ahm.b;
    TerrainProbe.resetMesa(); PopulationWorldProbe.W w = SpringProbe.world(PopulationWorldProbe.W.class, seed, 0L);
    w.carts = new ArrayList<>(); w.animals = new ArrayList<>(); w.manager = new aib(seed, type);
    w.info = (ays) TerrainProbe.unsafe.allocateInstance(ays.class); TerrainProbe.set(w.info, "a", seed);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == ahm.class) { f.setAccessible(true); f.set(w.info, type); }
    aqz gen = new aqz(w, seed, true); w.halo = new aqz(w, seed, false);
    StructurePopulationWorldProbe.searchOrder.clear();
    List<String> inputs = new ArrayList<>();
    for (int x = cx0; x < cx0 + size; x++) for (int z = cz0; z < cz0 + size; z++) {
      apx c = gen.d(x, z); c.d = true; w.chunks.put(SpringProbe.G.ck(x, z), c);
      inputs.add("[" + x + "," + z + "," + q(MineshaftWorldProbe.chunkHash(c)) + "]");
    }
    Random random = (Random) TerrainProbe.get(gen, "i");
    List<String> steps = new ArrayList<>();
    akx.M = true;
    try {
      for (int x = cx0; x < cx0 + size; x++) for (int z = cz0; z < cz0 + size; z++) {
        w.calls = MessageDigest.getInstance("SHA-1"); w.writes = MessageDigest.getInstance("SHA-1"); w.callCount = 0; w.writeCount = 0;
        // -DtraceChunk=x,z dumps that chunk's ordered World calls to -DtraceFile (debugging aid only).
        boolean tracing = System.getProperty("traceChunk") != null && System.getProperty("traceChunk").equals(x + "," + z);
        if (tracing) w.trace = new StringBuilder();
        gen.a(gen, x, z);
        if (tracing) { java.nio.file.Files.writeString(java.nio.file.Path.of(System.getProperty("traceFile")), w.trace.toString()); w.trace = null; }
        steps.add("{\"chunk\":[" + x + "," + z + "],\"callCount\":" + w.callCount + ",\"callsSha1\":" + q(TerrainProbe.hex(w.calls.digest()))
          + ",\"writeCount\":" + w.writeCount + ",\"writesSha1\":" + q(TerrainProbe.hex(w.writes.digest()))
          + ",\"providerNextLong\":" + q("" + random.nextLong()) + ",\"worldNextLong\":" + q("" + ((Random) TerrainProbe.get(w, "s")).nextLong()) + "}");
      }
    } finally { akx.M = false; }
    List<String> chunks = new ArrayList<>();
    for (int x = cx0; x < cx0 + size; x++) for (int z = cz0; z < cz0 + size; z++) {
      apx c = w.e(x, z);
      List<aor> tl = new ArrayList<>(); for (Object o : c.i.values()) tl.add((aor) o);
      tl.sort(Comparator.<aor>comparingInt(t -> t.c).thenComparingInt(t -> t.e).thenComparingInt(t -> t.d));
      List<String> tiles = new ArrayList<>(); for (aor t : tl) tiles.add(tile(w, t));
      List<String> ents = new ArrayList<>();
      for (sa e : w.animals) if ((((int) Math.floor(e.s)) >> 4) == x && (((int) Math.floor(e.u)) >> 4) == z) ents.add(entity(e));
      chunks.add("{\"chunk\":[" + x + "," + z + "],\"sha1\":" + q(MineshaftWorldProbe.chunkHash(c)) + ",\"tiles\":[" + String.join(",", tiles) + "],\"entities\":[" + String.join(",", ents) + "]}");
    }
    System.out.println("{\"kind\":\"structureArea\",\"label\":" + q(label) + ",\"seed\":" + q("" + seed) + ",\"type\":\"default\",\"origin\":[" + cx0 + "," + cz0 + "],\"size\":" + size
      + ",\"inputs\":[" + String.join(",", inputs) + "],\"steps\":[" + String.join(",", steps) + "],\"chunks\":[" + String.join(",", chunks) + "]"
      + ",\"starts\":" + StructurePopulationWorldProbe.mapRows(gen) + ",\"carts\":[" + String.join(",", w.carts) + "],\"pending\":[" + w.pending + "],\"drops\":[" + w.drops + "]}");
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null); aji.p(); adb.l();
    for (String a : args) { String[] p = a.split(":"); run(p[0], Long.parseLong(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); }
  }
}
