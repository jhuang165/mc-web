import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Commands are constructed and registered using original CommandHandler;
// profile membership/order comes from ServerCommandManager bytecode.
// Structure registries run their unchanged static registration methods.
public class SurfaceCatalogueProbe {
  static String q(String s) { return CatalogueProbe.q(s); }
  static Map<?, ?> map(String name) throws Exception {
    Field f = avi.class.getDeclaredField(name);
    f.setAccessible(true);
    return (Map<?, ?>) f.get(null);
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    List<String[]> registrations = new ArrayList<>();
    for (String line : Files.readAllLines(Paths.get(args[0]))) registrations.add(line.split("\t"));
    for (String[] row : registrations) {
      y command = (y) Class.forName(row[1]).getDeclaredConstructor().newInstance();
      List<String> aliases = command.b();
      List<String> names = new ArrayList<>();
      if (aliases != null) for (String name : aliases) names.add(q(name));
      boolean customPermission = command.getClass().getMethod("a", ac.class).getDeclaringClass() != y.class;
      System.out.println("{\"kind\":\"command\",\"scope\":" + q(row[0]) + ",\"class\":" + q(row[1])
        + ",\"name\":" + q(command.c()) + ",\"aliases\":[" + String.join(",", names) + "]"
        + ",\"permissionLevel\":" + command.a() + ",\"customPermission\":" + customPermission
        + ",\"usage\":" + q(command.c(null)) + "}");
    }
    for (String profile : new String[] { "integrated", "dedicated" }) {
      z handler = new z();
      for (String[] row : registrations) if (row[0].equals("common") || row[0].equals(profile)) {
        handler.a((aa) Class.forName(row[1]).getDeclaredConstructor().newInstance());
      }
      Map<String, aa> commands = handler.a();
      List<String> keys = new ArrayList<>();
      for (String key : new TreeSet<String>(commands.keySet())) {
        aa command = commands.get(key);
        keys.add("{\"key\":" + q(key) + ",\"name\":" + q(command.c()) + ",\"class\":" + q(command.getClass().getName()) + "}");
      }
      System.out.println("{\"kind\":\"profile\",\"profile\":" + q(profile) + ",\"lookup\":[" + String.join(",", keys) + "]}");
    }
    for (String[] registry : new String[][] { { "structureStart", "b", "c" }, { "structurePiece", "d", "e" } }) {
      Map<String, Class<?>> forward = (Map<String, Class<?>>) map(registry[1]);
      Map<Class<?>, String> reverse = (Map<Class<?>, String>) map(registry[2]);
      if (forward.size() != reverse.size()) throw new AssertionError("Structure registry sizes");
      for (String key : new TreeSet<String>(forward.keySet())) {
        Class<?> type = forward.get(key);
        if (!key.equals(reverse.get(type))) throw new AssertionError("Structure reverse mapping: " + key);
        System.out.println("{\"kind\":" + q(registry[0]) + ",\"id\":" + q(key) + ",\"class\":" + q(type.getName()) + "}");
      }
    }
  }
}
