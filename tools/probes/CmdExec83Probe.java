import java.io.File;
import java.lang.reflect.Field;
import java.util.*;

// Batch 83 cmdexec83: the command forms CmdArgsProbe (b82) could not run, on the unchanged 1.7.10 command classes. The CmdArgsProbe server double gets:
//  - a fresh pair of real EntityPlayerMP doubles per record (Alex at 0.5,64,0.5 yaw 30 pitch 10, Steve at 10.25,70,-3.75 yaw 90 pitch -20), each with its
//    MinecraftServer (mw.b), a real StatisticsFile (pg, never saved), a real ContainerPlayer (aap) as inventoryContainer and openContainer, health 20, and a
//    recording NetHandlerPlayServer whose player field (nh.b) is set, so the real setPlayerLocation (nh.a(DDDFF)) moves the player;
//  - MinecraftServer.theProfiler (b) = a real Profiler (qi);
//  - StatList (pp.a) and AchievementList (pc.a) initialised, so the achievement and stat-criteria lists exist;
//  - a world double (W) whose blockExists is World.blockExists's bytecode (ahb.d(III): y < 0 or y >= 256 is false) with every chunk loaded, and which
//    records spawnEntityInWorld.
// Records (one JSON object):
//  tab: [text, options] (CommandHandler.getPossibleCommands) for the texts the b82 double could not answer.
//  run: [command, args, setup, {thrown, crash, admin, chat: {player: [components]}, state}] processCommand (aa.b) called directly with Alex as the sender;
//       state is the players' (and a mount's) position/rotation/riding, health/dead, inventory, achievements after the command.
//  summon: [name, tag, {admin, spawned: [{cls, nbt: {key: NBTBase.toString()}}]}] CommandSummon with a data tag of every Entity.readFromNBT key, the
//       spawned entities' writeToNBT (sa.e) values of those keys.
public class CmdExec83Probe {
  static sun.misc.Unsafe u;
  static String q(String s) { return CmdChatProbe.q(s); }
  static Field fd(Class<?> c, String n) throws Exception { return PlayerDamageProbe.fd(c, n); }
  static String num(double d) { return Double.toString(d); }

  public static class W extends PlayerDamageProbe.World {
    static List<sa> spawned = new ArrayList<>();
    public boolean d(int x, int y, int z) { return y >= 0 && y < 256; } // World.blockExists (ahb.d(III), bytecode-read), every chunk loaded
    public boolean d(sa e) { spawned.add(e); return true; }            // World.spawnEntityInWorld: recorded
  }

  static CmdChatProbe.Srv server;
  static List<Object> online;
  static File statsDir;
  static CmdChatProbe.CP mk(String name, double x, double y, double z, float yaw, float pitch, int mode) throws Exception {
    CmdChatProbe.CP p = CmdChatProbe.player(name, x, y, z);
    fd(sa.class, "o").set(p, PlayerDamageProbe.w);
    mx m = (mx) u.allocateInstance(mx.class); fd(mx.class, "c").set(m, ahk.a(mode)); fd(mx.class, "b").set(m, p); fd(mw.class, "c").set(p, m);
    ahk.a(mode).a(p.bE);
    u.putObject(p, u.objectFieldOffset(mw.class.getDeclaredField("b")), server);
    u.putObject(p, u.objectFieldOffset(mw.class.getDeclaredField("bO")), new pg(server, new File(statsDir, name + ".json")));
    fd(sv.class, "aH").setInt(p, 20);
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    aap c = new aap(p.bm, true, p); p.bn = c; p.bo = c;
    ((nh) p.a).b = p;
    p.y = yaw; p.z = pitch; p.A = yaw; p.B = pitch;
    fd(yz.class, "bF").setInt(p, 5);
    return p;
  }

  static List<String> admin = new ArrayList<>();
  public static class Admin implements x {
    public void a(ac sender, aa cmd, int flags, String key, Object... a) { admin.add("[" + flags + "," + q(key) + "," + safeArgs(a) + "]"); }
  }

  // An argument component whose ChatStyle is its own parent (StatBase.func_150955_j sets the "[name]" wrapper's style to the name's, which is its sibling)
  // overflows the style getters: each part is recorded on its own, "!StackOverflowError" where that happens.
  static String part(java.util.concurrent.Callable<String> f) { try { return q(f.call()); } catch (StackOverflowError e) { return q("!StackOverflowError"); } catch (Exception e) { return q("!" + e); } }
  static String safeArgs(Object[] a) {
    StringBuilder b = new StringBuilder("[");
    if (a != null) for (Object o : a) {
      b.append(b.length() > 1 ? "," : "");
      if (o instanceof fj) { fj c = (fj) o; b.append("[" + part(() -> fk.a(c)) + "," + part(() -> c.d()) + "," + part(() -> c.c()) + "]"); }
      else b.append(q(String.valueOf(o)));
    }
    return b.append("]").toString();
  }
  static String stack(add s) throws Exception {
    if (s == null) return "null";
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]";
  }
  static String inv(yz p) throws Exception {
    StringBuilder b = new StringBuilder("{\"main\":[");
    for (int i = 0; i < p.bm.a.length; i++) b.append(i > 0 ? "," : "").append(stack(p.bm.a[i]));
    b.append("],\"armor\":[");
    for (int i = 0; i < p.bm.b.length; i++) b.append(i > 0 ? "," : "").append(stack(p.bm.b[i]));
    return b.append("],\"cursor\":").append(stack(p.bm.o())).append("}").toString();
  }
  static String where(sa e) {
    return "{\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u) + ",\"yaw\":" + e.y + ",\"pitch\":" + e.z + ",\"riding\":" + (e.m != null) + ",\"ridden\":" + (e.l != null) + "}";
  }
  static String achievements(mw p) throws Exception {
    StringBuilder b = new StringBuilder("[");
    for (Object o : pc.e) { pb a = (pb) o; if (p.w().a(a)) b.append(b.length() > 1 ? "," : "").append(q(a.e)); }
    return b.append("]").toString();
  }

  static z handler;
  static Map<String, aa> byName = new LinkedHashMap<>();
  static CmdChatProbe.CP alex, steve;
  static sa mount;

  static void fresh(String setup) throws Exception {
    alex = mk("Alex", 0.5, 64, 0.5, 30, 10, setup.equals("creative") ? 1 : 0);
    steve = mk("Steve", 10.25, 70, -3.75, 90, -20, 0);
    online.clear(); online.add(alex); if (!setup.equals("solo")) online.add(steve);
    mount = null;
    if (setup.equals("riding")) {
      wo pig = new wo(PlayerDamageProbe.w);
      PlayerDamageProbe.pos(pig, 5.5, 64, 5.5);
      pig.y = 45; pig.A = 45;
      alex.a((sa) pig); // the cast picks Entity.mountEntity (a(sv) is another method)
      mount = pig;
    }
    if (setup.startsWith("inv")) {
      yx in = alex.bm;
      in.a[0] = new add(aji.b("stone"), 10, 0);
      in.a[1] = new add(aji.b("stone"), 5, 1);
      in.a[2] = new add(adb.d(263), 3, 0);
      in.a[3] = new add(adb.d(263), 4, 1);
      in.a[9] = new add(adb.d(276), 1, 10);
      in.a[20] = new add(aji.b("wool"), 7, 3);
      in.b[0] = new add(adb.d(309), 1, 0);
      if (setup.equals("invCursor")) in.b(new add(aji.b("stone"), 2, 0));
    }
    for (CmdChatProbe.CP p : new CmdChatProbe.CP[] { alex, steve }) { p.direct.clear(); ((CmdChatProbe.NH) p.a).got.clear(); }
    admin.clear();
  }

  static String chat(CmdChatProbe.CP p) {
    List<String> got = new ArrayList<>(((CmdChatProbe.NH) p.a).got); got.addAll(p.direct);
    return "[" + String.join(",", got) + "]";
  }

  static String run(String name, String setup, String... a) throws Exception {
    fresh(setup);
    String thrown = "null", crash = "null";
    try { byName.get(name).b(alex, a.clone()); }
    catch (cd x) { thrown = "[" + q(x.getClass().getName()) + "," + q(x.getMessage()) + "," + CmdArgsProbe.args(x.a()) + "]"; }
    catch (Throwable t) { crash = q(String.valueOf(t)); }
    StringBuilder al = new StringBuilder("[");
    for (String s : a) al.append(al.length() > 1 ? "," : "").append(q(s));
    al.append("]");
    String state = "{\"alex\":" + where(alex) + ",\"steve\":" + where(steve) + (mount != null ? ",\"mount\":" + where(mount) : "")
      + ",\"health\":" + alex.aS() + ",\"dead\":" + alex.K + ",\"death\":" + q(PlayerDamageProbe.Player.message) + ",\"inv\":" + inv(alex)
      + ",\"achievements\":{\"Alex\":" + achievements(alex) + ",\"Steve\":" + achievements(steve) + "}}";
    PlayerDamageProbe.Player.message = null;
    return "[" + q(name) + "," + al + "," + q(setup) + ",{\"thrown\":" + thrown + ",\"crash\":" + crash + ",\"admin\":[" + String.join(",", admin) + "],\"chat\":{\"Alex\":" + chat(alex) + ",\"Steve\":" + chat(steve) + "},\"state\":" + state + "}]";
  }

  public static void main(String[] argv) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    CmdChatProbe.u = u;
    // The world double: PlayerDamageProbe's World fields copied into a W.
    W w = (W) u.allocateInstance(W.class);
    for (Class<?> c = PlayerDamageProbe.World.class; c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
        f.setAccessible(true); f.set(w, f.get(PlayerDamageProbe.w));
      }
    { Field l = ahb.class.getDeclaredField("L"); l.setAccessible(true); l.set(w, new ArrayList<>()); } // World.collidingBoundingBoxes (func_147461_a), which a dismount reads
    PlayerDamageProbe.w = w; SuffocationProbe.w = w; DifficultyProbe.w = w;
    pp.a(); pc.a();
    statsDir = java.nio.file.Files.createTempDirectory("cmdexec83").toFile();
    server = (CmdChatProbe.Srv) u.allocateInstance(CmdChatProbe.Srv.class);
    oi mgr = (oi) u.allocateInstance(CmdChatProbe.MgrImpl.class);
    Field e = oi.class.getDeclaredField("e"); e.setAccessible(true);
    online = new ArrayList<>();
    u.putObject(mgr, u.objectFieldOffset(e), online);
    Field mi = oi.class.getDeclaredField("i"); mi.setAccessible(true);
    u.putObject(mgr, u.objectFieldOffset(mi), server);
    Field uf = net.minecraft.server.MinecraftServer.class.getDeclaredField("u"); uf.setAccessible(true);
    u.putObject(server, u.objectFieldOffset(uf), mgr);
    Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
    u.putObject(u.staticFieldBase(jf), u.staticFieldOffset(jf), server);
    u.putObject(server, u.objectFieldOffset(net.minecraft.server.MinecraftServer.class.getDeclaredField("b")), new qi());
    mt ws = (mt) u.allocateInstance(mt.class);
    for (Field f : ahb.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true); f.set(ws, f.get(w));
    }
    Field wsf = net.minecraft.server.MinecraftServer.class.getDeclaredField("c"); wsf.setAccessible(true);
    wsf.set(server, new mt[] { ws, ws, ws });
    y.a(new Admin());
    String[] classes = { "bz", "ar", "aq", "al", "aw", "ca", "cb", "ap", "bv", "at", "am", "ao", "an", "bq", "au", "ak", "az", "ah", "bp", "bn", "as", "ai", "by", "br", "bf", "bk", "ae", "bu", "bm", "bx", "ba", "bg" };
    handler = new z();
    for (String c : classes) { aa cmd = (aa) Class.forName(c).getDeclaredConstructor().newInstance(); handler.a(cmd); byName.put(cmd.c(), cmd); }
    Field of = net.minecraft.server.MinecraftServer.class.getDeclaredField("o"); u.putObject(server, u.objectFieldOffset(of), handler);

    fresh("pair");
    StringBuilder tab = new StringBuilder("[");
    String[] tabTexts = { "achievement give ", "achievement give achievement.o", "achievement give achievement.openInventory ", "achievement give stat.j", "scoreboard objectives add x ", "achievement give * " };
    for (String text : tabTexts) {
      String res;
      try {
        List<?> r = handler.b(alex, text);
        if (r == null) res = "null";
        else { StringBuilder b = new StringBuilder("["); for (Object o : r) b.append(b.length() > 1 ? "," : "").append(q(String.valueOf(o))); res = b.append("]").toString(); }
      } catch (Throwable t) { res = q("!" + t); }
      tab.append(tab.length() > 1 ? "," : "").append("[" + q(text) + "," + res + "]");
    }
    tab.append("]");

    List<String> rows = new ArrayList<>();
    for (String s : new String[] { "pair", "creative" }) { rows.add(run("kill", s)); rows.add(run("kill", s, "Alex")); rows.add(run("kill", s, "Steve")); }
    String[][] tp = { { "1", "2", "3" }, { "~", "~1", "~" }, { "~-1.5", "~", "~2" }, { "1.5", "64", "-3" }, { "0", "-5", "0" }, { "0", "300", "0" }, { "0", "30000001", "0" }, { "~", "~-100000000", "~" },
      { "30000000", "64", "-30000000" }, { "-29999999.6", "64", "0" }, { "~30000000", "64", "0" }, { "Alex", "1", "2", "3" }, { "Steve", "1", "2", "3" }, { "Steve", "~", "~", "~1" },
      { "Steve" }, { "Alex" }, { "Alex", "Steve" }, { "Steve", "Alex" }, { "Alex", "Alex" }, { "Steve", "Steve" }, { "~", "~", "~" } };
    for (String[] a : tp) rows.add(run("tp", "pair", a));
    for (String[] a : new String[][] { { "1", "2", "3" }, { "~", "~", "~" }, { "Steve" }, { "Steve", "Alex" }, { "Alex", "Steve" }, { "Steve", "Steve" } }) rows.add(run("tp", "riding", a));
    String[][] clear = { {}, { "Alex" }, { "Alex", "stone" }, { "Alex", "stone", "0" }, { "Alex", "stone", "1" }, { "Alex", "stone", "-1" }, { "Alex", "coal" }, { "Alex", "coal", "1" }, { "Alex", "coal", "0" },
      { "Alex", "diamond_sword" }, { "Alex", "diamond_sword", "10" }, { "Alex", "diamond_sword", "0" }, { "Alex", "iron_boots" }, { "Alex", "dirt" }, { "Alex", "minecraft:stone" }, { "Alex", "1" },
      { "Alex", "wool" }, { "Alex", "wool", "3" }, { "Alex", "wool", "4" }, { "Alex", "stone", "x" }, { "Alex", "stone", "0", "extra" }, { "Steve" }, { "Nobody" }, { "Alex", "nosuch" } };
    for (String[] a : clear) rows.add(run("clear", "inv", a));
    for (String[] a : new String[][] { {}, { "Alex", "stone" }, { "Alex", "stone", "0" }, { "Alex", "dirt" } }) rows.add(run("clear", "invCursor", a));
    rows.add(run("clear", "pair", "Alex"));
    rows.add(run("debug", "pair", "stop"));
    String[][] ach = { { "give", "achievement.openInventory" }, { "give", "achievement.mineWood" }, { "give", "achievement.buildWorkBench" }, { "give", "achievement.diamonds" }, { "give", "*" },
      { "give", "stat.jump" }, { "give", "stat.nosuch" }, { "give", "achievement.openInventory", "Nobody" }, { "give", "achievement.openInventory", "Steve" }, { "take", "achievement.openInventory" },
      { "GIVE", "achievement.openInventory" }, { "give", "*", "Steve" }, { "foo", "achievement.openInventory" }, { "give", "Achievement.openInventory" }, { "give", "stat.mineBlock.minecraft.stone" } };
    for (String[] a : ach) rows.add(run("achievement", "pair", a));
    String[][] heights = {
      { "summon", "Pig", "0", "300", "0" }, { "summon", "Pig", "0", "-1", "0" }, { "summon", "Pig", "0", "255", "0" }, { "summon", "Pig", "0", "256", "0" }, { "summon", "Pig", "0", "-0.5", "0" },
      { "summon", "Pig", "0", "30000001", "0" }, { "summon", "Pig", "0", "-30000001", "0" }, { "summon", "Pig", "0", "~-64.5", "0" }, { "summon", "Pig", "0", "~192", "0" },
      { "setblock", "0", "-1", "0", "stone" }, { "setblock", "0", "256", "0", "stone" }, { "setblock", "0", "30000001", "0", "stone" }, { "setblock", "0", "~200", "0", "stone" },
      { "testforblock", "0", "-1", "0", "stone" }, { "testforblock", "0", "256", "0", "stone" }, { "testforblock", "0", "30000001", "0", "stone" }, { "testforblock", "0", "255", "0", "air" },
      { "testforblock", "0", "-30000001", "0", "stone" }, { "testforblock", "0", "~-65", "0", "stone" } };
    for (String[] h : heights) rows.add(run(h[0], "solo", Arrays.copyOfRange(h, 1, h.length)));

    // Summon tags: every key Entity.readFromNBT reads, plus EntityLiving's CustomName/CustomNameVisible and EntityTNTPrimed's Fuse.
    String[] tags = {
      "{Fire:100s,Air:50s,Motion:[0.1d,0.2d,0.3d],Rotation:[45.0f,10.0f],OnGround:1b,FallDistance:3.5f,Dimension:1,Invulnerable:1b,PortalCooldown:7,CustomName:\"Bob\",CustomNameVisible:1b,Fuse:5b}",
      "{Fire:-20s,Motion:[11.0d,-10.0d,0.0d]}",
      "{direction:[0.1d,-0.2d,0.3d],Fire:100s}", "{direction:[0.1d,-0.2d,0.3d],Fire:-20s}", // b85 fire85: a fireball without `direction` is born dead (EntityFireball.readEntityFromNBT); these rows are run for the fireball kinds only
      "{}", "" }; // b84 cmdfix84: "" is the untagged command (no fifth argument)
    String[] keys = { "Fire", "Air", "Motion", "Rotation", "OnGround", "FallDistance", "Dimension", "Invulnerable", "PortalCooldown", "CustomName", "CustomNameVisible", "Fuse" };
    StringBuilder sum = new StringBuilder("[");
    fresh("solo");
    List<?> names = handler.b(alex, "summon ");
    for (Object n : names) for (String tag : tags) {
      if (tag.startsWith("{direction") && !Arrays.asList("Fireball", "SmallFireball", "WitherSkull").contains(n)) continue;
      W.spawned.clear(); admin.clear();
      String crash = "null";
      try { byName.get("summon").b(alex, tag.isEmpty() ? new String[] { (String) n, "0.5", "64", "0.5" } : new String[] { (String) n, "0.5", "64", "0.5", tag }); } catch (Throwable t) { crash = q(String.valueOf(t)); }
      StringBuilder sp = new StringBuilder("[");
      for (sa s : W.spawned) {
        dh out = new dh();
        String nbt;
        try {
          s.e(out);
          StringBuilder kb = new StringBuilder("{");
          for (String k : keys) if (out.c(k)) kb.append(kb.length() > 1 ? "," : "").append(q(k)).append(":").append(q(out.a(k).toString()));
          nbt = kb.append("}").toString();
        } catch (Throwable t) { nbt = q("!" + t); }
        // b84 cmdfix84: one Entity.onUpdate (sa.h) of the entity as spawned, for the tags that carry Fire: the counter after it, isBurning (sa.al) and isDead (sa.K). A crash (the world
        // double is not a world) is recorded as "!..." and means the class's update needs more than this double.
        int fireRead = fd(sa.class, "e").getInt(s);
        String tick = "null";
        if (tag.contains("Fire:")) {
          try { s.h(); tick = "{\"fire\":" + fd(sa.class, "e").getInt(s) + ",\"burning\":" + s.al() + ",\"dead\":" + fd(sa.class, "K").getBoolean(s) + "}"; } catch (Throwable t) { tick = q("!" + t); }
        }
        sp.append(sp.length() > 1 ? "," : "").append("{\"cls\":" + q(s.getClass().getName()) + ",\"fire\":" + fireRead + ",\"tick\":" + tick + ",\"nbt\":" + nbt + "}");
      }
      sp.append("]");
      sum.append(sum.length() > 1 ? "," : "").append("[" + q((String) n) + "," + q(tag) + ",{\"crash\":" + crash + ",\"admin\":[" + String.join(",", admin) + "],\"spawned\":" + sp + "}]");
    }
    sum.append("]");
    // b85 fire85: (1) CommandSummon's onSpawnWithEgg (bu.b: run when the command has NO data tag and the entity is an EntityLiving; a tag, {} too, skips it): 280 runs per mode of an ocelot
    // (one chance in seven of two kittens: the spawned count) and a sheep (EntitySheep.onSpawnWithEgg: a random fleece colour; a tagged sheep is always colour 0). Each run is spawned
    // list size + the first sheep's Color. (2) Invulnerable:1b / absent, then attackEntityFrom(generic, 4) and (outOfWorld, 4) on the summoned entity: return value, isDead and a living entity's health.
    StringBuilder egg = new StringBuilder("[");
    for (String n : new String[] { "Ozelot", "Sheep" }) for (String tg : new String[] { "", "{}" }) {
      StringBuilder counts = new StringBuilder("["), colors = new StringBuilder("[");
      for (int i = 0; i < 280; i++) {
        W.spawned.clear(); admin.clear();
        try { byName.get("summon").b(alex, tg.isEmpty() ? new String[] { n, "0.5", "64", "0.5" } : new String[] { n, "0.5", "64", "0.5", tg }); } catch (Throwable t) { counts.append("\"!" + t + "\","); continue; }
        counts.append(i > 0 ? "," : "").append(W.spawned.size());
        String color = "null";
        for (sa s : W.spawned) if (s.getClass().getName().equals("wp")) { dh out = new dh(); s.e(out); color = q(out.a("Color").toString()); break; }
        colors.append(i > 0 ? "," : "").append(color);
      }
      egg.append(egg.length() > 1 ? "," : "").append("[" + q(n) + "," + q(tg) + "," + counts + "]," + colors + "]]");
    }
    egg.append("]");
    StringBuilder inv = new StringBuilder("[");
    String[][] invKinds = { { "Pig", "" }, { "Zombie", "" }, { "Boat", "" }, { "MinecartRideable", "" }, { "Item", "Item:{id:264s,Count:1b,Damage:0s}," }, { "XPOrb", "Value:5s," },
      { "Painting", "Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Kebab\"," }, { "ItemFrame", "Direction:0b,TileX:0,TileY:64,TileZ:0," }, { "EnderCrystal", "" } };
    for (String[] k : invKinds) for (String flag : new String[] { "0b", "1b" }) for (String src : new String[] { "generic", "outOfWorld" }) {
      W.spawned.clear(); admin.clear();
      String res = "null", err = "null", health = "null", dead = "null";
      try {
        byName.get("summon").b(alex, new String[] { k[0], "0.5", "64", "0.5", "{" + k[1] + "Invulnerable:" + flag + "}" });
        sa s = W.spawned.get(0);
        try { res = String.valueOf(s.a(src.equals("generic") ? ro.j : ro.i, 4.0f)); } catch (Throwable t) { err = q("" + t); }
        dead = String.valueOf(fd(sa.class, "K").getBoolean(s));
        if (s instanceof sv) health = String.valueOf(((sv) s).aS());
      } catch (Throwable t) { err = q("!" + t); }
      inv.append(inv.length() > 1 ? "," : "").append("[" + q(k[0]) + "," + q(flag) + "," + q(src) + "," + res + "," + dead + "," + health + "," + err + "]");
    }
    inv.append("]");
    System.out.println("{\"tab\":" + tab + ",\"run\":[" + String.join(",", rows) + "],\"summon\":" + sum + ",\"egg\":" + egg + ",\"invulnerable\":" + inv + "}");
  }
}
