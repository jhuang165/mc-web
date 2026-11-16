import java.lang.reflect.*;
import java.util.*;

// b77 worldflags77: unchanged ChunkProviderGenerate (aqz) provideChunk + populate with mapFeaturesEnabled true and false for the
// same seed/chunk (WorldType default). No structure generator is replaced or traced; the constructor's boolean is the only
// difference between the two records. Same World/Chunk doubles as StructurePopulationWorldProbe (full block light, sky 15).
// Records, per run: provideChunk input hash, ordered call/write counts and hashes of the populate step, the provider Random and
// World.rand continuations, tiles, entities, carts, pending ticks, drops, and the final hashes of the 2x2 chunks the populate
// of (cx, cz) can touch (cx..cx+1, cz..cz+1).
public class WorldFlagsProbe {
  static String q(String s) { return TerrainProbe.q(s); }
  static void run(long seed, int cx, int cz, boolean mapFeatures) throws Exception {
    TerrainProbe.resetMesa();
    PopulationWorldProbe.W w = SpringProbe.world(PopulationWorldProbe.W.class, seed, 0L);
    w.carts = new ArrayList<>(); w.animals = new ArrayList<>(); w.manager = new aib(seed, ahm.b);
    w.info = (ays) TerrainProbe.unsafe.allocateInstance(ays.class); TerrainProbe.set(w.info, "a", seed);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == ahm.class) { f.setAccessible(true); f.set(w.info, ahm.b); }
    aqz gen = new aqz(w, seed, mapFeatures); w.halo = new aqz(w, seed, false);
    apx chunk = gen.d(cx, cz); chunk.d = true; w.chunks.put(SpringProbe.G.ck(cx, cz), chunk);
    String input = MineshaftWorldProbe.chunkHash(chunk);
    w.calls = java.security.MessageDigest.getInstance("SHA-1"); w.writes = java.security.MessageDigest.getInstance("SHA-1"); w.callCount = 0; w.writeCount = 0;
    Random random = (Random) TerrainProbe.get(gen, "i");
    akx.M = true;
    try { gen.a(gen, cx, cz); } finally { akx.M = false; }
    String step = "{\"callCount\":" + w.callCount + ",\"callsSha1\":" + q(TerrainProbe.hex(w.calls.digest())) + ",\"writeCount\":" + w.writeCount + ",\"writesSha1\":" + q(TerrainProbe.hex(w.writes.digest())) + ",\"providerNextLong\":" + q("" + random.nextLong()) + "}";
    String tileData = PopulationWorldProbe.tiles(w);
    StringJoiner area = new StringJoiner(",", "[", "]");
    for (int x = cx; x <= cx + 1; x++) for (int z = cz; z <= cz + 1; z++) area.add(q(MineshaftWorldProbe.chunkHash(w.e(x, z))));
    System.out.println("{\"kind\":\"flags\",\"seed\":" + q("" + seed) + ",\"mapFeatures\":" + mapFeatures + ",\"chunk\":[" + cx + "," + cz + "],\"inputSha1\":" + q(input) + ",\"step\":" + step
      + ",\"tiles\":" + tileData + ",\"entities\":" + StructurePopulationWorldProbe.entities(w) + ",\"carts\":[" + String.join(",", w.carts) + "],\"pending\":[" + w.pending + "],\"drops\":[" + w.drops + "],\"areaSha1\":" + area
      + ",\"worldNextLong\":" + q("" + ((Random) TerrainProbe.get(w, "s")).nextLong()) + "}");
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null); aji.p(); adb.l();
    long[][] fixtures = {{0, -19, 18}, {17, -25, 5}, {17, -4, -55}, {17, 10, -53}, {0, 0, -1}};
    for (long[] f : fixtures) for (boolean mf : new boolean[] {true, false}) run(f[0], (int) f[1], (int) f[2], mf);
    // Off-only sweep over varied biomes: the structure-free population (lakes, dungeons, decoration) with its native neighbour callbacks.
    long[][] sweepChunks = {{0, 0}, {30, -20}, {-60, 45}, {75, 80}};
    for (long seed : new long[] {1, 2, 3, 4}) for (long[] c : sweepChunks) run(seed, (int) c[0], (int) c[1], false);
  }
}
