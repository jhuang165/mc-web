import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Random;

// Records the unchanged 1.7.10 Overworld biome layers and WorldChunkManager, one JSON record per line:
//   biomes  every registered BiomeGenBase (ahu.n()[0..255]): list index, id, name, class, temperature, rainfall, root height,
//           height variation, temperature category, snowy (j), enableSnow (d), mesa (instanceof ail), top/filler
//           block id and metadata fields, plus the static field (letter) that holds each biome.
//   graph   for one seed and world type, the layer objects GenLayer.initializeAllBiomeGenerators (axn.a) builds,
//           in depth-first order from the river mix: class, base seed (b), world seed after init (c), the layer
//           inputs, and getInts over one area.
//   ints    getInts (axn.a(x, z, w, h)) of the river mix (genBiomes) and the voronoi zoom (biomeIndexLayer) over
//           areas with negative and far coordinates, per seed and world type.
//   manager WorldChunkManager(seed, type): getBiomesForGeneration, loadBlockGeneratorData (aligned chunks use the
//           BiomeCache), getRainfall, areBiomesViable and findBiomePosition with java.util.Random(seed).
public class BiomeLayerProbe {
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
      } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String ints(int[] a, int n) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < n; i++) b.append(i == 0 ? "" : ",").append(a[i]);
    return b.append("]").toString();
  }
  static int[] call(axn layer, int x, int z, int w, int h) {
    axl.a();
    int[] r = layer.a(x, z, w, h);
    int[] copy = new int[w * h];
    System.arraycopy(r, 0, copy, 0, w * h);
    return copy;
  }
  static String typeName(ahm t) {
    return t == ahm.b ? "default" : t == ahm.d ? "largeBiomes" : t == ahm.e ? "amplified" : t == ahm.f ? "default_1_1" : "?";
  }
  static int blockId(Object b) { return b == null ? -1 : aji.b((aji) b); }

  // Inputs of a layer: the parent (a) first, then the layer class's own GenLayer fields by name.
  static List<axn> inputs(axn l) throws Exception {
    List<axn> r = new ArrayList<>();
    Object p = field(axn.class, "a").get(l);
    if (p != null) r.add((axn) p);
    List<Field> own = new ArrayList<>();
    for (Field f : l.getClass().getDeclaredFields())
      if (axn.class.isAssignableFrom(f.getType()) && !Modifier.isStatic(f.getModifiers())) own.add(f);
    own.sort((x, y) -> x.getName().compareTo(y.getName()));
    for (Field f : own) {
      f.setAccessible(true);
      Object v = f.get(l);
      if (v != null) r.add((axn) v);
    }
    return r;
  }

  static void graph(String name, long seed, ahm type) throws Exception {
    axn[] layers = axn.a(seed, type);
    IdentityHashMap<axn, Integer> ids = new IdentityHashMap<>();
    List<axn> order = new ArrayList<>();
    visit(layers[0], ids, order);
    visit(layers[1], ids, order);
    StringBuilder out = new StringBuilder("{\"kind\":\"graph\",\"name\":" + q(name) + ",\"seed\":" + q(Long.toString(seed)) + ",\"type\":" + q(typeName(type)));
    out.append(",\"roots\":[").append(ids.get(layers[0])).append(",").append(ids.get(layers[1])).append(",").append(ids.get(layers[2])).append("],\"area\":[-6,-6,12,12],\"nodes\":[");
    for (int i = 0; i < order.size(); i++) {
      axn l = order.get(i);
      StringBuilder in = new StringBuilder("[");
      List<axn> inp = inputs(l);
      for (int j = 0; j < inp.size(); j++) in.append(j == 0 ? "" : ",").append(ids.get(inp.get(j)));
      in.append("]");
      out.append(i == 0 ? "" : ",").append("{\"class\":").append(q(l.getClass().getName()));
      if (l instanceof awy) out.append(",\"mode\":").append(((Enum) get(l, "c")).ordinal());
      out
          .append(",\"base\":").append(q(Long.toString((Long) field(axn.class, "b").get(l))))
          .append(",\"world\":").append(q(Long.toString((Long) field(axn.class, "c").get(l))))
          .append(",\"inputs\":").append(in).append(",\"ints\":").append(ints(call(l, -6, -6, 12, 12), 144)).append("}");
    }
    System.out.println(out.append("]}"));
  }
  static void visit(axn l, IdentityHashMap<axn, Integer> ids, List<axn> order) throws Exception {
    if (ids.containsKey(l)) return;
    ids.put(l, order.size());
    order.add(l);
    for (axn p : inputs(l)) visit(p, ids, order);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    // ---- biomes
    StringBuilder b = new StringBuilder("{\"kind\":\"biomes\",\"biomes\":[");
    boolean first = true;
    for (int id = 0; id < 256; id++) {
      ahu biome = ahu.n()[id];
      if (biome == null) continue;
      b.append(first ? "" : ",").append("{\"index\":").append(id).append(",\"id\":").append(biome.ay).append(",\"name\":").append(q(String.valueOf(biome.af)))
          .append(",\"class\":").append(q(biome.getClass().getName()))
          .append(",\"temperature\":").append(Float.toString(biome.ao)).append(",\"rainfall\":").append(Float.toString(biome.ap))
          .append(",\"rootHeight\":").append(Float.toString((Float) get(biome, "am"))).append(",\"heightVariation\":").append(Float.toString((Float) get(biome, "an")))
          .append(",\"category\":").append(biome.m().ordinal()).append(",\"snowy\":").append(biome.j()).append(",\"enableSnow\":").append(biome.d())
          .append(",\"mesa\":").append(biome instanceof ail).append(",\"rainfallInt\":").append(biome.h())
          .append(",\"top\":[").append(blockId(get(biome, "ai"))).append(",").append(get(biome, "aj")).append("]")
          .append(",\"filler\":[").append(blockId(get(biome, "ak"))).append(",").append(get(biome, "al")).append("]}");
      first = false;
    }
    b.append("],\"fields\":{");
    first = true;
    for (Field f : ahu.class.getDeclaredFields())
      if (Modifier.isStatic(f.getModifiers()) && f.getType() == ahu.class) {
        f.setAccessible(true);
        ahu v = (ahu) f.get(null);
        b.append(first ? "" : ",").append(q(f.getName())).append(":").append(v == null ? -1 : v.ay);
        first = false;
      }
    b.append("},\"categories\":[");
    for (int i = 0; i < ahw.values().length; i++) b.append(i == 0 ? "" : ",").append(q(ahw.values()[i].name()));
    System.out.println(b.append("]}"));

    // ---- layer graphs
    graph("default", 8675309L, ahm.b);
    graph("largeBiomes", 8675309L, ahm.d);
    graph("default_1_1", 8675309L, ahm.f);

    // ---- getInts
    long[] seeds = {0L, 1L, -1L, 123456789L, (long) "Overworld".hashCode(), (long) "chunks".hashCode(), Long.MAX_VALUE, Long.MIN_VALUE, -6148914691236517206L, 2862933555777941757L};
    ahm[] types = {ahm.b, ahm.d, ahm.f, ahm.e};
    int[][] mixAreas = {{-8, -8, 16, 16}, {100, -300, 24, 20}, {-5000, 7000, 10, 10}, {7500000, -7500000, 5, 7}};
    int[][] voronoiAreas = {{-32, -32, 48, 48}, {1232, -4320, 16, 16}, {-30000000, 29999984, 16, 16}, {37, -91, 13, 21}};
    for (long seed : seeds)
      for (ahm type : types) {
        if ((type == ahm.f || type == ahm.e) && seed != seeds[4] && seed != seeds[7]) continue;
        axn[] layers = axn.a(seed, type);
        StringBuilder r = new StringBuilder("{\"kind\":\"ints\",\"seed\":" + q(Long.toString(seed)) + ",\"type\":" + q(typeName(type)) + ",\"mix\":[");
        for (int i = 0; i < mixAreas.length; i++) {
          int[] a = mixAreas[i];
          r.append(i == 0 ? "" : ",").append("[").append(a[0]).append(",").append(a[1]).append(",").append(a[2]).append(",").append(a[3]).append(",").append(ints(call(layers[0], a[0], a[1], a[2], a[3]), a[2] * a[3])).append("]");
        }
        r.append("],\"voronoi\":[");
        for (int i = 0; i < voronoiAreas.length; i++) {
          int[] a = voronoiAreas[i];
          r.append(i == 0 ? "" : ",").append("[").append(a[0]).append(",").append(a[1]).append(",").append(a[2]).append(",").append(a[3]).append(",").append(ints(call(layers[1], a[0], a[1], a[2], a[3]), a[2] * a[3])).append("]");
        }
        System.out.println(r.append("]}"));
      }

    // ---- WorldChunkManager
    for (long seed : new long[] {(long) "Overworld".hashCode(), -4172144997902289642L, 42L})
      for (ahm type : new ahm[] {ahm.b, ahm.d}) {
        aib m = new aib(seed, type);
        StringBuilder r = new StringBuilder("{\"kind\":\"manager\",\"seed\":" + q(Long.toString(seed)) + ",\"type\":" + q(typeName(type)));
        ahu[] gen = m.a((ahu[]) null, -3, 5, 10, 10);
        int[] genIds = new int[gen.length];
        for (int i = 0; i < gen.length; i++) genIds[i] = gen[i].ay;
        r.append(",\"generation\":[-3,5,10,10,").append(ints(genIds, 100)).append("]");
        r.append(",\"blocks\":[");
        int[][] blockAreas = {{-48, 32, 16, 16, 1}, {-48, 32, 16, 16, 0}, {5, -7, 16, 16, 1}, {160, 160, 16, 16, 1}};
        for (int i = 0; i < blockAreas.length; i++) {
          int[] a = blockAreas[i];
          ahu[] got = m.a((ahu[]) null, a[0], a[1], a[2], a[3], a[4] != 0);
          int[] gi = new int[got.length];
          for (int j = 0; j < got.length; j++) gi[j] = got[j].ay;
          r.append(i == 0 ? "" : ",").append("[").append(a[0]).append(",").append(a[1]).append(",").append(a[2]).append(",").append(a[3]).append(",").append(a[4]).append(",").append(ints(gi, a[2] * a[3])).append("]");
        }
        r.append("],\"at\":[");
        int[][] points = {{0, 0}, {-1, -1}, {15, 16}, {-300, 1234}, {99999, -99999}};
        for (int i = 0; i < points.length; i++) r.append(i == 0 ? "" : ",").append("[").append(points[i][0]).append(",").append(points[i][1]).append(",").append(m.a(points[i][0], points[i][1]).ay).append("]");
        float[] rain = m.a((float[]) null, -20, 30, 8, 8);
        r.append("],\"rainfall\":[-20,30,8,8,[");
        for (int i = 0; i < 64; i++) r.append(i == 0 ? "" : ",").append(Float.toString(rain[i]));
        r.append("]],\"viable\":[");
        List spawn = m.a();
        int[][] viable = {{0, 0, 0}, {0, 0, 16}, {200, -200, 32}, {-1000, 64, 8}, {48, 48, 256}};
        for (int i = 0; i < viable.length; i++) r.append(i == 0 ? "" : ",").append("[").append(viable[i][0]).append(",").append(viable[i][1]).append(",").append(viable[i][2]).append(",").append(m.a(viable[i][0], viable[i][1], viable[i][2], spawn)).append("]");
        r.append("],\"find\":[");
        int[][] finds = {{0, 0, 256}, {0, 0, 16}, {-500, 900, 64}, {1, 1, 0}};
        for (int i = 0; i < finds.length; i++) {
          Random rand = new Random(seed + i);
          agt p = m.a(finds[i][0], finds[i][1], finds[i][2], spawn, rand);
          String pos = p == null ? "null" : "[" + get(p, "a") + "," + get(p, "b") + "," + get(p, "c") + "]";
          r.append(i == 0 ? "" : ",").append("[").append(finds[i][0]).append(",").append(finds[i][1]).append(",").append(finds[i][2]).append(",").append(pos).append(",").append(q(Long.toString(rand.nextLong()))).append("]");
        }
        StringBuilder sl = new StringBuilder("[");
        for (int i = 0; i < spawn.size(); i++) sl.append(i == 0 ? "" : ",").append(((ahu) spawn.get(i)).ay);
        r.append("],\"spawnBiomes\":").append(sl.append("]"));
        System.out.println(r.append("}"));
      }
  }
}
