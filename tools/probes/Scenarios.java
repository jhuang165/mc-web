import java.util.*;
import java.util.function.Supplier;

// One row per (screen, variant): world state (0 none, 1 normal, 2 hardcore), singleplayer flag, updateScreen ticks, and the button ids clicked before recording.
class Scenarios {
  static class S {
    final String name; final Supplier<bdw> make; final int world; final boolean single; final int ticks; final int[] clicks;
    S(String name, Supplier<bdw> make, int world, boolean single, int ticks, int... clicks) { this.name = name; this.make = make; this.world = world; this.single = single; this.ticks = ticks; this.clicks = clicks; }
  }
  static List<S> table() {
    List<S> m = new ArrayList<>();
    bbj s = GuiMenusProbe.mc.u;
    m.add(new S("GuiGameOver", () -> new bdc(), 1, false, 0));
    m.add(new S("GuiGameOver+20ticks", () -> new bdc(), 1, false, 20));
    m.add(new S("GuiGameOver+singleplayer+20ticks", () -> new bdc(), 1, true, 20));
    m.add(new S("GuiGameOverHardcore", () -> new bdc(), 2, false, 0));
    m.add(new S("GuiGameOverHardcore+singleplayer", () -> new bdc(), 2, true, 0));
    m.add(new S("GuiYesNo", () -> new bcw(null, "Are you sure?", "line two", 7), 0, false, 0));
    m.add(new S("GuiYesNo4", () -> new bcw(null, "Q", "S", "Yup", "Nope", 7), 0, false, 0));
    m.add(new S("GuiConfirmOpenLink+untrusted", () -> new bcu(null, "http://example.com", 3, false), 0, false, 0));
    m.add(new S("GuiConfirmOpenLink+trusted", () -> new bcu(null, "http://example.com", 3, true), 0, false, 0));
    m.add(new S("GuiIngameMenu+remote", () -> new bdp(), 1, false, 0));
    m.add(new S("GuiIngameMenu+singleplayer", () -> new bdp(), 1, true, 0));
    m.add(new S("GuiOptions+noworld", () -> new bdm(null, s), 0, false, 0));
    m.add(new S("GuiOptions+world", () -> new bdm(null, s), 1, false, 0));
    m.add(new S("GuiOptions+hardcore", () -> new bdm(null, s), 2, false, 0));
    m.add(new S("GuiVideoSettings", () -> new bef(null, s), 0, false, 0));
    m.add(new S("GuiScreenOptionsSounds", () -> new bec(null, s), 0, false, 0));
    m.add(new S("GuiControls", () -> new bew(null, s), 0, false, 0));
    m.add(new S("ScreenChatOptions", () -> new bcs(null, s), 0, false, 0));
    m.add(new S("GuiShareToLan", () -> new bdz(null), 1, true, 0));
    m.add(new S("GuiShareToLan+mode", () -> new bdz(null), 1, true, 0, 104));
    m.add(new S("GuiRenameWorld", () -> new bdv(null, "World1"), 0, false, 0));
    m.add(new S("GuiMainMenu", () -> new bee(), 0, false, 0));
    m.add(new S("GuiSleepMP", () -> new bdi(), 1, false, 0));
    m.add(new S("GuiCreateWorld", () -> new bdb(null), 0, false, 0));
    m.add(new S("GuiCreateWorld+more", () -> new bdb(null), 0, false, 0, 3));
    m.add(new S("GuiCreateWorld+gamemode", () -> new bdb(null), 0, false, 0, 2));
    m.add(new S("GuiCreateWorld+gamemode2", () -> new bdb(null), 0, false, 0, 2, 2));
    m.add(new S("GuiCreateWorld+more+type", () -> new bdb(null), 0, false, 0, 3, 5));
    m.add(new S("GuiCreateWorld+more+type2", () -> new bdb(null), 0, false, 0, 3, 5, 5));
    m.add(new S("GuiCreateWorld+more+type3", () -> new bdb(null), 0, false, 0, 3, 5, 5, 5));
    m.add(new S("GuiSelectWorld", () -> new bdx(null), 0, false, 0));
    m.add(new S("GuiMultiplayer", () -> new bfz(null), 0, false, 0));
    m.add(new S("GuiScreenResourcePacks", () -> new bgf(null), 0, false, 0));
    // b77 worldflags77: ServerListEntryLanScan dots by clock (Minecraft.getSystemTime() / 300 % 4) and real folder packs in both pack lists.
    m.add(new S("GuiMultiplayer+t300", () -> { org.lwjgl.Sys.now = 300L; return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+t600", () -> { org.lwjgl.Sys.now = 600L; return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+t900", () -> { org.lwjgl.Sys.now = 900L; return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+t1200", () -> { org.lwjgl.Sys.now = 1200L; return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+servers1", () -> { GuiMenusProbe.serverFixtures(1); return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+servers2", () -> { GuiMenusProbe.serverFixtures(2); return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+servers3", () -> { GuiMenusProbe.serverFixtures(3); return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiMultiplayer+servers4", () -> { GuiMenusProbe.serverFixtures(4); return new bfz(null); }, 0, false, 0));
    m.add(new S("GuiScreenResourcePacks+packs", () -> { GuiMenusProbe.packFixtures(false); return new bgf(null); }, 0, false, 0));
    m.add(new S("GuiScreenResourcePacks+packs+selected", () -> { GuiMenusProbe.packFixtures(true); return new bgf(null); }, 0, false, 0));
    m.add(new S("GuiLanguage", () -> new bdj(null, s, GuiMenusProbe.lang), 0, false, 0));
    m.add(new S("GuiScreenAddServer", () -> new bdg(null, new bjn("Minecraft Server", "")), 0, false, 0));
    m.add(new S("GuiScreenAddServer+existing", () -> new bdg(null, new bjn("Home", "play.example.com:25566")), 0, false, 0));
    m.add(new S("GuiScreenServerList", () -> new bde(null, new bjn("Minecraft Server", "")), 0, false, 0));
    m.add(new S("GuiDisconnected", () -> new bdf(null, "disconnect.lost", new fq("Timed out")), 0, false, 0));
    m.add(new S("GuiErrorScreen", () -> new bdh("Error title", "Error message"), 0, false, 0));
    m.add(new S("GuiScreenWorking", () -> new bdt(), 0, false, 0));
    return m;
  }
  static void run(String[] only, int[][] sizes) {
    Set<String> want = only == null ? null : new HashSet<>(Arrays.asList(only));
    for (S e : table()) {
      if (want != null && !want.contains(e.name) && !want.contains(e.name.split("\\+")[0])) continue;
      for (int[] sz : sizes) System.out.println(GuiMenusProbe.run(e.name, sz[0], sz[1], e.make, e.world, e.single, e.ticks, e.clicks, true));
    }
  }
}
