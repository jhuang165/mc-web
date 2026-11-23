import java.lang.reflect.*;
import java.util.*;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.properties.Property;
// b97 tiles97: unchanged 1.7.10 classes. (1) item stacks with tag keys the port does not model, in every container tile and the jukebox, through
// TileEntity.createAndLoadEntity (aor.c) and writeToNBT (aor.b); (2) an EntityItem holding an ItemStack with a null item (BlockJukebox.dropRecord's
// ejection of a Record int that names no item): construct, merge test, tick, write; (3) TileEntitySkull ExtraType with a stub MinecraftServer whose profile cache
// knows nothing (the offline single-player case) and with a cache hit that carries textures. Builds on the Tiles95/96 probe helpers.
public class Tiles97Probe {
  static String q(String s) { return Tiles95Probe.q(s); }
  static Object tag(Object... kv) throws Exception { return Tiles95Probe.tag(kv); }
  static Object list(Object... i) throws Exception { return Tiles95Probe.list(i); }
  static Object item(int slot, int id, int count, int damage) throws Exception { return Tiles95Probe.item(slot, id, count, damage); }
  static Object itemTag(int slot, int id, int count, int damage, Object t) throws Exception { Object c = item(slot, id, count, damage); Tiles95Probe.put(c, "tag", t); return c; }
  static void run(String l, String id, Object t) throws Exception { Tiles95Probe.run(l, id, t); }
  public static class FakeCache extends ns {
    GameProfile hit;
    public FakeCache() { super(null, null); }
    public GameProfile a(String name) { return hit; }
  }
  public static class FakeServer extends net.minecraft.server.MinecraftServer {
    public FakeServer() { super(null, null); }
    protected boolean e() { return false; }
    public boolean h() { return false; }
    public ahk i() { return null; }
    public rd j() { return null; }
    public boolean k() { return false; }
    public int l() { return 0; }
    public boolean m() { return false; }
    public boolean X() { return false; }
    public boolean ad() { return false; }
    public String a(ahk a, boolean b) { return null; }
  }
  static Object extra() throws Exception {
    return tag("Extra", 7, "Flag", (byte) 1, "Big", 123456789012L, "Words", "hi", "Nested", tag("a", (short) 2, "b", list(tag("k", 1))),
      "display", tag("Name", "N", "Foo", "bar", "Deep", tag("x", 1)), "ench", list(tag("id", (short) 16, "lvl", (short) 2)));
  }
  public static void main(String[] x) throws Exception {
    Class.forName("aji").getMethod("p").invoke(null); Class.forName("adb").getMethod("l").invoke(null);
    Tiles95Probe.DH = Class.forName("dh"); Tiles95Probe.DQ = Class.forName("dq"); Tiles95Probe.DY = Class.forName("dy"); Tiles95Probe.TE = Class.forName("aor");
    // 1. unknown tag keys
    run("jukebox extra", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", itemTag(0, 2257, 1, 0, extra())));
    run("chest extra", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 276, 1, 7, extra()), itemTag(1, 4, 5, 0, tag("Extra", 7)))));
    run("hopper extra", "Hopper", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 276, 1, 7, extra()))));
    run("dispenser extra", "Trap", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 276, 1, 7, extra()))));
    run("dropper extra", "Dropper", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 276, 1, 7, extra()))));
    run("furnace extra", "Furnace", tag("x", 1, "y", 2, "z", 3, "BurnTime", (short) 5, "CookTime", (short) 6, "Items", list(itemTag(0, 4, 3, 0, tag("Extra", 7)), itemTag(1, 263, 2, 0, tag("Extra", 8)))));
    run("brewing extra", "Cauldron", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 373, 1, 16, tag("Extra", 7)))));
    run("jukebox empty tag", "RecordPlayer", tag("x", 1, "y", 2, "z", 3, "RecordItem", itemTag(0, 2257, 1, 0, tag())));
    run("chest empty tag", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 4, 1, 0, tag()))));
    run("chest tag wrong type", "Chest", tag("x", 1, "y", 2, "z", 3, "Items", list(itemTag(0, 4, 1, 0, null == null ? tag("Extra", 7) : null))));
    // 2. null-item entity
    ItemTags2Probe.u = MobMoveProbe.unsafe();
    ItemTags2Probe.world = (ItemTags2Probe.W2) ItemTags2Probe.u.allocateInstance(ItemTags2Probe.W2.class);
    MobMoveProbe.set(ItemTags2Probe.world, "s", new Random(2)); MobMoveProbe.set(ItemTags2Probe.world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(ItemTags2Probe.world, new ArrayList()); }
    MobMoveProbe.set(ItemTags2Probe.world, "t", ItemTags2Probe.u.allocateInstance(aqq.class));
    ays info = (ays) ItemTags2Probe.u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1); MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(ItemTags2Probe.world, info);
    ItemTags2Probe.world.tiles = new HashMap<>(); ItemTags2Probe.world.spawned = new ArrayList<>(); HorseProbe.W = ItemTags2Probe.world;
    ahb w = ItemTags2Probe.world;
    add ghost = new add((adb) null, 1, 0);
    step("ghost stack", () -> "stackSize=" + ghost.b + " item=" + ghost.b() + " hasTag=" + ghost.p() + " damaged=" + ghost.i() + " stackable=" + ghost.f());
    add copy = ghost.m();
    step("ghost copy", () -> "stackSize=" + copy.b + " item=" + copy.b());
    final xk[] ents = new xk[2];
    step("entity new", () -> { ents[0] = new xk(w, 1.5, 2.5, 3.5, copy); ents[0].b = 10; return "ok f()==null " + (ents[0].f() == null) + " item=" + ents[0].f().b() + " size=" + ents[0].f().b; });
    step("entity second", () -> { ents[1] = new xk(w, 1.5, 2.5, 3.5, ghost.m()); return "ok"; });
    step("spawn", () -> "ret " + w.d(ents[0]) + " spawned=" + ItemTags2Probe.world.spawned.size());
    step("merge a(xk)", () -> { Method m = xk.class.getDeclaredMethod("a", xk.class); m.setAccessible(true); return "ret " + m.invoke(ents[0], ents[1]) + " sizes " + ents[0].f().b + "/" + ents[1].f().b + " dead " + ents[1].K; });
    step("tick h()", () -> { for (int i = 0; i < 3; i++) ents[0].h(); return "ok age=" + ents[0].a + " dead=" + ents[0].K; });
    step("write b(dh)", () -> { Object o = Tiles95Probe.nbt(); Method m = sa.class.getDeclaredMethod("e", Tiles95Probe.DH); m.setAccessible(true); m.invoke(ents[0], o); return Tiles95Probe.ser(o); });
    step("write item compound", () -> Tiles95Probe.ser(ghost.m().b((dh) Tiles95Probe.nbt())));
    // 3. skull ExtraType through a stub server
    FakeServer srv = (FakeServer) ItemTags2Probe.u.allocateInstance(FakeServer.class);
    FakeCache cache = (FakeCache) ItemTags2Probe.u.allocateInstance(FakeCache.class);
    MobMoveProbe.set(srv, "X", cache);
    Field j = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); j.setAccessible(true); j.set(null, srv);
    run("skull ExtraType 3 cache miss", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", "Notch"));
    run("skull ExtraType 3 whitespace", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", " "));
    run("skull ExtraType 3 empty", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", ""));
    run("skull ExtraType 1 cache miss", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 1, "ExtraType", "Notch"));
    run("skull ExtraType int", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", 5));
    run("skull Owner and ExtraType", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "Owner", tag("Name", "Alex"), "ExtraType", "Notch"));
    GameProfile full = new GameProfile(UUID.fromString("069a79f4-44e9-4726-a5be-fca90e38aaf5"), "Notch");
    full.getProperties().put("textures", new Property("textures", "VALUE", "SIG"));
    cache.hit = full;
    run("skull ExtraType 3 cache hit textures", "Skull", tag("x", 1, "y", 2, "z", 3, "SkullType", (byte) 3, "ExtraType", "notch"));
    cache.hit = new GameProfile(UUID.fromString("069a79f4-44e9-4726-a5be-fca90e38aaf5"), "Notch");
    j.set(null, null);
  }
  interface Step { Object get() throws Exception; }
  static void step(String label, Step s) {
    String r; try { r = "{\"label\":" + q(label) + ",\"result\":" + q(String.valueOf(s.get())) + ",\"entity\":true}"; }
    catch (InvocationTargetException e) { r = "{\"label\":" + q(label) + ",\"error\":" + q(String.valueOf(e.getCause())) + ",\"entity\":true}"; }
    catch (Throwable e) { r = "{\"label\":" + q(label) + ",\"error\":" + q(String.valueOf(e)) + ",\"entity\":true}"; }
    System.out.println(r);
  }
}
