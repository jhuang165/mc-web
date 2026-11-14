import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

// Batch 69 mptabcomplete: CommandHandler (z) of Minecraft Java 1.7.10 with the command classes the dedicated server registers (the class list
// and order come from ServerCommandManager's constructor bytecode, read by tools/verify-tabcomplete.mjs; the lan-only /publish is left out).
// getPossibleCommands (z.b) is called with a proxy ICommandSender (ac) whose canCommandSenderUseCommand (ac.a(int, String)) is "level >= required".
// Each line: {"level":L,"text":"...","options":[...]} in the order the unchanged HashMap iteration returned.
public class TabProbe {
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  // A MinecraftServer (the integrated server class stands in for the dedicated one, which is not in the client JAR; isSinglePlayer() is false: no server owner) without running its constructor: the static instance (I()), a ServerConfigurationManager (ah()) holding a UserListBans (op) and a
  // BanList (nx) (oi is abstract: its integrated subclass stands in), both with their default "enabled" flag (true), as a dedicated server has them. Everything else stays null.
  static void stubServer() throws Exception {
    Field uf = Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true);
    Unsafe u = (Unsafe) uf.get(null);
    Class<?> ms = Class.forName("net.minecraft.server.MinecraftServer");
    Object server = u.allocateInstance(bsx.class), cfg = u.allocateInstance(bsw.class);
    for (Field f : ms.getDeclaredFields()) {
      f.setAccessible(true);
      if (Modifier.isStatic(f.getModifiers()) && f.getType() == ms) f.set(null, server);
      else if (f.getType() == oi.class) f.set(server, cfg);
    }
    for (Field f : oi.class.getDeclaredFields()) {
      f.setAccessible(true);
      if (f.getType() == op.class || f.getType() == nx.class) {
        Object list = u.allocateInstance(f.getType());
        for (Class<?> c = f.getType(); c != Object.class; c = c.getSuperclass()) for (Field b : c.getDeclaredFields()) if (b.getType() == boolean.class && !Modifier.isStatic(b.getModifiers())) { b.setAccessible(true); b.set(list, true); }
        f.set(cfg, list);
      }
    }
  }
  static String run(z handler, ac sender, String profile, String key, int keyValue, String text) {
    List<String> r;
    String head = "{\"profile\":" + q(profile) + "," + (key == null ? "" : "\"" + key + "\":" + keyValue + ",") + "\"text\":" + q(text) + ",";
    try { r = handler.b(sender, text); } catch (Throwable t) { return head + "\"error\":" + q(String.valueOf(t)) + "}"; }
    StringBuilder b = new StringBuilder();
    if (r != null) for (String s : r) b.append(b.length() == 0 ? "" : ",").append(q(s));
    return head + "\"options\":" + (r == null ? "null" : "[" + b + "]") + "}";
  }
  static z handlerOf(String list) throws Exception {
    z handler = new z();
    for (String cls : list.split(",")) handler.a((aa) Class.forName(cls).getDeclaredConstructor().newInstance());
    return handler;
  }
  // args[0]: the dedicated server's command classes (ServerCommandManager's `isDedicated` branch taken), args[1] the integrated server's (the common 31 plus the lan-only /publish).
  public static void main(String[] args) throws Exception {
    stubServer();
    String[] texts = {"", "s", "S", "t", "te", "se", "b", "ban", "w", "?", "x", "gamemode s", "gamemode ", "difficulty p", "weather r", "time set ", "nosuch ", "TIME s"};
    z dedicated = handlerOf(args[0]);
    for (int level = 0; level <= 4; level++) {
      final int lv = level;
      ac sender = (ac) Proxy.newProxyInstance(TabProbe.class.getClassLoader(), new Class[]{ac.class}, (p, m, a) -> {
        if (m.getName().equals("a") && m.getParameterTypes().length == 2) return lv >= ((Integer) a[0]);
        if (m.getName().equals("b_")) return "Player";
        return null;
      });
      for (String text : texts) System.out.println(run(dedicated, sender, "dedicated", "level", lv, text).replace("{\"profile\":\"dedicated\",", "{"));
    }
    // The integrated server: EntityPlayerMP.canCommandSenderUseCommand (mw.a(int, String), bytecode-read): "seed" is always allowed (the server is not dedicated), "tell", "help" and "me" too;
    // any other command needs the player to be an op (ServerConfigurationManager.g: cheats on for the owner's world) and the op level 4 (MinecraftServer.l()) >= the required level.
    z integrated = handlerOf(args[1]);
    String[] more = Arrays.copyOf(texts, texts.length + 12);
    String[] extra = {"g", "ga", "p", "pu", "d", "de", "m", "ms", "k", "e", "he", "sp"};
    System.arraycopy(extra, 0, more, texts.length, extra.length);
    for (int cheats = 0; cheats <= 1; cheats++) {
      final boolean on = cheats == 1;
      ac sender = (ac) Proxy.newProxyInstance(TabProbe.class.getClassLoader(), new Class[]{ac.class}, (p, m, a) -> {
        if (m.getName().equals("a") && m.getParameterTypes().length == 2) {
          String name = (String) a[1];
          if (name.equals("seed") || name.equals("tell") || name.equals("help") || name.equals("me")) return true;
          return on && 4 >= ((Integer) a[0]);
        }
        if (m.getName().equals("b_")) return "Player";
        return null;
      });
      for (String text : more) System.out.println(run(integrated, sender, "integrated", "cheats", cheats, text));
    }
  }
}
