import java.util.*;

// Batch 66 bonemeal2. Runs the unchanged 1.7.10 ItemDye.func_150919_a (acj.a(ItemStack, World, x, y, z), the bone meal branch of ItemDye.onItemUse) on every kind of block
// that implements IGrowable (ajo): mushrooms (amc), tall grass and ferns (anz), double plants (ako), cocoa (ajz), crops (akf), stems (anu) and saplings (anj, the marking
// step), plus blocks that do not implement it (reeds, cactus, flowers, nether wart, lily pad, vines, melon/pumpkin, dead bush). The world is PlantProbe.W (a map-backed World
// double with original ids; setBlock is a plain write that records [x, y, z, id, meta, flags]), with `ahb.s` (the world Random the IGrowable methods use) seeded per record.
// Each record gives the returned boolean, the stack size before and after, the recorded writes, the dropped item entities (stack, position, pickup delay) and the next draw
// of the world Random (so the number of draws is checked too). The grass block (alh) is not run here: BlockGrass.func_149853_b is covered by dyes-reference.json.
public class BoneMealProbe {
  static final int SX = 0, SY = 64, SZ = 0;

  static PlantProbe.Base floor(int soil) {
    return (x, y, z) -> y < 63 ? new int[] {1, 0} : y == 63 ? new int[] {soil, 0} : new int[] {0, 0};
  }

  static String str(String s) { return "\"" + s + "\""; }

  static void run(String name, int soil, int block, int meta, int index, int[][] extra) throws Exception {
    run(name, soil, block, meta, index, extra, SY, 1);
  }

  // cy: the clicked cell's height (the block is put there); biome: BiomeGenBase id read by World.getBiomeGenForCoords (the grass block's flower choice).
  static void run(String name, int soil, int block, int meta, int index, int[][] extra, int cy, int biome) throws Exception {
    long seed = index * 987654321L + 12345L; // small seeds give nearly equal first draws, so the index is spread
    PlantProbe.W w = PlantProbe.world(floor(soil));
    MobMoveProbe.set(w, "s", new Random(seed));
    w.biome = ahu.d(biome);
    w.put(SX, cy, SZ, block, meta);
    if (extra != null) for (int[] c : extra) w.put(c[0], c[1], c[2], c[3], c[4]);
    add stack = new add(adb.d(351), 1, 15);
    boolean ret = acj.a(stack, w, SX, cy, SZ);
    int draw = w.s.nextInt(1000000);
    StringBuilder items = new StringBuilder("[");
    int n = 0;
    for (sa e : w.spawned)
      if (e instanceof xk) {
        xk i = (xk) e;
        add s = i.f();
        items.append(n++ > 0 ? "," : "").append("[").append(adb.b(s.b())).append(",").append(s.b).append(",").append(s.k()).append(",")
          .append(i.s).append(",").append(i.t).append(",").append(i.u).append(",").append(i.b).append("]");
      }
    items.append("]");
    System.out.println("{\"case\":\"bone\",\"name\":" + str(name) + ",\"soil\":" + soil + ",\"block\":" + block + ",\"meta\":" + meta + ",\"seed\":" + seed
      + ",\"cy\":" + cy + ",\"biome\":" + biome + ",\"extra\":" + Arrays.deepToString(extra == null ? new int[0][] : extra) + ",\"returned\":" + ret + ",\"stack\":" + stack.b + ",\"sets\":" + PlantProbe.sets(w)
      + ",\"items\":" + items + ",\"next\":" + draw + ",\"here\":[" + w.cell(SX, cy, SZ)[0] + "," + w.cell(SX, cy, SZ)[1] + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    // Mushrooms: 40 % gate is outside func_150919_a's effect on the stack (the stack is spent either way), the growth is func_149884_c.
    for (int block = 39; block <= 40; block++)
      for (int seed = 1; seed <= 12; seed++) run("mushroom-" + block, 3, block, 0, seed, null);
    for (int i = 1; i <= 8; i++) run("mushroom-red-grass", 2, 40, 0, i, null);
    for (int i = 1; i <= 8; i++) run("mushroom-brown-mycelium", 110, 39, 0, i, null);
    for (int i = 1; i <= 8; i++) run("mushroom-red-stone-below", 1, 40, 0, i, null);
    for (int i = 1; i <= 8; i++) run("mushroom-brown-blocked-roof", 3, 39, 0, i, new int[][] {{0, 68, 0, 1, 0}});
    for (int i = 1; i <= 8; i++) run("mushroom-red-leaves-in-way", 3, 40, 0, i, new int[][] {{1, 66, 0, 18, 0}, {0, 67, 0, 18, 0}});
    for (int i = 1; i <= 8; i++) run("mushroom-red-wide-cap-blocked", 3, 40, 0, i, new int[][] {{3, 69, 0, 1, 0}});
    for (int i = 1; i <= 8; i++) run("mushroom-brown-opaque-cap-cell", 3, 39, 0, i, new int[][] {{2, 69, 0, 1, 0}, {-2, 70, 0, 1, 0}});
    // Tall grass (dead bush 0, grass 1, fern 2) with air above (grass soil), and the failure cases.
    for (int meta = 0; meta < 3; meta++) run("tallgrass-" + meta, 2, 31, meta, 1, null);
    run("tallgrass-1-dirt", 3, 31, 1, 1, null);
    run("tallgrass-1-roof", 2, 31, 1, 1, new int[][] {{0, 65, 0, 1, 0}});
    run("tallgrass-2-roof", 2, 31, 2, 1, new int[][] {{0, 65, 0, 20, 0}});
    run("tallgrass-1-stone-soil", 1, 31, 1, 1, null);
    run("tallgrass-1-sand-soil", 12, 31, 1, 1, null);
    run("tallgrass-1-farmland", 60, 31, 1, 1, null);
    // Double plants: bottom half clicked (types 0-5), and the top half clicked (type read from the bottom).
    for (int type = 0; type < 6; type++) run("double-bottom-" + type, 2, 175, type, 5, new int[][] {{0, 65, 0, 175, 8}});
    // The click is at (0, 64, 0): the top half there, its bottom half below.
    for (int type : new int[] {0, 1, 2, 3, 4, 5}) runTop("double-top-" + type, type, 6);
    // Cocoa: age (meta >> 2 & 3) 0..2 (3 does not exist but is checked), every direction.
    for (int age = 0; age < 4; age++) for (int dir = 0; dir < 4; dir++) run("cocoa-" + age + "-" + dir, 3, 127, age << 2 | dir, 1, null);
    // Crops: wheat 59, carrots 141, potatoes 142: stage 0..7 with several seeds (the world Random draws the 2 + nextInt(4)).
    for (int block : new int[] {59, 141, 142})
      for (int meta : new int[] {0, 2, 5, 6, 7})
        for (int seed = 1; seed <= 3; seed++) run("crop-" + block + "-" + meta, 60, block, meta, seed, null);
    // Stems.
    for (int block : new int[] {104, 105})
      for (int meta : new int[] {0, 4, 6, 7})
        for (int seed = 1; seed <= 3; seed++) run("stem-" + block + "-" + meta, 60, block, meta, seed, null);
    // Saplings: the stack is spent; the 45 % gate then marks the sapling (meta | 8). Type 0..5 marks the same way.
    for (int meta = 0; meta < 6; meta += 5) for (int seed = 1; seed <= 10; seed++) run("sapling-" + meta, 3, 6, meta, seed, null);
    // b67 bonemeal3: the world Random stream of the grass block (BlockGrass.func_149853_b: 128 walks, tall grass or the biome's flower) and of a marked sapling's tree
    // (func_149878_d; the stage bit set: the gate draw, then the generator's draws), checked through the next draw like every record.
    for (int i = 1; i <= 6; i++) run("grass-plains", 2, 2, 0, i, null, 63, 1);
    for (int i = 1; i <= 4; i++) run("grass-forest", 2, 2, 0, i, null, 63, 4);
    for (int i = 1; i <= 3; i++) run("grass-covered", 2, 2, 0, i, new int[][] {{0, 64, 0, 1, 0}, {1, 64, 0, 1, 0}, {-1, 64, 1, 1, 0}}, 63, 1);
    for (int type = 0; type < 6; type++) for (int seed = 1; seed <= 12; seed++) run("sapling-marked-" + type, 3, 6, 8 | type, seed, null);
    // Not IGrowable.
    int[] never = {37, 38, 81, 83, 106, 111, 115, 86, 103, 59 + 20, 32, 2 + 1, 18, 17};
    for (int block : never) run("not-growable-" + block, block == 81 ? 12 : block == 83 ? 3 : block == 115 ? 88 : 2, block, 0, 1, null);
    run("not-growable-red-flower-meta-3", 2, 38, 3, 1, null);
    run("not-growable-farmland", 2, 60, 7, 1, null);
    run("not-growable-air", 2, 0, 0, 1, null);
  }

  static void runTop(String name, int type, int index) throws Exception {
    run(name, 2, 175, 8, index, new int[][] {{0, 63, 0, 175, type}});
  }
}
