// Batch 87 offline87: executes, on the unchanged 1.7.10 classes,
//  * NetHandlerLoginServer.func_152506_a (nn.a(GameProfile)): the profile an offline-mode login gets for the typed name (the method reads no fields, so the handler
//    is allocated without its constructor),
//  * EntityPlayer.func_146094_a (yz.a(GameProfile)): the entity UUID of a complete and of a name-only profile (SaveHandler.writePlayerData names playerdata/<that>.dat),
//  * EnumConnectionState (eo): every state's id and both packet maps (eo.a() = client to server, eo.b() = server to client; the ids the netty encoder fa and decoder ez
//    record in NetworkStatistics, so /netstat's per-packet lines).
// Prints one JSON line {"offline":[...],"entity":[...],"states":[...]}. Run through tools/verify-offline87.mjs.
import com.mojang.authlib.GameProfile;
import com.google.common.collect.BiMap;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

public class Offline87Probe {
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  public static void main(String[] args) throws Exception {
    Field uf = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe"); uf.setAccessible(true);
    Object unsafe = uf.get(null);
    Object login = unsafe.getClass().getMethod("allocateInstance", Class.class).invoke(unsafe, nn.class);
    Method offline = nn.class.getDeclaredMethod("a", GameProfile.class); offline.setAccessible(true);
    StringBuilder b = new StringBuilder("{\"offline\":[");
    String[] names = { "Alex", "alex", "ALEX", "Steve", "Eve", "Herobrine", "Notch", "a", "Player", "Name_With_16chr" };
    for (int i = 0; i < names.length; i++) {
      GameProfile p = (GameProfile) offline.invoke(login, new GameProfile(null, names[i]));
      b.append(i > 0 ? "," : "").append("[").append(q(names[i])).append(",").append(q(String.valueOf(p.getId()))).append(",").append(q(p.getName())).append("]");
    }
    b.append("],\"entity\":[");
    UUID account = UUID.fromString("00000000-0000-0000-0000-000000000001");
    b.append("[").append(q("Alex")).append(",null,").append(q(yz.a(new GameProfile(null, "Alex")).toString())).append("],");
    b.append("[").append(q("Alex")).append(",").append(q(account.toString())).append(",").append(q(yz.a(new GameProfile(account, "Alex")).toString())).append("]");
    b.append("],\"states\":[");
    eo[] states = eo.values();
    for (int s = 0; s < states.length; s++) {
      eo st = states[s];
      b.append(s > 0 ? "," : "").append("{\"name\":").append(q(st.name())).append(",\"id\":").append(st.c());
      for (int dir = 0; dir < 2; dir++) {
        BiMap map = dir == 0 ? st.a() : st.b();
        TreeMap<Integer, String> sorted = new TreeMap<>();
        for (Object e : map.entrySet()) { Map.Entry en = (Map.Entry) e; sorted.put((Integer) en.getKey(), ((Class) en.getValue()).getName()); }
        b.append(dir == 0 ? ",\"serverbound\":{" : ",\"clientbound\":{");
        boolean first = true;
        for (Map.Entry<Integer, String> en : sorted.entrySet()) { b.append(first ? "" : ",").append(q(String.valueOf(en.getKey()))).append(":").append(q(en.getValue())); first = false; }
        b.append("}");
      }
      b.append("}");
    }
    b.append("]}");
    System.out.println(b);
  }
}
