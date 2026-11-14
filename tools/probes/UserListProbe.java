import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.mojang.authlib.GameProfile;

// Batch 70 sptab70: the 1.7.10 UserList (om) with its real subclasses: UserListBans (op), UserListOps (oj), UserListWhitelist (or) and the IP BanList (nx), all in the default
// package of the client JAR. Entries are put and removed through the unchanged put/remove methods (a(ol), c(Object)) and the name arrays the tab completion reads (a()) are printed
// after each checkpoint: {"list":...,"step":...,"entries":[{"name":...,"uuid":...} | {"ip":...}, ...]} in the order of the returned array.
public class UserListProbe {
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static GameProfile profile(String name) { return new GameProfile(UUID.nameUUIDFromBytes(("OfflinePlayer:" + name).getBytes(StandardCharsets.UTF_8)), name); }
  static String uuidOf(String name) { return profile(name).getId().toString(); }
  static void print(String list, String step, String[] arr, boolean ip) {
    StringBuilder b = new StringBuilder();
    for (String s : arr) b.append(b.length() == 0 ? "" : ",").append(ip ? "{\"ip\":" + q(s) + "}" : "{\"name\":" + q(s) + ",\"uuid\":" + q(uuidOf(s)) + "}");
    System.out.println("{\"list\":" + q(list) + ",\"step\":" + q(step) + ",\"entries\":[" + b + "]}");
  }
  public static void main(String[] args) throws Exception {
    File dir = new File(args[0]); dir.mkdirs();
    String[] names = new String[40];
    for (int i = 0; i < names.length; i++) names[i] = (i % 3 == 0 ? "Steve" : i % 3 == 1 ? "Alex" : "Notch") + i;
    String[] kinds = {"bans", "ops", "whitelist", "ips"};
    for (String kind : kinds) {
      om list = kind.equals("bans") ? new op(new File(dir, "b.json")) : kind.equals("ops") ? new oj(new File(dir, "o.json")) : kind.equals("whitelist") ? new or(new File(dir, "w.json")) : new nx(new File(dir, "i.json"));
      boolean ip = kind.equals("ips");
      for (int i = 0; i < names.length; i++) {
        String ipText = "10.0." + (i * 7 % 256) + "." + (i * 13 % 256);
        ol entry = kind.equals("bans") ? new oq(profile(names[i])) : kind.equals("ops") ? new ok(profile(names[i]), 4) : kind.equals("whitelist") ? new os(profile(names[i])) : new ny(ipText);
        list.a(entry);
        if (i + 1 == 5 || i + 1 == 13 || i + 1 == 26 || i + 1 == 40) print(kind, "put" + (i + 1), ip ? list.a() : list.a(), ip);
      }
      // remove all but the first 6 names (the table keeps its size)
      for (int i = 6; i < names.length; i++) { String ipText = "10.0." + (i * 7 % 256) + "." + (i * 13 % 256); if (kind.equals("ips")) list.c(ipText); else list.c(profile(names[i])); }
      print(kind, "removeTo6", list.a(), ip);
    }
  }
}
