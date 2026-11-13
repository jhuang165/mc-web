import java.lang.reflect.Field;
import java.util.*;

// Player-side hurt rules of the unchanged 1.7.10 classes (PLAYER-01 follow-ups), on the
// SuffocationProbe world double (Normal difficulty) with air below y 0. Prints one JSON object
// per line:
//   hits        scripted attackEntityFrom calls on the real EntityPlayerMP (mw) or a zombie (yq),
//               ticked like SuffocationProbe (player: --bU and --hurtResistantTime, then sv.C).
//               Each hit records the return value, health, hurtResistantTime, hurtTime, lastDamage
//               and every World event it caused: setEntityState statuses (2 hurt, 3 death), sounds
//               played at the entity, and sounds the player plays to everyone else
//               (EntityPlayer.playSound -> World.playSoundToNearExcept). The death message
//               (CombatTracker.func_151521_b, as EntityPlayerMP.onDeath broadcasts it) is recorded.
//   protection  one hit of each DamageSource on a player with field_147101_bU (spawn protection)
//               set, in Survival or Creative (capabilities.disableDamage), with or without armour.
//   void        Entity.onEntityUpdate below posY -64 calls EntityLivingBase.kill [sv.G], which is
//               attackEntityFrom(outOfWorld, 4); per-tick state as in hits.
public class PlayerDamageProbe {
  public static class World extends SuffocationProbe.World {
    static List<String> events = new ArrayList<>();
    // Air below y 0 (SuffocationProbe has stone there), so the void cases do not also suffocate.
    public aji a(int x, int y, int z) { Integer id = cells.get(key(x, y, z)); return aji.e(id != null ? id : 0); }
    public void a(sa entity, byte state) { events.add("status|" + state); }
    public void a(sa entity, String sound, float volume, float pitch) { events.add("sound|" + sound + "|" + volume); }
    public void a(yz except, String sound, float volume, float pitch) { events.add("except|" + sound + "|" + volume); }
    // Batch 51 (mobvictims): the entities World.getEntitiesWithinAABBExcludingEntity returns when `near` is set (the pigman's call for help).
    static List<sa> near = null;
    public List b(sa entity, azt box) {
      if (near == null) return super.b(entity, box);
      List<sa> out = new ArrayList<>();
      for (sa e : near) if (e != entity && e.C.b(box)) out.add(e);
      return out;
    }
  }
  // The original EntityPlayerMP. onDeath only records the death message its first line broadcasts
  // (chat, inventory scatter and scoreboard are not run).
  public static class Player extends mw {
    static String message;
    Player() { super(null, null, null, null); }
    public void a(ro source) { message = chat(aW().b()); }
  }

  static Class<? extends Player> playerClass = Player.class;
  static World w;
  static sun.misc.Unsafe u;
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static void pos(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String esc(String s) { return s.replace("\\", "\\\\").replace("\"", "\\\""); }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder();
    for (String x : l) s.append(s.length() == 0 ? "" : ",").append("\"").append(esc(x)).append("\"");
    return "[" + s + "]";
  }
  // ChatComponentTranslation (fr): key, the unformatted text of each argument, and the whole text.
  static String chat(fj c) {
    StringBuilder s = new StringBuilder("{");
    if (c instanceof fr) {
      fr t = (fr) c;
      s.append("\"key\":\"").append(esc(t.i())).append("\",\"args\":[");
      Object[] args = t.j();
      for (int i = 0; i < args.length; i++) s.append(i == 0 ? "" : ",").append("\"").append(esc(args[i] instanceof fj ? ((fj) args[i]).c() : String.valueOf(args[i]))).append("\"");
      s.append("],");
    }
    return s.append("\"text\":\"").append(esc(c.c())).append("\"}").toString();
  }

  static sv make(String type) throws Exception {
    if (type.equals("zombie")) return new yq(w);
    Player p = (Player) u.allocateInstance(playerClass); // b63 mppvp: the PvP probe swaps in a subclass that records the crit effects
    MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(0)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); MobMoveProbe.set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    fd(sv.class, "f").set(p, new HashMap());
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "bm", new yx(p));
    MobMoveProbe.set(p, "bp", new zr());
    fd(sv.class, "e").set(p, new rn(p));
    fd(sv.class, "aH").setInt(p, 20); // maxHurtResistantTime, set by the constructor
    fd(sa.class, "M").setFloat(p, 0.6f); // EntityPlayer's constructor: setSize(0.6F, 1.8F)
    fd(sa.class, "N").setFloat(p, 1.8f);
    u.putObject(p, u.objectFieldOffset(fd(yz.class, "i")), new com.mojang.authlib.GameProfile(new UUID(0, 1), "Player"));
    MobMoveProbe.set(p, "b", u.allocateInstance(SuffocationProbe.Fake.class));
    MobMoveProbe.set(p, "bO", u.allocateInstance(SuffocationProbe.Stats.class));
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    return p;
  }

  static ro source(String name, sv attacker) {
    switch (name) {
      case "inFire": return ro.a;
      case "onFire": return ro.b;
      case "lava": return ro.c;
      case "inWall": return ro.d;
      case "drown": return ro.e;
      case "starve": return ro.f;
      case "cactus": return ro.g;
      case "fall": return ro.h;
      case "outOfWorld": return ro.i;
      case "generic": return ro.j;
      case "mob": return ro.a(attacker);
      default: throw new IllegalArgumentException(name);
    }
  }

  static Field hr, ht, ld, bu;
  static int tickOf(sv e) throws Exception { return ticks.getOrDefault(e, 0); }
  static final Map<sv, Integer> ticks = new IdentityHashMap<>();
  static String state(sv e) throws Exception {
    return "\"health\":" + num(e.aS()) + ",\"resist\":" + hr.getInt(e) + ",\"hurtTime\":" + ht.getInt(e) + ",\"last\":" + num(ld.getFloat(e));
  }
  static sv prepare(String type, double x, double y, double z, Map<String, Object> setup) throws Exception {
    World.cells.clear();
    Player.message = null;
    sv e = make(type);
    pos(e, x, y, z);
    if (type.equals("player")) bu.setInt(e, setup.containsKey("protection") ? (Integer) setup.get("protection") : 0);
    if (setup.containsKey("creative")) { yw c = (yw) fd(yz.class, "bE").get(e); c.a = true; }
    if (setup.containsKey("armor")) { yx inv = (yx) fd(yz.class, "bm").get(e); for (int i = 0; i < 4; i++) inv.b[i] = new add(adb.d(306 + i), 1, 0); }
    if (setup.containsKey("health")) e.g((Float) setup.get("health"));
    MobMoveProbe.set(e, "Z", new Random(7));
    MobMoveProbe.set(w, "s", new Random(9));
    return e;
  }
  static void tick(sv e) throws Exception {
    ticks.merge(e, 1, Integer::sum);
    if (e instanceof mw) {
      bu.setInt(e, bu.getInt(e) - 1);
      if (hr.getInt(e) > 0) hr.setInt(e, hr.getInt(e) - 1);
    }
    e.C();
  }
  static String setupJson(Map<String, Object> setup) {
    StringBuilder su = new StringBuilder();
    for (Map.Entry<String, Object> en : setup.entrySet()) su.append(su.length() == 0 ? "" : ",").append("\"").append(en.getKey()).append("\":").append(en.getValue() instanceof Float ? num((Float) en.getValue()) : en.getValue().toString());
    return "{" + su + "}";
  }

  // ops: "tick:source:amount"; the hits of a tick land before its update.
  static void hits(String name, String type, int ticks, Map<String, Object> setup, String... ops) throws Exception {
    sv e = prepare(type, 64.5, 5.0, 64.5, setup);
    yq attacker = new yq(w); pos(attacker, 66.5, 5.0, 64.5);
    StringBuilder hitsOut = new StringBuilder(), ticksOut = new StringBuilder(), opsOut = new StringBuilder();
    for (String op : ops) opsOut.append(opsOut.length() == 0 ? "" : ",").append("\"").append(op).append("\"");
    int deadAt = -1;
    for (int t = 0; t < ticks && deadAt < 0; t++) {
      for (String op : ops) {
        String[] s = op.split(":");
        if (Integer.parseInt(s[0]) != t) continue;
        World.events.clear();
        boolean ok = e.a(source(s[1], attacker), Float.parseFloat(s[2]));
        hitsOut.append(hitsOut.length() == 0 ? "" : ",").append("{\"tick\":").append(t).append(",\"source\":\"").append(s[1]).append("\",\"amount\":").append(s[2])
          .append(",\"accepted\":").append(ok).append(",").append(state(e)).append(",\"events\":").append(strings(World.events)).append("}");
        if (e.aS() <= 0) deadAt = t;
      }
      if (deadAt >= 0) break;
      World.events.clear();
      tick(e);
      ticksOut.append(ticksOut.length() == 0 ? "" : ",").append("{").append(state(e)).append(",\"events\":").append(strings(World.events)).append("}");
      if (e.aS() <= 0) deadAt = t;
    }
    System.out.println("{\"case\":\"hits\",\"name\":\"" + name + "\",\"type\":\"" + type + "\",\"setup\":" + setupJson(setup) + ",\"ops\":[" + opsOut + "],\"hits\":[" + hitsOut + "],\"ticks\":[" + ticksOut + "],\"deadAt\":" + deadAt
      + ",\"message\":" + (Player.message == null ? "null" : Player.message) + "}");
  }

  static void protection(String src, Map<String, Object> setup) throws Exception {
    sv e = prepare("player", 64.5, 5.0, 64.5, setup);
    yq attacker = new yq(w); pos(attacker, 66.5, 5.0, 64.5);
    World.events.clear();
    boolean ok = e.a(source(src, attacker), 4.0f);
    System.out.println("{\"case\":\"protection\",\"source\":\"" + src + "\",\"amount\":4.0,\"setup\":" + setupJson(setup) + ",\"accepted\":" + ok + "," + state(e) + ",\"events\":" + strings(World.events) + "}");
  }

  static void voidCase(String name, String type, double y, int ticks, Map<String, Object> setup) throws Exception {
    sv e = prepare(type, 64.5, y, 64.5, setup);
    StringBuilder out = new StringBuilder();
    int deadAt = -1;
    for (int t = 0; t < ticks; t++) {
      World.events.clear();
      pos(e, 64.5, y, 64.5); // the probe does not move the entity; it stays at this height
      tick(e);
      out.append(out.length() == 0 ? "" : ",").append("{").append(state(e)).append(",\"events\":").append(strings(World.events)).append("}");
      if (e.aS() <= 0) { deadAt = t; break; }
    }
    System.out.println("{\"case\":\"void\",\"name\":\"" + name + "\",\"type\":\"" + type + "\",\"y\":" + num(y) + ",\"setup\":" + setupJson(setup) + ",\"ticks\":[" + out + "],\"deadAt\":" + deadAt
      + ",\"message\":" + (Player.message == null ? "null" : Player.message) + "}");
  }

  static Map<String, Object> setup(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  // The world double and the field handles, shared with CombatTrackerProbe.
  public static void init() throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    DifficultyProbe.w = w;
    SuffocationProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    fd(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    hr = fd(sa.class, "ad"); ht = fd(sv.class, "ax"); ld = fd(sv.class, "bb"); bu = fd(mw.class, "bU");
  }

  public static void main(String[] args) throws Exception {
    init();

    // Hurt-window top-ups: a larger hit while hurtResistantTime > 10 deals the difference.
    for (String type : new String[] { "player", "zombie" }) {
      hits("topup-" + type, type, 30, setup(), "0:generic:3", "4:generic:5", "6:generic:4", "6:generic:5", "8:generic:6.5", "9:generic:7", "10:generic:1", "21:generic:0.5");
      hits("topup-mob-" + type, type, 30, setup(), "0:mob:2", "3:mob:5", "12:mob:1");
      hits("topup-fatal-" + type, type, 30, setup("health", 6.0f), "0:generic:3", "2:generic:8");
      hits("fresh-fatal-" + type, type, 30, setup("health", 2.0f), "0:mob:4");
      hits("topup-fall-" + type, type, 30, setup(), "0:fall:2", "3:fall:5", "9:fall:7");
    }
    // Death messages: a final hit of each source, alone or after a zombie hit 12 ticks before.
    for (String src : new String[] { "inWall", "outOfWorld", "starve", "drown", "lava", "onFire", "inFire", "cactus", "generic", "fall" }) {
      hits("death-" + src, "player", 30, setup("health", 1.0f), "0:" + src + ":1");
      hits("death-" + src + "-after-mob", "player", 30, setup("health", 2.0f), "0:mob:1", "12:" + src + ":1");
    }
    // Spawn protection (EntityPlayerMP.field_147101_bU) and Creative against every source.
    String[] all = { "inFire", "onFire", "lava", "inWall", "drown", "starve", "cactus", "fall", "outOfWorld", "generic", "mob" };
    for (String src : all) {
      protection(src, setup());
      protection(src, setup("protection", 60));
      protection(src, setup("protection", 1));
      protection(src, setup("creative", true));
      protection(src, setup("creative", true, "protection", 60));
      protection(src, setup("armor", true));
      protection(src, setup("armor", true, "protection", 60));
    }
    // The void: below posY -64 every update is attackEntityFrom(outOfWorld, 4).
    voidCase("void-protected", "player", -64.5, 80, setup("protection", 60));
    voidCase("void", "player", -64.5, 80, setup());
    voidCase("void-creative", "player", -64.5, 80, setup("creative", true));
    voidCase("void-creative-protected", "player", -64.5, 80, setup("creative", true, "protection", 60));
    voidCase("void-armor-protected", "player", -64.5, 80, setup("armor", true, "protection", 60));
    voidCase("void-edge-at", "player", -64.0, 30, setup());
    voidCase("void-edge-below", "player", -64.000001, 30, setup());
    voidCase("void-above", "player", -63.9, 30, setup("protection", 60));
    voidCase("void-zombie", "zombie", -64.5, 80, setup());
  }
}
