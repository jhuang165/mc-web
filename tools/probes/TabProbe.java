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
  public static void main(String[] args) throws Exception {
    stubServer();
    z handler = new z();
    for (String cls : args[0].split(",")) handler.a((aa) Class.forName(cls).getDeclaredConstructor().newInstance());
    String[] texts = {"", "s", "S", "t", "te", "se", "b", "ban", "w", "?", "x", "gamemode s", "gamemode ", "difficulty p", "weather r", "time set ", "nosuch ", "TIME s"};
    for (int level = 0; level <= 4; level++) {
      final int lv = level;
      ac sender = (ac) Proxy.newProxyInstance(TabProbe.class.getClassLoader(), new Class[]{ac.class}, (p, m, a) -> {
        if (m.getName().equals("a") && m.getParameterTypes().length == 2) return lv >= ((Integer) a[0]);
        if (m.getName().equals("b_")) return "Player";
        return null;
      });
      for (String text : texts) {
        List<String> r;
        try { r = handler.b(sender, text); } catch (Throwable t) { System.out.println("{\"level\":" + level + ",\"text\":" + q(text) + ",\"error\":" + q(String.valueOf(t)) + "}"); continue; }
        StringBuilder b = new StringBuilder();
        if (r != null) for (String s : r) b.append(b.length() == 0 ? "" : ",").append(q(s));
        System.out.println("{\"level\":" + level + ",\"text\":" + q(text) + ",\"options\":" + (r == null ? "null" : "[" + b + "]") + "}");
      }
    }
  }
}
