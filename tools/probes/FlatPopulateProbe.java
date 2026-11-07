import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged ChunkProviderFlat (aqu): every chunk of a size x size area is provided first (terrain plus each enabled structure
// generator's range-8 start search, in list order), then populated x outer / z inner with aqu.populate (the population
// reseed, the structure generators on the provider Random, lake, lava_lake, eight dungeons and decoration). The world is
// PopulationWorldProbe's Chunk-backed double (sky light 15, block light 0, unpopulated lazy halo from a second aqu with map
// features off). Per populated chunk: ordered World calls and writes, the provider Random and World.rand afterwards. Per
// chunk after the area: block hash, tile entities, entities. Args: label:seed:originChunkX:originChunkZ:size:mapFeatures:options
// (options may contain ':' and ';' but not a leading colon field; the first six fields never do).
public class FlatPopulateProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  public static class W extends PopulationWorldProbe.W {
    aqu fhalo;
    public apx e(int x, int z) {
      apx c = chunks.get(ck(x, z));
      if (c == null) { c = fhalo.d(x, z); c.d = true; chunks.put(ck(x, z), c); }
      return c;
    }
  }
  static String starts(aqu gen) throws Exception {
    List<?> list = (List<?>) TerrainProbe.get(gen, "f");
    StringJoiner out = new StringJoiner(",", "{", "}");
    for (Object g : list) {
      String name = g instanceof avn ? "village" : g instanceof atx ? "scatteredFeature" : g instanceof asw ? "mineshaft" : g instanceof aug ? "stronghold" : null;
      if (name == null) throw new AssertionError(g.getClass());
      out.add(q(name) + ":" + StructurePopulationWorldProbe.starts((ave) g));
    }
    return out.toString();
  }
  static String order(aqu gen) throws Exception {
    StringJoiner out = new StringJoiner(",", "[", "]");
    for (Object g : (List<?>) TerrainProbe.get(gen, "f")) out.add(q(g instanceof avn ? "village" : g instanceof atx ? "scatteredFeature" : g instanceof asw ? "mineshaft" : "stronghold"));
    return out.toString();
  }
  static void run(String label, long seed, int cx0, int cz0, int size, boolean features, String options) throws Exception {
    TerrainProbe.resetMesa();
    W w = SpringProbe.world(W.class, seed, 0L);
    w.carts = new ArrayList<>(); w.animals = new ArrayList<>();
    ass info = ass.a(options);
    w.manager = new aie(ahu.d(info.a()), 0.5f);
    w.info = (ays) TerrainProbe.unsafe.allocateInstance(ays.class); TerrainProbe.set(w.info, "a", seed);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == ahm.class) { f.setAccessible(true); f.set(w.info, ahm.c); }
    aqu gen = new aqu(w, seed, features, options); w.fhalo = new aqu(w, seed, false, options);
    List<String> inputs = new ArrayList<>(), steps = new ArrayList<>();
    for (int x = cx0; x < cx0 + size; x++) for (int z = cz0; z < cz0 + size; z++) {
      apx c = gen.d(x, z); c.d = true; w.chunks.put(SpringProbe.G.ck(x, z), c);
      inputs.add("[" + x + "," + z + "," + q(MineshaftWorldProbe.chunkHash(c)) + "]");
    }
    Random random = (Random) TerrainProbe.get(gen, "b");
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
      List<String> tiles = new ArrayList<>(); for (aor t : tl) tiles.add(StructureAreaProbe.tile(w, t));
      List<String> ents = new ArrayList<>();
      for (sa e : w.animals) if ((((int) Math.floor(e.s)) >> 4) == x && (((int) Math.floor(e.u)) >> 4) == z) ents.add(StructureAreaProbe.entity(e));
      chunks.add("{\"chunk\":[" + x + "," + z + "],\"sha1\":" + q(MineshaftWorldProbe.chunkHash(c)) + ",\"tiles\":[" + String.join(",", tiles) + "],\"entities\":[" + String.join(",", ents) + "]}");
    }
    System.out.println("{\"kind\":\"flatArea\",\"label\":" + q(label) + ",\"seed\":" + q("" + seed) + ",\"options\":" + q(options) + ",\"parsed\":" + q(info.toString()) + ",\"mapFeatures\":" + features
      + ",\"origin\":[" + cx0 + "," + cz0 + "],\"size\":" + size + ",\"generators\":" + order(gen)
      + ",\"inputs\":[" + String.join(",", inputs) + "],\"steps\":[" + String.join(",", steps) + "],\"chunks\":[" + String.join(",", chunks) + "]"
      + ",\"starts\":" + starts(gen) + ",\"carts\":[" + String.join(",", w.carts) + "],\"pending\":[" + w.pending + "],\"drops\":[" + w.drops + "]}");
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null); aji.p(); adb.l();
    for (String a : args) {
      String[] p = a.split(":", 7);
      run(p[0], Long.parseLong(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), p[5].equals("1"), p[6]);
    }
  }
}
