import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 78 falling78: executes the unchanged 1.7.10 classes for the falling-block leftovers.
//  - item: Item.getItemFromBlock for water, lava, fire and portal (and controls): class, id, stack size, a stack's NBT as an item entity writes it.
//  - land: World.canPlaceEntityOnSide(block, x, y, z, true, 1, null, null) (the check EntityFallingBlock.onUpdate makes) over a set of cells the block lands in.
//  - drop (b79 falling79): a falling water/lava block that times out drops ItemStack(block, 1, damageDropped) (xj.h with Time 601): the dropped item id for blocks 8, 9, 10, 11.
//  - tile (b79 falling79): the real xj.h lands a falling block carrying TileEntityData on a world double (Tiles79.World stores the cell and creates the tile entity through
//    ITileEntityProvider.createNewTileEntity like Chunk.func_150807_a); the landed tile's writeToNBT is dumped as hex with the data compound and the tile as placed without data.
//  - fire: the Fire short an EntityItem saves after 0, 1, 2, 5 and 200 onUpdate calls (Entity.moveEntity sets fire to -fireResistance while it is not burning).
public class FallingBlock78Probe {
  public static class W extends HorseProbe.World {
    static aji target = aji.e(0), below = aji.e(1);
    public aji a(int x, int y, int z) { return y == 64 ? target : y == 63 ? below : aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
  }
  static String q(String s) { return "\"" + s + "\""; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    W world = (W) MobNbtProbe.u.allocateInstance(W.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if ((f.getType() == List.class || f.getType() == ArrayList.class) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    int[] blocks = { 8, 9, 10, 11, 51, 90, 12, 13, 145, 1 };
    for (int id : blocks) {
      aji b = aji.e(id);
      adb it = adb.a(b);
      StringBuilder o = new StringBuilder("{\"kind\":\"item\",\"block\":" + id + ",\"material\":" + q(b.o() == awt.a ? "air" : "other") + ",\"item\":");
      if (it == null) o.append("null}");
      else {
        add stack = new add(b, 1, b.a(0));
        dh t = new dh();
        stack.b(t);
        o.append("{\"class\":" + q(it.getClass().getName()) + ",\"id\":" + adb.b(it) + ",\"max\":" + it.m() + ",\"damage\":" + b.a(0) + ",\"nbtId\":" + t.e("id") + ",\"nbtCount\":" + t.d("Count") + ",\"nbtDamage\":" + t.e("Damage") + "}}");
      }
      System.out.println(o);
    }
    int[] targets = { 0, 9, 8, 11, 10, 51, 78, 31, 1, 90, 106, 175 };
    // below: stone (solid top), glass (not a solid top surface), air, leaves, bottom stone slab, netherrack-free; only fire and portal can depend on it.
    for (int below : new int[] { 1, 20, 0, 18, 44 }) for (int id : blocks) for (int target : targets) {
      if (below != 1 && id != 51 && id != 90 && id != 12) continue;
      W.target = aji.e(target);
      W.below = aji.e(below);
      String res;
      try { res = String.valueOf(world.a(aji.e(id), 0, 64, 0, true, 1, null, null)); } catch (Throwable t) { res = q(t.getClass().getSimpleName()); }
      System.out.println("{\"kind\":\"land\",\"block\":" + id + ",\"target\":" + target + ",\"below\":" + below + ",\"canPlace\":" + res + "}");
    }
    W.below = aji.e(1);
    W.target = aji.e(0);
    for (int ticks : new int[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 40, 200 }) {
      xk e = new xk(world, 0.5, 70.0, 0.5, new add(aji.e(12), 1, 0));
      e.v = 0; e.w = 0; e.x = 0;
      for (int i = 0; i < ticks; i++) e.h();
      dh t = new dh();
      e.c(t);
      System.out.println("{\"kind\":\"fire\",\"ticks\":" + ticks + ",\"fire\":" + t.e("Fire") + ",\"age\":" + t.e("Age") + "}");
    }
    Tiles79.run();
  }

  // ---- b79 falling79 ----
  public static class Tiles79 {
    public static class World extends HorseProbe.World {
      static java.util.Map<String, aji> blocks = new java.util.HashMap<>();
      static java.util.Map<String, Integer> metas = new java.util.HashMap<>();
      static java.util.Map<String, aor> tiles = new java.util.HashMap<>();
      static String key79(int x, int y, int z) { return x + "," + y + "," + z; }
      @Override public aji a(int x, int y, int z) { aji b = blocks.get(key79(x, y, z)); return b != null ? b : y <= 63 ? aji.e(1) : aji.e(0); }
      @Override public int e(int x, int y, int z) { Integer m = metas.get(key79(x, y, z)); return m == null ? 0 : m; }
      @Override public List a(sa entity, azt box) {
        List<azt> out = new ArrayList<>();
        for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++) for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++) for (int y = 62; y <= 63; y++) out.add(azt.a(x, y, z, x + 1, y + 1, z + 1));
        return out;
      }
      @Override public boolean d(int x, int y, int z, aji b, int meta, int flags) {
        blocks.put(key79(x, y, z), b); metas.put(key79(x, y, z), meta);
        if (b instanceof akw) {
          aor t = ((akw) b).a(this, meta);
          if (t != null) { t.c = x; t.d = y; t.e = z; t.a(this); tiles.put(key79(x, y, z), t); }
        }
        return true;
      }
      @Override public aor o(int x, int y, int z) { return tiles.get(key79(x, y, z)); }
      @Override public void b(int x, int y, int z, aor t) {}
      @Override public void f(int x, int y, int z, aji b) {}
    }
    static String hex(dh t) throws Exception { return MobNbtProbe.hex(t); }
    static dh C(Object... kv) {
      dh t = new dh();
      for (int i = 0; i < kv.length; i += 2) {
        String key = (String) kv[i]; Object v = kv[i + 1];
        if (v instanceof Byte) t.a(key, (Byte) v); else if (v instanceof Short) t.a(key, (Short) v); else if (v instanceof Integer) t.a(key, (Integer) v);
        else if (v instanceof Long) t.a(key, (Long) v); else if (v instanceof Float) t.a(key, (Float) v); else if (v instanceof Double) t.a(key, (Double) v);
        else if (v instanceof String) t.a(key, (String) v); else t.a(key, (dy) v);
      }
      return t;
    }
    static dq L(dy... items) { dq l = new dq(); for (dy i : items) l.a(i); return l; }
    static dh I(int slot, int id, int count, int dmg) { return C("Slot", (byte) slot, "id", (short) id, "Count", (byte) count, "Damage", (short) dmg); }
    static byte b(int n) { return (byte) n; }
    static short s(int n) { return (short) n; }
    static void one(World w, String name, int id, int meta, String label, dh data) throws Exception {
      World.blocks.clear(); World.metas.clear(); World.tiles.clear();
      aji block = aji.e(id);
      // the tile as placed without data (the base the merge overlays)
      xj plain = new xj(w, 0.5, 64.52, 0.5, block, meta);
      String baseHex = "null";
      String err = null; boolean landed = false; String tileHex = "null";
      try {
        plain.b = 2;
        for (int i = 0; i < 3 && !plain.K; i++) plain.h();
        aor t0 = w.o(0, 64, 0);
        if (t0 != null) { dh d0 = new dh(); t0.b(d0); baseHex = hex(d0); }
      } catch (Throwable e) { err = "base:" + e; }
      World.blocks.clear(); World.metas.clear(); World.tiles.clear();
      xj e = new xj(w, 0.5, 64.52, 0.5, block, meta);
      if (data != null) e.d = data;
      err = null;
      try {
        e.b = 2;
        for (int i = 0; i < 3 && !e.K; i++) e.h();
      } catch (Throwable x) { Throwable c = x; while (c.getCause() != null) c = c.getCause(); err = c.getClass().getSimpleName() + ":" + String.valueOf(c.getMessage()); }
      // the cell and the tile after xj.h returned or threw (a throwing readFromNBT leaves the placed tile as it was)
      landed = World.blocks.get("0,64,0") == block;
      aor t = w.o(0, 64, 0);
      if (t != null) { dh d = new dh(); t.b(d); tileHex = hex(d); }
      System.out.println("{\"kind\":\"tile\",\"name\":" + q(name) + ",\"block\":" + id + ",\"meta\":" + meta + ",\"label\":" + q(label) + ",\"data\":" + (data == null ? "null" : q(hex(data))) + ",\"base\":" + (baseHex.equals("null") ? "null" : q(baseHex)) + ",\"landed\":" + landed + ",\"tile\":" + (tileHex.equals("null") ? "null" : q(tileHex)) + ",\"error\":" + (err == null ? "null" : "\"" + err.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"") + "}");
    }
    static void run() throws Exception {
      World w = (World) MobNbtProbe.u.allocateInstance(World.class);
      MobMoveProbe.set(w, "s", new Random(2));
      MobMoveProbe.set(w, "C", new qi());
      for (Field f : ahb.class.getDeclaredFields())
        if ((f.getType() == List.class || f.getType() == ArrayList.class) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
      MobMoveProbe.set(w, "t", MobNbtProbe.u.allocateInstance(aqq.class));
      // TileEntitySkull.readFromNBT resolves an ExtraType name through MinecraftServer.getPlayerProfileCache: an integrated-server shell holds a cache with one entry ("Notch").
      {
        Object server = MobNbtProbe.u.allocateInstance(bsx.class);
        Object cache = MobNbtProbe.u.allocateInstance(ns.class);
        MobMoveProbe.set(cache, "c", new java.util.HashMap());
        MobMoveProbe.set(cache, "d", new java.util.HashMap());
        MobMoveProbe.set(cache, "e", new java.util.LinkedList());
        java.lang.reflect.Constructor<?> k = Class.forName("nv").getDeclaredConstructor(ns.class, com.mojang.authlib.GameProfile.class, java.util.Date.class);
        k.setAccessible(true);
        com.mojang.authlib.GameProfile notch = new com.mojang.authlib.GameProfile(new java.util.UUID(0x1111L, 0x2222L), "Notch");
        Object entry = k.newInstance(cache, notch, new java.util.Date(System.currentTimeMillis() + 86400000L * 365));
        ((java.util.Map) MobMoveProbe.field(ns.class, "c").get(cache)).put("notch", entry);
        ((java.util.Map) MobMoveProbe.field(ns.class, "d").get(cache)).put(notch.getId(), entry);
        MobMoveProbe.set(cache, "b", new com.google.gson.GsonBuilder().create());
        java.io.File cacheFile = java.io.File.createTempFile("usercache79", ".json");
        cacheFile.deleteOnExit();
        MobMoveProbe.set(cache, "g", cacheFile);
        MobMoveProbe.set(server, "X", cache);
        // no network: fillProfileProperties returns the profile as given (the cache hit has no textures property)
        MobMoveProbe.set(server, "U", java.lang.reflect.Proxy.newProxyInstance(com.mojang.authlib.minecraft.MinecraftSessionService.class.getClassLoader(), new Class[] { com.mojang.authlib.minecraft.MinecraftSessionService.class }, (px, m, a) -> m.getName().equals("fillProfileProperties") ? a[0] : null));
        MobMoveProbe.field(net.minecraft.server.MinecraftServer.class, "j").set(null, server);
      }
      // drops: a falling fluid block that times out (Time over 600) drops ItemStack(block, 1, damageDropped)
      for (int id : new int[] { 8, 9, 10, 11 }) {
        HorseProbe.World.items.clear();
        xj e = new xj(w, 0.5, 70.0, 0.5, aji.e(id));
        e.b = 601;
        e.h();
        System.out.println("{\"kind\":\"drop\",\"block\":" + id + ",\"items\":" + q(String.join(",", HorseProbe.World.items)) + ",\"dead\":" + e.K + "}");
      }
      dh items = C("Items", L(I(0, 1, 3, 0), I(5, 264, 2, 0)));
      dh mixed = C("Items", L(I(0, 1, 3, 0), I(5, 264, 2, 0), I(30, 4, 1, 0), I(2, 4000, 1, 0)), "CustomName", "Named");
      for (int[] c : new int[][] { { 54, 2 }, { 146, 3 }, { 61, 2 }, { 62, 4 }, { 23, 3 }, { 158, 5 }, { 154, 2 }, { 117, 0 } }) {
        String n = c[0] == 54 || c[0] == 146 ? "chest" : c[0] == 61 || c[0] == 62 ? "furnace" : c[0] == 23 ? "dispenser" : c[0] == 158 ? "dropper" : c[0] == 154 ? "hopper" : "brewing";
        String extra = n.equals("furnace") ? "BurnTime" : n.equals("hopper") ? "TransferCooldown" : n.equals("brewing") ? "BrewTime" : null;
        one(w, n, c[0], c[1], "none", null);
        one(w, n, c[0], c[1], "empty", C());
        one(w, n, c[0], c[1], "items", items);
        one(w, n, c[0], c[1], "mixed items and name", mixed);
        one(w, n, c[0], c[1], "xyz ignored", C("x", 99, "y", 99, "z", 99, "Items", L(I(1, 1, 1, 0))));
        one(w, n, c[0], c[1], "unknown keys", C("Foo", b(1), "Bar", "baz", "Items", L(I(0, 1, 3, 0)), "id", "Furnace", "Lock", "x"));
        one(w, n, c[0], c[1], "Items string", C("Items", "oops"));
        one(w, n, c[0], c[1], "Items int list", C("Items", L(new dp(1), new dp(2))));
        one(w, n, c[0], c[1], "Items element wrong types", C("Items", L(C("Slot", "a", "id", "b", "Count", "c", "Damage", "d"), I(1, 5, 2, 0))));
        one(w, n, c[0], c[1], "Items missing slot", C("Items", L(C("id", s(1), "Count", b(2), "Damage", s(0)))));
        one(w, n, c[0], c[1], "Items slot int", C("Items", L(C("Slot", 1, "id", s(1), "Count", b(2), "Damage", s(0)))));
        one(w, n, c[0], c[1], "Items id int", C("Items", L(C("Slot", b(1), "id", 1, "Count", b(2), "Damage", s(0)))));
        one(w, n, c[0], c[1], "Items count zero and negative", C("Items", L(I(0, 1, 0, 0), I(1, 1, -3, 0), I(2, 1, 100, 0))));
        one(w, n, c[0], c[1], "Items damage and bad slots", C("Items", L(I(3, 276, 1, 5), I(-1, 1, 1, 0), I(255, 1, 1, 0), I(200, 1, 1, 0))));
        one(w, n, c[0], c[1], "duplicate slot", C("Items", L(I(0, 1, 1, 0), I(0, 2, 2, 0))));
        one(w, n, c[0], c[1], "CustomName int", C("CustomName", 5));
        one(w, n, c[0], c[1], "CustomName empty", C("CustomName", ""));
        one(w, n, c[0], c[1], "CustomName only", C("CustomName", "Boxy"));
        if (extra != null) {
          one(w, n, c[0], c[1], extra + " short", C(extra, s(37), "Items", L(I(0, 1, 1, 0))));
          one(w, n, c[0], c[1], extra + " int", C(extra, 41, "CookTime", 9));
          one(w, n, c[0], c[1], extra + " string", C(extra, "12", "Items", L(I(0, 1, 1, 0))));
          one(w, n, c[0], c[1], extra + " byte", C(extra, b(5)));
          one(w, n, c[0], c[1], extra + " negative", C(extra, s(-5)));
          one(w, n, c[0], c[1], extra + " large", C(extra, 70000));
        }
        if (n.equals("furnace")) {
          one(w, n, c[0], c[1], "CookTime short", C("CookTime", s(100), "BurnTime", s(50)));
          one(w, n, c[0], c[1], "CookTime string", C("CookTime", "3"));
          one(w, n, c[0], c[1], "furnace burn items", C("BurnTime", s(200), "CookTime", s(10), "Items", L(I(0, 4, 1, 0), I(1, 263, 1, 0), I(2, 1, 5, 0))));
        }
      }
      for (int[] c : new int[][] { { 63, 0 }, { 68, 2 } }) {
        one(w, "sign", c[0], c[1], "none", null);
        one(w, "sign", c[0], c[1], "four lines", C("Text1", "a", "Text2", "bb", "Text3", "ccc", "Text4", "dddd"));
        one(w, "sign", c[0], c[1], "long lines", C("Text1", "0123456789abcdefghij", "Text2", "exactly15chars!", "Text3", "sixteen chars!!!", "Text4", ""));
        one(w, "sign", c[0], c[1], "partial", C("Text2", "only2"));
        one(w, "sign", c[0], c[1], "wrong types", C("Text1", 5, "Text2", b(1), "Text3", C("a", 1), "Text4", L(new dp(1))));
        one(w, "sign", c[0], c[1], "unknown keys", C("Text5", "x", "Foo", 1, "Text1", "ok"));
        one(w, "sign", c[0], c[1], "unicode", C("Text1", "\u00e9\u4e2d\u00a7aZ", "Text2", "\ud83d\ude00\ud83d\ude00\ud83d\ude00\ud83d\ude00\ud83d\ude00\ud83d\ude00\ud83d\ude00\ud83d\ude00"));
        one(w, "sign", c[0], c[1], "xyz", C("x", 5, "Text1", "q"));
      }
      dh potential = C("Type", "Zombie", "Weight", 3, "Properties", C("Health", s(10)));
      one(w, "spawner", 52, 0, "none", null);
      one(w, "spawner", 52, 0, "empty", C());
      one(w, "spawner", 52, 0, "full", C("EntityId", "Skeleton", "Delay", s(33), "MinSpawnDelay", s(100), "MaxSpawnDelay", s(300), "SpawnCount", s(2), "MaxNearbyEntities", s(9), "RequiredPlayerRange", s(20), "SpawnRange", s(6)));
      one(w, "spawner", 52, 0, "entity only", C("EntityId", "Creeper"));
      one(w, "spawner", 52, 0, "delay only", C("Delay", s(7)));
      one(w, "spawner", 52, 0, "min delay only", C("MinSpawnDelay", s(55)));
      one(w, "spawner", 52, 0, "max nearby only", C("MaxNearbyEntities", s(3)));
      one(w, "spawner", 52, 0, "required range only", C("RequiredPlayerRange", s(30)));
      one(w, "spawner", 52, 0, "spawn range only", C("SpawnRange", s(9)));
      one(w, "spawner", 52, 0, "spawn count only", C("SpawnCount", s(7)));
      one(w, "spawner", 52, 0, "spawn data", C("EntityId", "Pig", "SpawnData", C("id", "Zombie", "Health", s(5)), "SpawnPotentials", L(potential, C("Type", "Pig", "Weight", 1))));
      one(w, "spawner", 52, 0, "potentials only", C("SpawnPotentials", L(potential)));
      one(w, "spawner", 52, 0, "potentials of ints", C("SpawnPotentials", L(new dp(1))));
      one(w, "spawner", 52, 0, "potentials string", C("SpawnPotentials", "x", "SpawnData", "y"));
      one(w, "spawner", 52, 0, "wrong types", C("EntityId", 5, "Delay", "x", "MinSpawnDelay", "y", "MaxSpawnDelay", b(1), "SpawnCount", "c", "MaxNearbyEntities", "n", "RequiredPlayerRange", "r", "SpawnRange", "s"));
      one(w, "spawner", 52, 0, "ints", C("Delay", 40, "MinSpawnDelay", 90000, "SpawnCount", 70000, "SpawnRange", 4));
      one(w, "spawner", 52, 0, "unknown keys", C("EntityId", "Pig", "Foo", b(1), "x", 4, "SpawnRange", s(5), "Items", L(I(0, 1, 1, 0))));
      one(w, "spawner", 52, 0, "unknown entity", C("EntityId", "NoSuchMob"));
      one(w, "spawner", 52, 0, "entity empty string", C("EntityId", ""));
      for (int meta : new int[] { 1, 2, 5 }) {
        one(w, "skull", 144, meta, "none", null);
        one(w, "skull", 144, meta, "empty", C());
        one(w, "skull", 144, meta, "type and rot", C("SkullType", b(3), "Rot", b(7)));
        one(w, "skull", 144, meta, "type out of range", C("SkullType", b(9), "Rot", b(20)));
        one(w, "skull", 144, meta, "negative", C("SkullType", b(-2), "Rot", b(-3)));
        one(w, "skull", 144, meta, "owner compound", C("SkullType", b(3), "Owner", C("Id", "11111111-2222-3333-4444-555555555555", "Name", "Steve")));
        one(w, "skull", 144, meta, "owner name only", C("SkullType", b(3), "Owner", C("Name", "Alex")));
        one(w, "skull", 144, meta, "owner id only", C("SkullType", b(3), "Owner", C("Id", "11111111-2222-3333-4444-555555555555")));
        one(w, "skull", 144, meta, "owner on zombie head", C("SkullType", b(2), "Owner", C("Name", "Alex")));
        one(w, "skull", 144, meta, "extratype", C("SkullType", b(3), "ExtraType", "Notch"));
        one(w, "skull", 144, meta, "extratype and owner", C("SkullType", b(3), "ExtraType", "Notch", "Owner", C("Name", "Alex")));
        one(w, "skull", 144, meta, "extratype empty", C("SkullType", b(3), "ExtraType", ""));
        one(w, "skull", 144, meta, "wrong types", C("SkullType", "x", "Rot", "y", "Owner", "z", "ExtraType", 4));
        one(w, "skull", 144, meta, "owner bad uuid", C("SkullType", b(3), "Owner", C("Id", "not-a-uuid", "Name", "Bob")));
        one(w, "skull", 144, meta, "type short", C("SkullType", s(3), "Rot", 5));
        one(w, "skull", 144, meta, "unknown keys", C("Foo", 1, "Rot", b(4)));
      }
      one(w, "flowerpot", 140, 0, "none", null);
      one(w, "flowerpot", 140, 0, "empty", C());
      one(w, "flowerpot", 140, 0, "rose", C("Item", 38, "Data", 0));
      one(w, "flowerpot", 140, 0, "poppy dandelion", C("Item", 37, "Data", 0));
      one(w, "flowerpot", 140, 0, "fern", C("Item", 31, "Data", 2));
      one(w, "flowerpot", 140, 0, "sapling", C("Item", 6, "Data", 3));
      one(w, "flowerpot", 140, 0, "cactus", C("Item", 81, "Data", 0));
      one(w, "flowerpot", 140, 0, "mushroom", C("Item", 39, "Data", 0));
      one(w, "flowerpot", 140, 0, "red mushroom", C("Item", 40, "Data", 0));
      one(w, "flowerpot", 140, 0, "deadbush", C("Item", 32, "Data", 0));
      one(w, "flowerpot", 140, 0, "item only", C("Item", 38));
      one(w, "flowerpot", 140, 0, "data only", C("Data", 4));
      one(w, "flowerpot", 140, 0, "stone", C("Item", 1, "Data", 0));
      one(w, "flowerpot", 140, 0, "nonsense", C("Item", 5000, "Data", 7));
      one(w, "flowerpot", 140, 0, "negative", C("Item", -3, "Data", -1));
      one(w, "flowerpot", 140, 0, "wrong types", C("Item", "x", "Data", "y"));
      one(w, "flowerpot", 140, 0, "short and byte", C("Item", s(38), "Data", b(1)));
      one(w, "flowerpot", 140, 0, "item stack style", C("Item", C("id", s(38), "Count", b(1))));
      one(w, "flowerpot", 140, 0, "unknown keys", C("Foo", 1, "Item", 38, "Data", 0, "Plant", "x"));
      one(w, "flowerpot", 140, 0, "tall grass", C("Item", 175, "Data", 2));
      one(w, "flowerpot", 140, 0, "sapling high data", C("Item", 6, "Data", 9));
      one(w, "flowerpot", 140, 0, "yellow flower data", C("Item", 37, "Data", 5));
      one(w, "flowerpot", 140, 0, "red flower data 8", C("Item", 38, "Data", 8));
      one(w, "flowerpot", 140, 0, "red flower data 9", C("Item", 38, "Data", 9));
      one(w, "flowerpot", 140, 0, "tallgrass data 1", C("Item", 31, "Data", 1));
      one(w, "flowerpot", 140, 0, "tallgrass data 0", C("Item", 31, "Data", 0));
      one(w, "flowerpot", 140, 0, "tallgrass data 3", C("Item", 31, "Data", 3));
      one(w, "flowerpot", 140, 0, "cactus data", C("Item", 81, "Data", 5));
      one(w, "flowerpot", 140, 0, "dead bush data", C("Item", 32, "Data", 5));
      one(w, "flowerpot", 140, 0, "sapling 0", C("Item", 6, "Data", 0));
      one(w, "flowerpot", 140, 0, "sapling 4", C("Item", 6, "Data", 4));
      one(w, "flowerpot", 140, 0, "sapling 5", C("Item", 6, "Data", 5));
      for (int meta : new int[] { 0, 1 }) {
        one(w, "command", 137, meta, "none", null);
        one(w, "command", 137, meta, "empty", C());
        one(w, "command", 137, meta, "command", C("Command", "say hi", "SuccessCount", 3, "CustomName", "Cmd", "TrackOutput", b(0)));
        one(w, "command", 137, meta, "last output", C("Command", "say hi", "LastOutput", "{\"text\":\"out\"}", "TrackOutput", b(1)));
        one(w, "command", 137, meta, "last output plain", C("LastOutput", "plain text"));
        one(w, "command", 137, meta, "last output bad json", C("Command", "say bad", "LastOutput", "{\"text\""));
        one(w, "command", 137, meta, "last output empty", C("LastOutput", ""));
        one(w, "command", 137, meta, "last output int", C("LastOutput", 5, "Command", "x"));
        one(w, "command", 137, meta, "last output array", C("LastOutput", "[{\"text\":\"a\"},{\"text\":\"b\"}]"));
        one(w, "command", 137, meta, "wrong types", C("Command", 5, "SuccessCount", "x", "CustomName", 3, "TrackOutput", "y"));
        one(w, "command", 137, meta, "success short", C("SuccessCount", s(4)));
        one(w, "command", 137, meta, "success big", C("SuccessCount", 99999));
        one(w, "command", 137, meta, "success negative", C("SuccessCount", -4));
        one(w, "command", 137, meta, "track int", C("TrackOutput", 1));
        one(w, "command", 137, meta, "track false", C("TrackOutput", b(0), "LastOutput", "{\"text\":\"kept\"}"));
        one(w, "command", 137, meta, "unknown keys", C("Foo", 1, "Command", "me x", "x", 4, "id", "Control"));
        one(w, "command", 137, meta, "custom name empty", C("CustomName", ""));
        one(w, "command", 137, meta, "long command", C("Command", "say " + "x".repeat(300)));
      }
      one(w, "note", 25, 0, "none", null);
      one(w, "note", 25, 0, "empty", C());
      for (int n : new int[] { 12, 24, 25, 50, -5 }) one(w, "note", 25, 0, "note " + n, C("note", b(n)));
      one(w, "note", 25, 0, "note short", C("note", s(7)));
      one(w, "note", 25, 0, "note int", C("note", 300));
      one(w, "note", 25, 0, "note string", C("note", "9"));
      one(w, "note", 25, 0, "note Note key", C("Note", b(9)));
      one(w, "note", 25, 0, "unknown keys", C("Foo", b(1), "note", b(3), "powered", b(1)));
      one(w, "note", 25, 0, "powered", C("note", b(2), "powered", b(1)));
      dh disc = C("id", s(2257), "Count", b(1), "Damage", s(0));
      one(w, "jukebox", 84, 0, "none", null);
      one(w, "jukebox", 84, 0, "empty", C());
      one(w, "jukebox", 84, 0, "record item", C("RecordItem", disc));
      one(w, "jukebox", 84, 0, "record item count 5", C("RecordItem", C("id", s(2258), "Count", b(5), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "record item with damage", C("RecordItem", C("id", s(2259), "Count", b(1), "Damage", s(3))));
      one(w, "jukebox", 84, 0, "record item with tag", C("RecordItem", C("id", s(2257), "Count", b(1), "Damage", s(0), "tag", C("display", C("Name", "X")))));
      one(w, "jukebox", 84, 0, "record item non disc", C("RecordItem", C("id", s(1), "Count", b(1), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "record item air", C("RecordItem", C("id", s(0), "Count", b(1), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "record item unknown id", C("RecordItem", C("id", s(4000), "Count", b(1), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "record item no count", C("RecordItem", C("id", s(2257))));
      one(w, "jukebox", 84, 0, "record item string", C("RecordItem", "x"));
      one(w, "jukebox", 84, 0, "record item id int", C("RecordItem", C("id", 2257, "Count", b(1), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "record item id string", C("RecordItem", C("id", "2257", "Count", b(1), "Damage", s(0))));
      one(w, "jukebox", 84, 0, "legacy record", C("Record", 2257));
      one(w, "jukebox", 84, 0, "legacy record non disc", C("Record", 1));
      one(w, "jukebox", 84, 0, "legacy record zero", C("Record", 0));
      one(w, "jukebox", 84, 0, "legacy record string", C("Record", "x"));
      one(w, "jukebox", 84, 0, "legacy record short", C("Record", s(2260)));
      one(w, "jukebox", 84, 0, "legacy record id 2267", C("Record", 2267));
      one(w, "jukebox", 84, 0, "legacy record id 2256", C("Record", 2256));
      one(w, "jukebox", 84, 0, "both", C("RecordItem", disc, "Record", 2258));
      one(w, "jukebox", 84, 0, "both with RecordItem non disc", C("RecordItem", C("id", s(1), "Count", b(1), "Damage", s(0)), "Record", 2258));
      one(w, "jukebox", 84, 0, "unknown keys", C("Foo", 1, "RecordItem", disc));
      one(w, "jukebox", 84, 0, "record item air with legacy", C("RecordItem", C("id", s(0), "Count", b(1), "Damage", s(0)), "Record", 2257));
      one(w, "beacon", 138, 0, "none", null);
      one(w, "beacon", 138, 0, "empty", C());
      one(w, "beacon", 138, 0, "full", C("Primary", 1, "Secondary", 10, "Levels", 4));
      one(w, "beacon", 138, 0, "primary only", C("Primary", 5));
      one(w, "beacon", 138, 0, "secondary only", C("Secondary", 1));
      one(w, "beacon", 138, 0, "levels only", C("Levels", 3));
      one(w, "beacon", 138, 0, "out of range", C("Primary", 99, "Secondary", -4, "Levels", 90));
      one(w, "beacon", 138, 0, "negative levels", C("Levels", -2));
      one(w, "beacon", 138, 0, "short and byte", C("Primary", s(3), "Secondary", b(2), "Levels", s(1)));
      one(w, "beacon", 138, 0, "wrong types", C("Primary", "x", "Secondary", "y", "Levels", "z"));
      one(w, "beacon", 138, 0, "unknown keys", C("Foo", 1, "Primary", 8));
      one(w, "beacon", 138, 0, "primary 0", C("Primary", 0, "Secondary", 0));
      one(w, "beacon", 138, 0, "long", C("Primary", 3L));
      one(w, "beacon", 138, 0, "float", C("Primary", 3.9f, "Levels", 2.5f));
      for (int id : new int[] { 149, 150 }) {
        one(w, "comparator", id, 0, "none", null);
        one(w, "comparator", id, 0, "empty", C());
        one(w, "comparator", id, 0, "signal 7", C("OutputSignal", 7));
        one(w, "comparator", id, 0, "signal big", C("OutputSignal", 99));
        one(w, "comparator", id, 0, "signal negative", C("OutputSignal", -3));
        one(w, "comparator", id, 0, "signal byte", C("OutputSignal", b(5)));
        one(w, "comparator", id, 0, "signal short", C("OutputSignal", s(9)));
        one(w, "comparator", id, 0, "signal string", C("OutputSignal", "4"));
        one(w, "comparator", id, 0, "signal long", C("OutputSignal", 6L));
        one(w, "comparator", id, 0, "signal float", C("OutputSignal", 6.7f));
        one(w, "comparator", id, 0, "unknown keys", C("Foo", 1, "OutputSignal", 3));
      }
      for (int id : new int[] { 12, 1, 145 }) one(w, "plain", id, 0, "data on a non-tile block", C("Items", L(I(0, 1, 1, 0))));
    }
  }
}
