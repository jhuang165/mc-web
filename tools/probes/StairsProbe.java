import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

// Executes the unchanged 1.7.10 BlockStairs (obfuscated ans) and its ten registry objects
// (ids 53, 67, 108, 109, 128, 134, 135, 136, 163, 164): constructor-derived properties, the
// func_150147_e / func_150145_f / func_150144_g shape methods against every neighbour stair
// configuration, addCollisionBoxesToList, collisionRayTrace, onBlockPlaced / onBlockPlacedBy and
// the drop, hardness and explosion queries. The world is a small ahb/ahl double over a cell map.
public final class StairsProbe {
  static final int[] IDS = {53, 67, 109, 128, 134, 135, 136, 108, 163, 164};
  static final int BX = 5, BY = 5, BZ = 5;

  static class WorldStub extends ahb {
    Map<String, aji> blocks; Map<String, Integer> metas;
    WorldStub() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; } protected int p() { return 0; }
    public sa a(int id) { return null; }
    static String key(int x, int y, int z) { return x + "," + y + "," + z; }
    public aji a(int x, int y, int z) { aji b = blocks.get(key(x, y, z)); return b == null ? aji.e(0) : b; }
    public int e(int x, int y, int z) { Integer m = metas.get(key(x, y, z)); return m == null ? 0 : m; }
    public boolean a(int x, int y, int z, int meta, int flags) { metas.put(key(x, y, z), meta); return true; }
    void put(int x, int y, int z, aji b, int meta) { blocks.put(key(x, y, z), b); metas.put(key(x, y, z), meta); }
    void clear() { blocks.clear(); metas.clear(); }
  }

  static Field field(Class<?> type, String name) throws Exception {
    for (Class<?> c = type; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException ignored) {}
    throw new NoSuchFieldException(name);
  }
  static Unsafe unsafe() throws Exception { Field f = Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); return (Unsafe) f.get(null); }
  static WorldStub world() throws Exception {
    WorldStub w = (WorldStub) unsafe().allocateInstance(WorldStub.class);
    w.blocks = new HashMap<>(); w.metas = new HashMap<>();
    return w;
  }
  static double bound(aji b, String n) throws Exception { return field(aji.class, n).getDouble(b); }
  static String num(double d) { return Double.toString(d); }
  static String bounds(aji b) throws Exception {
    return "[" + num(bound(b, "B")) + "," + num(bound(b, "C")) + "," + num(bound(b, "D")) + "," + num(bound(b, "E")) + "," + num(bound(b, "F")) + "," + num(bound(b, "G")) + "]";
  }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  // Every public no-argument boolean/int method of a class, by obfuscated name.
  static String queries(Object o, Class<?> type) throws Exception {
    StringBuilder out = new StringBuilder("{");
    boolean first = true;
    List<Method> methods = new ArrayList<>(Arrays.asList(type.getMethods()));
    methods.sort(Comparator.comparing(Method::getName));
    for (Method m : methods) {
      if (m.getParameterCount() != 0 || Modifier.isStatic(m.getModifiers())) continue;
      if (m.getDeclaringClass() == Object.class) continue;
      Class<?> r = m.getReturnType();
      if (r != boolean.class && r != int.class) continue;
      if (m.getName().equals("hashCode")) continue;
      m.setAccessible(true);
      if (!first) out.append(',');
      first = false;
      out.append(q(m.getName())).append(':').append(m.invoke(o));
    }
    return out.append('}').toString();
  }
  static String materialName(awt material) throws Exception {
    for (Field f : awt.class.getDeclaredFields())
      if (Modifier.isStatic(f.getModifiers()) && f.getType() == awt.class && f.get(null) == material) return f.getName();
    return "?";
  }

  static String blockRecord(int id) throws Exception {
    aji block = aji.e(id);
    if (!(block instanceof ans)) throw new AssertionError("id " + id + " is " + block.getClass().getName());
    ans stairs = (ans) block;
    aji model = (aji) field(ans.class, "b").get(stairs);
    int modelMeta = field(ans.class, "M").getInt(stairs);
    WorldStub w = world();
    StringBuilder out = new StringBuilder("{\"kind\":\"block\",\"id\":").append(aji.b(block));
    out.append(",\"modelId\":").append(aji.b(model)).append(",\"modelMeta\":").append(modelMeta);
    out.append(",\"hardnessField\":").append(num(field(aji.class, "v").getFloat(block)));
    out.append(",\"resistanceField\":").append(num(field(aji.class, "w").getFloat(block)));
    out.append(",\"modelHardnessField\":").append(num(field(aji.class, "v").getFloat(model)));
    out.append(",\"modelResistanceField\":").append(num(field(aji.class, "w").getFloat(model)));
    out.append(",\"hardness\":").append(num(block.f(w, 0, 0, 0)));
    out.append(",\"explosionResistance\":").append(num(block.a((sa) null)));
    out.append(",\"modelExplosionResistance\":").append(num(model.a((sa) null)));
    out.append(",\"lightOpacityField\":").append(field(aji.class, "r").getInt(block));
    out.append(",\"lightValueField\":").append(field(aji.class, "t").getInt(block));
    out.append(",\"useNeighborBrightnessField\":").append(field(aji.class, "u").getBoolean(block));
    out.append(",\"modelUseNeighborBrightnessField\":").append(field(aji.class, "u").getBoolean(model));
    out.append(",\"opaqueFlag\":").append(field(aji.class, "q").getBoolean(block));
    out.append(",\"stepSound\":{\"name\":").append(q(((ajm) field(aji.class, "H").get(block)).a)).append(",\"volume\":").append(num(((ajm) field(aji.class, "H").get(block)).b)).append(",\"pitch\":").append(num(((ajm) field(aji.class, "H").get(block)).c)).append('}');
    out.append(",\"modelStepSound\":").append(q(((ajm) field(aji.class, "H").get(model)).a));
    out.append(",\"slipperiness\":").append(num(field(aji.class, "K").getFloat(block)));
    awt material = (awt) field(aji.class, "J").get(block);
    out.append(",\"material\":").append(q(materialName(material))).append(",\"modelMaterial\":").append(q(materialName((awt) field(aji.class, "J").get(model))));
    out.append(",\"materialQueries\":").append(queries(material, awt.class));
    out.append(",\"blockQueries\":").append(queries(block, aji.class));
    out.append(",\"renderType\":").append(stairs.b());
    out.append(",\"creativeTab\":").append(block.J() == abt.b ? "\"buildingBlocks\"" : q(String.valueOf(block.J())));
    adb dropped = block.a(0, new Random(1), 0);
    out.append(",\"dropItemId\":").append(dropped == null ? -1 : adb.b(dropped)).append(",\"dropQuantity\":").append(block.a(new Random(1)));
    out.append(",\"damageDropped\":[");
    for (int m = 0; m < 16; m++) { if (m > 0) out.append(','); out.append(block.a(m)); }
    out.append("],\"tickRate\":").append(block.a(w));
    out.append(",\"canBlockStay\":").append("null");
    // World.doesBlockHaveSolidTopSurface (ahb.a(ahl, x, y, z), static): upside-down stairs only.
    out.append(",\"solidTop\":[");
    for (int m = 0; m < 16; m++) {
      w.clear(); w.put(0, 0, 0, block, m);
      if (m > 0) out.append(',');
      out.append(ahb.a((ahl) w, 0, 0, 0));
    }
    out.append("]}");
    return out.toString();
  }

  // The three-step shape sequence shared by the model renderer (blm.a(ans, x, y, z)) and
  // addCollisionBoxesToList: e() then f() (always a box), then g() only when f() returned true.
  static String renderShape(WorldStub w, ans stairs, int x, int y, int z) throws Exception {
    stairs.e((ahl) w, x, y, z);
    String first = bounds(stairs);
    boolean simple = stairs.f((ahl) w, x, y, z);
    String second = bounds(stairs);
    String third = null;
    boolean inner = false;
    if (simple) { inner = stairs.g((ahl) w, x, y, z); if (inner) third = bounds(stairs); }
    return "{\"boxes\":[" + first + "," + second + (third != null ? "," + third : "") + "],\"simple\":" + simple + ",\"inner\":" + inner + "}";
  }
  static String collisionShape(WorldStub w, ans stairs, int x, int y, int z) throws Exception {
    List<Object> list = new ArrayList<>();
    azt mask = azt.a(x - 1, y - 1, z - 1, x + 2, y + 2, z + 2);
    stairs.a((ahb) w, x, y, z, mask, list, (sa) null);
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < list.size(); i++) {
      azt b = (azt) list.get(i);
      if (i > 0) out.append(',');
      out.append('[').append(num(b.a - x)).append(',').append(num(b.b - y)).append(',').append(num(b.c - z)).append(',').append(num(b.d - x)).append(',').append(num(b.e - y)).append(',').append(num(b.f - z)).append(']');
    }
    return out.append(']').toString();
  }
  static int index(Map<String, Integer> table, List<String> rows, String row) {
    Integer i = table.get(row);
    if (i == null) { i = rows.size(); table.put(row, i); rows.add(row); }
    return i;
  }

  static String raytrace(WorldStub w, ans stairs, int meta, double[] ray) throws Exception {
    w.clear(); w.put(BX, BY, BZ, stairs, meta);
    azw a = azw.a(BX + ray[0], BY + ray[1], BZ + ray[2]), b = azw.a(BX + ray[3], BY + ray[4], BZ + ray[5]);
    azu hit = stairs.a((ahb) w, BX, BY, BZ, a, b);
    StringBuilder out = new StringBuilder("[");
    for (int i = 0; i < 6; i++) { if (i > 0) out.append(','); out.append(num(ray[i])); }
    out.append(',');
    if (hit == null) out.append("null");
    else out.append('[').append(hit.e).append(',').append(num(hit.f.a)).append(',').append(num(hit.f.b)).append(',').append(num(hit.f.c)).append(']');
    return out.append(']').toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    StringBuilder out = new StringBuilder();
    for (int id : IDS) System.out.println(blockRecord(id));

    ans oak = (ans) aji.e(53);
    WorldStub w = world();
    // Neighbour configurations: 0 = air, 1..8 = this stair type with metadata 0..7, for the
    // four cells x-1, x+1, z-1, z+1; the centre metadata runs 0..15.
    Map<String, Integer> renderIndex = new HashMap<>(), collisionIndex = new HashMap<>();
    List<String> renderShapes = new ArrayList<>(), collisionShapes = new ArrayList<>();
    StringBuilder states = new StringBuilder();
    for (int center = 0; center < 16; center++) {
      StringBuilder renderStates = new StringBuilder("["), collisionStates = new StringBuilder("[");
      for (int s = 0; s < 6561; s++) {
        int[] n = {s / 729 % 9, s / 81 % 9, s / 9 % 9, s % 9};
        w.clear(); w.put(BX, BY, BZ, oak, center);
        int[][] at = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        for (int i = 0; i < 4; i++) if (n[i] > 0) w.put(BX + at[i][0], BY, BZ + at[i][1], oak, n[i] - 1);
        int r = index(renderIndex, renderShapes, renderShape(w, oak, BX, BY, BZ));
        // The collision method resets the block bounds to the full cube afterwards.
        int c = index(collisionIndex, collisionShapes, collisionShape(w, oak, BX, BY, BZ));
        if (!bounds(oak).equals("[0.0,0.0,0.0,1.0,1.0,1.0]")) throw new AssertionError("bounds not reset " + bounds(oak));
        if (s > 0) { renderStates.append(','); collisionStates.append(','); }
        renderStates.append(r); collisionStates.append(c);
      }
      renderStates.append(']'); collisionStates.append(']');
      if (center > 0) states.append(',');
      states.append("{\"center\":").append(center).append(",\"render\":").append(renderStates).append(",\"collision\":").append(collisionStates).append('}');
    }
    System.out.println("{\"kind\":\"shapes\",\"neighbourOrder\":[\"x-1\",\"x+1\",\"z-1\",\"z+1\"],\"neighbourCodes\":\"0 air, 1..8 same stair type metadata 0..7\",\"renderShapes\":[" + String.join(",", renderShapes) + "],\"collisionShapes\":[" + String.join(",", collisionShapes) + "],\"states\":[" + states + "]}");

    // Mixed stair types and non-stair neighbours: the connection test is `instanceof BlockStairs`
    // plus an equal metadata; any other block counts as air.
    Random rnd = new Random(20260311L);
    StringBuilder mixed = new StringBuilder();
    for (int i = 0; i < 4000; i++) {
      int center = rnd.nextInt(8);
      ans cb = (ans) aji.e(IDS[rnd.nextInt(IDS.length)]);
      w.clear(); w.put(BX, BY, BZ, cb, center);
      int[][] at = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
      StringBuilder nb = new StringBuilder("[");
      for (int k = 0; k < 4; k++) {
        int kind = rnd.nextInt(4), nid = 0, nm = 0;
        if (kind == 1) { nid = 1; nm = rnd.nextInt(16); }
        else if (kind >= 2) { nid = IDS[rnd.nextInt(IDS.length)]; nm = rnd.nextInt(8); if (rnd.nextInt(3) == 0) nm = center; }
        if (nid != 0) w.put(BX + at[k][0], BY, BZ + at[k][1], aji.e(nid), nm);
        if (k > 0) nb.append(',');
        nb.append('[').append(nid).append(',').append(nm).append(']');
      }
      nb.append(']');
      int r = index(renderIndex, renderShapes, renderShape(w, cb, BX, BY, BZ));
      int c = index(collisionIndex, collisionShapes, collisionShape(w, cb, BX, BY, BZ));
      if (i > 0) mixed.append(',');
      mixed.append("[").append(aji.b(cb)).append(',').append(center).append(',').append(nb).append(',').append(r).append(',').append(c).append(']');
    }
    System.out.println("{\"kind\":\"mixed\",\"cases\":[" + mixed + "]}");
    // Shape tables again, now including the shapes first seen in the mixed cases (same order prefix).
    System.out.println("{\"kind\":\"tables\",\"renderShapes\":[" + String.join(",", renderShapes) + "],\"collisionShapes\":[" + String.join(",", collisionShapes) + "]}");

    // collisionRayTrace: six pass-through rays per grid cell on each face, then random rays.
    double[] grid = {0.125, 0.375, 0.625, 0.875};
    for (int meta = 0; meta < 16; meta++) {
      StringBuilder rays = new StringBuilder();
      boolean first = true;
      List<double[]> list = new ArrayList<>();
      for (int axis = 0; axis < 3; axis++) for (double u : grid) for (double v : grid) for (int dir = 0; dir < 2; dir++) {
        double[] a = new double[3], b = new double[3];
        int p = (axis + 1) % 3, q = (axis + 2) % 3;
        a[axis] = dir == 0 ? -0.5 : 1.5; b[axis] = dir == 0 ? 1.5 : -0.5;
        a[p] = b[p] = u; a[q] = b[q] = v;
        list.add(new double[]{a[0], a[1], a[2], b[0], b[1], b[2]});
      }
      Random rr = new Random(900 + meta);
      for (int i = 0; i < 96; i++) {
        double th = rr.nextDouble() * Math.PI * 2, ph = Math.acos(rr.nextDouble() * 2 - 1);
        double ax = 0.5 + 1.6 * Math.sin(ph) * Math.cos(th), ay = 0.5 + 1.6 * Math.cos(ph), az = 0.5 + 1.6 * Math.sin(ph) * Math.sin(th);
        double tx = 0.02 + rr.nextDouble() * 0.96, ty = 0.02 + rr.nextDouble() * 0.96, tz = 0.02 + rr.nextDouble() * 0.96;
        list.add(new double[]{ax, ay, az, ax + (tx - ax) * 2.2, ay + (ty - ay) * 2.2, az + (tz - az) * 2.2});
      }
      for (double[] ray : list) { if (!first) rays.append(','); first = false; rays.append(raytrace(w, oak, meta, ray)); }
      // The selection box and the stale bounds after a trace (Block.getSelectedBoundingBoxFromPool
      // is overridden to the model block; the stair's own bounds keep the last octant).
      w.clear(); w.put(BX, BY, BZ, oak, meta);
      azt selected = oak.g((ahb) w, BX, BY, BZ);
      String selectedBox = "[" + num(selected.a - BX) + "," + num(selected.b - BY) + "," + num(selected.c - BZ) + "," + num(selected.d - BX) + "," + num(selected.e - BY) + "," + num(selected.f - BZ) + "]";
      oak.a((ahl) w, BX, BY, BZ);
      String afterTrace = bounds(oak);
      oak.e((ahl) w, BX, BY, BZ);
      oak.a((ahl) w, BX, BY, BZ);
      System.out.println("{\"kind\":\"raytrace\",\"meta\":" + meta + ",\"selectedBox\":" + selectedBox + ",\"boundsAfterTrace\":" + afterTrace + ",\"rays\":[" + rays + "]}");
    }

    // onBlockPlaced (side, hit vector, incoming metadata) and onBlockPlacedBy (yaw, existing bit).
    StringBuilder placed = new StringBuilder("[");
    boolean first = true;
    float[] hits = {0F, 0.25F, 0.4999999F, 0.5F, 0.50000006F, 0.75F, 1F, 0.3F, 0.7F};
    for (int side = 0; side < 6; side++) for (float hy : hits) for (int meta : new int[]{0, 1, 3, 4}) {
      w.clear();
      int result = oak.a((ahb) w, BX, BY, BZ, side, 0.5F, hy, 0.5F, meta);
      if (!first) placed.append(',');
      first = false;
      placed.append('[').append(side).append(',').append(Float.toString(hy)).append(',').append(meta).append(',').append(result).append(']');
    }
    placed.append(']');
    sv entity = (sv) unsafe().allocateInstance(wo.class);
    StringBuilder by = new StringBuilder("[");
    first = true;
    List<Float> yaws = new ArrayList<>();
    for (int k = -100; k <= 100; k++) yaws.add(k * 7.5F);
    for (int j = -4; j <= 4; j++) {
      float edge = 45F + 90F * j;
      yaws.add(edge); yaws.add(Math.nextUp(edge)); yaws.add(Math.nextDown(edge)); yaws.add(edge + 0.001F); yaws.add(edge - 0.001F);
    }
    yaws.add(360F); yaws.add(-360F); yaws.add(720.5F); yaws.add(-720.5F); yaws.add(1e6F); yaws.add(-1e6F);
    Random yr = new Random(77);
    for (int i = 0; i < 400; i++) yaws.add((yr.nextFloat() - 0.5F) * 2000F);
    for (float yaw : yaws) for (int existing : new int[]{0, 4}) {
      w.clear(); w.put(BX, BY, BZ, oak, existing);
      field(sa.class, "y").setFloat(entity, yaw);
      oak.a((ahb) w, BX, BY, BZ, entity, (add) null);
      if (!first) by.append(',');
      first = false;
      by.append('[').append(Float.toString(yaw)).append(',').append(existing).append(',').append(w.e(BX, BY, BZ)).append(']');
    }
    by.append(']');
    System.out.println("{\"kind\":\"placement\",\"onBlockPlaced\":" + placed + ",\"onBlockPlacedBy\":" + by + "}");
  }
}
