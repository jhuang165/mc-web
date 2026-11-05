import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 Teleporter (ahp) on a sparse WorldServer double (mt subclass allocated without its constructor), WorldProviderHell (aqp),
// WorldProviderEnd (aqr), WorldProvider (aqo) tables, Direction (p) arrays, Entity.setInPortal (sa.ah), EntityPlayer.getMaxInPortalTime (yz.D)
// and getPortalCooldown (ai). Records: provider, direction, timing, setInPortal, teleport.
public class DimensionProbe {
  static String q(String s){return "\""+s+"\"";}
  static sun.misc.Unsafe U;
  static ays INFO;
  static Field fld(Class<?> c,String n)throws Exception{for(;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}catch(NoSuchFieldException e){}throw new NoSuchFieldException(n);}
  // Sparse world: default cell from the fixture (stone below `floor`, lava in boxes, air above), explicit overrides in `cells`.
  public static class TW extends mt {
    TW(){super(null,null,null,0,null,null);}
    long seed,time;int floor;List<int[]> lava=new ArrayList<>();Map<String,Integer> cells=new HashMap<>();
    StringBuilder writes=new StringBuilder(),notes=new StringBuilder();
    static String ck(int x,int y,int z){return x+","+y+","+z;}
    int id(int x,int y,int z){Integer v=cells.get(ck(x,y,z));if(v!=null)return v;
      if(y<0)return 0;if(y<=floor){for(int[] b:lava)if(x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3])return 11;return 1;}return 0;}
    public aji a(int x,int y,int z){int i=id(x,y,z);return i==0?ajn.a:aji.e(i);}
    public int e(int x,int y,int z){return 0;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){if(y<0||y>=256)return false;cells.put(ck(x,y,z),aji.b(b));
      if(writes.length()>0)writes.append(',');writes.append("["+x+","+y+","+z+","+aji.b(b)+","+meta+","+flags+"]");return true;}
    public boolean b(int x,int y,int z,aji b){return d(x,y,z,b,0,3);}
    public void d(int x,int y,int z,aji b){if(notes.length()>0)notes.append(',');notes.append("["+x+","+y+","+z+"]");}
    public ays N(){return INFO;}
    public long H(){return seed;} public long I(){return time;}
  }
  public static class TE extends sa {
    TE(){super((ahb)null);}
    protected void c(){} protected void a(dh d){} protected void b(dh d){}
  }
  public static class TP extends yz {
    TP(){super(null,null);}
    public void a(fj f){} public boolean a(int i,String t){return true;} public r f_(){return null;}
  }
  static TW world(int dim,long seed,int floor)throws Exception{
    TW w=(TW)U.allocateInstance(TW.class);w.seed=seed;w.floor=floor;w.cells=new HashMap<>();w.lava=new ArrayList<>();w.writes=new StringBuilder();w.notes=new StringBuilder();
    aqo p=(aqo)U.allocateInstance(dim==-1?aqp.class:dim==1?aqr.class:aqq.class);fld(aqo.class,"h").set(p,new float[16]);fld(aqo.class,"j").set(p,new float[4]);fld(ahb.class,"t").set(w,p);p.a(w);return w;}
  static TE entity(double x,double y,double z,float yaw,double vx,double vz)throws Exception{
    TE e=(TE)U.allocateInstance(TE.class);fld(sa.class,"C").set(e,azt.a(0,0,0,0,0,0));e.s=x;e.t=y;e.u=z;e.y=yaw;e.v=vx;e.x=vz;return e;}
  static String ent(TE e){return "["+e.s+","+e.t+","+e.u+","+e.v+","+e.w+","+e.x+","+e.y+","+e.z+"]";}
  static String arr(int[] a){return Arrays.toString(a);}
  static String fl(float[] a){StringBuilder s=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)s.append(',');s.append(a[i]);}return s.append(']').toString();}
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);U=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();INFO=(ays)U.allocateInstance(ays.class);
    // ---- direction ----
    System.out.println("{\"kind\":\"direction\",\"offsetX\":"+arr(p.a)+",\"offsetZ\":"+arr(p.b)+",\"rotateOpposite\":"+arr(p.f)+",\"rotateRight\":"+arr(p.g)+",\"rotateLeft\":"+arr(p.h)+"}");
    StringBuilder md=new StringBuilder();
    double[] ds={0,1,-1,0.5,-0.5,3,-3};
    for(double dx:ds)for(double dz:ds){if(md.length()>0)md.append(',');md.append("["+dx+","+dz+","+p.a(dx,dz)+"]");}
    System.out.println("{\"kind\":\"movementDirection\",\"cases\":["+md+"]}");
    // ---- providers ----
    for(int dim=-1;dim<=1;dim++){
      aqo p=world(dim,1,10).t;
      StringBuilder ang=new StringBuilder(),fog=new StringBuilder();
      for(long t:new long[]{0,6000,12000,18000,23999}){if(ang.length()>0)ang.append(',');ang.append("["+t+","+p.a(t,0f)+"]");}
      if(dim!=0)for(float a2:new float[]{0f,0.25f,0.5f,0.75f,1f}){azw v=p.b(a2,1f);if(fog.length()>0)fog.append(',');fog.append("["+a2+","+v.a+","+v.b+","+v.c+"]");}
      System.out.println("{\"kind\":\"provider\",\"dimension\":"+dim+",\"id\":"+p.i+",\"hasNoSky\":"+p.f+",\"isHellWorld\":"+p.g+",\"canRespawnHere\":"+p.d()+",\"isSurfaceWorld\":"+p.e()+",\"cloudHeight\":"+p.f()
        +",\"lightTable\":"+fl(p.h)+",\"celestial\":["+ang+"],\"fog\":["+fog+"],\"entrance\":"+(dim==1?"["+p.h().a+","+p.h().b+","+p.h().c+"]":"null")+",\"averageGroundLevel\":"+p.i()+",\"name\":"+q(p.l())+"}");
    }
    // ---- timing ----
    for(boolean creative:new boolean[]{false,true}){
      yz pl=(yz)U.allocateInstance(TP.class);yw cap=new yw();cap.a=creative;fld(yz.class,"bE").set(pl,cap);
      TE en=entity(0,0,0,0,0,0);
      System.out.println("{\"kind\":\"timing\",\"creative\":"+creative+",\"playerMaxInPortal\":"+pl.D()+",\"playerCooldown\":"+pl.ai()+",\"entityMaxInPortal\":"+en.D()+",\"entityCooldown\":"+en.ai()+"}");
    }
    // ---- setInPortal ----
    Random r=new Random(7);
    for(int i=0;i<60;i++){
      boolean player=i%2==0;sa e=player?(yz)U.allocateInstance(TP.class):entity(0,0,0,0,0,0);
      if(player){fld(yz.class,"bE").set(e,new yw());fld(sa.class,"C").set(e,azt.a(0,0,0,0,0,0));}
      ahb w=world(0,1,10);fld(sa.class,"o").set(e,w);
      int until=r.nextInt(3)==0?r.nextInt(400):0;boolean inP=r.nextInt(4)==0;int tdir=r.nextInt(4);
      e.am=until;fld(sa.class,"an").set(e,inP);
      double px=r.nextInt(7)-3,pz=r.nextInt(7)-3,x=r.nextInt(7)-3,z=r.nextInt(7)-3;
      e.p=px;e.r=pz;e.s=x;e.u=z;fld(sa.class,"aq").set(e,tdir);
      e.ah();
      System.out.println("{\"kind\":\"setInPortal\",\"player\":"+player+",\"until\":"+until+",\"inPortal\":"+inP+",\"teleportDirection\":"+tdir+",\"prev\":["+px+","+pz+"],\"pos\":["+x+","+z+"],\"afterUntil\":"+e.am+",\"afterInPortal\":"+fld(sa.class,"an").get(e)+",\"afterDirection\":"+fld(sa.class,"aq").get(e)+"}");
    }
    // ---- teleport ----
    Random pick=new Random(20261105L);
    for(int n=0;n<36;n++){
      int dim=n%3==2?1:(n%2==0?-1:0); // destination dimension of the teleporter's world
      int mode=n%6; // 0 portal nearby (north side), 1 portal far, 2 none (open floor), 3 none (lava lake near), 4 portal boxed in, 5 none and no floor near
      int floor=dim==-1?31:(40+pick.nextInt(25));
      long seed=1000+n*37L;
      TW w=world(dim,seed,floor);
      double ex=pick.nextInt(60)-30+0.5*pick.nextInt(2),ey=floor+1+pick.nextInt(4),ez=pick.nextInt(60)-30+0.5*pick.nextInt(2);
      float yaw=pick.nextInt(360);int tdir=pick.nextInt(4);double vx=pick.nextInt(5)-2,vz=pick.nextInt(5)-2;
      StringBuilder spec=new StringBuilder();
      List<int[]> blocks=new ArrayList<>();
      if(dim!=1){
        if(mode==0||mode==1||mode==4){
          int d=mode==1?60+pick.nextInt(50):2+pick.nextInt(10);int px=(int)ex+d*(pick.nextBoolean()?1:-1),pz=(int)ez+pick.nextInt(7)-3,axis=pick.nextInt(2),py=floor+1;
          for(int i=0;i<2;i++)for(int j=0;j<3;j++)blocks.add(new int[]{px+(axis==0?i:0),py+j,pz+(axis==1?i:0),90});
          for(int i=-1;i<=2;i++)for(int j=-1;j<=3;j++)if(i==-1||i==2||j==-1||j==3){if(j==-1&&(i==-1||i==2)||j==3&&(i==-1||i==2))continue;blocks.add(new int[]{px+(axis==0?i:0),py+j,pz+(axis==1?i:0),49});}
          if(mode==4){ // walls around: the safe side logic faces solid blocks on both sides
            for(int i=-1;i<=2;i++)for(int j=0;j<3;j++){int[] o=axis==0?new int[]{0,0,1}:new int[]{1,0,0};for(int s=-1;s<=1;s+=2)blocks.add(new int[]{px+(axis==0?i:0)+o[0]*s,py+j,pz+(axis==1?i:0)+o[2]*s,1});}
          }
          if(mode==0&&pick.nextBoolean()){ // second, farther portal
            int px2=px+9,pz2=pz+9;for(int i=0;i<2;i++)for(int j=0;j<3;j++)blocks.add(new int[]{px2+i,py+j,pz2,90});}
        }
        if(mode==3){int bx=(int)ex-10,bz=(int)ez-10;w.lava.add(new int[]{bx-20,bz-20,bx+40,bz+40});}
        if(mode==5){w.lava.add(new int[]{-100,-100,100,100});}
        if(mode==2&&pick.nextBoolean()){for(int i=0;i<6;i++)blocks.add(new int[]{(int)ex+pick.nextInt(9)-4,floor+1+pick.nextInt(4),(int)ez+pick.nextInt(9)-4,1});}
      }
      for(int[] b:blocks)w.cells.put(TW.ck(b[0],b[1],b[2]),b[3]);
      ahp t=new ahp(w);
      TE e=entity(ex,ey,ez,yaw,vx,vz);fld(sa.class,"aq").set(e,tdir);
      String before=ent(e);
      t.a(e,ex+100,ey,ez-100,yaw);
      String first=ent(e)+","+0;
      String wr=w.writes.toString(),nt=w.notes.toString();
      // second call: cached destination (or the freshly built portal)
      w.writes.setLength(0);w.notes.setLength(0);
      TE e2=entity(ex,ey,ez,yaw,vx,vz);fld(sa.class,"aq").set(e2,tdir);
      t.a(e2,ex,ey,ez,yaw);
      StringBuilder bl=new StringBuilder();for(int[] b:blocks){if(bl.length()>0)bl.append(',');bl.append(Arrays.toString(b));}
      StringBuilder lv=new StringBuilder();for(int[] b:w.lava){if(lv.length()>0)lv.append(',');lv.append(Arrays.toString(b));}
      System.out.println("{\"kind\":\"teleport\",\"index\":"+n+",\"dimension\":"+dim+",\"mode\":"+mode+",\"seed\":"+q(""+seed)+",\"floor\":"+floor+",\"lava\":["+lv+"],\"blocks\":["+bl+"],\"entity\":"+before+",\"teleportDirection\":"+tdir
        +",\"first\":{\"entity\":"+ent(e)+",\"writes\":["+wr+"],\"notifies\":["+nt+"]},\"second\":{\"entity\":"+ent(e2)+",\"writes\":["+w.writes+"],\"notifies\":["+w.notes+"]}}");
    }
  }
}
