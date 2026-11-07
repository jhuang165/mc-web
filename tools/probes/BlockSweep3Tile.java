import java.util.*;

// Tile-entity block boxes (batch 19). Runs the unchanged BlockPistonMoving (apr, id 36) with a real TileEntityPiston (aps) stored in the double
// (SW3.o returns it): setBlockBoundsBasedOnState, getSelectedBoundingBoxFromPool, getCollisionBoundingBoxFromPool and addCollisionBoxesToList for
// stored block x facing x extending x progress. BlockPistonMoving.setBlockBoundsBasedOnState first runs the stored block's own setBlockBoundsBasedOnState on the
// shared block instance, and the collision box then reads the stored block's (primed) bounds fields, so "pool" is taken after that call. The stored block's own unshifted pool box is recorded too ("stored"), so a replay can separate the
// shift arithmetic (func_149964_a) from the stored block's box. Chest, ender chest, trapped chest, skull, pot, brewing stand, enchanting table, anvil,
// end portal frame, beacon, cauldron, hopper, piston head and base compute their boxes from metadata and neighbours only (no getTileEntity call in
// the bytecode of their box methods), so BlockSweepProbe's sbox/mask rows already are the "tile entity present" values; "teq" records which of the
// listed blocks query a tile entity while computing boxes (the double logs every getTileEntity call).
public class BlockSweep3Tile {
  static final Map<Long, aor> TES = new HashMap<>();
  static boolean queried;
  static aor get(int x, int y, int z) { queried = true; return TES.get(((long) x << 40) ^ ((long) y << 20) ^ z); }
  static void set(int x, int y, int z, aor t) { TES.put(((long) x << 40) ^ ((long) y << 20) ^ z, t); }
  static String f(float v) { return Float.toString(v); }

  static void run(List<String> out) throws Exception {
    aji mv = aji.e(36);
    int[][] stored = {{1, 0}, {44, 0}, {44, 8}, {92, 3}, {88, 0}, {78, 3}, {60, 0}, {33, 0}, {33, 1}, {33, 2}, {33, 3}, {33, 4}, {33, 5}, {85, 0}, {50, 5}, {31, 1}, {54, 2}, {145, 0}, {116, 0}, {118, 0}, {154, 0}, {0, 0}, {36, 0}, {53, 0}, {53, 4}};
    float[] progs = {0f, 0.25f, 0.5f, 0.75f, 1f};
    for (int[] s : stored) {
      List<String> es = new ArrayList<>();
      for (int facing = 0; facing < 6; facing++) for (int ext = 0; ext < 2; ext++) for (float p : progs) {
        BlockSweepProbe.reset(); TES.clear();
        NetherBlocksProbe.put(0, 1, 0, 36, s[1]);
        aji sb = s[0] == 0 ? null : aji.e(s[0]);
        aps te = new aps(sb, s[1], facing, ext == 1, false);
        MobMoveProbe.set(te, "m", p); MobMoveProbe.set(te, "n", p);
        set(0, 1, 0, te);
        queried = false;
        es.add(BlockSweepProbe.entry(mv, 0, 1, 0).replaceFirst("\\}$", ",\"q\":" + queried + "}"));
      }
      String st;
      try { BlockSweepProbe.reset(); NetherBlocksProbe.put(0, 1, 0, s[0], s[1]); aji sb = s[0] == 0 ? null : aji.e(s[0]); BlockSweepProbe.restore(sb); if (sb != null) sb.a((ahl) BlockSweepProbe.w, 0, 1, 0); st = sb == null ? "null" : NetherBlocksProbe.box(sb.a((ahb) BlockSweepProbe.w, 0, 1, 0)); } catch (Throwable t) { st = BlockSweepProbe.q(BlockSweepProbe.ex(t)); }
      out.add("{\"c\":\"tebox\",\"id\":36,\"stored\":" + s[0] + ",\"meta\":" + s[1] + ",\"pool\":" + st + ",\"rows\":[" + String.join(",", es) + "]}");
    }
    // no tile entity at all: BlockPistonMoving.getCollisionBoundingBoxFromPool returns null, bounds are left as they were
    { BlockSweepProbe.reset(); TES.clear(); NetherBlocksProbe.put(0, 1, 0, 36, 0); out.add("{\"c\":\"tebox\",\"id\":36,\"stored\":-1,\"meta\":0,\"pool\":null,\"rows\":[" + BlockSweepProbe.entry(mv, 0, 1, 0) + "]}"); }
    // which box methods ask for a tile entity
    for (int id : new int[] {54, 130, 146, 144, 140, 117, 116, 145, 120, 138, 118, 154, 34, 29, 33, 149, 150}) {
      aji b = aji.e(id); List<String> qs = new ArrayList<>();
      for (int m = 0; m < 16; m++) { BlockSweepProbe.reset(); TES.clear(); NetherBlocksProbe.put(0, 1, 0, id, m); queried = false; BlockSweepProbe.entry(b, 0, 1, 0); qs.add(queried ? "1" : "0"); }
      out.add("{\"c\":\"teq\",\"id\":" + id + ",\"q\":\"" + String.join("", qs) + "\"}");
    }
  }
}
