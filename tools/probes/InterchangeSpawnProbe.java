import java.io.File;
import java.lang.reflect.Field;
import java.util.*;

// Batch 24 interchange evidence on the unchanged 1.7.10 classes (InterchangeProbe's EquipmentProbe world double; no class is patched or shipped).
//  spawnBonus  sg.a(name, world) for every registered living EntityList name, Entity.rand (sa.Z) replaced by new Random(seed), then
//              EntityLiving.onSpawnWithEgg (sw.a(sy)) with null data; the written Attributes list (sa.e) and the live attribute values.
//              Shows which classes take the followRange "Random spawn bonus" (gaussian * 0.05, operation 1) and that it is the first draw.
//  modEffect   hand-edited Attributes lists (extra modifiers and edited bases) read back with sa.f: the live values the entity then uses, the
//              health after HealF, and the list written again.
//  babyBoost   a zombie or pigman with or without IsBaby and with or without the saved "Baby speed boost" modifier, read back and written again.
//  weapon      the held item's attribute modifiers as EntityLivingBase.onUpdate applies them (tl.a(prev.D()), tl.b(stack.D()), bytecode-read in
//              sv.h), then the written Attributes list; and that list read back onto a fresh mob.
//  legacyOwner PreYggdrasilConverter.func_152719_a (nz.a) with a MinecraftServer stub (allocated without its constructor: serverOwner H,
//              onlineMode y, the profile cache X = new ns(server, file) and the GameProfileRepository W); and a wolf read with an Owner name.
public class InterchangeSpawnProbe {
  static void out(String s) { System.out.println(s); }
  static String q(String s) { return HorseProbe.str(s); }
  static sun.misc.Unsafe u;
  static EquipmentProbe.World w;

  static sa make(String name, long seed) throws Exception {
    sa e = sg.a(name, w);
    if (e == null) return null;
    MobMoveProbe.set(e, "Z", new Random(seed));
    EquipmentProbe.place(e, 3.5, 64.0, 7.5);
    return e;
  }
  static dh write(sa e) { dh t = new dh(); e.e(t); return t; }
  static sa read(String name, dh t) throws Exception {
    sa back = sg.a(name, w);
    MobMoveProbe.set(back, "Z", new Random(5));
    back.f(t);
    return back;
  }
  static String rec(sa e, dh t) {
    return ",\"attributes\":" + (t.b("Attributes", 9) ? InterchangeLinkProbe.attrsTag(t) : "[]") + ",\"live\":" + InterchangeLinkProbe.attrs((sv) e) + ",\"health\":" + ((sv) e).aS();
  }
  static dh attr(dh t, String name) {
    dq list = t.c("Attributes", 10);
    for (int i = 0; i < list.c(); i++) if (list.b(i).j("Name").equals(name)) return list.b(i);
    return null;
  }
  static void addModifier(dh a, String name, double amount, int op, long most, long least) {
    dq ms = a.b("Modifiers", 9) ? a.c("Modifiers", 10) : new dq();
    dh m = new dh();
    m.a("Name", name); m.a("Amount", amount); m.a("Operation", op); m.a("UUIDMost", most); m.a("UUIDLeast", least);
    ms.a(m);
    a.a("Modifiers", ms);
  }

  // ---- legacy owner names ----
  public static class Server extends net.minecraft.server.MinecraftServer {
    Server() { super(null, null); }
    protected boolean e() { return false; }
    public boolean h() { return false; }
    public ahk i() { return null; }
    public rd j() { return null; }
    public boolean k() { return false; }
    public int l() { return 0; }
    public boolean m() { return false; }
    public boolean X() { return false; }
    public boolean ad() { return false; }
    public String a(ahk g, boolean b) { return null; }
  }
  static Server server;
  static final List<String> lookups = new ArrayList<>();
  static com.mojang.authlib.GameProfile answer;
  static void setServer(String owner, boolean online, com.mojang.authlib.GameProfile repoAnswer) throws Exception {
    server = (Server) u.allocateInstance(Server.class);
    Field j = net.minecraft.server.MinecraftServer.class.getDeclaredField("j");
    j.setAccessible(true);
    j.set(null, server);
    Field h = net.minecraft.server.MinecraftServer.class.getDeclaredField("H");
    h.setAccessible(true);
    h.set(server, owner);
    Field y = net.minecraft.server.MinecraftServer.class.getDeclaredField("y");
    y.setAccessible(true);
    y.setBoolean(server, online);
    answer = repoAnswer;
    Object repo = java.lang.reflect.Proxy.newProxyInstance(com.mojang.authlib.GameProfileRepository.class.getClassLoader(), new Class[] { com.mojang.authlib.GameProfileRepository.class }, (proxy, m, a) -> {
      if (m.getName().equals("findProfilesByNames")) {
        for (String n : (String[]) a[0]) lookups.add(n);
        com.mojang.authlib.ProfileLookupCallback cb = (com.mojang.authlib.ProfileLookupCallback) a[2];
        for (String n : (String[]) a[0]) {
          if (answer != null && answer.getName().equalsIgnoreCase(n)) cb.onProfileLookupSucceeded(answer);
          else cb.onProfileLookupFailed(new com.mojang.authlib.GameProfile(null, n), new RuntimeException("probe: no profile"));
        }
      }
      return null;
    });
    Field wf = net.minecraft.server.MinecraftServer.class.getDeclaredField("W");
    u.putObject(server, u.objectFieldOffset(wf), repo);
    File cache = File.createTempFile("probe-usercache", ".json");
    cache.delete();
    cache.deleteOnExit();
    Field xf = net.minecraft.server.MinecraftServer.class.getDeclaredField("X");
    u.putObject(server, u.objectFieldOffset(xf), new ns(server, cache));
  }
  static void legacy(String mode, String name) {
    lookups.clear();
    String result, error = null;
    try { result = nz.a(name); } catch (Throwable x) { result = null; error = x.toString(); }
    out("{\"case\":\"legacyOwner\",\"mode\":" + q(mode) + ",\"name\":" + q(name) + ",\"result\":" + (result == null ? "null" : q(result)) + ",\"lookups\":" + lookups.size()
      + ",\"error\":" + (error == null ? "null" : q(error)) + "}");
  }
  static void wolfOwner(String mode, String key, String value) throws Exception {
    sa e = make("Wolf", 3);
    dh t = write(e);
    t.o("OwnerUUID");
    t.a(key, value);
    sa back = read("Wolf", t);
    dh t2 = write(back);
    out("{\"case\":\"wolfOwner\",\"mode\":" + q(mode) + ",\"key\":" + q(key) + ",\"value\":" + q(value) + ",\"owner\":" + q(((tg) back).b()) + ",\"tamed\":" + ((tg) back).bZ()
      + ",\"written\":" + q(t2.j("OwnerUUID")) + ",\"maxHealth\":" + ((sv) back).a(yj.a).e() + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
    EquipmentProbe.w = w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    EquipmentProbe.environment(1, 0, 6, 1, false);

    List<String> names = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) names.add((String) k);
    Collections.sort(names);

    // ---- spawnBonus ----
    for (String n : names) for (long seed = 1; seed <= 3; seed++) {
      sa e;
      try { e = make(n, seed); } catch (Throwable x) { continue; }
      if (!(e instanceof sw)) break;
      String error = null;
      MobMoveProbe.set(w, "s", new Random(seed + 100));
      ChickenProbe.World.spawned.clear();
      try { ((sw) e).a((sy) null); } catch (Throwable x) { error = x.toString(); }
      dh t;
      try { t = write(e); } catch (Throwable x) { out("{\"case\":\"spawnBonusError\",\"id\":" + q(n) + ",\"error\":" + q(x.toString()) + "}"); break; }
      out("{\"case\":\"spawnBonus\",\"id\":" + q(n) + ",\"seed\":" + seed + ",\"error\":" + (error == null ? "null" : q(error)) + ",\"gauss\":" + (new Random(seed).nextGaussian() * 0.05)
        + ",\"spawned\":" + ChickenProbe.World.spawned.size() + rec(e, t) + ",\"nbt\":\"" + InterchangeLinkProbe.hex(t) + "\"}");
    }

    // ---- modEffect ----
    String[] modded = { "Zombie", "PigZombie", "Pig", "Cow", "Wolf", "Ozelot", "Skeleton", "Creeper", "Spider", "CaveSpider", "Villager", "VillagerGolem", "Enderman", "Witch",
      "Blaze", "EntityHorse", "Slime", "Chicken", "Sheep", "Silverfish", "SnowMan" };
    for (String n : modded) {
      for (int variant = 0; variant < 4; variant++) {
        sa e = make(n, 9);
        dh t = write(e);
        String kind;
        if (variant == 0) {
          kind = "modifiers";
          addModifier(attr(t, "generic.maxHealth"), "Probe health", 0.5, 2, 11, 1);
          addModifier(attr(t, "generic.movementSpeed"), "Probe speed", 0.2, 1, 11, 2);
          addModifier(attr(t, "generic.movementSpeed"), "Probe speed add", 0.05, 0, 11, 3);
          if (attr(t, "generic.attackDamage") != null) addModifier(attr(t, "generic.attackDamage"), "Probe damage", 3.0, 0, 11, 4);
          addModifier(attr(t, "generic.followRange"), "Probe follow", 1.0, 2, 11, 5);
          addModifier(attr(t, "generic.knockbackResistance"), "Probe knockback", 0.25, 0, 11, 6);
        } else if (variant == 1) {
          kind = "bases";
          attr(t, "generic.maxHealth").a("Base", 30.0);
          attr(t, "generic.movementSpeed").a("Base", 0.4);
          if (attr(t, "generic.attackDamage") != null) attr(t, "generic.attackDamage").a("Base", 7.0);
          attr(t, "generic.followRange").a("Base", 24.0);
          attr(t, "generic.knockbackResistance").a("Base", 0.5);
          t.a("HealF", 28.0f);
        } else if (variant == 2) {
          kind = "clamp";
          addModifier(attr(t, "generic.maxHealth"), "Probe health", 3000.0, 0, 11, 7);
          addModifier(attr(t, "generic.followRange"), "Probe follow", 5000.0, 0, 11, 8);
          addModifier(attr(t, "generic.knockbackResistance"), "Probe knockback", 4.0, 0, 11, 9);
          addModifier(attr(t, "generic.movementSpeed"), "Probe slow", -2.0, 2, 11, 10);
          t.a("HealF", 2500.0f);
        } else {
          kind = "unknownName";
          dq list = t.c("Attributes", 10);
          dh extra = new dh();
          extra.a("Name", "probe.unknown"); extra.a("Base", 3.0);
          list.a(extra);
          addModifier(attr(t, "generic.maxHealth"), "Probe health", -0.5, 1, 11, 11);
        }
        String input = InterchangeLinkProbe.hex(t);
        sa back = read(n, t);
        dh t2 = write(back);
        out("{\"case\":\"modEffect\",\"id\":" + q(n) + ",\"kind\":" + q(kind) + ",\"input\":" + InterchangeLinkProbe.attrsTag(t) + ",\"healF\":" + t.h("HealF") + rec(back, t2) + ",\"nbt\":\"" + input + "\"}");
      }
    }

    // ---- babyBoost ----
    for (String n : new String[] { "Zombie", "PigZombie" })
      for (int baby = 0; baby < 2; baby++) for (int mod = 0; mod < 2; mod++) {
        sa e = make(n, 4);
        dh t = write(e);
        t.a("IsBaby", baby == 1);
        if (mod == 1) {
          UUID id = UUID.fromString("b9766b59-9566-4402-bc1f-2ee2a276d836");
          addModifier(attr(t, "generic.movementSpeed"), "Baby speed boost", 0.5, 1, id.getMostSignificantBits(), id.getLeastSignificantBits());
        }
        String input = InterchangeLinkProbe.hex(t);
        sa back = read(n, t);
        dh t2 = write(back);
        out("{\"case\":\"babyBoost\",\"id\":" + q(n) + ",\"isBaby\":" + (baby == 1) + ",\"modifier\":" + (mod == 1) + ",\"child\":" + ((sv) back).f() + rec(back, t2) + ",\"nbt\":\"" + input + "\"}");
      }

    // ---- weapon ----
    int[][] held = { { 267, 0 }, { 283, 0 }, { 256, 0 }, { 261, 0 }, { 279, 0 }, { 276, 0 }, { 272, 0 }, { 268, 0 }, { 270, 0 }, { 278, 0 }, { 284, 0 }, { 1, 0 } };
    for (String n : new String[] { "Zombie", "Skeleton", "PigZombie" })
      for (int[] h : held) {
        sw e = (sw) make(n, 6);
        add stack = new add(adb.d(h[0]), 1, h[1]);
        add prev = e.be();
        if (prev != null) e.bc().a(prev.D());
        e.c(0, stack);
        e.bc().b(stack.D());
        dh t = write(e);
        sa back = read(n, t);
        out("{\"case\":\"weapon\",\"id\":" + q(n) + ",\"item\":" + h[0] + ",\"prev\":" + (prev == null ? 0 : adb.b(prev.b())) + rec(e, t) + ",\"backLive\":" + InterchangeLinkProbe.attrs((sv) back) + "}");
      }

    // ---- legacy owner ----
    String[] legacyNames = { "Player", "Notch", "a", "player", "Sixteen_chars_ab", "Seventeen_chars_x", "", " ", "Cached", "cached" };
    // IntegratedServer.startServer (bsx.e) calls setOnlineMode(true), so single player is an online-mode server with an owner (N() true); the
    // proxy repository fails every lookup (no network), as an offline browser would.
    setServer("Player", true, null);
    server.ax().a(new com.mojang.authlib.GameProfile(new UUID(5L, 6L), "Cached"));
    for (String n : legacyNames) legacy("singleplayer", n);
    setServer(null, false, null);
    for (String n : legacyNames) legacy("offlineServer", n);
    setServer(null, true, new com.mojang.authlib.GameProfile(new UUID(7L, 8L), "Notch"));
    for (String n : legacyNames) legacy("onlineServer", n);
    setServer("Player", true, null);
    wolfOwner("singleplayer", "Owner", "Player");
    wolfOwner("singleplayer", "Owner", "Seventeen_chars_x");
    wolfOwner("singleplayer", "Owner", "");
    wolfOwner("singleplayer", "OwnerUUID", " ");
    wolfOwner("singleplayer", "OwnerUUID", "not-a-uuid");
  }
}
