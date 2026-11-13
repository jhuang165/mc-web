import java.util.ArrayList;
import java.util.List;

// Batch 41: a real EntityPlayerMP (mw) for the probes, built with the unchanged 1.7.10 constructor on stubs. The constructor wants a MinecraftServer, a WorldServer (mt) and an
// ItemInWorldManager (mx): the server is an abstract MinecraftServer double (only X, ab, ao, ah are ever asked), the WorldServer is an Unsafe-allocated mt subclass that answers the three
// calls the constructor makes (spawn point, collision list, provider.hasNoSky so the spawn-radius Random draws are skipped), and mx is the real class. Afterwards the entity is moved into the
// probe world (Entity.worldObj), spawn protection (mw.bU = 60, decremented only by mw.onUpdate) is cleared and the game type is set through the real ahk. mw is never ticked: the mobs
// see exactly what EntityCreature / EntityAITarget / World.getClosestVulnerablePlayerToEntity read: EntityPlayerMP's class, ItemInWorldManager.isCreative() and PlayerCapabilities.
public class ServerPlayerProbe {
  public static class Stats extends pg { // StatisticsFile: damage taken and dealt statistics the real attackEntityFrom adds (no file, no network)
    Stats() { super(null, null); }
    public void b(yz p, ph stat, int amount) {}
    public void a(yz p, ph stat, int amount) {}
  }
  public static class Net extends nh { // NetHandlerPlayServer.sendPacket: effect, health and velocity packets go nowhere
    Net() { super(null, null, null); }
    public void a(ft packet) {}
    public sa player; // batch 55: set by make(); NetHandlerPlayServer.setPlayerLocation moves the player (setPositionAndRotation) to the spot, so mw.setPositionAndUpdate of a dismount really lands it there
    public void a(double x, double y, double z, float yaw, float pitch) { // setPlayerLocation (a rider's mount packet)
      if (player == null) return;
      try { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, x, y, z); } catch (Exception e) { throw new RuntimeException(e); }
    }
  }
  public static class Oi extends oi {
    Oi() { super(null); }
    public pg a(yz p) { try { return (pg) MobMoveProbe.unsafe().allocateInstance(Stats.class); } catch (Exception e) { throw new RuntimeException(e); } }
  }
  public static class Server extends net.minecraft.server.MinecraftServer {
    Server() { super(null, null); }
    protected boolean e() { return false; }
    public boolean h() { return false; }
    public ahk i() { return ahk.b; }
    public rd j() { return rd.c; }
    public boolean k() { return false; }
    public int l() { return 0; }
    public boolean m() { return false; }
    public boolean X() { return false; } // isPVPEnabled: mw.attackEntityFrom only asks it for fall damage while ab() is true
    public boolean ab() { return false; }
    public boolean ad() { return false; }
    public int ao() { return 0; }
    public oi ah() { return OI; }
    public String a(ahk g, boolean cheats) { return ""; }
    public String b_() { return "Server"; }
    public fj c_() { return null; }
    public void a(fj m) {}
    public boolean a(int l, String c) { return false; }
    public r f_() { return new r(0, 0, 0); }
    public ahb d() { return null; }
    public void a(ri l) {}
    public void b(ri l) {}
    public boolean W() { return false; }
    static oi OI;
  }
  public static class Stage extends mt {
    Stage() { super(null, null, null, 0, null, null); }
    public r K() { return new r(0, 0, 0); }
    public List a(sa e, azt box) { return new ArrayList(); }
  }
  public static class PM extends mw {
    public String n;
    PM(Server s, Stage w, String n) { super(s, w, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes(n.getBytes()), n), new mx(w)); this.n = n; }
    public String b_() { return n; }
  }

  public static PM make(ahb real, String n) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    if (Server.OI == null) Server.OI = (oi) u.allocateInstance(Oi.class);
    Server server = (Server) u.allocateInstance(Server.class);
    Stage stage = (Stage) u.allocateInstance(Stage.class);
    aqo provider = (aqo) u.allocateInstance(aqq.class);
    MobMoveProbe.field(aqo.class, "g").setBoolean(provider, true); // hasNoSky: skips the spawn-radius draws of the constructor
    MobMoveProbe.set(stage, "t", provider);
    PM p = new PM(server, stage, n);
    p.a = (nh) u.allocateInstance(Net.class);
    ((Net) p.a).player = p;
    MobMoveProbe.set(p, "o", real); // Entity.worldObj
    p.c.a = real; // ItemInWorldManager.theWorld
    MobMoveProbe.field(mw.class, "bU").setInt(p, 0); // spawn protection ticks
    gameType(p, ahk.b);
    return p;
  }

  // ItemInWorldManager.setGameType minus the network update mw.updateCapabilities sends: the stored type and the capabilities the real ahk.a(PlayerCapabilities) writes (disableDamage, isCreativeMode, allowFlying, isFlying)
  public static void gameType(PM p, ahk type) throws Exception {
    MobMoveProbe.field(mx.class, "c").set(p.c, type);
    type.a(p.bE);
  }
}
