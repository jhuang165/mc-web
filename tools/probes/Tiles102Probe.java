import java.util.*;
// b102 tiles102: unchanged 1.7.10 tile entities, TileEntity.createAndLoadEntity (aor.c) then writeToNBT (aor.b), edge tags of the tiles not yet audited:
// mob spawner (Delay widths, EntityId missing / odd, SpawnPotentials Weight / Properties / Type odd, SpawnData), beacon (Primary / Secondary / Levels widths),
// brewing stand (BrewTime, Items slot out of range), flower pot (Item / Data widths, unknown item), skull, comparator, enchant table / furnace CustomName, hopper cooldown.
public class Tiles102Probe {
  static Object tag(Object... kv) throws Exception { return Tiles95Probe.tag(kv); }
  static Object list(Object... i) throws Exception { return Tiles95Probe.list(i); }
  static Object item(int s, int id, int c, int d) throws Exception { return Tiles95Probe.item(s, id, c, d); }
  static void run(String l, String id, Object... kv) throws Exception {
    Object[] a = new Object[kv.length + 6]; a[0] = "x"; a[1] = 1; a[2] = "y"; a[3] = 2; a[4] = "z"; a[5] = 3; System.arraycopy(kv, 0, a, 6, kv.length);
    Tiles95Probe.run(l, id, tag(a));
  }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null);
    Tiles95Probe.DH = Class.forName("dh"); Tiles95Probe.DQ = Class.forName("dq"); Tiles95Probe.DY = Class.forName("dy"); Tiles95Probe.TE = Class.forName("aor");
    // spawner
    Object[] w = {(byte) 7, (short) 7, 7, 7L, 7.5f, 7.5d, "7"};
    for (Object v : w) run("spawner Delay " + v.getClass().getSimpleName(), "MobSpawner", "EntityId", "Pig", "Delay", v);
    for (Object v : w) run("spawner MinSpawnDelay " + v.getClass().getSimpleName(), "MobSpawner", "EntityId", "Pig", "MinSpawnDelay", v, "MaxSpawnDelay", v);
    run("spawner EntityId int", "MobSpawner", "EntityId", 5);
    run("spawner EntityId empty", "MobSpawner", "EntityId", "", "Delay", (short) 5);
    run("spawner SpawnData only no EntityId", "MobSpawner", "SpawnData", tag("id", "Creeper", "Health", (short) 4));
    run("spawner SpawnData Pos", "MobSpawner", "EntityId", "Pig", "SpawnData", tag("id", "Pig", "Pos", list(), "foo", 1));
    run("spawner SpawnData id mismatch", "MobSpawner", "EntityId", "Pig", "SpawnData", tag("id", "Cow"));
    run("spawner SpawnData empty", "MobSpawner", "EntityId", "Pig", "SpawnData", tag());
    run("spawner SpawnData only: EntityId + potentials", "MobSpawner", "EntityId", "Pig", "SpawnData", tag("id", "Zombie"), "SpawnPotentials", list(tag("Type", "Cow", "Weight", 1)));
    String[] ws = {"neg", "zero", "short", "long", "string", "missing", "big"};
    Object[] wv = {-3, 0, (short) 4, 4L, "4", null, Integer.MAX_VALUE};
    for (int i = 0; i < ws.length; i++) {
      if (wv[i] == null) run("potentials weight " + ws[i], "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow")));
      else run("potentials weight " + ws[i], "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow", "Weight", wv[i])));
    }
    run("potentials Properties string", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow", "Weight", 2, "Properties", "x")));
    run("potentials Properties id key", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow", "Weight", 2, "Properties", tag("id", "Pig", "Health", (short) 2))));
    run("potentials Type missing", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Weight", 2, "Properties", tag("Health", (short) 2))));
    run("potentials Type int", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", 3, "Weight", 2)));
    run("potentials extra key", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow", "Weight", 2, "foo", 1)));
    run("potentials two", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(tag("Type", "Cow", "Weight", 2), tag("Type", "Sheep", "Weight", 5, "Properties", tag("Color", (byte) 3))));
    run("potentials list of strings", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", list(Tiles95Probe.tag("a", 1) == null ? null : tag("Type", "Cow")));
    run("potentials wrong type", "MobSpawner", "EntityId", "Pig", "SpawnPotentials", "x");
    run("spawner field widths", "MobSpawner", "EntityId", "Pig", "SpawnCount", (byte) 3, "MaxNearbyEntities", 9L, "RequiredPlayerRange", 8.5d, "SpawnRange", "5");
    run("spawner extra key", "MobSpawner", "EntityId", "Pig", "Foo", 5);
    // beacon
    Object[] bw = {(byte) 3, (short) 3, 3, 3L, 3.5f, "3"};
    for (Object v : bw) run("beacon Primary " + v.getClass().getSimpleName(), "Beacon", "Primary", v, "Secondary", v, "Levels", v);
    for (int p : new int[]{0, 1, 3, 5, 8, 10, 11, 22, 33, 99, -1}) run("beacon Primary " + p, "Beacon", "Primary", p, "Secondary", p, "Levels", 4);
    for (int l : new int[]{-1, 0, 1, 4, 5, 100}) run("beacon Levels " + l, "Beacon", "Levels", l);
    run("beacon empty", "Beacon");
    run("beacon extra", "Beacon", "Primary", 1, "Foo", 5);
    // brewing stand
    for (int s : new int[]{0, 3, 4, 5, 127, -1, -128}) run("brewing slot " + s, "Cauldron", "Items", list(item(s, 373, 1, 0)));
    run("brewing slot dup", "Cauldron", "Items", list(item(0, 373, 1, 0), item(0, 373, 1, 16)));
    run("brewing slot short", "Cauldron", "Items", list(tag("Slot", (short) 1, "id", (short) 373, "Count", (byte) 1, "Damage", (short) 0)));
    run("brewing slot int", "Cauldron", "Items", list(tag("Slot", 1, "id", (short) 373, "Count", (byte) 1, "Damage", (short) 0)));
    run("brewing slot missing", "Cauldron", "Items", list(tag("id", (short) 373, "Count", (byte) 1, "Damage", (short) 0)));
    run("brewing items wrong type", "Cauldron", "Items", "x");
    for (Object v : new Object[]{(byte) 5, (short) 5, 5, 5L, "5", 70000, -4}) run("brewing BrewTime " + v.getClass().getSimpleName() + " " + v, "Cauldron", "BrewTime", v);
    run("brewing CustomName", "Cauldron", "CustomName", "Brew");
    run("brewing CustomName int", "Cauldron", "CustomName", 5);
    run("brewing CustomName empty", "Cauldron", "CustomName", "");
    // flower pot
    Object[] fw = {(byte) 38, (short) 38, 38, 38L, 38.5f, "38"};
    for (Object v : fw) run("pot Item " + v.getClass().getSimpleName(), "FlowerPot", "Item", v, "Data", 2);
    Object[] dw = {(byte) 2, (short) 2, 2, 2L, 2.5d, "2"};
    for (Object v : dw) run("pot Data " + v.getClass().getSimpleName(), "FlowerPot", "Item", 38, "Data", v);
    for (int i : new int[]{0, 6, 37, 38, 39, 40, 81, 32, 31, 30, 1, 2, 4, 44, 175, 256, 295, 6000, -5, 2256, 409}) run("pot item " + i, "FlowerPot", "Item", i, "Data", 1);
    for (int d : new int[]{-1, 0, 8, 9, 100, 70000, -70000}) { run("pot red flower data " + d, "FlowerPot", "Item", 38, "Data", d); run("pot sapling data " + d, "FlowerPot", "Item", 6, "Data", d); }
    run("pot empty", "FlowerPot");
    run("pot extra key", "FlowerPot", "Item", 38, "Data", 1, "Foo", 3);
    run("pot Item string unknown", "FlowerPot", "Item", "abc");
    // skull
    for (Object v : new Object[]{(byte) 2, (short) 2, 2, 2L, "2"}) run("skull SkullType " + v.getClass().getSimpleName(), "Skull", "SkullType", v, "Rot", v);
    for (int t : new int[]{0, 4, 5, 6, 127, -128, 200}) run("skull SkullType byte " + t, "Skull", "SkullType", (byte) t, "Rot", (byte) 3);
    for (int r : new int[]{0, 15, 16, 17, 127, -1, -128}) run("skull Rot byte " + r, "Skull", "SkullType", (byte) 0, "Rot", (byte) r);
    run("skull empty", "Skull");
    run("skull ExtraType int", "Skull", "SkullType", (byte) 3, "ExtraType", 3);
    run("skull Owner string", "Skull", "SkullType", (byte) 3, "Owner", "Notch");
    run("skull Owner empty compound", "Skull", "SkullType", (byte) 3, "Owner", tag());
    run("skull Owner name only", "Skull", "SkullType", (byte) 3, "Owner", tag("Name", "Steve"));
    run("skull Owner extra", "Skull", "SkullType", (byte) 3, "Owner", tag("Name", "Steve", "Id", "00000000-0000-0000-0000-000000000001", "Foo", 3));
    run("skull Owner bad Id", "Skull", "SkullType", (byte) 3, "Owner", tag("Name", "Steve", "Id", "nope"));
    // comparator
    for (Object v : new Object[]{(byte) 3, (short) 3, 3, 3L, 3.5f, 3.5d, "3", -1, 16, Integer.MIN_VALUE}) run("comparator " + v.getClass().getSimpleName() + " " + v, "Comparator", "OutputSignal", v);
    run("comparator extra", "Comparator", "OutputSignal", 4, "Foo", 1);
    // enchant table, furnace, hopper names
    run("enchant CustomName int", "EnchantTable", "CustomName", 5);
    run("enchant CustomName empty", "EnchantTable", "CustomName", "");
    run("enchant CustomName color", "EnchantTable", "CustomName", "§aTable");
    run("enchant extra key", "EnchantTable", "CustomName", "T", "Foo", 1);
    run("furnace CustomName int", "Furnace", "CustomName", 5);
    run("furnace CustomName empty", "Furnace", "CustomName", "");
    run("furnace CustomName long", "Furnace", "CustomName", "x".repeat(300));
    run("furnace slot 3", "Furnace", "Items", list(item(3, 4, 1, 0), item(2, 4, 1, 0)));
    run("furnace slot -1 and 127", "Furnace", "Items", list(item(-1, 4, 1, 0), item(127, 4, 1, 0)));
    for (Object v : new Object[]{(byte) 4, (short) 4, 4, 4L, "4", -2, 70000}) run("hopper cooldown " + v.getClass().getSimpleName() + " " + v, "Hopper", "TransferCooldown", v);
    run("hopper CustomName", "Hopper", "CustomName", "H");
    run("hopper CustomName empty", "Hopper", "CustomName", "");
    run("hopper slot 5", "Hopper", "Items", list(item(5, 4, 1, 0), item(4, 4, 1, 0)));
    run("hopper slot negative", "Hopper", "Items", list(item(-3, 4, 1, 0)));
    run("hopper no items extra", "Hopper", "Foo", 1);
  }
}
