import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 84 dedicated84: the dedicated-server-only commands (op, deop, stop, save-all, save-off, save-on, ban-ip, pardon-ip, ban, banlist, pardon, kick, list,
// whitelist, setidletimeout, netstat) executed on the unchanged 1.7.10 classes. The double:
//  - the real ServerCommandManager (bl), built with isDedicatedServer (X) true so it registers the dedicated rows, and the real CommandHandler.executeCommand (z.a(ac, String)):
//    permission check, usage / failure texts and the chat.type.admin notification to the other ops (bl.a(ac, aa, int, String, Object...));
//  - a real ServerConfigurationManager (oi) with its four real UserLists (op bans, nx IP bans, oj ops, or whitelist; written to ./*.json in the working directory) and a
//    real PlayerProfileCache (ns) over a GameProfileRepository double that knows Alex, Steve, Eve and Herobrine (online-mode) or an offline-mode server;
//  - three real EntityPlayerMP doubles (Alex 10.0.0.1, Steve 10.0.0.2, Eve 10.0.0.2) whose canCommandSenderUseCommand (mw.a(int, String)) is the real one
//    (op list lookup, op level) and whose NetHandlerPlayServer records kickPlayerFromServer (nh.c) and answers the address (ej.b);
//  - a MinecraftServer double (X true, op-permission-level l(), online mode Y, real func_143006_e-less d(int) idle timeout, r() stop recorded, a(fj) console chat recorded)
//    and three WorldServer doubles that record saveAllChunks (mt.a(boolean, qk)) and flush (mt.m()), with the real levelSaving flag (mt.c).
// A record: [command line, setup, sender, {crash, count, chat: {name: [components]}, console: [components], state}], state = the four lists as the files serialise them
// (created dates masked), the whitelist flag, the idle timeout, the running flag, the levelSaving flags, the save calls, the kicks and the profile cache names.
public class Dedicated84Probe {
  static sun.misc.Unsafe u;
  static String q(String s) { return CmdChatProbe.q(s); }
  static Field fd(Class<?> c, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; }

  static UUID id(int n) { return new UUID(0, n); }
  static Map<String, GP> known = new LinkedHashMap<>();
  static class GP { UUID id; String name; GP(int n, String name) { id = id(n); this.name = name; } }

  public static class Repo implements com.mojang.authlib.GameProfileRepository {
    public void findProfilesByNames(String[] names, com.mojang.authlib.Agent agent, com.mojang.authlib.ProfileLookupCallback cb) {
      for (String n : names) {
        GP g = known.get(n.toLowerCase());
        if (g != null) cb.onProfileLookupSucceeded(new com.mojang.authlib.GameProfile(g.id, g.name));
        else cb.onProfileLookupFailed(new com.mojang.authlib.GameProfile(null, n), new Exception("unknown"));
      }
    }
  }

  static List<String> console = new ArrayList<>();
  static int stops = 0, savedPlayers = 0;
  static boolean online = true;
  static int opLevel = 4;
  static Repo repo = new Repo();
  static ns cache;
  public static class DSrv extends CmdChatProbe.Srv {
    public boolean X() { return true; }
    public int l() { return opLevel; }
    public boolean Y() { return online; }
    public com.mojang.authlib.GameProfileRepository aw() { return repo; }
    public ns ax() { return cache; }
    public void a(fj c) { console.add(CmdChatProbe.comp(c)); }
    public void r() { stops++; super.r(); }
  }
  static Set<String> dat = new LinkedHashSet<>(); // the world's playerdata/*.dat names (ISaveHandler.getPlayerNBTManager().func_75754_f)
  public static class DMgr extends CmdChatProbe.Mgr { public void j() { savedPlayers++; for (Object p : e) dat.add(((mw) p).bJ().getId().toString()); } } // saveAllPlayerData writes every online player's file
  static List<String> saves = new ArrayList<>();
  public static class WS extends mt {
    WS() { super(null, null, null, 0, null, null); }
    int n;
    public void a(boolean b, qk p) { saves.add("save" + n + ":" + b + ":" + (p != null)); }
    public void m() { saves.add("flush" + n); }
    public azc M() {
      azp files = (azp) java.lang.reflect.Proxy.newProxyInstance(azp.class.getClassLoader(), new Class<?>[] { azp.class }, (pr, m, a) -> dat.toArray(new String[0]));
      return (azc) java.lang.reflect.Proxy.newProxyInstance(azc.class.getClassLoader(), new Class<?>[] { azc.class }, (pr, m, a) -> m.getName().equals("e") ? files : null);
    }
  }
  static List<String> kicks = new ArrayList<>();
  public static class NH extends CmdChatProbe.NH {
    String who;
    public void c(String reason) { kicks.add(who + ":" + reason); }
  }
  public static class NM extends ej {
    String ip;
    NM() { super(false); }
    public java.net.SocketAddress b() { try { return new java.net.InetSocketAddress(java.net.InetAddress.getByAddress(new byte[] { 10, 0, 0, (byte) Integer.parseInt(ip) }), 25565); } catch (Exception e) { throw new RuntimeException(e); } }
  }
  public static class DP extends PlayerDamageProbe.Player {
    List<String> direct = new ArrayList<>();
    public void a(fj c) { direct.add(CmdChatProbe.comp(c)); }
  }

  static DSrv server;
  static oi mgr;
  static bl handler;
  static WS[] worlds;
  static Map<String, DP> players = new LinkedHashMap<>();

  static DP mkPlayer(String name, int n, String lastOctet) throws Exception {
    DP p = (DP) u.allocateInstance(DP.class);
    MobMoveProbe.set(p, "o", PlayerDamageProbe.w);
    MobMoveProbe.set(p, "Z", new Random(0));
    u.putObject(p, u.objectFieldOffset(fd(yz.class, "i")), new com.mojang.authlib.GameProfile(id(n), name));
    u.putObject(p, u.objectFieldOffset(mw.class.getDeclaredField("b")), server);
    for (Field f : sa.class.getDeclaredFields()) if (f.getType() == UUID.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(p, id(n)); } // Entity.entityUniqueID = the profile's id (EntityPlayer constructor)
    p.direct = new ArrayList<>();
    NH hn = (NH) u.allocateInstance(NH.class); hn.who = name; ((CmdChatProbe.NH) hn).got = new ArrayList<>();
    NM nm = (NM) u.allocateInstance(NM.class); nm.ip = lastOctet;
    u.putObject(hn, u.objectFieldOffset(Class.forName("nh").getDeclaredField("a")), nm);
    p.a = hn;
    return p;
  }

  static final String[] SETUPS = { "base", "lists", "offline", "saveoff", "partial", "levels" };

  static void fresh(String setup, String sender) throws Exception {
    console.clear(); saves.clear(); kicks.clear(); stops = 0; savedPlayers = 0;
    online = !setup.equals("offline");
    opLevel = 4;
    File dir = new File(".");
    cache = new ns(server, new File(dir, "usercache-" + System.nanoTime() + ".json"));
    mgr = new DMgr();
    ((om) fieldOf(mgr, "j")).a(true); ((om) fieldOf(mgr, "k")).a(true); // DedicatedPlayerList's constructor (not in the client jar, recalled) turns the ban lists' func_152686_a on; oi's own constructor leaves them off
    fd(oi.class, "f").setInt(mgr, 20); // DedicatedPlayerList: max-players (default 20)
    u.putObject(mgr, u.objectFieldOffset(fd(oi.class, "i")), server);
    u.putObject(server, u.objectFieldOffset(fd(net.minecraft.server.MinecraftServer.class, "u")), mgr);
    fd(net.minecraft.server.MinecraftServer.class, "v").setBoolean(server, true);
    fd(net.minecraft.server.MinecraftServer.class, "F").setInt(server, 0);
    players.clear();
    DP alex = mkPlayer("Alex", 1, "1"), steve = mkPlayer("Steve", 2, "2"), eve = mkPlayer("Eve", 3, "2");
    players.put("Alex", alex); players.put("Steve", steve); players.put("Eve", eve);
    boolean levels = setup.equals("levels"); // b85 dedtab85: more watchers, to see which ops the chat.type.admin notice reaches by permission level
    if (levels) { players.put("Ivy", mkPlayer("Ivy", 5, "5")); players.put("Kay", mkPlayer("Kay", 6, "6")); players.put("Lou", mkPlayer("Lou", 7, "7")); }
    for (DP p : players.values()) { mgr.e.add(p); cache.a(p.bJ()); }
    mgr.a(alex.bJ()); // op, level l()
    mgr.d(alex.bJ()); mgr.c(alex.bJ()); // whitelist add + remove: leaves the whitelist file written, empty
    if (sender.equals("eve") || levels) { oj ops = (oj) fieldOf(mgr, "l"); ops.a(new ok(eve.bJ(), 2)); }
    if (levels) { oj ops = (oj) fieldOf(mgr, "l"); ops.a(new ok(players.get("Ivy").bJ(), 1)); ops.a(new ok(players.get("Kay").bJ(), 3)); ops.a(new ok(players.get("Lou").bJ(), 4)); }
    if (setup.equals("lists") || levels) {
      op bans = (op) fieldOf(mgr, "j"); nx ips = (nx) fieldOf(mgr, "k"); or wl = (or) fieldOf(mgr, "m"); oj ops = (oj) fieldOf(mgr, "l");
      bans.a(new oq(steve.bJ(), null, "Console", null, "griefing"));
      bans.a(new oq(new com.mojang.authlib.GameProfile(id(9), "Notch"), null, "Alex", null, null));
      ips.a(new ny("10.0.0.9", null, "Console", null, "spam"));
      ips.a(new ny("192.168.1.20", null, "Alex", null, null));
      wl.a(new os(steve.bJ())); wl.a(new os(new com.mojang.authlib.GameProfile(id(4), "Herobrine")));
      ops.a(new ok(new com.mojang.authlib.GameProfile(id(9), "Notch"), 3));
      cache.a(new com.mojang.authlib.GameProfile(id(9), "Notch"));
    }
    dat.clear(); if (setup.equals("lists") || levels) { dat.add(id(2).toString()); dat.add(id(9).toString()); }
    for (int i = 0; i < worlds.length; i++) worlds[i].c = setup.equals("saveoff") || (setup.equals("partial") && i == 0); // mt.c is levelSaving = saving DISABLED (save-off sets it, save-on clears it)
    for (DP p : players.values()) { p.direct.clear(); ((CmdChatProbe.NH) p.a).got.clear(); }
  }
  static Object fieldOf(Object o, String n) throws Exception { return fd(oi.class, n).get(o); }

  static String mask(String json) { return json.replaceAll("\"created\": \"[^\"]*\"", "\"created\": \"<date>\"").replaceAll("\\n\\s*", ""); }
  static String list(om l) throws Exception {
    Method e = om.class.getDeclaredMethod("e"); e.setAccessible(true);
    Map<?, ?> m = (Map<?, ?>) e.invoke(l);
    com.google.gson.Gson g = (com.google.gson.Gson) fd(om.class, "b").get(l);
    return mask(g.toJson(m.values()));
  }
  static String state() throws Exception {
    StringBuilder b = new StringBuilder("{");
    b.append("\"ops\":").append(list((om) fieldOf(mgr, "l"))).append(",\"banned\":").append(list((om) fieldOf(mgr, "j"))).append(",\"ips\":").append(list((om) fieldOf(mgr, "k"))).append(",\"whitelist\":").append(list((om) fieldOf(mgr, "m")));
    b.append(",\"whitelistOn\":").append(fd(oi.class, "p").getBoolean(mgr));
    b.append(",\"idle\":").append(fd(net.minecraft.server.MinecraftServer.class, "F").getInt(server));
    b.append(",\"running\":").append(fd(net.minecraft.server.MinecraftServer.class, "v").getBoolean(server)).append(",\"stops\":").append(stops);
    b.append(",\"saving\":["); for (int i = 0; i < worlds.length; i++) b.append(i > 0 ? "," : "").append(!worlds[i].c); b.append("]"); // reported as saving enabled
    b.append(",\"saves\":["); for (int i = 0; i < saves.size(); i++) b.append(i > 0 ? "," : "").append(q(saves.get(i))); b.append("],\"savedPlayers\":").append(savedPlayers);
    b.append(",\"kicks\":["); for (int i = 0; i < kicks.size(); i++) b.append(i > 0 ? "," : "").append(q(kicks.get(i))); b.append("]");
    b.append(",\"dat\":").append(dat.size());
    b.append(",\"profiles\":["); String[] names = cache.a(); for (int i = 0; i < names.length; i++) b.append(i > 0 ? "," : "").append(q(names[i])); b.append("]");
    return b.append("}").toString();
  }
  static String chatOf(List<String> l) { return "[" + String.join(",", l) + "]"; }

  static String run(String line, String setup, String sender) throws Exception {
    fresh(setup, sender);
    ac who = sender.equals("console") ? server : players.get(sender.equals("eve") ? "Eve" : sender.equals("steve") ? "Steve" : sender.equals("ivy") ? "Ivy" : sender.equals("kay") ? "Kay" : sender.equals("lou") ? "Lou" : "Alex");
    String crash = "null"; int count = -1;
    if (System.getProperty("probe.debug") != null && line.equals(System.getProperty("probe.debug"))) {
      String[] w = line.split(" ");
      try { ((aa) ((Map<?, ?>) handler.a()).get(w[0])).b(who, Arrays.copyOfRange(w, 1, w.length)); } catch (Throwable t) { t.printStackTrace(); }
      fresh(setup, sender);
    }
    try { count = handler.a(who, line); } catch (Throwable t) { crash = q(String.valueOf(t)); }
    StringBuilder chat = new StringBuilder("{");
    for (Map.Entry<String, DP> e : players.entrySet()) chat.append(chat.length() > 1 ? "," : "").append(q(e.getKey())).append(":").append(chatOf(e.getValue().direct));
    chat.append("}");
    return "[" + q(line) + "," + q(setup) + "," + q(sender) + ",{\"crash\":" + crash + ",\"count\":" + count + ",\"chat\":" + chat + ",\"console\":" + chatOf(console) + ",\"state\":" + state() + "}]";
  }

  static String tab(String text, String setup, String sender) throws Exception {
    fresh(setup, sender);
    ac who = sender.equals("console") ? server : players.get("Alex");
    String res;
    try { List<?> r = handler.b(who, text); if (r == null) res = "null"; else { StringBuilder b = new StringBuilder("["); for (Object o : r) b.append(b.length() > 1 ? "," : "").append(q(String.valueOf(o))); res = b.append("]").toString(); } }
    catch (Throwable t) { res = q("!" + t); }
    return "[" + q(text) + "," + q(setup) + "," + res + "]";
  }

  public static void main(String[] argv) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u; CmdChatProbe.u = u;
    known.put("alex", new GP(1, "Alex")); known.put("steve", new GP(2, "Steve")); known.put("eve", new GP(3, "Eve")); known.put("herobrine", new GP(4, "Herobrine"));
    server = (DSrv) u.allocateInstance(DSrv.class);
    u.putObject(u.staticFieldBase(fd(net.minecraft.server.MinecraftServer.class, "j")), u.staticFieldOffset(fd(net.minecraft.server.MinecraftServer.class, "j")), server);
    u.putObject(server, u.objectFieldOffset(net.minecraft.server.MinecraftServer.class.getDeclaredField("b")), new qi());
    worlds = new WS[3];
    for (int i = 0; i < 3; i++) {
      WS ws = (WS) u.allocateInstance(WS.class); ws.n = i;
      for (Class<?> c = ahb.class; c != Object.class; c = c.getSuperclass()) for (Field f : c.getDeclaredFields()) { if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue; f.setAccessible(true); f.set(ws, f.get(PlayerDamageProbe.w)); }
      worlds[i] = ws;
    }
    server.c = worlds;
    mgr = new DMgr();
    u.putObject(mgr, u.objectFieldOffset(fd(oi.class, "i")), server);
    u.putObject(server, u.objectFieldOffset(fd(net.minecraft.server.MinecraftServer.class, "u")), mgr);
    handler = new bl();
    u.putObject(server, u.objectFieldOffset(fd(net.minecraft.server.MinecraftServer.class, "o")), handler);

    String[] forms = {
      "op", "op Steve", "op steve", "op Herobrine", "op Nobody", "op Alex", "op Steve x", "op Eve",
      "deop", "deop Alex", "deop alex", "deop Nobody", "deop Alex Eve", "deop Notch", "deop Eve",
      "ban", "ban Steve", "ban Steve griefing", "ban Steve a  b c", "ban steve", "ban Herobrine", "ban Nobody", "ban Alex", "ban Notch", "ban Herobrine @p", "ban Herobrine hi @a", "ban Herobrine ~",
      "ban-ip", "ban-ip 1.2.3.4", "ban-ip 1.2.3.4 spam", "ban-ip 10.0.0.2", "ban-ip 10.0.0.1", "ban-ip Steve", "ban-ip steve spam it", "ban-ip Nobody", "ban-ip 256.1.1.1", "ban-ip 1.2.3", "ban-ip x", "ban-ip 999.999.999.999", "ban-ip 01.002.3.4", "ban-ip 10.0.0.9", "ban-ip 1.2.3.4 @p",
      "pardon", "pardon Steve", "pardon steve", "pardon Nobody", "pardon Steve x", "pardon Notch",
      "pardon-ip", "pardon-ip 10.0.0.9", "pardon-ip 1.2.3.4", "pardon-ip x", "pardon-ip Steve", "pardon-ip 10.0.0.9 x", "pardon-ip 256.1.1.1",
      "banlist", "banlist ips", "banlist IPS", "banlist players", "banlist x", "banlist ips x", "banlist Ips",
      "whitelist", "whitelist on", "whitelist off", "whitelist ON", "whitelist list", "whitelist add", "whitelist add Steve", "whitelist add steve", "whitelist add Nobody", "whitelist add Herobrine", "whitelist add Eve x",
      "whitelist remove", "whitelist remove Steve", "whitelist remove steve", "whitelist remove Nobody", "whitelist remove Herobrine x", "whitelist reload", "whitelist foo", "whitelist on x", "whitelist list x",
      "kick", "kick S", "kick St", "kick Steve", "kick Steve bad behaviour", "kick steve", "kick Nobody", "kick Alex", "kick Steve  two  spaces", "kick Steve @p", "kick Steve @a x",
      "list", "list uuids", "list UUIDS", "list x", "list uuids x",
      "save-all", "save-all flush", "save-all x", "save-all flush x", "save-all FLUSH",
      "save-on", "save-on x", "save-off", "save-off x",
      "stop", "stop x",
      "setidletimeout", "setidletimeout 5", "setidletimeout 0", "setidletimeout -1", "setidletimeout x", "setidletimeout 5 6", "setidletimeout 2147483647", "setidletimeout 2147483648", "setidletimeout 1.5", "setidletimeout +7", "setidletimeout 007",
      "netstat", "netstat x",
      "/op Steve", " op Steve", "OP Steve", "Op Steve"
    };
    List<String> rows = new ArrayList<>();
    for (String f : forms) {
      rows.add(run(f, "base", "alex")); rows.add(run(f, "lists", "alex"));
      rows.add(run(f, "lists", "steve")); rows.add(run(f, "lists", "eve")); rows.add(run(f, "lists", "console"));
    }
    for (String f : new String[] { "op Herobrine", "op Nobody", "ban Herobrine", "ban Nobody", "whitelist add Nobody", "whitelist add Herobrine", "ban-ip Nobody" }) rows.add(run(f, "offline", "alex"));
    for (String f : new String[] { "save-on", "save-off", "save-all", "save-all flush" }) { rows.add(run(f, "saveoff", "alex")); rows.add(run(f, "partial", "alex")); }
    for (String f : forms) for (String sd : new String[] { "alex", "kay", "eve", "ivy", "lou", "steve" }) rows.add(run(f, "levels", sd));
    // b86 console86: the console sender (the DedicatedServer itself: b_() "Server", a(int, String) true, a(fj) logs the unformatted text) in the base, levels and
    // offline setups, every form in offline mode for a player, and the netstat sub-commands (only the console gets past CommandNetstat's player check).
    for (String f : forms) { rows.add(run(f, "base", "console")); rows.add(run(f, "levels", "console")); }
    List<String> offline7 = Arrays.asList("op Herobrine", "op Nobody", "ban Herobrine", "ban Nobody", "whitelist add Nobody", "whitelist add Herobrine", "ban-ip Nobody");
    String[] offlineMore = { "op nobody", "op NoBody", "ban nobody why", "whitelist add nobody", "whitelist add NOBODY", "deop nobody", "pardon nobody", "whitelist remove nobody", "op Herobrine2" };
    for (String f : forms) { if (!offline7.contains(f)) rows.add(run(f, "offline", "alex")); rows.add(run(f, "offline", "console")); }
    for (String f : offlineMore) { rows.add(run(f, "offline", "alex")); rows.add(run(f, "offline", "console")); rows.add(run(f, "base", "console")); }
    String[] net = { "netstat read-count", "netstat write-count", "netstat read-count x", "netstat foo", "netstat ab", "netstat packet-read", "netstat packet-read 3", "netstat packet-read x", "netstat packet-read  ",
      "netstat packet-write", "netstat packet-write 5", "netstat packet-write -1", "netstat hottest-read", "netstat hottest-write", "netstat most-read", "netstat most-write", "netstat READ-COUNT", "NETSTAT" };
    for (String f : net) { rows.add(run(f, "lists", "console")); rows.add(run(f, "lists", "alex")); rows.add(run(f, "lists", "steve")); }
    List<String> tabs = new ArrayList<>();
    for (String t : new String[] { "op ", "op S", "op s", "deop ", "ban ", "ban S", "ban-ip ", "ban-ip S", "ban-ip 10", "pardon ", "pardon S", "pardon-ip ", "pardon-ip 1", "banlist ", "banlist i", "banlist ips ", "whitelist ", "whitelist a", "whitelist add ", "whitelist add S", "whitelist remove ", "whitelist remove S", "whitelist x ", "kick ", "kick S", "kick Steve ", "list ", "list u", "save-all ", "setidletimeout ", "netstat ", "stop " })
      for (String s : new String[] { "base", "lists" }) tabs.add(tab(t, s, "alex"));
    System.out.println("{\"run\":[" + String.join(",", rows) + "],\"tab\":[" + String.join(",", tabs) + "]}");
  }
}
