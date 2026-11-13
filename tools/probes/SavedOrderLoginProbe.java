import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Batch 56 (b56so): the order World.loadedEntityList takes at a native login. The unchanged ChunkProviderServer (ms) over an AnvilChunkLoader-reading loader (aqc double
// whose a(world, x, z) hands back the chunk read by the real aqk reader from the chunk NBT the real aqk writer made), the unchanged MinecraftServer.initialWorldChunkLoad loop (25 x 25
// chunks round the spawn, `prepare`), then the login of ServerConfigurationManager.playerLoggedIn: the real World.spawnEntityInWorld(player) (ahb.d, which loads the player's chunk
// through getChunkFromChunkCoords and appends the player after that chunk's entities), the real PlayerManager.addPlayer (mq.a: x outer, z inner over the view square, each
// PlayerInstance loading its chunk), and the mount read back from the player's Riding compound after the chunks (createEntityFromNBT of the first Riding only, forceSpawn,
// spawnEntityInWorld). The player is the real EntityPlayerMP (allocated without a constructor); the mount's rider in the saving world is a cow stand-in (as b54so).
// Each record: the entities by index (x = chunk x * 16 + 1 + 0.5 * index) in loadedEntityList order after the login, -1 for the player.
public class SavedOrderLoginProbe {
  public static class WS2 extends ChunkProviderProbe.WS {
    public void a(sa e) {} // onEntityAdded: the entity tracker is not part of the probe
    public void c() {} // updateAllPlayersSleepingFlag
  }
  // b57so: caseName labels the records; skipGrid: no initialWorldChunkLoad (the Nether and End: MinecraftServer.g loads dimension 0 only); noPlayer: nobody logs in (the Overworld while the player is away)
  static String caseName = "saved-order4";
  static boolean skipGrid = false, noPlayer = false;
  // b58so: after the login the player moves (PlayerManager.updateMountedMovingPlayer, mq.d: a PlayerInstance, which loads its chunk, for each chunk of the new view square that was not watched) to (moveX, moveZ); NaN: stays
  static double moveX = Double.NaN, moveZ = Double.NaN;
  // b59so: after the move the player walks on along `path` (x, z pairs); with unloadAfterMove each step is followed by ChunkProviderServer.unloadQueuedChunks (ms.d, up to 100 queued chunks: Chunk.onChunkUnload hands the
  // entity lists to World.unloadEntities) and the removal World.updateEntities does (loadedEntityList.removeAll(unloadedEntityList)); chunks the player's square loads again are read from the saved NBT and append.
  static Boolean respawnOverride = null;
  static double[][] path = null; static boolean unloadAfterMove = false;
  // b60so: unloadMask[i] false skips the unload after step i (the chunks stay queued); recordSteps adds `steps` (loadedEntityList indices after each step)
  static boolean[] unloadMask = null; static boolean[] recordSteps = null;
  static Map<Long, dh> nbts;
  static aqk anvil;
  static Method reader, writer;
  public static class Loader2 implements aqc {
    public apx a(ahb w, int x, int z) {
      dh level = nbts.get(agu.a(x, z));
      if (level == null) return null;
      try { return (apx) reader.invoke(anvil, w, level); } catch (Exception e) { throw new RuntimeException(e); }
    }
    public void a(ahb w, apx c) {}
    public void b(ahb w, apx c) {}
    public void a() {}
    public void b() {}
  }
  static void set(Class<?> c, Object o, String n, Object v) throws Exception { ChunkProviderProbe.setIn(c, o, n, v); }

  // spec: kind, y, chunk (index), mount (index of the entity it rides, or -1). playerMount: the spec index the player rides (-1: none), saved in the player's Riding compound.
  static void login(String name, int[][] chunks, String[][] specs, int spawnX, int spawnZ, double px, double pz, int view, int playerMount) throws Throwable {
    SavedOrderProbe.SW w = SavedOrderProbe.world();
    List<apx> made = new ArrayList<>();
    for (int[] c : chunks) { apx ch = new apx(w, c[0], c[1]); made.add(ch); w.chunkMap.put(SavedOrderProbe.SW.key(c[0], c[1]), ch); }
    List<sa> ents = new ArrayList<>();
    for (int i = 0; i < specs.length; i++) {
      int ci = Integer.parseInt(specs[i][2]);
      sa e = SavedOrderProbe.make(w, specs[i][0], chunks[ci][0] * 16 + 1 + 0.5 * i, Double.parseDouble(specs[i][1]), chunks[ci][1] * 16 + 8.5);
      made.get(ci).a(e);
      ents.add(e);
    }
    for (int i = 0; i < specs.length; i++) { int m = Integer.parseInt(specs[i][3]); if (m >= 0) ents.get(i).a(ents.get(m)); }
    sa stand = null;
    if (playerMount >= 0) { stand = new wh(w); PlayerStepProbe.field(sa.class, "Z").set(stand, new Random(7)); stand.b(0, 0, 0); stand.a(ents.get(playerMount)); }
    nbts = new HashMap<>();
    anvil = new aqk(new File("unused-probe-path"));
    writer = aqk.class.getDeclaredMethod("a", apx.class, ahb.class, dh.class); writer.setAccessible(true);
    reader = aqk.class.getDeclaredMethod("a", ahb.class, dh.class); reader.setAccessible(true);
    for (int ci = 0; ci < chunks.length; ci++) { dh level = new dh(); writer.invoke(anvil, made.get(ci), w, level); nbts.put(agu.a(chunks[ci][0], chunks[ci][1]), level); }
    dh riding = null;
    if (stand != null) { dh tag = new dh(); stand.e(tag); riding = tag.m("Riding"); }

    // the login world: the unchanged ChunkProviderServer over the loader above
    ChunkProviderProbe.setup(true, view, spawnX, spawnZ);
    WS2 lw = (WS2) ChunkProviderProbe.unsafe.allocateInstance(WS2.class);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(lw, new ArrayList<>()); }
    ChunkProviderProbe.Provider p = new ChunkProviderProbe.Provider();
    p.respawn = respawnOverride == null ? true : respawnOverride; p.g = true; p.b = lw;
    set(ahb.class, lw, "t", p);
    set(ahb.class, lw, "x", ChunkProviderProbe.info);
    ChunkProviderProbe.Gen gen = new ChunkProviderProbe.Gen(); gen.world = lw;
    ms provider = new ms(lw, new Loader2(), gen);
    set(ahb.class, lw, "v", provider);
    set(mt.class, lw, "b", provider);
    mq manager = (mq) ChunkProviderProbe.unsafe.allocateInstance(mq.class);
    set(mq.class, manager, "b", lw); set(mq.class, manager, "c", new ArrayList<>()); set(mq.class, manager, "d", new qd()); set(mq.class, manager, "e", new ArrayList<>()); set(mq.class, manager, "f", new ArrayList<>());
    set(mq.class, manager, "i", new int[][] {{1, 0}, {0, 1}, {-1, 0}, {0, -1}}); set(mq.class, manager, "g", view);
    set(mt.class, lw, "L", manager);
    MobMoveProbe.field(ahb.class, "E").setBoolean(lw, false);
    java.lang.invoke.MethodHandle spawn = java.lang.invoke.MethodHandles.privateLookupIn(WS2.class, java.lang.invoke.MethodHandles.lookup()).findSpecial(ahb.class, "d", java.lang.invoke.MethodType.methodType(boolean.class, sa.class), WS2.class);
    // MinecraftServer.initialWorldChunkLoad
    r sp = lw.K();
    if (!skipGrid) for (int k = -192; k <= 192; k += 16) for (int l = -192; l <= 192; l += 16) provider.c(sp.a + k >> 4, sp.c + l >> 4);
    // ServerConfigurationManager.playerLoggedIn: spawnEntityInWorld(player), then PlayerManager.addPlayer
    mw player = ChunkProviderProbe.player(77, px, pz);
    if (!noPlayer) { spawn.invoke(lw, player); manager.a(player); }
    if (!noPlayer && !Double.isNaN(moveX)) { player.s = moveX; player.u = moveZ; manager.d(player); }
    List<List<Integer>> steps = new ArrayList<>();
    if (!noPlayer && path != null) for (int si = 0; si < path.length; si++) {
      double[] st = path[si];
      player.s = st[0]; player.u = st[1]; manager.d(player);
      if (unloadAfterMove && (unloadMask == null || unloadMask[si])) {
        provider.d();
        List<?> un = (List<?>) MobMoveProbe.field(ahb.class, "f").get(lw), live = (List<?>) MobMoveProbe.field(ahb.class, "e").get(lw);
        live.removeAll(un); un.clear();
      }
      if (recordSteps != null) { List<Integer> now = new ArrayList<>(); for (Object o : (List) MobMoveProbe.field(ahb.class, "e").get(lw)) now.add(o instanceof mw ? -1 : SavedOrderProbe.index((sa) o, chunks)); steps.add(now); }
    }
    if (riding != null && !noPlayer) { // initializeConnectionToPlayer, after playerLoggedIn
      sa mount = sg.a(riding, lw); // EntityList.createEntityFromNBT: the first Riding only
      PlayerStepProbe.field(sa.class, "Z").set(mount, new Random(7));
      mount.n = true; spawn.invoke(lw, mount); mount.n = false;
    }
    List<Integer> after = new ArrayList<>();
    for (Object o : (List) MobMoveProbe.field(ahb.class, "e").get(lw)) after.add(o instanceof mw ? -1 : SavedOrderProbe.index((sa) o, chunks));
    StringBuilder s = new StringBuilder("{\"case\":\"" + caseName + "\",\"name\":\"" + name + "\",\"chunks\":" + Arrays.deepToString(chunks) + ",\"specs\":[");
    for (int i = 0; i < specs.length; i++) s.append(i == 0 ? "" : ",").append("[\"").append(specs[i][0]).append("\",").append(specs[i][1]).append(",").append(specs[i][2]).append(",").append(specs[i][3]).append("]");
    s.append("],").append(Double.isNaN(moveX) ? "" : "\"move\":[" + moveX + "," + moveZ + "],").append(path == null ? "" : "\"path\":" + Arrays.deepToString(path) + ",").append("\"spawn\":[").append(spawnX).append(",").append(spawnZ).append("],\"player\":[").append(px).append(",").append(pz).append("],\"view\":").append(view).append(",\"playerMount\":").append(playerMount).append(recordSteps == null ? "" : ",\"mask\":" + Arrays.toString(unloadMask) + ",\"steps\":" + steps).append(",\"after\":").append(after).append("}");
    System.out.println(s);
  }

  public static void main(String[] args) throws Throwable {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    ChunkProviderProbe.unsafe = MobMoveProbe.unsafe();
    String[] k = {"item", "cow", "orb", "item", "cart", "orb", "cow", "arrow"};
    java.util.function.BiFunction<double[], int[], String[][]> plain = (ys, ch) -> { String[][] out = new String[ys.length][]; for (int i = 0; i < ys.length; i++) out[i] = SavedOrderProbe.S(k[i % k.length], ys[i], ch[i], -1); return out; };
    // entities in the spawn grid (spawn 0,0: chunks -12..12), the player inside it: grid order is x outer, z inner
    int[][] grid = {{2, 0}, {-1, 0}, {0, 5}, {2, 3}, {-1, -4}};
    login("b56so-grid-order", grid, plain.apply(new double[] {70, 70, 70, 70, 70, 70, 70, 70}, new int[] {0, 1, 2, 3, 4, 0, 1, 2}), 0, 0, 40.5, 8.5, 2, -1);
    login("b56so-grid-sections", grid, plain.apply(new double[] {70, 5, 130, 20, 70, 130, 5, 70}, new int[] {0, 0, 1, 1, 2, 2, 3, 4}), 0, 0, 40.5, 8.5, 2, -1);
    // the player far from the spawn: his chunk and the view square come after the grid; a chunk in neither is not loaded
    int[][] far = {{21, 1}, {19, 3}, {3, 0}, {-30, 0}, {20, 0}, {22, 2}};
    login("b56so-view-square", far, plain.apply(new double[] {70, 70, 70, 70, 70, 70, 70, 70}, new int[] {0, 1, 2, 3, 4, 5, 0, 4}), 0, 0, 20 * 16 + 4.5, 8.5, 2, -1);
    login("b56so-view-one", far, plain.apply(new double[] {70, 70, 70, 70, 70, 70, 70, 70}, new int[] {0, 1, 2, 3, 4, 5, 0, 4}), 0, 0, 20 * 16 + 4.5, 8.5, 1, -1);
    login("b56so-spawn-offset", far, plain.apply(new double[] {70, 70, 70, 70, 70, 70, 70, 70}, new int[] {0, 1, 2, 3, 4, 5, 0, 4}), 300, -50, 20 * 16 + 4.5, 8.5, 2, -1);
    // the player's mount goes after every chunk: in a grid chunk, and in the player's own chunk
    String[][] withCart = {SavedOrderProbe.S("item", 70, 0, -1), SavedOrderProbe.S("cart", 70, 1, -1), SavedOrderProbe.S("orb", 70, 2, -1), SavedOrderProbe.S("item", 5, 1, -1), SavedOrderProbe.S("cow", 70, 0, -1)};
    login("b56so-mount-grid", grid, withCart, 0, 0, 40.5, 8.5, 2, 1);
    login("b56so-mount-player-chunk", grid, new String[][] {SavedOrderProbe.S("item", 70, 1, -1), SavedOrderProbe.S("cart", 70, 0, -1), SavedOrderProbe.S("orb", 70, 0, -1), SavedOrderProbe.S("cow", 70, 2, -1)}, 0, 0, 40.5, 8.5, 2, 1);
    // stacked riders: the player sits on a cow that rides a cart. The chunk writer skips both (each is ridden); the login reads the cow only (the first Riding), so the cart is nowhere
    login("b56so-stacked-cow-on-cart", grid, new String[][] {SavedOrderProbe.S("item", 70, 0, -1), SavedOrderProbe.S("cow", 70, 1, 2), SavedOrderProbe.S("cart", 70, 1, -1), SavedOrderProbe.S("orb", 70, 2, -1), SavedOrderProbe.S("item", 70, 3, -1)}, 0, 0, 40.5, 8.5, 2, 1);
    login("b56so-stacked-chain", grid, new String[][] {SavedOrderProbe.S("item", 70, 0, -1), SavedOrderProbe.S("cow", 70, 1, 2), SavedOrderProbe.S("cow", 70, 1, 3), SavedOrderProbe.S("cart", 70, 1, -1), SavedOrderProbe.S("orb", 70, 2, -1)}, 0, 0, 40.5, 8.5, 2, 1);
    // the same player on the cow that carries another rider's mount (a cow on a cow: the lower cow is lost too), and an unrelated mounted pair stays
    login("b56so-stacked-plus-pair", grid, new String[][] {SavedOrderProbe.S("cow", 70, 0, 1), SavedOrderProbe.S("cart", 70, 0, -1), SavedOrderProbe.S("cow", 70, 1, 3), SavedOrderProbe.S("cart", 70, 1, -1), SavedOrderProbe.S("orb", 70, 2, -1)}, 0, 0, 40.5, 8.5, 2, 2);
    // b57so: scenarios 11 on. The Nether and the End log in with no spawn grid (MinecraftServer.g loads dimension 0 only; bytecode-read), the Overworld while the player is away
    // loads only its grid, a mob riding the mount the player then takes (EntityBoat.interactFirst lets a non-player rider be taken over; Entity.mountEntity leaves the old rider's link),
    // and non-mob entities high above the world.
    caseName = "saved-order5";
    skipGrid = true;
    double[] flat = {70, 70, 70, 70, 70, 70, 70, 70};
    login("b57so-nether-no-grid", grid, plain.apply(flat, new int[] {0, 1, 2, 3, 4, 0, 1, 2}), 0, 0, 40.5, 8.5, 2, -1);
    login("b57so-nether-far", far, plain.apply(flat, new int[] {0, 1, 2, 3, 4, 5, 0, 4}), 0, 0, 20 * 16 + 4.5, 8.5, 2, -1);
    login("b57so-nether-view-one", grid, plain.apply(flat, new int[] {0, 1, 2, 3, 4, 0, 1, 2}), 0, 0, 40.5, 8.5, 1, -1);
    login("b57so-nether-mount", grid, withCart, 0, 0, 40.5, 8.5, 2, 1);
    skipGrid = false; noPlayer = true;
    login("b57so-away-grid", grid, plain.apply(new double[] {70, 5, 130, 20, 70, 130, 5, 70}, new int[] {0, 0, 1, 1, 2, 2, 3, 4}), 0, 0, 0, 0, 2, -1);
    login("b57so-away-far", far, plain.apply(flat, new int[] {0, 1, 2, 3, 4, 5, 0, 4}), 0, 0, 0, 0, 2, -1);
    noPlayer = false;
    // a cow in a cart, the player takes the cart: the cow keeps its link, is written with the cart nested, and the cart (ridden) is only in the player's Riding
    login("b57so-stale-cow-in-cart", grid, new String[][] {SavedOrderProbe.S("item", 70, 0, -1), SavedOrderProbe.S("cow", 70, 1, 2), SavedOrderProbe.S("cart", 70, 1, -1), SavedOrderProbe.S("orb", 70, 2, -1)}, 0, 0, 40.5, 8.5, 2, 2);
    // non-mob entities high above the world, in a chunk of the grid and one section low: every kind is written and read back, filed in section 15 (y / 16 clamped), 0 for y < 0
    String[] hk = {"item", "boat", "fall", "tnt", "arrow", "orb", "cart", "item", "boat", "fall", "tnt", "arrow"};
    double[] hy = {300, 70, 256, 255.5, 400, 130, 1000, 5, 600, -20, 16, 4000};
    String[][] high = new String[hk.length][];
    for (int i = 0; i < hk.length; i++) high[i] = SavedOrderProbe.S(hk[i], hy[i], i < 6 ? 0 : 1, -1);
    login("b57so-high-kinds", grid, high, 0, 0, 40.5, 8.5, 2, -1);
    String[][] high2 = new String[hk.length][];
    for (int i = 0; i < hk.length; i++) high2[i] = SavedOrderProbe.S(hk[i], hy[(i + 5) % hy.length], i % 3, -1);
    login("b57so-high-mixed", grid, high2, 0, 0, 40.5, 8.5, 2, -1);
    // a high cart the player rides is read from the player's Riding, last
    login("b57so-high-mount", grid, new String[][] {SavedOrderProbe.S("item", 300, 0, -1), SavedOrderProbe.S("boat", 400, 1, -1), SavedOrderProbe.S("fall", 70, 0, -1), SavedOrderProbe.S("tnt", 260, 1, -1)}, 0, 0, 40.5, 8.5, 2, 1);
    // b58so: scenarios 21 on. The player moves after the login: the chunks of the new view square load in x outer, z inner order and append to loadedEntityList (the chunks of the first
    // square keep their places). No spawn grid (the Nether and End), so only the squares load. Chunks: first square (view 2 at chunk 2,0) x 0..4, z -2..2; moving to chunk 5,0: x 3..7.
    caseName = "saved-order6";
    skipGrid = true;
    int[][] mv = {{1, 0}, {4, 2}, {5, 1}, {6, -2}, {7, 2}, {5, -2}, {3, 0}, {7, 0}};
    String[][] mvSpecs = plain.apply(flat, new int[] {0, 1, 2, 3, 4, 5, 6, 7});
    moveX = 5 * 16 + 4.5; moveZ = 8.5;
    login("b58so-move-east", mv, mvSpecs, 0, 0, 40.5, 8.5, 2, -1);
    login("b58so-move-east-sections", mv, plain.apply(new double[] {70, 5, 130, 20, 70, 130, 5, 70}, new int[] {7, 6, 5, 4, 3, 2, 1, 0}), 0, 0, 40.5, 8.5, 2, -1);
    moveX = 2 * 16 + 4.5; moveZ = 3 * 16 + 4.5; // diagonal: z 1..5 and x 0..4 (the square overlaps the old one in z 1..2)
    int[][] mv2 = {{0, 0}, {4, 2}, {2, 5}, {0, 3}, {4, 5}, {1, 4}, {3, 1}, {2, -2}};
    login("b58so-move-diagonal", mv2, mvSpecs, 0, 0, 40.5, 8.5, 2, -1);
    moveX = Double.NaN; moveZ = Double.NaN;
    // falling blocks of the away run (nobody logged in, the Overworld's spawn grid): EntityFallingBlock is saved and read back like every other kind
    skipGrid = false; noPlayer = true;
    String[] fk = {"item", "fall", "cow", "fall", "orb", "fall", "item", "fall"};
    double[] fy = {70, 5, 130, 20, 70, 260, 5, 70};
    String[][] fall = new String[fk.length][];
    for (int i = 0; i < fk.length; i++) fall[i] = SavedOrderProbe.S(fk[i], fy[i], new int[] {0, 0, 1, 1, 2, 3, 4, 2}[i], -1);
    login("b58so-away-falling", grid, fall, 0, 0, 0, 0, 2, -1);
    noPlayer = false;
    // b59so: the player walks away and back. Spawn (170, 0): ChunkProviderServer.unloadChunksIfNotNearSpawn (ms.b, bytecode-read) queues a chunk of an Overworld-like world only when its centre is more than 128
    // blocks from the spawn on an axis, so chunks 0..2 (centre x 8..40 < 42) unload and 3, 4 stay; the provider says canRespawnHere (the Nether and End always queue).
    caseName = "saved-order7"; moveX = Double.NaN; moveZ = Double.NaN;
    path = new double[][] {{12 * 16 + 4.5, 8.5}, {2 * 16 + 4.5, 8.5}}; unloadAfterMove = true;
    String[][] back = plain.apply(flat, new int[] {0, 1, 2, 3, 4, 5, 6, 7});
    int[][] bk = {{0, 0}, {1, 2}, {2, 1}, {3, -2}, {4, 2}, {4, -2}, {3, 0}, {2, 2}};
    login("b59so-away-back-spawn", bk, back, 170, 0, 40.5, 8.5, 2, -1);
    login("b59so-away-back-spawn-sections", bk, plain.apply(new double[] {70, 5, 130, 20, 70, 130, 5, 70}, new int[] {7, 6, 5, 4, 3, 2, 1, 0}), 170, 0, 40.5, 8.5, 2, -1);
    login("b59so-away-back-nospawn", bk, back, 0, 0, 40.5, 8.5, 2, -1); // spawn (0, 0): every chunk of the square is within 128 blocks: none unloads
    respawnOverride = Boolean.FALSE; // the Nether/End provider: every chunk the player leaves is queued
    login("b59so-away-back-nether", bk, back, 0, 0, 40.5, 8.5, 2, -1);
    respawnOverride = null;
    // b60so: the unload queue. queue-cancel: the player steps away and back before ms.d runs (loadChunk, ms.c, takes the chunks off chunksToUnload); queue-delay: one tick queued, the next unloads;
    // limit: view 6, a teleport queues 169 chunks and ms.d takes 100 per call (HashSet<Long> order), the second call the rest.
    caseName = "saved-order8"; recordSteps = new boolean[0];
    double farX = 12 * 16 + 4.5, back0 = 2 * 16 + 4.5;
    path = new double[][] {{farX, 8.5}, {back0, 8.5}}; unloadMask = new boolean[] {false, true};
    login("b60so-queue-cancel", bk, back, 1000, 0, 40.5, 8.5, 2, -1);
    path = new double[][] {{farX, 8.5}, {farX + 1, 8.5}, {back0, 8.5}}; unloadMask = new boolean[] {false, true, true};
    login("b60so-queue-delay", bk, back, 1000, 0, 40.5, 8.5, 2, -1);
    int[][] wide = new int[12][]; for (int i = 0; i < 12; i++) wide[i] = new int[] {i - 3, i % 3 - 1};
    double[] wy = new double[12]; int[] wc = new int[12]; for (int i = 0; i < 12; i++) { wy[i] = 70; wc[i] = i; }
    path = new double[][] {{100 * 16 + 4.5, 8.5}, {100 * 16 + 5.5, 8.5}, {2 * 16 + 4.5, 8.5}}; unloadMask = new boolean[] {true, true, true};
    login("b60so-limit", wide, plain.apply(wy, wc), 1000, 0, 40.5, 8.5, 6, -1);
    path = null; unloadAfterMove = false; unloadMask = null; recordSteps = null;
  }
}
