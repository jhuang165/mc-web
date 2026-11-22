import java.lang.reflect.*;
import java.util.*;
// b96 tiles96: unchanged 1.7.10 tile entities through TileEntity.createAndLoadEntity (aor.c) and writeToNBT (aor.b), on the Tiles95Probe helpers, plus
// BlockSkull.breakBlock drops of raw types through ItemTags2Probe's world double (real authlib, no stub). Jukebox stacks with tags and Damage, unregistered
// Record ints, and the tile kinds batch 95 left (hopper, dispenser, dropper, brewing stand, chest names, daylight sensor, note edges, end portal, piston).
public class Tiles96Probe {
  static String q(String s) { return Tiles95Probe.q(s); }
  static Object tag(Object... kv) throws Exception { return Tiles95Probe.tag(kv); }
  static Object list(Object... i) throws Exception { return Tiles95Probe.list(i); }
  static Object item(int slot, int id, int count, int damage) throws Exception { return Tiles95Probe.item(slot, id, count, damage); }
  static Object itemTag(int slot, int id, int count, int damage, Object t) throws Exception { Object c = item(slot, id, count, damage); Tiles95Probe.put(c, "tag", t); return c; }
  static void run(String l, String id, Object t) throws Exception { Tiles95Probe.run(l, id, t); }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null);
    Tiles95Probe.DH = Class.forName("dh"); Tiles95Probe.DQ = Class.forName("dq"); Tiles95Probe.DY = Class.forName("dy"); Tiles95Probe.TE = Class.forName("aor");
    // Item.getItemById registry: every id 1..4095 that names an item (adb.d(int)) after Block.registerBlocks / Item.registerItems
    { StringBuilder b = new StringBuilder("{\"registry\":["); boolean f = true; Method g = Class.forName("adb").getMethod("d", int.class);
      for (int id = 1; id < 4096; id++) if (g.invoke(null, id) != null) { b.append(f ? "" : ",").append(id); f = false; }
      System.out.println(b.append("]}")); }
    // skull drops (BlockSkull.breakBlock -> getDamageValue)
    ItemTags2Probe.u = MobMoveProbe.unsafe();
    ItemTags2Probe.world = (ItemTags2Probe.W2) ItemTags2Probe.u.allocateInstance(ItemTags2Probe.W2.class);
    MobMoveProbe.set(ItemTags2Probe.world, "s", new Random(2)); MobMoveProbe.set(ItemTags2Probe.world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(ItemTags2Probe.world, new ArrayList()); }
    MobMoveProbe.set(ItemTags2Probe.world, "t", ItemTags2Probe.u.allocateInstance(aqq.class));
    ays info = (ays) ItemTags2Probe.u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1); MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(ItemTags2Probe.world, info);
    ItemTags2Probe.world.tiles = new HashMap<>(); ItemTags2Probe.world.spawned = new ArrayList<>(); HorseProbe.W = ItemTags2Probe.world;
    for (int t : new int[]{0, 4, 5, 7, 100, -1, -128}) ItemTags2Probe.drop("type" + t, t, null);
    ItemTagsProbe.N owner = ItemTags2Probe.prof("Notch", "069a79f4-44e9-4726-a5be-fca90e38aaf5");
    ItemTags2Probe.drop("type7_owner", 7, owner);
    // skull tile owner and ExtraType, real classes (the ExtraType lookup needs a server: probe read errors are reported, the profile is kept)
    Object nbtOwner = tag("Name", "Notch", "Id", "069a79f4-44e9-4726-a5be-fca90e38aaf5");
    run("skull Owner type 3", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "Owner", nbtOwner));
    run("skull Owner type 7", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 7, "Rot", (byte) 3, "Owner", nbtOwner));
    run("skull Owner string", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "Owner", "Notch"));
    // jukebox
    Object disc = item(0, 2257, 1, 5);
    run("jukebox disc damage 5", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", disc));
    run("jukebox disc damage -3", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 2257, 1, -3)));
    run("jukebox disc tag", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", itemTag(0, 2257, 1, 0, tag("display", tag("Name", "Mix"), "Extra", 7))));
    run("jukebox disc tag and damage", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", itemTag(0, 2258, 2, 9, tag("ench", list(tag("id", (short) 16, "lvl", (short) 2)), "RepairCost", 3))));
    run("jukebox tag not compound", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 2257, 1, 0)));
    run("jukebox sword tag", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", itemTag(0, 267, 1, 12, tag("display", tag("Name", "Blade")))));
    run("jukebox RecordItem id 0", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 0, 1, 0), "Record", 2258));
    run("jukebox RecordItem negative count", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", item(0, 2257, -5, 0)));
    for (int id : new int[]{26, 36, 51, 90, 95, 119, 140, 175, 176, 255, 256, 408, 2256, 2267, 2268, 5000, 32767, 32768, 65536, 70000}) run("jukebox Record " + id, "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "Record", id));
    // hopper
    run("hopper full", "Hopper", tag("x", 1, "y", 2, "z", 3, "CustomName", "H", "TransferCooldown", 5, "Items", list(item(0, 4, 3, 0), item(4, 263, 1, 0), item(5, 4, 1, 0), item(-1, 4, 1, 0))));
    run("hopper cooldown short", "Hopper", tag("x", 1, "y", 2, "z", 3, "TransferCooldown", (short) 7));
    run("hopper cooldown negative", "Hopper", tag("x", 1, "y", 2, "z", 3, "TransferCooldown", -4));
    run("hopper cooldown string", "Hopper", tag("x", 1, "y", 2, "z", 3, "TransferCooldown", "4"));
    run("hopper name empty", "Hopper", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("hopper name int", "Hopper", tag("x", 1, "y", 2, "z", 3, "CustomName", 4));
    run("hopper slot byte -1", "Hopper", tag("x", 1, "y", 2, "z", 3, "Items", list(item(255 - 256, 4, 1, 0))));
    // dispenser / dropper
    run("dispenser full", "Trap", tag("x", 1, "y", 2, "z", 3, "CustomName", "D", "Items", list(item(0, 4, 3, 0), item(8, 263, 1, 0), item(9, 4, 1, 0))));
    run("dropper full", "Dropper", tag("x", 1, "y", 2, "z", 3, "CustomName", "Dr", "Items", list(item(0, 4, 3, 0), item(8, 263, 1, 0), item(9, 4, 1, 0))));
    run("dispenser name empty", "Trap", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("dropper name empty", "Dropper", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("dispenser name int", "Trap", tag("x", 1, "y", 2, "z", 3, "CustomName", 5));
    run("dispenser tag items", "Trap", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 373, 1, 16421, tag("display", tag("Name", "P"))), item(1, 4, 0, 0), item(2, 4, -1, 0))));
    // brewing stand
    run("brewing full", "Cauldron", tag("x", 1, "y", 2, "z", 3, "CustomName", "B", "BrewTime", (short) 300, "Items", list(item(0, 373, 1, 16), item(1, 373, 1, 16), item(2, 373, 1, 0), item(3, 372, 1, 0), item(4, 4, 1, 0))));
    run("brewing time int", "Cauldron", tag("x", 1, "y", 2, "z", 3, "BrewTime", 70000));
    run("brewing time negative", "Cauldron", tag("x", 1, "y", 2, "z", 3, "BrewTime", (short) -5));
    run("brewing name empty", "Cauldron", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    // chests
    run("chest name", "Chest", tag("x", 1, "y", 2, "z", 3, "CustomName", "Box", "Items", list(item(0, 4, 3, 0), item(26, 4, 1, 0), item(27, 4, 1, 0))));
    run("chest name empty", "Chest", tag("x", 1, "y", 2, "z", 3, "CustomName", ""));
    run("chest name int", "Chest", tag("x", 1, "y", 2, "z", 3, "CustomName", 3));
    run("chest slot 255", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(item(-1, 4, 1, 0), item(-128, 4, 1, 0))));
    // daylight sensor, note edges, end portal, piston
    run("daylight", "DLDetector", tag("x", 1, "y", 2, "z", 3));
    run("note 24", "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) 24));
    run("note 25", "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) 25));
    run("note 26", "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) 26));
    run("note 100", "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) 100));
    run("note -1", "Music", tag("x", 1, "y", 2, "z", 3, "note", (byte) -1));
    run("note short 30", "Music", tag("x", 1, "y", 2, "z", 3, "note", (short) 30));
    run("note int 300", "Music", tag("x", 1, "y", 2, "z", 3, "note", 300));
    run("endportal", "Airportal", tag("x", 1, "y", 2, "z", 3));
    run("piston", "Piston", tag("x", 1, "y", 2, "z", 3, "blockId", 4, "blockData", 0, "facing", 1, "progress", 0.5f, "extending", (byte) 1));
    run("piston retract", "Piston", tag("x", 1, "y", 2, "z", 3, "blockId", 35, "blockData", 5, "facing", 3, "progress", 0.25f, "extending", (byte) 0));
    run("piston empty", "Piston", tag("x", 1, "y", 2, "z", 3));
    run("piston big", "Piston", tag("x", 1, "y", 2, "z", 3, "blockId", 70000, "blockData", 300, "facing", 9, "progress", 3.0f, "extending", (byte) 7));
    run("piston negative", "Piston", tag("x", 1, "y", 2, "z", 3, "blockId", -3, "blockData", -1, "facing", -2, "progress", -1.5f, "extending", (byte) -1));
    run("piston wrong types", "Piston", tag("x", 1, "y", 2, "z", 3, "blockId", "4", "blockData", 2.5, "facing", (short) 2, "progress", 1, "extending", 1));
    run("piston progress double", "Piston", tag("x", 1, "y", 2, "z", 3, "progress", 0.75, "blockId", (short) 5, "extending", (byte) 1));
  }
}
