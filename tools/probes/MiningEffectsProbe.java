import java.lang.reflect.Field;
import java.util.*;

// Batch 81 (collide81): Haste and Mining Fatigue in the unchanged EntityPlayer.getCurrentPlayerStrVsBlock [yz.a(aji, boolean)] and
// Block.getPlayerRelativeBlockHardness [aji.a(yz, ahb, int, int, int)], on DigFinishProbe's EntityPlayerMP double (real inventory,
// real ItemStacks with the "ench" NBT list). The effects are real PotionEffect [rw] objects in EntityLivingBase.activePotionsMap [sv.f]
// (Haste id 3, Mining Fatigue id 4). Water is still water (id 9, meta 0) in the player's column, so Entity.isInsideOfMaterial(water) [sa.a(awt)]
// runs on the world double; Aqua Affinity is an enchanted iron helmet. onGround is sa.D. The dug block is at (10, 5, 10).
// Rows: [block, tool, efficiency, haste, fatigue, env, speed, progress]; haste/fatigue -1 = no effect, else the amplifier;
// env 0 dry ground, 1 wet ground, 2 wet ground with Aqua Affinity, 3 dry airborne, 4 wet airborne. speed/progress are Float.toString,
// "NaN"/"Infinity"/"-Infinity" as strings. tools/verify-mining-effects.mjs writes public/research/mining-effects-reference.json;
// src/collide81-b81.test.js replays it.
public class MiningEffectsProbe {
  static String num(float v) { return Float.isNaN(v) || Float.isInfinite(v) ? "\"" + v + "\"" : Float.toString(v); }
  static void effect(mw p, int id, int amp) throws Exception {
    @SuppressWarnings("unchecked") HashMap<Integer, rw> map = (HashMap<Integer, rw>) MobMoveProbe.field(sv.class, "f").get(p);
    map.remove(id);
    if (amp >= 0) map.put(id, new rw(id, 600, amp));
  }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    DigFinishProbe.dw = (DigFinishProbe.DWorld) PlayerDamageProbe.u.allocateInstance(DigFinishProbe.DWorld.class);
    for (Class<?> c = ahb.class; c != null && c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(DigFinishProbe.dw, f.get(PlayerDamageProbe.w)); }
    PlayerDamageProbe.w = DigFinishProbe.dw; DifficultyProbe.w = DigFinishProbe.dw; SuffocationProbe.w = DigFinishProbe.dw;
    // stone dirt cobble log leaves web wool obsidian torch bedrock netherrack glass pumpkin cactus snow layer
    int[] blocks = { 1, 3, 4, 17, 18, 30, 35, 49, 50, 7, 87, 20, 86, 81, 78 };
    // hand, wooden/iron/diamond/gold pickaxe, diamond shovel, diamond axe, iron sword, shears
    int[] tools = { 0, 270, 257, 278, 285, 277, 279, 267, 359 };
    int[][] pairs = { { -1, -1 }, { 0, -1 }, { 1, -1 }, { 2, -1 }, { 4, -1 }, { 9, -1 }, { 127, -1 }, { 255, -1 }, { -1, 0 }, { -1, 1 }, { -1, 2 }, { -1, 3 },
      { -1, 4 }, { -1, 5 }, { -1, 9 }, { -1, 255 }, { 0, 0 }, { 1, 2 }, { 4, 3 }, { 0, 4 }, { 9, 9 } };
    int[][] wide = { { -1, -1 }, { 1, -1 }, { -1, 1 }, { 1, 2 }, { -1, 4 }, { -1, 5 } };
    StringBuilder out = new StringBuilder();
    int n = 0;
    for (int b : blocks) for (int t : tools) for (int eff : new int[] { 0, 3 }) for (int env = 0; env < 5; env++) for (int[] hf : (eff == 0 && env == 0 ? pairs : wide)) {
      if (t == 0 && eff > 0) continue;
      DigFinishProbe.setup(env < 3 ? 1 : 0);
      mw p = DigFinishProbe.p;
      yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
      inv.a[0] = t > 0 ? new add(adb.d(t), 1, 0) : null; inv.c = 0;
      if (eff > 0) inv.a[0].a(aft.r, eff);
      if (env == 2) { add helmet = new add(adb.d(306), 1, 0); helmet.a(aft.j, 1); inv.b[3] = helmet; }
      if (env == 1 || env == 2 || env == 4) for (int y = 0; y < 12; y++) { DigFinishProbe.DWorld.cells.put(DigFinishProbe.DWorld.key(64, y, 64), 9); DigFinishProbe.DWorld.meta.put(DigFinishProbe.DWorld.key(64, y, 64), 0); }
      effect(p, 3, hf[0]); effect(p, 4, hf[1]);
      DigFinishProbe.DWorld.cells.put(DigFinishProbe.DWorld.key(10, 5, 10), b);
      aji block = aji.e(b);
      boolean wet = p.a(awt.h);
      if (wet != (env == 1 || env == 2 || env == 4)) throw new IllegalStateException("water setup " + env);
      float speed = p.a(block, p.a(block)), progress = block.a(p, DigFinishProbe.dw, 10, 5, 10);
      out.append("[").append(b).append(',').append(t).append(',').append(eff).append(',').append(hf[0]).append(',').append(hf[1]).append(',').append(env)
        .append(',').append(num(speed)).append(',').append(num(progress)).append("]\n");
      n++;
    }
    System.out.print(out);
    System.err.println(n + " rows");
  }
}
