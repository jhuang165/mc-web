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
    // batch 53 (b53so): World.updateEntityWithOptionalForce files an entity into the chunk that exists at its position (chunkExists / getChunkFromChunkCoords)
    public Map<Long, apx> chunkMap = new HashMap<>();
    static long key(int x, int z) { return ((long) x << 32) ^ (z & 0xffffffffL); }
    public boolean c(int x, int z) { return chunkMap.containsKey(key(x, z)); }
    public apx e(int x, int z) { return chunkMap.get(key(x, z)); }
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
    w.chunkMap = new HashMap<>();
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
      case "boat": e = new xi(w, x, y, z); break; // EntityBoat (b57so)
      case "fall": e = new xj(w, x, y, z, aji.e(1)); break; // EntityFallingBlock of stone (b57so)
      case "cart": e = new xs(w, x, y, z); PlayerStepProbe.field(sa.class, "c").setInt(e, 1); break; // EntityMinecartEmpty (id set as EntityListProbe does)
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
  // Batch 53 (b53so): the order after entities changed section or chunk and after a mount was saved with its rider. spec: kind, y, chunk, mount (the index of the entity this one
  // rides, or -1). Each tick applies its moves ({index, y, chunk x shift}) and then runs the real World.updateEntityWithOptionalForce(entity, false) on every entity in
  // loadedEntityList order (the walk of World.updateEntities: Chunk.removeEntityAtIndex then Chunk.addEntity when posX/16, posY/16 or posZ/16 differs from the filed cell).
  static void scenario2(String name, int[][] chunks, String[][] specs, double[][][] ticks) throws Exception {
    aqk loader = new aqk(new File("unused-probe-path"));
    Method writer = aqk.class.getDeclaredMethod("a", apx.class, ahb.class, dh.class); writer.setAccessible(true);
    Method reader = aqk.class.getDeclaredMethod("a", ahb.class, dh.class); reader.setAccessible(true);
    SW w = world();
    List<apx> made = new ArrayList<>();
    for (int[] c : chunks) { apx ch = new apx(w, c[0], c[1]); made.add(ch); w.chunkMap.put(SW.key(c[0], c[1]), ch); }
    List<sa> ents = new ArrayList<>();
    List<Integer> before = new ArrayList<>();
    for (int i = 0; i < specs.length; i++) {
      int ci = Integer.parseInt(specs[i][2]);
      sa e = make(w, specs[i][0], chunks[ci][0] * 16 + 1 + 0.5 * i, Double.parseDouble(specs[i][1]), chunks[ci][1] * 16 + 8.5);
      made.get(ci).a(e);
      loaded(w).add(e);
      ents.add(e);
      before.add(index(e, chunks));
    }
    for (int i = 0; i < specs.length; i++) { int m = Integer.parseInt(specs[i][3]); if (m >= 0) ents.get(i).a(ents.get(m)); } // Entity.mountEntity
    for (double[][] tick : ticks) {
      for (double[] mv : tick) { sa e = ents.get((int) mv[0]); e.b(e.s + 16 * mv[2], mv[1], e.u); }
      for (sa e : new ArrayList<>(loaded(w))) w.a(e, false);
    }
    SW w2 = world();
    for (int ci = 0; ci < chunks.length; ci++) {
      dh level = new dh(); writer.invoke(loader, made.get(ci), w, level);
      apx back = (apx) reader.invoke(loader, w2, level);
      back.d();
    }
    List<Integer> after = new ArrayList<>();
    for (sa e : loaded(w2)) after.add(index(e, chunks));
    StringBuilder s = new StringBuilder("{\"case\":\"saved-order2\",\"name\":\"" + name + "\",\"chunks\":" + Arrays.deepToString(chunks) + ",\"specs\":[");
    for (int i = 0; i < specs.length; i++) s.append(i == 0 ? "" : ",").append("[\"").append(specs[i][0]).append("\",").append(specs[i][1]).append(",").append(specs[i][2]).append(",").append(specs[i][3]).append("]");
    s.append("],\"ticks\":").append(Arrays.deepToString(ticks)).append(",\"before\":").append(before).append(",\"after\":").append(after).append("}");
    System.out.println(s);
  }
  // Batch 54 (b54so): the same World.updateEntityWithOptionalForce check run per entity, right after that entity's own update (as World.updateEntities does), and a mount that carries
  // the player. A tick walks loadedEntityList by index: entity i first applies its own moves ({index, y, chunk shift, -1}), then the check runs on it; moves with pusher p ({index, y, shift, p})
  // are applied right after entity p's check (another entity pushed it after its own turn, so its refile waits for the next pass). `playerCart` >= 0 names a spec whose mount carries
  // the player: a cow stand-in for the player (a player is not in a chunk) rides it; the chunk writer skips the mount (riddenByEntity != null), the rider's own Riding compound is
  // written (Entity.writeToNBT), and after the chunks are loaded (Chunk.onChunkLoad) the compound is read back as ServerConfigurationManager.initializeConnectionToPlayer does:
  // EntityList.createEntityFromNBT(Riding), forceSpawn, World.spawnEntityInWorld (real, appended after the chunks), then mountEntity. The record's `after` is loadedEntityList.
  static void scenario3(String name, int[][] chunks, String[][] specs, double[][][] ticks, int playerCart) throws Throwable {
    aqk loader = new aqk(new File("unused-probe-path"));
    Method writer = aqk.class.getDeclaredMethod("a", apx.class, ahb.class, dh.class); writer.setAccessible(true);
    Method reader = aqk.class.getDeclaredMethod("a", ahb.class, dh.class); reader.setAccessible(true);
    java.lang.invoke.MethodHandle spawn = java.lang.invoke.MethodHandles.privateLookupIn(XpOrbProbe.XW.class, java.lang.invoke.MethodHandles.lookup()).findSpecial(ahb.class, "d", java.lang.invoke.MethodType.methodType(boolean.class, sa.class), XpOrbProbe.XW.class);
    SW w = world();
    List<apx> made = new ArrayList<>();
    for (int[] c : chunks) { apx ch = new apx(w, c[0], c[1]); made.add(ch); w.chunkMap.put(SW.key(c[0], c[1]), ch); }
    List<sa> ents = new ArrayList<>();
    List<Integer> before = new ArrayList<>();
    for (int i = 0; i < specs.length; i++) {
      int ci = Integer.parseInt(specs[i][2]);
      sa e = make(w, specs[i][0], chunks[ci][0] * 16 + 1 + 0.5 * i, Double.parseDouble(specs[i][1]), chunks[ci][1] * 16 + 8.5);
      made.get(ci).a(e);
      loaded(w).add(e);
      ents.add(e);
      before.add(index(e, chunks));
    }
    for (int i = 0; i < specs.length; i++) { int m = Integer.parseInt(specs[i][3]); if (m >= 0) ents.get(i).a(ents.get(m)); }
    sa player = null;
    if (playerCart >= 0) { player = new wh(w); PlayerStepProbe.field(sa.class, "Z").set(player, new Random(7)); player.b(0, 0, 0); player.a(ents.get(playerCart)); }
    for (double[][] tick : ticks) {
      for (sa e : new ArrayList<>(loaded(w))) {
        int me = ents.indexOf(e);
        for (double[] mv : tick) if ((int) mv[0] == me && mv[3] < 0) { e.b(e.s + 16 * mv[2], mv[1], e.u); }
        w.a(e, false);
        for (double[] mv : tick) if ((int) mv[3] == me) { sa t = ents.get((int) mv[0]); t.b(t.s + 16 * mv[2], mv[1], t.u); }
      }
    }
    SW w2 = world();
    MobMoveProbe.field(ahb.class, "e").set(w2, new ArrayList()); // loadedEntityList
    MobMoveProbe.field(ahb.class, "g").set(w2, new ArrayList()); // loadedTileEntityList (Chunk.onChunkLoad adds the chunk tile entities)
    for (int ci = 0; ci < chunks.length; ci++) {
      dh level = new dh(); writer.invoke(loader, made.get(ci), w, level);
      apx back = (apx) reader.invoke(loader, w2, level);
      w2.chunkMap.put(SW.key(chunks[ci][0], chunks[ci][1]), back);
      back.c(); // Chunk.onChunkLoad: addLoadedEntities for sections 0..15
    }
    if (player != null) {
      dh tag = new dh(); player.e(tag); // Entity.writeToNBT: the Riding compound holds the cart
      sa cart = sg.a(tag.m("Riding"), w2); // EntityList.createEntityFromNBT
      PlayerStepProbe.field(sa.class, "Z").set(cart, new Random(7));
      cart.n = true; spawn.invoke(w2, cart); cart.n = false;
    }
    List<Integer> after = new ArrayList<>();
    for (Object o : (List) MobMoveProbe.field(ahb.class, "e").get(w2)) after.add(index((sa) o, chunks));
    StringBuilder s = new StringBuilder("{\"case\":\"saved-order3\",\"name\":\"" + name + "\",\"chunks\":" + Arrays.deepToString(chunks) + ",\"specs\":[");
    for (int i = 0; i < specs.length; i++) s.append(i == 0 ? "" : ",").append("[\"").append(specs[i][0]).append("\",").append(specs[i][1]).append(",").append(specs[i][2]).append(",").append(specs[i][3]).append("]");
    s.append("],\"ticks\":").append(Arrays.deepToString(ticks)).append(",\"playerCart\":").append(playerCart).append(",\"before\":").append(before).append(",\"after\":").append(after).append("}");
    System.out.println(s);
  }
  static String[] S(String kind, double y, int chunk, int mount) { return new String[] {kind, Double.toString(y), Integer.toString(chunk), Integer.toString(mount)}; }
  static String[][] plain(String[] kinds, double[] ys, int[] chunk) {
    String[][] out = new String[ys.length][];
    for (int i = 0; i < ys.length; i++) out[i] = S(kinds[i % kinds.length], ys[i], chunk[i], -1);
    return out;
  }
  static String[][] mix(double[] ys, int[] chunk) {
    String[] kinds = {"item", "cow", "arrow", "orb", "tnt", "item", "cow", "orb", "arrow", "tnt"};
    String[][] out = new String[ys.length][];
    for (int i = 0; i < ys.length; i++) out[i] = new String[] {kinds[i % kinds.length], Double.toString(ys[i]), Integer.toString(chunk[i])};
    return out;
  }
  public static void main(String[] args) throws Throwable {
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
    // ---- batch 53 (b53so) ----
    String[] kinds = {"item", "cow", "arrow", "orb", "tnt", "item", "cow", "orb", "arrow", "tnt"};
    double[][] none = {};
    scenario2("b53so-no-move", one, plain(kinds, new double[] {70, 5, 70, 40, 5, 100, 40, 250, 5, 70}, c0), new double[][][] {none, none});
    scenario2("b53so-section-move", one, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, c0), new double[][][] {{{2, 20, 0}}, {{0, 20, 0}, {5, 130, 0}}, {{2, 70, 0}}});
    scenario2("b53so-move-within-section", one, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, c0), new double[][][] {{{1, 75, 0}, {3, 65, 0}}, {{4, 64, 0}}});
    scenario2("b53so-two-moves-one-tick", one, plain(kinds, new double[] {70, 70, 20, 70, 20, 70, 70, 20, 70, 70}, c0), new double[][][] {{{7, 70, 0}, {1, 20, 0}, {9, 20, 0}, {3, 20, 0}}});
    scenario2("b53so-move-back", one, plain(kinds, new double[] {70, 70, 70, 20, 20, 70, 70, 70, 20, 70}, c0), new double[][][] {{{0, 20, 0}}, {{3, 70, 0}}, {{0, 70, 0}, {4, 70, 0}}});
    scenario2("b53so-chunk-move", two, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, alt), new double[][][] {{{0, 70, 1}, {1, 70, -1}}, {{6, 70, -1}}});
    scenario2("b53so-unclamped-refile", one, plain(kinds, new double[] {250, 70, 270, 250, -5, 5, 130, 250, 400, 255.5}, c0), new double[][][] {none, none, {{0, 260, 0}, {3, 40, 0}}, none});
    // a mount saved with its rider is one nested record: the rider is written, the mount is skipped, and the loader adds the rider, then its mount
    String[] rk = {"cow", "cart", "item", "item", "cow", "orb"};
    scenario2("b53so-mount-rider-first", one, new String[][] {S("cow", 70, 0, 1), S("cart", 70, 0, -1), S("item", 5, 0, -1), S("item", 70, 0, -1), S("orb", 70, 0, -1)}, new double[][][] {none});
    scenario2("b53so-mount-first", one, new String[][] {S("item", 70, 0, -1), S("cart", 70, 0, -1), S("item", 5, 0, -1), S("cow", 70, 0, 1), S("orb", 70, 0, -1)}, new double[][][] {none});
    scenario2("b53so-mount-sections", one, new String[][] {S("item", 70, 0, -1), S("cart", 63.5, 0, -1), S("item", 50, 0, -1), S("cow", 64.2, 0, 1), S("orb", 70, 0, -1), S("item", 40, 0, -1)}, new double[][][] {none});
    scenario2("b53so-mount-chain", one, new String[][] {S("cow", 70, 0, 1), S("cow", 70, 0, 2), S("cart", 70, 0, -1), S("item", 70, 0, -1), S("item", 5, 0, -1)}, new double[][][] {none});
    scenario2("b53so-mount-two-chunks", two, new String[][] {S("item", 70, 0, -1), S("cow", 70, 1, 2), S("cart", 70, 1, -1), S("item", 70, 1, -1), S("cow", 70, 0, 5), S("cart", 70, 0, -1), S("item", 70, 0, -1)}, new double[][][] {none});
    scenario2("b53so-mount-after-move", one, new String[][] {S("item", 70, 0, -1), S("cart", 70, 0, -1), S("cow", 70, 0, 1), S("item", 20, 0, -1), S("orb", 70, 0, -1)}, new double[][][] {{{2, 20, 0}, {1, 20, 0}}, {{0, 20, 0}}});
    // ---- batch 54 (b54so): the check per entity, right after its own update; a cart that carries the player ----
    scenario3("b54so-pushed-after-turn", one, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, c0), new double[][][] {{{0, 20, 0, 1}, {2, 20, 0, -1}}, none}, -1);
    scenario3("b54so-pusher-earlier", one, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, c0), new double[][][] {{{5, 20, 0, 1}, {3, 20, 0, -1}, {1, 20, 0, -1}}, none}, -1);
    scenario3("b54so-pushed-chunk", two, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, alt), new double[][][] {{{0, 70, 1, 4}, {2, 70, 1, -1}}, none, {{4, 20, 0, -1}}}, -1);
    scenario3("b54so-pushed-twice", one, plain(kinds, new double[] {70, 70, 70, 70, 70, 70, 70, 70, 70, 70}, c0), new double[][][] {{{0, 20, 0, 1}, {1, 20, 0, 2}, {2, 20, 0, 9}}, {{0, 70, 0, 3}}, none}, -1);
    scenario3("b54so-no-player", one, new String[][] {S("item", 70, 0, -1), S("cart", 70, 0, -1), S("item", 5, 0, -1), S("orb", 70, 0, -1)}, new double[][][] {none}, -1);
    scenario3("b54so-player-cart-first", one, new String[][] {S("cart", 70, 0, -1), S("item", 70, 0, -1), S("item", 5, 0, -1), S("orb", 70, 0, -1)}, new double[][][] {none}, 0);
    scenario3("b54so-player-cart-middle", one, new String[][] {S("item", 70, 0, -1), S("cart", 5, 0, -1), S("item", 70, 0, -1), S("orb", 40, 0, -1)}, new double[][][] {none}, 1);
    scenario3("b54so-player-cart-two-chunks", two, new String[][] {S("item", 70, 0, -1), S("cart", 70, 1, -1), S("item", 70, 1, -1), S("orb", 70, 0, -1), S("cow", 20, 1, -1)}, new double[][][] {none}, 1);
    scenario3("b54so-player-cart-moved", two, new String[][] {S("item", 70, 0, -1), S("cart", 70, 0, -1), S("item", 70, 1, -1), S("orb", 70, 0, -1)}, new double[][][] {{{1, 20, 1, -1}, {0, 20, 0, -1}}}, 1);
  }
}
