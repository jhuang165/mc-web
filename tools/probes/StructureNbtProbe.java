import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Unchanged structure persistence (GEN-05h), Minecraft Java 1.7.10.
// Per scenario (the five StructurePopulationWorldProbe worlds): all four MapGenStructure maps run the
// real ChunkProviderGenerate.provideChunk search and populate. The private MapGenStructureData (avj
// "e") of each generator is read after the search (the data written by func_143026_a when each start was
// created) and after population (start NBT rewritten after generateStructuresInChunk). Both are emitted
// as the raw named-root {data:{Features}} bytes that MapStorage.saveData wraps, base64. A second world
// then loads the created data natively (avj.func_76184_a, as MapStorage.loadData does) and runs the same
// population: the unchanged MapGenStructure.func_143027_a rebuilds every start through
// MapGenStructureIO.func_143035_a, and the step hashes, final chunk and RNG states are recorded.
// Mode "dat <dir>" replays the same scenarios from gzip .dat files (native or written by the JavaScript port):
// <dir>/<label>.<generator>.dat read through CompressedStreamTools. One world per JVM: native class statics make
// a second run in the same process differ (seen for the jungle worlds s5_-50_-48 and s1_46_3).
public class StructureNbtProbe {
  static final String[] GENERATORS = {"mineshaft", "village", "stronghold", "scatteredFeature"};
  static final String[] DATA_NAMES = {"Mineshaft", "Village", "Stronghold", "Temple"};
  static String q(String s) { return TerrainProbe.q(s); }
  static String b64(byte[] a) { return Base64.getEncoder().encodeToString(a); }
  static byte[] raw(dh root) throws Exception { ByteArrayOutputStream b = new ByteArrayOutputStream(); du.a(root, (DataOutput)new DataOutputStream(b)); return b.toByteArray(); }

  public static class DW extends PopulationWorldProbe.W {
    Map<String, ayl> data; // world instances are allocated without constructors
    public ayl a(Class c, String n) { return data == null ? null : data.get(n); }
  }

  static class Out {
    String search, step, area, worldNext, mapOrder;
    Map<String, String> created = new LinkedHashMap<>(), populated = new LinkedHashMap<>(), populatedGzip = new LinkedHashMap<>();
    Map<String, String> starts = new LinkedHashMap<>();
    Map<String, String> order = new LinkedHashMap<>();
  }

  static avj data(ave gen) throws Exception { return (avj)TerrainProbe.field(ave.class, "e").get(gen); }
  static dh root(avj d) { dh data = new dh(); d.b(data); dh root = new dh(); root.a("data", data); return root; }
  static String keyList(dh features) { StringJoiner s = new StringJoiner(",", "[", "]"); for (Object k : features.c()) s.add(q((String)k)); return s.toString(); }
  static String mapKeys(ave gen) throws Exception { StringJoiner s = new StringJoiner(",", "[", "]"); for (Object o : ((Map<?,?>)TerrainProbe.field(ave.class, "d").get(gen)).values()) { avm v = (avm)o; s.add("[" + v.e() + "," + v.f() + "]"); } return s.toString(); }
  static String startsJson(avj d) throws Exception {
    dh features = d.a(); StringJoiner s = new StringJoiner(",", "[", "]");
    for (Object k : features.c()) { dh start = features.m((String)k); byte[] bytes = raw(start); s.add("[" + q((String)k) + "," + q(TerrainProbe.hex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes))) + "," + bytes.length + "]"); }
    return s.toString();
  }

  static Out run(long seed, String typeName, int cx, int cz, Map<String, avj> preload) throws Exception {
    ahm type = typeName.equals("default") ? ahm.b : typeName.equals("amplified") ? ahm.e : ahm.d;
    TerrainProbe.resetMesa(); DW w = SpringProbe.world(DW.class, seed, 0L);
    if (preload != null) { w.data = new HashMap<>(); } if (preload != null) for (int i = 0; i < GENERATORS.length; i++) w.data.put(DATA_NAMES[i], preload.get(GENERATORS[i]));
    w.carts = new ArrayList<>(); w.animals = new ArrayList<>(); w.manager = new aib(seed, type);
    w.info = (ays)TerrainProbe.unsafe.allocateInstance(ays.class); TerrainProbe.set(w.info, "a", seed);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == ahm.class) { f.setAccessible(true); f.set(w.info, type); }
    aqz gen = new aqz(w, seed, true); w.halo = new aqz(w, seed, false);
    ave[] g = {new StructurePopulationWorldProbe.M(), new StructurePopulationWorldProbe.V(), new StructurePopulationWorldProbe.S(), new StructurePopulationWorldProbe.T()};
    TerrainProbe.set(gen, "w", g[0]); TerrainProbe.set(gen, "v", g[1]); TerrainProbe.set(gen, "u", g[2]); TerrainProbe.set(gen, "x", g[3]);
    StructurePopulationWorldProbe.searchOrder.clear();
    apx chunk = gen.d(cx, cz); Out out = new Out(); out.search = StructurePopulationWorldProbe.list(StructurePopulationWorldProbe.searchOrder);
    chunk.d = true; w.chunks.put(SpringProbe.G.ck(cx, cz), chunk);
    StringJoiner mapOrder = new StringJoiner(",", "{", "}");
    for (int i = 0; i < 4; i++) {
      avj d = data(g[i]);
      out.created.put(GENERATORS[i], b64(raw(root(d))));
      out.order.put(GENERATORS[i], keyList(d.a()));
      out.starts.put(GENERATORS[i], startsJson(d));
      mapOrder.add(q(GENERATORS[i]) + ":" + mapKeys(g[i]));
    }
    out.mapOrder = mapOrder.toString();
    akx.M = true;
    try { out.step = StructurePopulationWorldProbe.step(w, gen, cx, cz); } finally { akx.M = false; }
    for (int i = 0; i < 4; i++) {
      avj d = data(g[i]); dh r = root(d);
      out.populated.put(GENERATORS[i], b64(raw(r)));
      out.populatedGzip.put(GENERATORS[i], b64(du.a(r)));
    }
    out.area = MineshaftWorldProbe.chunkHash(w.e(cx, cz));
    out.worldNext = "" + ((Random)TerrainProbe.get(w, "s")).nextLong();
    return out;
  }

  static String map(Map<String, String> m, boolean quote) { StringJoiner s = new StringJoiner(",", "{", "}"); for (Map.Entry<String, String> e : m.entrySet()) s.add(q(e.getKey()) + ":" + (quote ? q(e.getValue()) : e.getValue())); return s.toString(); }
  static String replay(Out o) { return "{\"mapOrder\":" + o.mapOrder + ",\"step\":" + o.step + ",\"areaSha1\":" + q(o.area) + ",\"worldNextLong\":" + q(o.worldNext) + ",\"populated\":" + map(o.populated, true) + "}"; }

  // The unchanged loader path: MapStorage.loadData reads the compressed file, takes "data" and calls readFromNBT.
  static avj load(String name, dh root) throws Exception {
    avj d = new avj(name); d.a(root.m("data")); return d;
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe)uf.get(null); aji.p(); adb.l();
    // The first five are the GEN-05g worlds; the rest are census worlds found with the JS searchers to cover more piece ids.
    long[] seeds = {0L, 17L, 17L, 17L, 0L, 17L, 0L, 0L, 5L, 1L}; int[][] chunks = {{-19, 18}, {-25, 5}, {-4, -55}, {10, -53}, {0, -1}, {50, -12}, {-53, -16}, {3, 47}, {-50, -48}, {46, 3}};
    String extra = System.getenv("STRUCTURE_NBT_SCENARIOS"); // diagnostic override: seed:cx:cz,...
    if (extra != null) { String[] parts = extra.split(","); seeds = new long[parts.length]; chunks = new int[parts.length][2];
      for (int i = 0; i < parts.length; i++) { String[] f = parts[i].split(":"); seeds[i] = Long.parseLong(f[0]); chunks[i][0] = Integer.parseInt(f[1]); chunks[i][1] = Integer.parseInt(f[2]); } }
    boolean js = args.length > 1 && args[0].equals("dat");
    for (int n = 0; n < seeds.length; n++) {
      long seed = seeds[n]; int cx = chunks[n][0], cz = chunks[n][1]; String label = "s" + seed + "_" + cx + "_" + cz;
      Map<String, avj> preload = new LinkedHashMap<>();
      if (js) {
        for (int i = 0; i < 4; i++) {
          try (InputStream in = new FileInputStream(new File(args[1], label + "." + GENERATORS[i] + ".dat"))) { preload.put(GENERATORS[i], load(DATA_NAMES[i], du.a(in))); }
        }
        Out o = run(seed, "default", cx, cz, preload);
        // Native re-serialisation of what the loader read, before and after population.
        System.out.println("{\"kind\":\"dat\",\"label\":" + q(label) + ",\"created\":" + map(o.created, true) + ",\"replay\":" + replay(o) + "}");
        continue;
      }
      Out base = run(seed, "default", cx, cz, null);
      System.out.println("{\"kind\":\"scenario\",\"label\":" + q(label) + ",\"seed\":" + q("" + seed) + ",\"type\":\"default\",\"chunk\":[" + cx + "," + cz + "],\"searchOrder\":" + base.search
        + ",\"created\":" + map(base.created, true) + ",\"createdKeys\":" + map(base.order, false) + ",\"createdStarts\":" + map(base.starts, false)
        + ",\"baseline\":" + replay(base) + ",\"populatedGzip\":" + map(base.populatedGzip, true) + "}");
    }
  }
}
