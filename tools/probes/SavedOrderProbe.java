import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Batch 52 (b52so): the order of World.loadedEntityList after a save and reload. The unchanged AnvilChunkLoader writer (aqk.a(apx, ahb, dh): walks Chunk.entityLists, 16
// vertical sections, each in list order, calling Entity.writeToNBTOptional) and reader (aqk.a(ahb, dh): createEntityFromNBT then Chunk.addEntity), then Chunk.onChunkLoad
// (apx.d: World.addLoadedEntities per section 0..15, ahb.b(List) = loadedEntityList.addAll) over EntityListProbe's World double. The unchanged EntityItem, EntityXPOrb,
// EntityArrow, EntityTNTPrimed and EntityCow are added to a chunk in a given order (Chunk.addEntity files each by posY / 16, clamped to 0..15) and the same chunk is
// saved, read and loaded. Each entity's x carries its index (chunk x * 16 + 1 + 0.5 * index); the record gives the index order before the save (the world order the
// entities were spawned in) and after the load.
public class SavedOrderProbe {
  public static class SW extends EntityListProbe.EW {
    SW() { super(); }
    public List a(apx c, boolean remove) { return null; } // World.getPendingBlockUpdates: none
    public long I() { return 1000L; }
  }
  static Object unsafeAlloc(Class<?> c) throws Exception { return PlantProbe.unsafe.allocateInstance(c); }
  static SW world() throws Exception {
    SW w = (SW) unsafeAlloc(SW.class);
    MobMoveProbe.set(w, "t", unsafeAlloc(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "f").set(w, new ArrayList()); // loadedEntityList
    w.cells = new HashMap<>();
    w.entities = new ArrayList<>();
    return w;
  }
  static List<sa> loaded(SW w) throws Exception { return (List<sa>) MobMoveProbe.field(ahb.class, "f").get(w); }
  // spec: kind, y, chunk (an index into the scenario's chunk list); the entity's number is its place in the spec list
  static sa make(SW w, String kind, double x, double y, double z) throws Exception {
    sa e;
    switch (kind) {
      case "item": e = new xk(w, x, y, z, new add(aji.e(1), 3, 0)); break;
      case "orb": e = new sq(w, x, y, z, 5); break;
      case "arrow": e = new zc(w, x, y, z); break;
      case "tnt": e = new xw(w, x, y, z, null); break;
      case "cow": e = new wh(w); break;
      default: throw new RuntimeException(kind);
    }
    PlayerStepProbe.field(sa.class, "Z").set(e, new Random(7));
    e.b(x, y, z);
    return e;
  }
  static int index(sa e, int[][] chunks) {
    for (int[] c : chunks) if (Math.floor(e.s / 16) == c[0] && Math.floor(e.u / 16) == c[1]) return (int) Math.rint((e.s - c[0] * 16 - 1) / 0.5);
    throw new RuntimeException("unknown entity at " + e.s + "," + e.u);
  }
  static void scenario(String name, int[][] chunks, String[][] specs) throws Exception {
    aqk loader = new aqk(new File("unused-probe-path"));
    Method writer = aqk.class.getDeclaredMethod("a", apx.class, ahb.class, dh.class); writer.setAccessible(true);
    Method reader = aqk.class.getDeclaredMethod("a", ahb.class, dh.class); reader.setAccessible(true);
    SW w = world();
    List<apx> made = new ArrayList<>();
    for (int[] c : chunks) made.add(new apx(w, c[0], c[1]));
    List<Integer> before = new ArrayList<>();
    for (int i = 0; i < specs.length; i++) {
      int ci = Integer.parseInt(specs[i][2]);
      sa e = make(w, specs[i][0], chunks[ci][0] * 16 + 1 + 0.5 * i, Double.parseDouble(specs[i][1]), chunks[ci][1] * 16 + 8.5);
      made.get(ci).a(e); // Chunk.addEntity (World.spawnEntityInWorld)
      loaded(w).add(e); // and the end of loadedEntityList
      before.add(index(e, chunks));
    }
    // the chunks are saved and loaded back in the scenario's chunk order, as a world with no loaded chunks would
    SW w2 = world();
    for (int ci = 0; ci < chunks.length; ci++) {
      dh level = new dh(); writer.invoke(loader, made.get(ci), w, level);
      apx back = (apx) reader.invoke(loader, w2, level);
      back.d(); // Chunk.onChunkLoad: addLoadedEntities for sections 0..15
    }
    List<Integer> after = new ArrayList<>();
    for (sa e : loaded(w2)) after.add(index(e, chunks));
    StringBuilder s = new StringBuilder("{\"case\":\"saved-order\",\"name\":\"" + name + "\",\"chunks\":" + Arrays.deepToString(chunks) + ",\"specs\":[");
    for (int i = 0; i < specs.length; i++) s.append(i == 0 ? "" : ",").append("[\"").append(specs[i][0]).append("\",").append(specs[i][1]).append(",").append(specs[i][2]).append("]");
    s.append("],\"before\":").append(before).append(",\"after\":").append(after).append("}");
    System.out.println(s);
  }
  static String[][] mix(double[] ys, int[] chunk) {
    String[] kinds = {"item", "cow", "arrow", "orb", "tnt", "item", "cow", "orb", "arrow", "tnt"};
    String[][] out = new String[ys.length][];
    for (int i = 0; i < ys.length; i++) out[i] = new String[] {kinds[i % kinds.length], Double.toString(ys[i]), Integer.toString(chunk[i])};
    return out;
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    int[][] one = {{0, 0}}, two = {{0, 0}, {1, 0}}, three = {{-1, 3}, {2, 2}, {0, 0}};
    int[] c0 = new int[10], alt = {0, 1, 0, 1, 1, 0, 1, 0, 0, 1}, tri = {0, 1, 2, 2, 0, 1, 2, 0, 1, 2};
    scenario("b52so-one-chunk-mixed", one, mix(new double[] {70, 5, 70, 40, 5, 100, 40, 250, 5, 70}, c0));
    scenario("b52so-one-chunk-reversed", one, mix(new double[] {70, 40, 5, 250, 100, 5, 40, 70, 5, 70}, c0));
    scenario("b52so-one-section", one, mix(new double[] {66, 65, 70, 64, 71, 66, 65, 70, 64, 71}, c0));
    scenario("b52so-clamped-sections", one, mix(new double[] {-10, 255.9, 300, 0, 16, 15.9, 130, -1, 400, 17}, c0));
    scenario("b52so-two-chunks", two, mix(new double[] {70, 5, 70, 40, 5, 100, 40, 250, 5, 70}, alt));
    scenario("b52so-three-chunks", three, mix(new double[] {20, 90, 20, 3, 200, 90, 3, 20, 200, 90}, tri));
    scenario("b52so-sorted-already", one, mix(new double[] {1, 17, 33, 49, 65, 81, 97, 113, 129, 145}, c0));
  }
}
