// Batch 59 (smallchecks). The unchanged 1.7.10 ItemStack.getTooltip (add.a(yz, boolean)) with advanced tooltips on and off: the title suffix "(#0358/N)" (item id padded to
// four digits, and the damage when the item has subtypes), the extra lines (Durability, registry name, NBT count) for a few items. Reuses ItemTags2Probe's world double.
import java.lang.reflect.Field;
import java.util.*;

public class SmallChecksProbe {
  static void row(String name, int id, int count, int damage, String custom, boolean advanced) throws Exception {
    StringBuilder out = new StringBuilder("{\"tag\":\"b59tip\",\"name\":" + ItemTagsProbe.json(name) + ",\"id\":" + id + ",\"damage\":" + damage + ",\"custom\":" + (custom == null ? "null" : ItemTagsProbe.json(custom)) + ",\"advanced\":" + advanced);
    try {
      yz player = (yz) ItemTags2Probe.u.allocateInstance(HorseProbe.FakePlayer.class);
      MobMoveProbe.set(player, "o", ItemTags2Probe.world);
      MobMoveProbe.field(ahb.class, "E").setBoolean(ItemTags2Probe.world, true);
      add st = new add(adb.d(id), count, damage);
      if (custom != null) st.c(custom);
      String tip = ItemTagsProbe.strings(st.a(player, advanced));
      out.append(",\"tooltip\":").append(tip);
    } catch (Throwable x) { out.append(",\"error\":").append(ItemTagsProbe.err(x)); }
    System.out.println(out.append("}"));
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    ItemTags2Probe.u = MobMoveProbe.unsafe();
    ItemTags2Probe.world = (ItemTags2Probe.W2) ItemTags2Probe.u.allocateInstance(ItemTags2Probe.W2.class);
    ItemTags2Probe.W2 world = ItemTags2Probe.world;
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", ItemTags2Probe.u.allocateInstance(aqq.class));
    ays info = (ays) ItemTags2Probe.u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(world, info);
    world.tiles = new HashMap<>();
    world.spawned = new ArrayList<>();
    HorseProbe.W = world;
    int[][] cases = {
      {358, 0}, {358, 7}, {35, 0}, {35, 14}, {5, 0}, {5, 3}, {1, 0}, {3, 0}, {267, 0}, {267, 10}, {276, 1561}, {257, 0}, {263, 0}, {263, 1}, {373, 0}, {373, 8193}, {260, 0},
      {351, 4}, {397, 3}, {383, 50}, {2256, 0}, {403, 0}, {386, 0}, {387, 0}, {17, 2}, {44, 3}, {98, 1}, {145, 1}, {373, 16384}, {334, 0}};
    for (int[] c : cases) {
      for (boolean adv : new boolean[] {false, true}) row("item" + c[0], c[0], 1, c[1], null, adv);
    }
    // every registered id at damage 0, advanced on: the suffix tells which items have subtypes
    for (int id = 1; id < 4096; id++) {
      if (adb.d(id) == null) continue;
      try {
        yz player = (yz) ItemTags2Probe.u.allocateInstance(HorseProbe.FakePlayer.class);
        MobMoveProbe.set(player, "o", ItemTags2Probe.world);
        MobMoveProbe.field(ahb.class, "E").setBoolean(ItemTags2Probe.world, true);
        List<String> l = new add(adb.d(id), 1, 0).a(player, true);
        System.out.println("{\"tag\":\"b59sweep\",\"id\":" + id + ",\"first\":" + ItemTagsProbe.json(l.get(0)) + "}");
      } catch (Throwable x) { System.out.println("{\"tag\":\"b59sweep\",\"id\":" + id + ",\"error\":" + ItemTagsProbe.err(x) + "}"); }
    }
    row("named wool", 35, 1, 5, "Bob", true);
    row("named sword", 267, 1, 4, "Edge", true);
    row("named map", 358, 1, 9, "Atlas", true);
    row("named map plain", 358, 1, 9, "Atlas", false);
  }
}
