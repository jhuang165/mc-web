import java.lang.invoke.*;
import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 portal code for non-player entities: Entity.onEntityUpdate's portal block (sa.C), BlockPortal (amp) and BlockEndPortal
// (akt) collision callbacks, Entity.travelToDimension (sa.b(I)V), ServerConfigurationManager.transferEntityToWorld (oi.a(sa,int,mt,mt)),
// Teleporter (ahp) and Entity.copyDataFrom (sa.a(sa,Z)), on sparse WorldServer doubles (mt subclass allocated without its constructor)
// and a MinecraftServer double. A registered probe entity class lets EntityList.createEntityByName build the copy.
// Batch 37: real EntityMinecartEmpty (xs) and EntityBoat (xi) updates (xl.h / xi.h with their own moveEntity) on the sparse world, and a Teleporter that
// outlives its transfers (WorldServer.getDefaultTeleporter, swept by removeStalePortalLocations(getTotalWorldTime())).
// Records: trace, collide, transfer, travel, nbt, vehicle, cache.
public class EntityPortalProbe {
  static String qt(String s){return "\""+s+"\"";}
  static sun.misc.Unsafe U;
  static ays INFO;
  static Field fld(Class<?> c,String n)throws Exception{for(;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}catch(NoSuchFieldException e){}throw new NoSuchFieldException(n);}
  static boolean allowNether=true;
  static StringBuilder log=new StringBuilder();
  static void logEvent(String s){if(log.length()>0)log.append(',');log.append(s);}
  public static class TS extends net.minecraft.server.MinecraftServer {
    TS(){super(null,null);}
    protected boolean e(){return true;} public boolean h(){return false;} public ahk i(){return null;} public rd j(){return null;}
    public boolean k(){return false;} public int l(){return 0;} public boolean m(){return false;} public boolean X(){return false;}
    public boolean ad(){return false;} public String a(ahk k,boolean b){return "";}
    public boolean w(){return allowNether;}
  }
  public static class TC extends oi { TC(){super(null);} }
  // Sparse world: stone below `floor`, air above, explicit overrides in `cells`; every spawn/remove/update is logged.
  public static class TW extends mt {
    TW(){super(null,null,null,0,null,null);}
    int dim,floor,spawnX,spawnY,spawnZ;long seed,time;Map<String,Integer> cells=new HashMap<>();ahp tele;
    static String ck(int x,int y,int z){return x+","+y+","+z;}
    int id(int x,int y,int z){Integer v=cells.get(ck(x,y,z));if(v!=null)return v;if(y<0)return 0;return y<=floor?1:0;}
    public aji a(int x,int y,int z){int i=id(x,y,z);return i==0?ajn.a:aji.e(i);}
    public int e(int x,int y,int z){return 0;}
    protected boolean c(int x,int z){return true;}
    public java.util.List b(sa e,azt box){return new ArrayList<Object>();}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){if(y<0||y>=256)return false;cells.put(ck(x,y,z),aji.b(b));return true;}
    public boolean b(int x,int y,int z,aji b){return d(x,y,z,b,0,3);}
    public void d(int x,int y,int z,aji b){}
    public ays N(){return INFO;}
    public long H(){return seed;} public long I(){return time;}
    public void e(sa e){logEvent("{\"op\":\"remove\",\"dim\":"+dim+"}");}
    public boolean d(sa e){logEvent("{\"op\":\"spawn\",\"dim\":"+dim+",\"class\":"+qt(e.getClass().getSimpleName())+",\"entity\":"+ent(e)+",\"cooldown\":"+e.am+"}");return true;}
    public void a(sa e,boolean force){logEvent("{\"op\":\"update\",\"dim\":"+dim+",\"force\":"+force+"}");}
    public void i(){}
    public ahp u(){return tele;}
    public r K(){return new r(spawnX,spawnY,spawnZ);}
    public r l(){return t.h();}
    public int i(int x,int z){return 64+Math.floorMod(x*7+z*13,9);}
  }
  public static class TE extends sa {
    public TE(ahb w){super(w);}
    TE(){super((ahb)null);}
    protected void c(){} protected void a(dh d){} protected void b(dh d){}
    public boolean N(){return false;} public boolean P(){return false;} protected void E(){} protected void G(){}
    public void a(int i,boolean b){} public boolean ao(){return false;}
    public void b(int d){logEvent("{\"op\":\"travel\",\"to\":"+d+"}");}
  }
  // The probe entity with the real travelToDimension.
  public static class TR extends sa {
    public TR(ahb w){super(w);}
    TR(){super((ahb)null);}
    protected void c(){} protected void a(dh d){} protected void b(dh d){}
    public boolean N(){return false;} public boolean P(){return false;} protected void E(){} protected void G(){}
    public void a(int i,boolean b){} public boolean ao(){return false;}
  }
  public static class TP extends yz {
    TP(){super(null,null);}
    public void a(fj f){} public boolean a(int i,String t){return true;} public r f_(){return null;}
    public boolean N(){return false;} public boolean P(){return false;} protected void E(){} protected void G(){}
    public void a(int i,boolean b){} public boolean ao(){return false;}
    public void b(int d){logEvent("{\"op\":\"travel\",\"to\":"+d+"}");}
  }
  // Real vehicles with only the travel call replaced by a log line (Entity.travelToDimension is replayed by the travel records).
  public static class VC extends xs { VC(ahb w){super(w);} public void b(int d){logEvent("{\"op\":\"travel\",\"to\":"+d+"}");} }
  public static class VB extends xi { VB(ahb w){super(w);} public void b(int d){logEvent("{\"op\":\"travel\",\"to\":"+d+"}");} }
  static TW world(int dim,long seed,int floor)throws Exception{
    TW w=(TW)U.allocateInstance(TW.class);w.dim=dim;w.seed=seed;w.floor=floor;w.cells=new HashMap<>();w.spawnX=3;w.spawnY=64;w.spawnZ=-5;
    aqo p=(aqo)U.allocateInstance(dim==-1?aqp.class:dim==1?aqr.class:aqq.class);fld(aqo.class,"h").set(p,new float[16]);fld(aqo.class,"j").set(p,new float[4]);fld(ahb.class,"t").set(w,p);p.a(w);
    fld(ahb.class,"C").set(w,new qi());fld(ahb.class,"L").set(w,new ArrayList<Object>());fld(ahb.class,"E").set(w,false);w.tele=new ahp(w);return w;}
  static void bindServer(TW over,TW nether,TW end)throws Exception{
    TS s=(TS)U.allocateInstance(TS.class);
    fld(net.minecraft.server.MinecraftServer.class,"c").set(s,new mt[]{over,nether,end});
    fld(net.minecraft.server.MinecraftServer.class,"u").set(s,U.allocateInstance(TC.class));
    fld(net.minecraft.server.MinecraftServer.class,"j").set(null,s);
    for(TW w:new TW[]{over,nether,end})fld(mt.class,"J").set(w,s);}
  static <T extends sa> T entity(Class<T> c,TW w,double x,double y,double z,float yaw,double vx,double vz)throws Exception{
    sa e=(sa)U.allocateInstance(c);fld(sa.class,"C").set(e,azt.a(0,0,0,0,0,0));fld(sa.class,"Z").set(e,new Random(5));
    fld(sa.class,"o").set(e,w);e.ap=w.dim;e.s=x;e.t=y;e.u=z;e.y=yaw;e.v=vx;e.x=vz;fld(sa.class,"ar").set(e,UUID.nameUUIDFromBytes("probe".getBytes()));
    e.p=x;e.q=y;e.r=z;te dw=new te(e);dw.a(0,Byte.valueOf((byte)0));dw.a(1,Short.valueOf((short)300));fld(sa.class,"af").set(e,dw);return c.cast(e);}
  static yz player(TW w,boolean creative)throws Exception{
    TP e=entity(TP.class,w,0,64,0,0,0,0);yw cap=new yw();cap.a=creative;fld(yz.class,"bE").set(e,cap);
    te dw=new te(e);dw.a(0,Byte.valueOf((byte)0));dw.a(1,Short.valueOf((short)300));dw.a(6,Float.valueOf(20f));dw.a(7,Integer.valueOf(0));dw.a(8,Byte.valueOf((byte)0));dw.a(9,Byte.valueOf((byte)0));dw.a(10,"");dw.a(11,Byte.valueOf((byte)0));dw.a(16,Byte.valueOf((byte)0));dw.a(17,Float.valueOf(0f));dw.a(18,Integer.valueOf(0));
    fld(sa.class,"af").set(e,dw);fld(sv.class,"f").set(e,new HashMap<Object,Object>());return e;}
  static String ent(sa e){return "["+e.s+","+e.t+","+e.u+","+e.v+","+e.w+","+e.x+","+e.y+","+e.z+"]";}
  static final MethodHandles.Lookup L=MethodHandles.lookup();
  static MethodHandle baseUpdate(Class<?> c)throws Throwable{return MethodHandles.privateLookupIn(c,L).findSpecial(sa.class,"C",MethodType.methodType(void.class),c);}
  static int geti(sa e,String n)throws Exception{return (Integer)fld(sa.class,n).get(e);}
  static boolean getb(sa e,String n)throws Exception{return (Boolean)fld(sa.class,n).get(e);}
  public static void main(String[] args)throws Throwable{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);U=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();INFO=(ays)U.allocateInstance(ays.class);
    Method add=sg.class.getDeclaredMethod("a",Class.class,String.class,int.class);add.setAccessible(true);add.invoke(null,TR.class,"ProbeEntity",250);
    aji portal=aji.e(90),endPortal=aji.e(119);
    // ---- trace: per-tick portal counters ----
    // Each tick runs Entity.onEntityUpdate (sa.C, called non-virtually) then, while `in`, the BlockPortal collision callback.
    // enter: 100 ticks inside, then 100 outside. riding: ridingEntity set. noNether: MinecraftServer.getAllowNether false.
    // brief: 3 ticks inside, then outside.
    String[] kinds={"entity","survival","creative"};
    for(String kind:kinds)for(String mode:new String[]{"enter","riding","noNether","brief"}){
      if(!kind.equals("entity")&&mode.equals("noNether"))continue;
      TW w=world(0,1,10);bindServer(w,w,w);allowNether=!mode.equals("noNether");
      sa e=kind.equals("entity")?entity(TE.class,w,0.5,11,0.5,0,0,0):player(w,kind.equals("creative"));
      MethodHandle upd=baseUpdate(e.getClass());
      if(mode.equals("riding"))fld(sa.class,"m").set(e,entity(TE.class,w,0,0,0,0,0,0));
      StringBuilder ticks=new StringBuilder();
      int inside=mode.equals("brief")?3:100,total=mode.equals("brief")?60:220;
      for(int t=0;t<total;t++){
        log.setLength(0);
        upd.invoke(e);
        String travel=log.toString();
        boolean in=t<inside;
        if(in)portal.a(w,0,11,0,e);
        if(ticks.length()>0)ticks.append(',');
        ticks.append("["+t+","+in+","+geti(e,"ao")+","+e.am+","+getb(e,"an")+","+qt(travel.isEmpty()?"":travel.replace("\"","'"))+"]");
      }
      System.out.println("{\"kind\":\"trace\",\"entity\":"+qt(kind)+",\"mode\":"+qt(mode)+",\"allowNether\":"+allowNether+",\"maxInPortal\":"+e.D()+",\"cooldown\":"+e.ai()+",\"ticks\":["+ticks+"]}");
    }
    allowNether=true;
    // ---- collide: which entities the two portal blocks react to ----
    for(boolean rides:new boolean[]{false,true})for(boolean ridden:new boolean[]{false,true})for(boolean remote:new boolean[]{false,true}){
      TW w=world(0,1,10);bindServer(w,w,w);fld(ahb.class,"E").set(w,remote);
      TE e=entity(TE.class,w,0.5,11,0.5,0,0,0);TE other=entity(TE.class,w,0,0,0,0,0,0);
      if(rides)fld(sa.class,"m").set(e,other);if(ridden)fld(sa.class,"l").set(e,other);
      e.am=0;log.setLength(0);portal.a(w,0,11,0,e);boolean inPortal=getb(e,"an");
      log.setLength(0);endPortal.a(w,0,11,0,e);
      System.out.println("{\"kind\":\"collide\",\"riding\":"+rides+",\"ridden\":"+ridden+",\"remote\":"+remote+",\"netherSetsInPortal\":"+inPortal+",\"endEvents\":["+log+"]}");
    }
    // ---- transfer: transferEntityToWorld on the real Teleporter ----
    Random pick=new Random(20261105L);
    int[][] routes={{0,-1},{-1,0},{0,1},{-1,1},{1,0}};
    for(int n=0;n<30;n++){
      int from=routes[n%routes.length][0],to=routes[n%routes.length][1];
      TW over=world(0,1000+n,60),nether=world(-1,1000+n,31),end=world(1,1000+n,40);bindServer(over,nether,end);
      TW src=from==0?over:from==-1?nether:end;
      int target=from==1?0:to; // Entity.travelToDimension sets the End exit's target to the Overworld
      TW dst=target==0?over:target==-1?nether:end;
      boolean portalNearby=n%2==0;
      double ex=pick.nextInt(200)-100+0.5*pick.nextInt(2),ez=pick.nextInt(200)-100+0.5*pick.nextInt(2),ey=src.floor+1+pick.nextInt(3);
      float yaw=pick.nextInt(360);int tdir=pick.nextInt(4);double vx=(pick.nextInt(9)-4)*0.05,vz=(pick.nextInt(9)-4)*0.05;
      List<int[]> blocks=new ArrayList<>();
      if(portalNearby&&target!=1){ // a portal frame at the scaled position
        double sx=target==-1?ex/8:ex*8,sz=target==-1?ez/8:ez*8;int px=(int)Math.floor(sx)+3,pz=(int)Math.floor(sz)-2,py=dst.floor+1;
        for(int i=0;i<2;i++)for(int j=0;j<3;j++)blocks.add(new int[]{px+i,py+j,pz,90});
        for(int i=-1;i<=2;i++)for(int j=-1;j<=3;j++)if(i==-1||i==2||j==-1||j==3){if((j==-1||j==3)&&(i==-1||i==2))continue;blocks.add(new int[]{px+i,py+j,pz,49});}
      }
      for(int[] b:blocks)dst.cells.put(TW.ck(b[0],b[1],b[2]),b[3]);
      TE e=entity(TE.class,src,ex,ey,ez,yaw,vx,vz);fld(sa.class,"aq").set(e,tdir);
      e.ap=target; // set by Entity.travelToDimension before the transfer
      log.setLength(0);
      oi m=(oi)fld(net.minecraft.server.MinecraftServer.class,"u").get(fld(net.minecraft.server.MinecraftServer.class,"j").get(null));
      m.a(e,from,src,dst);
      StringBuilder bl=new StringBuilder();for(int[] b:blocks){if(bl.length()>0)bl.append(',');bl.append(Arrays.toString(b));}
      System.out.println("{\"kind\":\"transfer\",\"index\":"+n+",\"from\":"+from+",\"to\":"+to+",\"seed\":"+qt(""+(1000+n))+",\"blocks\":["+bl+"],\"teleportDirection\":"+tdir
        +",\"before\":["+ex+","+ey+","+ez+","+vx+","+vz+","+yaw+"],\"after\":"+ent(e)+",\"ops\":["+log+"]}");
    }
    // ---- travel: the real Entity.travelToDimension through EntityList.createEntityByName and copyDataFrom ----
    int[][] r2={{0,-1},{-1,0},{0,1},{1,1},{-1,1}}; // the End exit is travelToDimension(1) called inside the End
    for(int n=0;n<30;n++){
      int from=r2[n%5][0],to=r2[n%5][1];
      TW over=world(0,2000+n,60),nether=world(-1,2000+n,31),end=world(1,2000+n,40);bindServer(over,nether,end);
      TW src=from==0?over:from==-1?nether:end;
      double ex=pick.nextInt(200)-100+0.5*pick.nextInt(2),ez=pick.nextInt(200)-100+0.5*pick.nextInt(2),ey=src.floor+1+pick.nextInt(3);
      float yaw=pick.nextInt(360);int tdir=pick.nextInt(4);double vx=(pick.nextInt(9)-4)*0.05,vz=(pick.nextInt(9)-4)*0.05;
      TR e=entity(TR.class,src,ex,ey,ez,yaw,vx,vz);fld(sa.class,"aq").set(e,tdir);
      e.am=300; // Entity.onEntityUpdate sets timeUntilPortal before travelToDimension
      log.setLength(0);
      e.b(to);
      System.out.println("{\"kind\":\"travel\",\"index\":"+n+",\"from\":"+from+",\"to\":"+to+",\"seed\":"+qt(""+(2000+n))
        +",\"before\":["+ex+","+ey+","+ez+","+vx+","+vz+","+yaw+","+tdir+"],\"dead\":"+e.K+",\"ops\":["+log+"]}");
    }
    // ---- nbt: PortalCooldown round trip and copyDataFrom ----
    for(int v:new int[]{0,1,10,299,300}){
      TW w=world(0,1,10);bindServer(w,w,w);TE e=entity(TE.class,w,1.5,11,2.5,45f,0.1,-0.2);e.am=v;
      dh tag=new dh();e.e(tag);
      TE copy=entity(TE.class,w,0,0,0,0,0,0);copy.f(tag);
      TE copy2=entity(TE.class,w,0,0,0,0,0,0);fld(sa.class,"aq").set(e,2);copy2.a(e,true);
      System.out.println("{\"kind\":\"nbt\",\"cooldown\":"+v+",\"tag\":"+tag.f("PortalCooldown")+",\"hasKey\":"+tag.b("PortalCooldown",3)+",\"read\":"+copy.am+",\"copied\":"+copy2.am+",\"copiedDirection\":"+geti(copy2,"aq")+",\"copiedEntity\":"+ent(copy2)+",\"counterAfterRead\":"+geti(copy,"ao")+"}");
    }

    // ---- vehicle: the real EntityMinecartEmpty.onUpdate (xl.h, its own portal section) and EntityBoat.onUpdate (xi.h -> Entity.onUpdate) with their own moveEntity ----
    // Portal blocks at (0, 10..12, 0) are in the world from tick 0 and removed at tick 20; the vehicle rests on the floor inside them.
    // [tick, inPortal block under the vehicle, portalCounter, timeUntilPortal, inPortal flag, travel ops]. ridden: riddenBy set. riding: ridingEntity set.
    for(String vehicle:new String[]{"cart","boat"})for(String mode:new String[]{"enter","ridden","riding","noNether"}){
      TW w=world(0,1,10);bindServer(w,w,w);allowNether=!mode.equals("noNether");
      sa e=vehicle.equals("cart")?new VC(w):new VB(w);e.b(0.5,vehicle.equals("cart")?11.35:11.3,0.5);
      for(int y=10;y<=12;y++)w.cells.put(TW.ck(0,y,0),90);
      if(mode.equals("ridden"))fld(sa.class,"l").set(e,entity(TE.class,w,0,0,0,0,0,0));
      if(mode.equals("riding"))fld(sa.class,"m").set(e,entity(TE.class,w,0,0,0,0,0,0));
      StringBuilder ticks=new StringBuilder();
      for(int t=0;t<40;t++){
        if(t==20)for(int y=10;y<=12;y++)w.cells.remove(TW.ck(0,y,0));
        log.setLength(0);
        if(e instanceof xl)((xl)e).h();else ((xi)e).h();
        String travel=log.toString();
        if(ticks.length()>0)ticks.append(',');
        ticks.append("["+t+","+(t<20)+","+geti(e,"ao")+","+e.am+","+getb(e,"an")+","+qt(travel.isEmpty()?"":travel.replace("\"","'"))+"]");
      }
      System.out.println("{\"kind\":\"vehicle\",\"vehicle\":"+qt(vehicle)+",\"mode\":"+qt(mode)+",\"allowNether\":"+allowNether+",\"maxInPortal\":"+e.D()+",\"cooldown\":"+e.ai()+",\"box\":["+e.C.a+","+e.C.b+","+e.C.c+","+e.C.d+","+e.C.e+","+e.C.f+"],\"ticks\":["+ticks+"]}");
    }
    allowNether=true;
    // ---- cache: one Teleporter per WorldServer outlives its transfers (oi.a(sa,int,mt,mt) asks mt.u(); WorldServer.tick runs removeStalePortalLocations(getTotalWorldTime())) ----
    // Every traveller (mob, item, orb, player) goes through that transfer, so a later entity sees the portal an earlier one used or built, even a broken one.
    // Steps: [time, wipe (every portal block of the destination is removed first), source x, z, yaw, direction] -> entity after the transfer.
    for(int n=0;n<8;n++){
      int from=n%2==0?0:-1,to=from==0?-1:0;
      TW over=world(0,3000+n,60),nether=world(-1,3000+n,31),end=world(1,3000+n,40);bindServer(over,nether,end);
      TW src=from==0?over:nether,dst=to==0?over:nether;
      double ex=pick.nextInt(160)-80+0.5,ez=pick.nextInt(160)-80+0.5;
      List<int[]> blocks=new ArrayList<>();
      if(n%4>=2){double sx=to==-1?ex/8:ex*8,sz=to==-1?ez/8:ez*8;int px=(int)Math.floor(sx)+3,pz=(int)Math.floor(sz)-2,py=dst.floor+1;
        for(int i=0;i<2;i++)for(int j=0;j<3;j++)blocks.add(new int[]{px+i,py+j,pz,90});
        for(int i=-1;i<=2;i++)for(int j=-1;j<=3;j++)if(i==-1||i==2||j==-1||j==3){if((j==-1||j==3)&&(i==-1||i==2))continue;blocks.add(new int[]{px+i,py+j,pz,49});}}
      for(int[] b:blocks)dst.cells.put(TW.ck(b[0],b[1],b[2]),b[3]);
      double[][] plan={{0,0,0,1},{300,1,0,2},{300,1,8,3},{800,0,0,0},{1500,0,0,1},{1500,0,0,2}}; // {time, wipe, x offset (source blocks), direction}
      long clock=0;StringBuilder steps=new StringBuilder();
      oi m=(oi)fld(net.minecraft.server.MinecraftServer.class,"u").get(fld(net.minecraft.server.MinecraftServer.class,"j").get(null));
      for(double[] st:plan){
        long target=(long)st[0];
        for(long t=(clock/100+1)*100;t<=target;t+=100){over.time=nether.time=end.time=t;dst.tele.a(t);}
        over.time=nether.time=end.time=target;clock=target;
        if(st[1]==1)dst.cells.replaceAll((k,v)->v==90?0:v);
        float yaw=pick.nextInt(360);int tdir=(int)st[3];
        TE e=entity(TE.class,src,ex+st[2],src.floor+1,ez,yaw,0,0);fld(sa.class,"aq").set(e,tdir);e.ap=to;
        m.a(e,from,src,dst);
        if(steps.length()>0)steps.append(',');
        TreeSet<String> pcs=new TreeSet<>();for(Map.Entry<String,Integer> c:dst.cells.entrySet())if(c.getValue()==90)pcs.add("\""+c.getKey()+"\"");
        steps.append("["+(long)st[0]+","+(int)st[1]+","+(ex+st[2])+","+ez+","+yaw+","+tdir+","+ent(e)+",["+String.join(",",pcs)+"]]");
      }
      StringBuilder bl=new StringBuilder();for(int[] b:blocks){if(bl.length()>0)bl.append(',');bl.append(Arrays.toString(b));}
      System.out.println("{\"kind\":\"cache\",\"index\":"+n+",\"from\":"+from+",\"to\":"+to+",\"seed\":"+qt(""+(3000+n))+",\"blocks\":["+bl+"],\"steps\":["+steps+"]}");
    }
  }
}
