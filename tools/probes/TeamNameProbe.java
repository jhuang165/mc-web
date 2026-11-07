import java.lang.reflect.Field;
import java.util.*;

// Batch 21 combat3: scoreboard-team formatting of names in death messages, on the unchanged CombatTracker (rn) / DamageSource (ro) and the real
// EntityPlayerMP (the CombatTrackerProbe / PlayerDamageProbe doubles). The world's real Scoreboard (bac) holds teams (azy) with a name prefix
// and suffix (what `/scoreboard teams option <team> color <c>` sets natively: prefix "§c", suffix "§r") and members by NAME: the victim "Player",
// a second player "Alex", and "Bob", which is only the custom name of a zombie (so it shows whether a mob's name is ever team-formatted).
// One record per configuration x scenario: the death message after the last hit, as key, the argument texts as getUnformattedText (fj.c) and as
// getFormattedText (fj.d), and the whole message both ways.
public class TeamNameProbe {
  static sun.misc.Unsafe u;
  static String q(String s) { return "\"" + PlayerDamageProbe.esc(s) + "\""; }

  static String chat(fj c) {
    StringBuilder s = new StringBuilder("{");
    if (c instanceof fr) {
      fr t = (fr) c;
      s.append("\"key\":").append(q(t.i())).append(",\"args\":[");
      Object[] args = t.j();
      for (int i = 0; i < args.length; i++) s.append(i == 0 ? "" : ",").append(q(args[i] instanceof fj ? ((fj) args[i]).c() : String.valueOf(args[i])));
      s.append("],\"argsFormatted\":[");
      for (int i = 0; i < args.length; i++) s.append(i == 0 ? "" : ",").append(q(args[i] instanceof fj ? ((fj) args[i]).d() : String.valueOf(args[i])));
      s.append("],");
    }
    return s.append("\"text\":").append(q(c.c())).append(",\"formatted\":").append(q(c.d())).append("}").toString();
  }

  static void scenario(String config, String name, String... ops) throws Exception {
    sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup("health", 20f));
    MobMoveProbe.set(e, "b", u.allocateInstance(CombatTrackerProbe.PvpFake.class));
    Field aa = PlayerDamageProbe.fd(sv.class, "aa"), fall = PlayerDamageProbe.fd(sa.class, "R");
    PlayerDamageProbe.Player.message = null;
    int last = 0;
    for (String op : ops) last = Math.max(last, Integer.parseInt(op.split(" ")[0]));
    String preview = "null";
    for (int t = 0; t <= last; t++) {
      for (String op : ops) {
        String[] s = op.split(" ");
        if (Integer.parseInt(s[0]) != t) continue;
        boolean isFall = s[1].equals("fall");
        if (isFall) fall.setFloat(e, Float.parseFloat(s[2]));
        ro src = isFall ? ro.h : CombatTrackerProbe.source(s[2], e);
        float amount = Float.parseFloat(s[3]);
        e.a(src, amount);
        if (isFall) fall.setFloat(e, 0f);
        preview = chat(e.aW().b());
      }
      aa.setInt(e, aa.getInt(e) + 1);
      PlayerDamageProbe.tick(e);
      if (aa.getInt(e) % 20 == 0) e.aW().g();
    }
    System.out.println("{\"config\":" + q(config) + ",\"name\":" + q(name) + ",\"ops\":[" + String.join(",", Arrays.stream(ops).map(TeamNameProbe::q).toArray(String[]::new)) + "],\"preview\":" + preview + "}");
  }

  static void teams(bac b, String config) {
    // victim team "Red": the `color red` option (prefix §c, suffix §r); Alex's team "Blue" (color blue); a prefix/suffix pair beyond what the commands set
    switch (config) {
      case "none": return;
      case "victimColor": team(b, "Red", "§c", "§r", "Player"); return;
      case "victimAffix": team(b, "Mod", "§l[Mod] §a", " §7(x)", "Player"); return;
      case "victimAndAlex": team(b, "Red", "§c", "§r", "Player"); team(b, "Blue", "§9", "§r", "Alex"); return;
      case "alexOnly": team(b, "Blue", "§9[B] ", "§r", "Alex"); return;
      case "mobNameOnly": team(b, "Green", "§a", "§r", "Bob"); return;
      case "everyone": team(b, "Red", "§c", "§r", "Player"); team(b, "Blue", "§9", "§r", "Alex"); team(b, "Green", "§a", "§r", "Bob"); return;
      default: throw new IllegalArgumentException(config);
    }
  }
  static void team(bac b, String name, String prefix, String suffix, String member) {
    azy t = b.e(name); if (t == null) t = b.f(name);
    t.b(prefix); t.c(suffix);
    b.a(member, name);
  }

  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    CombatTrackerProbe.u = u;
    bac board = null;
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); board = (bac) f.get(PlayerDamageProbe.w); }
    String[] configs = {"none", "victimColor", "victimAffix", "victimAndAlex", "alexOnly", "mobNameOnly", "everyone"};
    String[][] cases = {
      {"drown", "0 hit drown A"}, {"fall-plain", "0 fall 3 A"},
      {"zombie", "0 hit mob:zombie A"}, {"zombie-bob", "0 hit mob:zombieBob A"}, {"zombie-sword", "0 hit mob:zombieSword A"},
      {"arrow-skeleton", "0 hit arrow:skeleton A"}, {"arrow-self", "0 hit arrow:self A"}, {"arrow-alex", "0 hit arrow:alex A"},
      {"thorns-self", "0 hit thorns:self A"}, {"thorns-bob", "0 hit thorns:zombieBob A"}, {"thorns-alex", "0 hit thorns:alex A"},
      {"player-alex", "0 hit player:alex A"}, {"player-alex-sword", "0 hit player:alexSword A"},
      {"explosion-creeper", "0 hit explosion:creeper A"}, {"fireball-ghast", "0 hit fireball:ghast A"}, {"fireball-self", "0 hit fireball:self A"},
      {"magic-witch", "0 hit indirectMagic:witch A"},
      {"fall-assist-alex", "0 hit player:alex 2", "12 fall 8 A"}, {"fall-assist-alex-sword", "0 hit player:alexSword 2", "12 fall 8 A"},
      {"fall-assist-bob", "0 hit mob:zombieBob 2", "12 fall 8 A"}, {"fall-finish-alex", "0 hit player:alex 2", "12 hit mob:zombie 2", "24 fall 8 A"},
      {"revenge-alex-lava", "0 hit player:alex 2", "50 hit lava A"}, {"revenge-bob-lava", "0 hit mob:zombieBob 2", "50 hit lava A"},
    };
    for (String config : configs) for (String[] c : cases) for (int k = 0; k < 2; k++) {
      board = new bac();
      for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(PlayerDamageProbe.w, board); }
      teams(board, config);
      String[] ops = new String[c.length - 1];
      for (int j = 1; j < c.length; j++) ops[j - 1] = c[j].replace(" A", k == 0 ? " 20" : " 3");
      scenario(config, c[0] + (k == 0 ? "-fatal" : "-soft"), ops);
    }
    // NetHandlerPlayServer.processChatMessage broadcasts ChatComponentTranslation("chat.type.text", player.func_145748_c_(), message) (bytecode-read;
    // the component is built here from the same two classes, the sender being the real EntityPlayerMP).
    for (String config : configs) {
      board = new bac();
      for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(PlayerDamageProbe.w, board); }
      teams(board, config);
      sv e = PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup("health", 20f));
      MobMoveProbe.set(e, "b", u.allocateInstance(CombatTrackerProbe.PvpFake.class));
      System.out.println("{\"config\":" + q(config) + ",\"name\":\"chat\",\"ops\":[],\"preview\":" + chat(new fr("chat.type.text", ((sa) e).c_(), "hello")) + "}");
    }
  }
}
