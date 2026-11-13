import java.lang.reflect.Field;
import java.util.*;

// Batch 56: the unchanged 1.7.10 CommandMessage (az, /tell /msg /w), CommandBroadcast (ah, /say), CommandEmote (an, /me), CommandBase (y) and PlayerSelector (ad)
// run on a server double: an allocated MinecraftServer subclass whose static instance and ServerConfigurationManager (oi) hold three real EntityPlayerMP doubles
// (PlayerDamageProbe's allocation: Alex, Steve and Bob in one world with a real Scoreboard, bac), a recording NetHandlerPlayServer (nh) per player, and stub console
// and command-block senders. Each record is one command line with a sender: the thrown CommandException (class, key, args), then every player's and the sender's
// received components (fk.a JSON, getFormattedText, getUnformattedText) in order. The language table is the client jar's en_US.lang (loaded from the jar).
// Also recorded: each command's name, aliases, usage key, permission level and isUsernameIndex for argument indexes 0..3.
public class CmdChatProbe {
  static sun.misc.Unsafe u;
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 0x20 || c > 0x7e) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String comp(fj c) { return "[" + q(fk.a(c)) + "," + q(c.d()) + "," + q(c.c()) + "]"; }

  public static class Srv extends SuffocationProbe.Fake { }
  public static abstract class Mgr extends oi { Mgr() { super(null); } }
  public static class MgrImpl extends Mgr { }
  public static class NH extends nh {
    List<String> got = new ArrayList<>();
    NH() { super(null, null, null); }
    public void a(ft packet) {
      try {
        if (packet instanceof gj) { Field f = gj.class.getDeclaredField("a"); f.setAccessible(true); got.add(comp((fj) f.get(packet))); }
        else got.add("[\"packet\"]");
      } catch (Exception e) { throw new RuntimeException(e); }
    }
  }
  public static class CP extends PlayerDamageProbe.Player {
    List<String> direct = new ArrayList<>();
    public void a(fj c) { direct.add(comp(c)); }
    public boolean a(int level, String name) { return true; }
  }
  public static class Sender implements ac {
    final String name; List<String> got = new ArrayList<>();
    Sender(String name) { this.name = name; }
    public String b_() { return name; }
    public fj c_() { return new fq(name); }
    public void a(fj c) { got.add(comp(c)); }
    public boolean a(int level, String n) { return true; }
    public r f_() { return new r(0, 0, 0); }
    public ahb d() { return PlayerDamageProbe.w; }
  }

  static CP player(String name, double x, double y, double z) throws Exception {
    CP p = (CP) u.allocateInstance(CP.class);
    MobMoveProbe.set(p, "o", PlayerDamageProbe.w); MobMoveProbe.set(p, "Z", new Random(0)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); MobMoveProbe.set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    PlayerDamageProbe.fd(sv.class, "f").set(p, new HashMap());
    MobMoveProbe.set(p, "bE", new yw()); MobMoveProbe.set(p, "bm", new yx(p)); MobMoveProbe.set(p, "bp", new zr());
    PlayerDamageProbe.fd(sv.class, "e").set(p, new rn(p));
    PlayerDamageProbe.fd(sa.class, "M").setFloat(p, 0.6f); PlayerDamageProbe.fd(sa.class, "N").setFloat(p, 1.8f);
    u.putObject(p, u.objectFieldOffset(PlayerDamageProbe.fd(yz.class, "i")), new com.mojang.authlib.GameProfile(new UUID(0, name.hashCode()), name));
    p.direct = new ArrayList<>();
    p.a = (NH) u.allocateInstance(NH.class);
    ((NH) p.a).got = new ArrayList<>();
    PlayerDamageProbe.pos(p, x, y, z);
    return p;
  }

  static List<CP> players = new ArrayList<>(), everyone = new ArrayList<>();
  static List<Object> managerList;
  static z handler = new z();
  // The real CommandHandler (z.a(ac, String)): permission check, the username-index selector expansion (ad.c, one run per matched player, none for no match),
  // and the red error components it sends for each CommandException.
  static String run(aa cmd, Sender sender, ac who, String[] args, String name) {
    for (CP p : players) { p.direct.clear(); ((NH) p.a).got.clear(); }
    sender.got.clear();
    String line = "/" + name + (args.length == 0 ? "" : " " + String.join(" ", args));
    int count = handler.a(who, line);
    String thrown = String.valueOf(count);
    StringBuilder out = new StringBuilder("{\"count\":" + thrown + ",\"out\":{");
    boolean first = true;
    for (CP p : players) {
      List<String> all = new ArrayList<>(((NH) p.a).got); all.addAll(p.direct);
      out.append(first ? "" : ",").append(q(p.b_())).append(":[").append(String.join(",", all)).append("]"); first = false;
    }
    out.append(",\"sender\":[").append(String.join(",", sender.got)).append("]}}");
    return out.toString();
  }

  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    CP alex = player("Alex", 0.5, 64, 0.5), steve = player("Steve", 10.5, 64, 0.5), bob = player("Bob", 200.5, 64, 0.5);
    everyone.addAll(Arrays.asList(alex, steve, bob));
    for (CP p : everyone) { PlayerDamageProbe.fd(sa.class, "o").set(p, PlayerDamageProbe.w); }
    // Teams: Alex and Steve in "red" (prefix the colour), Bob in none. Bob is in creative (gamemode 1) so m= can pick him out.
    bac sb = PlayerDamageProbe.w.W();
    azx t = null;
    azy team = sb.f("red"); team.b("§c"); team.c("§r");
    sb.a("Alex", "red"); sb.a("Steve", "red");
    mx bobMgr = (mx) u.allocateInstance(mx.class); PlayerDamageProbe.fd(mx.class, "c").set(bobMgr, ahk.a(1)); PlayerDamageProbe.fd(mw.class, "c").set(bob, bobMgr);
    mx plain = (mx) u.allocateInstance(mx.class); PlayerDamageProbe.fd(mx.class, "c").set(plain, ahk.a(0));
    PlayerDamageProbe.fd(mw.class, "c").set(alex, plain); PlayerDamageProbe.fd(mw.class, "c").set(steve, plain);
    PlayerDamageProbe.fd(yz.class, "bF").setInt(alex, 5); PlayerDamageProbe.fd(yz.class, "bF").setInt(steve, 20);
    // The server double.
    Srv server = (Srv) u.allocateInstance(Srv.class);
    oi mgr = (oi) u.allocateInstance(MgrImpl.class);
    Field e = oi.class.getDeclaredField("e"); e.setAccessible(true);
    managerList = new ArrayList<Object>();
    u.putObject(mgr, u.objectFieldOffset(e), managerList);
    Field mi = oi.class.getDeclaredField("i"); mi.setAccessible(true);
    u.putObject(mgr, u.objectFieldOffset(mi), server);
    Field uf = net.minecraft.server.MinecraftServer.class.getDeclaredField("u"); uf.setAccessible(true);
    u.putObject(server, u.objectFieldOffset(uf), mgr);
    Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
    u.putObject(u.staticFieldBase(jf), u.staticFieldOffset(jf), server);

    Sender console = new Sender("Server"), block = new Sender("@");
    Map<String, aa> cmds = new LinkedHashMap<>();
    cmds.put("tell", new az()); cmds.put("say", new ah()); cmds.put("me", new an());
    for (aa c : cmds.values()) handler.a(c);
    StringBuilder facts = new StringBuilder("[");
    for (Map.Entry<String, aa> c : cmds.entrySet()) {
      aa cmd = c.getValue();
      List<?> al = cmd.b();
      StringBuilder idx = new StringBuilder();
      for (int i = 0; i < 4; i++) idx.append(i > 0 ? "," : "").append(cmd.a(new String[] { "x" }, i));
      facts.append(facts.length() > 1 ? "," : "").append("[" + q(c.getKey()) + "," + q(cmd.c()) + "," + (al == null ? "null" : "[" + String.join(",", al.stream().map(x -> q((String) x)).toArray(String[]::new)) + "]") + "," + q(cmd.c(console)) + "," + ((y) cmd).a() + ",[" + idx + "]]");
    }
    facts.append("]");
    String[][] tellArgs = { {}, { "Bob" }, { "Bob", "" }, { "Bob", "hi" }, { "Bob", "hello", "there" }, { "Bob", "a", "", "b" }, { "Bob", "", "x" }, { "bob", "case" }, { "Alex", "me" }, { "Nobody", "hi" },
      { "@p", "hi" }, { "@a", "hi" }, { "@r", "hi" }, { "@e", "hi" }, { "@p[r=5]", "hi" }, { "@p[r=500]", "hi" }, { "@a[name=Bob]", "hi" }, { "@a[team=red]", "hi" }, { "@a[m=1]", "hi" }, { "@a[l=10]", "hi" }, { "@a[lm=10]", "hi" },
      { "@a[team=!red]", "hi" }, { "@a[c=1]", "hi" }, { "@a[x=0,y=64,z=0,r=3]", "hi" }, { "@a[bad]", "hi" }, { "@p[", "hi" }, { "@x", "hi" }, { "@p", "@p", "x" }, { "Bob", "@p hi" }, { "Bob", "@p", "@a" }, { "Bob", "@a[r=3]" } };
    String[][] sayArgs = { {}, { "" }, { "hi" }, { "hi", "there" }, { "", "x" }, { "hi", "", "there" }, { "@p" }, { "@a" }, { "@r" }, { "@e" }, { "@p[r=5]" }, { "@a[team=red]" }, { "@a[m=1]" }, { "@a[name=Nobody]" }, { "@p[bad" }, { "@a[bad]" }, { "@x" },
      { "Bob" }, { "hi @p" }, { "hi", "@a", "@p" }, { "@p@a" }, { "@a[c=1]" }, { "@a[l=5]" }, { "@a[x=0,y=64,z=0,r=3]" }, { "@a[score_x=1]" }, { "@p[name=Alex]", "and", "@p[name=Steve]" }, { "a  b" }, { "   " } };
    Object[][] senders = { { "Alex", alex, alex }, { "Server", console, console }, { "@", block, block }, { "Steve", steve, steve } };
    StringBuilder recs = new StringBuilder("[");
    for (String scenario : new String[] { "trio", "solo" }) {
      players.clear(); managerList.clear();
      players.addAll(scenario.equals("trio") ? everyone : Arrays.asList(alex));
      managerList.addAll(players);
      for (Map.Entry<String, aa> c : cmds.entrySet()) {
        String[][] set = c.getKey().equals("tell") ? tellArgs : sayArgs;
        for (Object[] s : senders) {
          if (scenario.equals("solo") && (s[1] == steve)) continue;
          if (scenario.equals("solo") && s[1] == console) continue;
          for (String[] a : set) {
            // @r draws an unseeded shuffle in a world of several players: those rows are not recorded.
            if (scenario.equals("trio") && Arrays.asList(a).contains("@r")) continue;
            Sender sink = s[1] instanceof Sender ? (Sender) s[1] : new Sender("unused");
            String res = run(c.getValue(), sink, (ac) s[2], a.clone(), c.getKey());
            recs.append(recs.length() > 1 ? "," : "").append("[" + q(scenario) + "," + q(c.getKey()) + "," + q((String) s[0]) + ",[" + String.join(",", Arrays.stream(a).map(CmdChatProbe::q).toArray(String[]::new)) + "]," + res + "]");
          }
        }
      }
    }
    recs.append("]");
    System.out.println("{\"facts\":" + facts + ",\"records\":" + recs + "}");
  }
}
