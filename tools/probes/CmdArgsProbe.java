import java.lang.reflect.Field;
import java.util.*;

// Batch 82 commands82: the unchanged 1.7.10 command classes of the integrated server (the 31 common commands and /publish, ServerCommandManager's order) on the
// CmdChatProbe server double (allocated MinecraftServer, a ServerConfigurationManager holding real EntityPlayerMP doubles, PlayerDamageProbe's world). Added here:
// a WorldServer (mt) allocated with the double world's World fields copied in, as MinecraftServer.worldServers[0..2], and a recording IAdminCommand (x) set with
// CommandBase.setAdminCommander (y.a(x)), so notifyAdmins (func_152373_a / func_152374_a) records (flags, key, args) as ServerCommandManager.func_152372_a would send them.
// Records:
//  tab: [text, options or null or "!" + throwable] from CommandHandler.getPossibleCommands (z.b) for the sender Alex (only Alex online, as in single player).
//  run: [command, args, {thrown: [exception class, key, args] | null, crash: throwable or null, admin: [[flags, key, args]], sender: [components]}] from
//       processCommand (aa.b(ac, String[])) called directly (no permission test, no selector expansion), so a CommandException is the command's own.
// Every argument of a recorded translation is either a component ([json, formatted, unformatted]) or String.valueOf of the object.
public class CmdArgsProbe {
  static sun.misc.Unsafe u;
  static String q(String s) { return CmdChatProbe.q(s); }
  static String arg(Object o) { return o instanceof fj ? CmdChatProbe.comp((fj) o) : q(String.valueOf(o)); }
  static String args(Object[] a) {
    StringBuilder b = new StringBuilder("[");
    if (a != null) for (Object o : a) b.append(b.length() > 1 ? "," : "").append(arg(o));
    return b.append("]").toString();
  }
  static List<String> admin = new ArrayList<>();
  public static class Admin implements x {
    public void a(ac sender, aa cmd, int flags, String key, Object... a) { admin.add("[" + flags + "," + q(key) + "," + args(a) + "]"); }
  }

  public static void main(String[] argv) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    CmdChatProbe.u = u;
    CmdChatProbe.CP alex = CmdChatProbe.player("Alex", 0.5, 64, 0.5);
    PlayerDamageProbe.fd(sa.class, "o").set(alex, PlayerDamageProbe.w);
    mx plain = (mx) u.allocateInstance(mx.class); PlayerDamageProbe.fd(mx.class, "c").set(plain, ahk.a(0));
    PlayerDamageProbe.fd(mw.class, "c").set(alex, plain);
    PlayerDamageProbe.fd(yz.class, "bF").setInt(alex, 5);
    CmdChatProbe.Srv server = (CmdChatProbe.Srv) u.allocateInstance(CmdChatProbe.Srv.class);
    oi mgr = (oi) u.allocateInstance(CmdChatProbe.MgrImpl.class);
    Field e = oi.class.getDeclaredField("e"); e.setAccessible(true);
    List<Object> list = new ArrayList<>(); list.add(alex);
    u.putObject(mgr, u.objectFieldOffset(e), list);
    Field mi = oi.class.getDeclaredField("i"); mi.setAccessible(true);
    u.putObject(mgr, u.objectFieldOffset(mi), server);
    Field uf = net.minecraft.server.MinecraftServer.class.getDeclaredField("u"); uf.setAccessible(true);
    u.putObject(server, u.objectFieldOffset(uf), mgr);
    Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
    u.putObject(u.staticFieldBase(jf), u.staticFieldOffset(jf), server);
    // The WorldServer: the double world's World (ahb) fields copied into an allocated mt.
    mt ws = (mt) u.allocateInstance(mt.class);
    for (Field f : ahb.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      long off = u.objectFieldOffset(f);
      Class<?> t = f.getType();
      if (t == int.class) u.putInt(ws, off, u.getInt(PlayerDamageProbe.w, off));
      else if (t == long.class) u.putLong(ws, off, u.getLong(PlayerDamageProbe.w, off));
      else if (t == boolean.class) u.putBoolean(ws, off, u.getBoolean(PlayerDamageProbe.w, off));
      else if (t == float.class) u.putFloat(ws, off, u.getFloat(PlayerDamageProbe.w, off));
      else if (t == double.class) u.putDouble(ws, off, u.getDouble(PlayerDamageProbe.w, off));
      else if (t == byte.class) u.putByte(ws, off, u.getByte(PlayerDamageProbe.w, off));
      else if (t == short.class) u.putShort(ws, off, u.getShort(PlayerDamageProbe.w, off));
      else if (t == char.class) u.putChar(ws, off, u.getChar(PlayerDamageProbe.w, off));
      else u.putObject(ws, off, u.getObject(PlayerDamageProbe.w, off));
    }
    Field wsf = net.minecraft.server.MinecraftServer.class.getDeclaredField("c"); wsf.setAccessible(true);
    wsf.set(server, new mt[] { ws, ws, ws });
    y.a(new Admin());

    // ServerCommandManager's integrated registrations: the 31 common commands in constructor order, then /publish (bg).
    String[] classes = { "bz", "ar", "aq", "al", "aw", "ca", "cb", "ap", "bv", "at", "am", "ao", "an", "bq", "au", "ak", "az", "ah", "bp", "bn", "as", "ai", "by", "br", "bf", "bk", "ae", "bu", "bm", "bx", "ba", "bg" };
    z handler = new z();
    Map<String, aa> byName = new LinkedHashMap<>();
    for (String c : classes) { aa cmd = (aa) Class.forName(c).getDeclaredConstructor().newInstance(); handler.a(cmd); byName.put(cmd.c(), cmd); }
    // MinecraftServer.getCommandManager (J(), field o) for /help, and the ItemInWorldManager's player (mx.b) for /gamemode.
    Field of = net.minecraft.server.MinecraftServer.class.getDeclaredField("o"); u.putObject(server, u.objectFieldOffset(of), handler);
    PlayerDamageProbe.fd(mx.class, "b").set(plain, alex);

    StringBuilder tab = new StringBuilder("[");
    String[] tabTexts = {
      "time ", "time s", "time set ", "time set d", "time add ", "time query ", "time foo ", "time set day ",
      "gamemode ", "gamemode c", "gamemode 1 ", "gamemode creative A", "gamemode creative Alex ",
      "difficulty ", "difficulty e", "difficulty easy ", "defaultgamemode ", "defaultgamemode a", "defaultgamemode a ",
      "kill ", "kill A", "toggledownfall ", "weather ", "weather t", "weather rain ", "weather rain 10 ",
      "xp ", "xp 5 ", "xp 5 A", "xp 5 Alex ", "tp ", "tp A", "tp Alex ", "tp Alex A", "tp 1 2 ", "tp Alex 1 2 3 ",
      "give ", "give A", "give Alex minecraft:dia", "give Alex dia", "give Alex minecraft:stone_", "give Alex stone ", "give Alex stone 1 ",
      "effect ", "effect A", "effect Alex ", "effect Alex c", "effect Alex 1 ", "enchant ", "enchant Alex ", "enchant Alex 1 ",
      "me ", "me A", "me hi A", "seed ", "help ", "help t", "help ?", "help w", "help m", "help 1 ", "help pu",
      "debug ", "debug s", "debug start ", "tell ", "tell A", "tell Alex A", "say ", "say A", "say hi A",
      "spawnpoint ", "spawnpoint A", "spawnpoint Alex ", "spawnpoint Alex A", "spawnpoint Alex 1 ", "setworldspawn ", "setworldspawn 1 ",
      "gamerule ", "gamerule d", "gamerule keepInventory ", "gamerule keepInventory t", "gamerule nosuch ", "gamerule keepInventory true ",
      "clear ", "clear A", "clear Alex ", "clear Alex minecraft:dia", "clear Alex dia", "clear Alex stone ",
      "testfor ", "testfor A", "testfor Alex ", "spreadplayers ", "spreadplayers 0 0 1 10 ", "spreadplayers 0 0 1 10 false ", "spreadplayers 0 0 1 10 false A",
      "playsound ", "playsound random.click ", "playsound random.click A", "playsound random.click Alex ",
      "scoreboard ", "scoreboard o", "scoreboard objectives ", "scoreboard objectives add x ", "scoreboard objectives setdisplay ", "scoreboard players ", "scoreboard teams ",
      "scoreboard teams option ", "scoreboard players set ",
      "achievement ", "achievement g", "achievement give ", "achievement give achievement.o", "achievement give achievement.openInventory ", "achievement give stat.j",
      "summon ", "summon P", "summon Pig ", "summon Pig 1 2 3 ", "summon minecraft:p",
      "setblock ", "setblock 1 ", "setblock 1 2 3 ", "setblock 1 2 3 minecraft:sto", "setblock 1 2 3 sto", "setblock 1 2 3 stone ", "setblock 1 2 3 stone 0 ", "setblock 1 2 3 stone 0 r", "setblock 1 2 3 stone 0 replace ",
      "testforblock ", "testforblock 1 2 3 minecraft:sto", "testforblock 1 2 3 stone ", "testforblock 1 2 3 stone 0 ",
      "tellraw ", "tellraw A", "tellraw Alex ", "publish ", "w A", "msg A", "? ", "? t",
    };
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
    // Block.getUnlocalizedName (aji.a()) and getLocalizedName (aji.F(): StatCollector over the jar's en_US) of every block-registry key (Block.getBlockFromName, aji.b),
    // the names CommandTestForBlock puts in commands.testforblock.failed.tile.
    StringBuilder blocks = new StringBuilder("[");
    for (Object key : handler.b(alex, "setblock 1 2 3 ")) {
      aji b = aji.b((String) key);
      blocks.append(blocks.length() > 1 ? "," : "").append("[" + q((String) key) + "," + q(b.a()) + "," + q(b.F()) + "]");
    }
    blocks.append("]");

    String[][] time = { {}, { "set" }, { "set", "100" }, { "set", "day" }, { "set", "night" }, { "set", "Day" }, { "set", "-1" }, { "set", "abc" }, { "set", "2147483648" }, { "add", "50" }, { "add", "-5" }, { "add", "x" },
      { "query" }, { "query", "daytime" }, { "query", "gametime" }, { "foo", "1" }, { "set", "1", "2" }, { "SET", "5" }, { "set", "1.5" } };
    String[][] gamemode = { {}, { "s" }, { "c" }, { "a" }, { "survival" }, { "0" }, { "2" }, { "3" }, { "-1" }, { "x" }, { "sp" }, { "S" }, { "Creative" }, { "creative", "Alex" }, { "creative", "Nobody" }, { "1", "Alex", "x" } };
    String[][] difficulty = { {}, { "p" }, { "e" }, { "n" }, { "h" }, { "peaceful" }, { "0" }, { "3" }, { "4" }, { "-1" }, { "x" }, { "Hard" }, { "E" }, { "easy", "extra" } };
    String[][] defaultgamemode = { {}, { "s" }, { "1" }, { "5" }, { "x" }, { "Adventure" }, { "a", "b" } };
    String[][] kill = { {}, { "Alex" } };
    String[][] toggledownfall = { { "x" } };
    String[][] weather = { {}, { "clear", "100" }, { "rain", "50" }, { "thunder", "20" }, { "rain", "0" }, { "rain", "1000001" }, { "rain", "1000000" }, { "rain", "x" }, { "snow" }, { "CLEAR", "5" }, { "a", "b", "c" }, { "snow", "5" } };
    String[][] xp = { {}, { "10" }, { "10L" }, { "10l" }, { "-5L" }, { "-5" }, { "L" }, { "x" }, { "xL" }, { "10", "Alex" }, { "10", "Nobody" }, { "2147483648" }, { "5", "Alex", "extra" }, { "0" }, { "0L" }, { "+3" } };
    String[][] tp = { {}, { "Alex" }, { "Nobody" }, { "1", "2", "3" }, { "~", "~1", "~" }, { "Alex", "1", "2", "3" }, { "1", "2" }, { "1", "2", "3", "4", "5" }, { "x", "y", "z" }, { "Alex", "Steve" },
      { "1.5", "64", "-3" }, { "0", "-5", "0" }, { "30000001", "64", "0" }, { "~30000000", "64", "0" }, { "Alex", "Alex" }, { "Nobody", "1", "2", "3" } };
    String[][] give = { {}, { "Alex" }, { "Alex", "nosuch" }, { "Alex", "minecraft:nosuch" }, { "Alex", "stone", "0" }, { "Alex", "stone", "65" }, { "Alex", "stone", "x" }, { "Alex", "stone", "1", "x" },
      { "Alex", "stone", "1", "0", "{bad" }, { "Alex", "stone", "1", "0", "[1]" }, { "Nobody", "stone" }, { "Alex", "0" }, { "Alex", "99999" } };
    String[][] effect = { {}, { "Alex" }, { "Alex", "99" }, { "Alex", "x" }, { "Alex", "speed" }, { "Alex", "-1" }, { "Alex", "1", "1000001" }, { "Alex", "1", "-1" }, { "Alex", "1", "10", "256" }, { "Alex", "1", "10", "-1" },
      { "Alex", "5", "0" }, { "Alex", "clear" }, { "Nobody", "1" }, { "Alex", "1", "x" }, { "Alex", "CLEAR" } };
    String[][] enchant = { {}, { "Alex" }, { "Alex", "16" }, { "Alex", "999" }, { "Alex", "257" }, { "Alex", "x" }, { "Alex", "16", "9" }, { "Alex", "16", "0" }, { "Nobody", "16" }, { "Alex", "3" } };
    String[][] me = { {} };
    String[][] seed = { {}, { "x" } };
    String[][] help = { { "x", "y" }, { "nosuch" }, { "time" }, { "?" }, { "w" }, { "msg" }, { "publish" }, { "0" }, { "-1" }, { "6" }, { "99" }, { "1.5" }, { "2147483648" } };
    String[][] debug = { {}, { "foo" }, { "stop" }, { "start", "x" }, { "Start" } };
    String[][] spawnpoint = { { "Alex", "1", "2" }, { "Alex", "~", "2", "3" }, { "Alex", "1.5", "2", "3" }, { "Alex", "1", "300", "3" }, { "Alex", "1", "-1", "3" }, { "Alex", "30000001", "2", "3" }, { "Nobody" }, { "Alex", "1", "2", "3", "4" } };
    String[][] setworldspawn = { { "1", "2" }, { "~", "2", "3" }, { "1", "300", "3" }, { "1", "2", "3", "4" }, { "1.5", "2", "3" }, { "x", "2", "3" } };
    String[][] gamerule = { {}, { "keepInventory" }, { "nosuch" }, { "keepInventory", "true" }, { "custom", "x" }, { "a", "b", "c" }, { "doDaylightCycle" }, { "KeepInventory" } };
    String[][] clear = { {}, { "Alex" }, { "Alex", "stone" }, { "Alex", "nosuch" }, { "Alex", "stone", "1" }, { "Alex", "stone", "x" }, { "Nobody" }, { "Alex", "stone", "1", "x" } };
    String[][] testfor = { {}, { "a", "b" }, { "Alex" } };
    String[][] spreadplayers = { {}, { "0", "0", "1", "10", "false" }, { "0", "0", "x", "10", "false", "Alex" }, { "0", "0", "1", "10", "maybe", "Alex" }, { "0", "0", "-1", "10", "false", "Alex" },
      { "0", "0", "5", "1", "false", "Alex" }, { "0", "0", "1", "0.5", "false", "Alex" }, { "x", "0", "1", "10", "false", "Alex" }, { "0", "0", "1", "10", "false", "Nobody" }, { "30000001", "0", "1", "10", "false", "Alex" } };
    String[][] playsound = { {}, { "random.click" }, { "random.click", "Nobody" }, { "random.click", "Alex", "~", "~", "~", "-1" }, { "random.click", "Alex", "~", "~", "~", "1", "3" },
      { "random.click", "Alex", "~", "~", "~", "1", "1", "2" }, { "random.click", "Alex", "x" }, { "random.click", "Alex", "100", "64", "0" } };
    String[][] scoreboard = { {}, { "foo" }, { "objectives" }, { "players" }, { "teams" }, { "objectives", "foo" }, { "players", "foo" }, { "teams", "foo" } };
    String[][] achievement = { {}, { "give" }, { "give", "nosuch" }, { "take", "achievement.openInventory" }, { "foo", "x" }, { "give", "stat.nosuch" }, { "give", "achievement.openInventory", "Nobody" } };
    String[][] summon = { {}, { "Nosuch" }, { "Pig", "x", "0", "0" }, { "Pig", "0", "300", "0" }, { "Pig", "0", "-1", "0" } };
    String[][] setblock = { {}, { "0", "64", "0" }, { "0", "64", "0", "nosuch" }, { "0", "64", "0", "stone", "16" }, { "0", "64", "0", "stone", "-1" }, { "0", "-1", "0", "stone" }, { "0", "256", "0", "stone" },
      { "x", "64", "0", "stone" }, { "0", "64", "0", "stone", "x" }, { "0", "64", "0", "chest", "0", "replace", "{bad" }, { "30000001", "64", "0", "stone" }, { "0", "64", "0", "999" } };
    String[][] testforblock = { {}, { "0", "64", "0" }, { "0", "64", "0", "nosuch" }, { "0", "64", "0", "stone", "16" }, { "0", "64", "0", "stone", "-2" }, { "0", "-1", "0", "stone" }, { "x", "64", "0", "stone" }, { "0", "64", "0", "chest", "0", "{bad" }, { "0", "64", "0", "1" }, { "0", "64", "0", "minecraft:stone" }, { "0", "64", "0", "dirt", "-1" }, { "0", "64", "0", "planks" }, { "0", "64", "0", "999" }, { "0", "64", "0", "-5" }, { "0", "64", "0", "air" } };
    String[][] tellraw = { {}, { "Alex" }, { "Nobody", "\"hi\"" }, { "Alex", "{bad" }, { "Alex", "[" } };
    String[][] publish = { };
    Object[][] table = { { "time", time }, { "gamemode", gamemode }, { "difficulty", difficulty }, { "defaultgamemode", defaultgamemode }, { "kill", kill }, { "toggledownfall", toggledownfall },
      { "weather", weather }, { "xp", xp }, { "tp", tp }, { "give", give }, { "effect", effect }, { "enchant", enchant }, { "me", me }, { "seed", seed }, { "help", help }, { "debug", debug },
      { "spawnpoint", spawnpoint }, { "setworldspawn", setworldspawn }, { "gamerule", gamerule }, { "clear", clear }, { "testfor", testfor }, { "spreadplayers", spreadplayers },
      { "playsound", playsound }, { "scoreboard", scoreboard }, { "achievement", achievement }, { "summon", summon }, { "setblock", setblock }, { "testforblock", testforblock },
      { "tellraw", tellraw }, { "publish", publish } };
    StringBuilder run = new StringBuilder("[");
    for (Object[] row : table) {
      String name = (String) row[0];
      aa cmd = byName.get(name);
      for (String[] a : (String[][]) row[1]) {
        alex.direct.clear(); ((CmdChatProbe.NH) alex.a).got.clear(); admin.clear();
        String thrown = "null", crash = "null";
        try { cmd.b(alex, a.clone()); }
        catch (cd x) { thrown = "[" + q(x.getClass().getName()) + "," + q(x.getMessage()) + "," + args(x.a()) + "]"; }
        catch (Throwable t) { crash = q(String.valueOf(t)); }
        List<String> got = new ArrayList<>(((CmdChatProbe.NH) alex.a).got); got.addAll(alex.direct);
        StringBuilder al = new StringBuilder("[");
        for (String s : a) al.append(al.length() > 1 ? "," : "").append(q(s));
        al.append("]");
        run.append(run.length() > 1 ? "," : "").append("[" + q(name) + "," + al + ",{\"thrown\":" + thrown + ",\"crash\":" + crash + ",\"admin\":[" + String.join(",", admin) + "],\"sender\":[" + String.join(",", got) + "]}]");
      }
    }
    run.append("]");
    System.out.println("{\"tab\":" + tab + ",\"blocks\":" + blocks + ",\"run\":" + run + "}");
  }
}
