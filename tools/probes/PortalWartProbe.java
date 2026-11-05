import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 BlockPortal (amp) with its Size scan (amq), and BlockNetherWart (amf), driven on real Chunk storage through
// SpringProbe.G (real World.setBlock/notify code; sound, drops and scheduled ticks recorded). Records:
//   frame:  func_150000_e (amp.e) on an obsidian frame spec with defects, then the cells it wrote; and onNeighborBlockChange
//           cascades after a frame/portal block is removed.
//   bounds: setBlockBoundsBasedOnState per meta for both axes, and shouldSideBeRendered per side next to portal/other blocks.
//   pigman: BlockPortal.updateTick over many ticks on one column (nextInt(2000) < difficulty, the solid-top scan, the spawn).
//   wart:   updateTick growth sequences, support loss, canBlockStay/canPlaceBlockAt and dropBlockAsItemWithChance.
public class PortalWartProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static final int OBS=49,PORTAL=90,FIRE=51,WART=115,SOUL=88,NETHERRACK=87,FLOOR_Y=10;
  public static class P extends SpringProbe.G {
    StringBuilder spawned=new StringBuilder();
    public boolean d(sa e){
      if(e instanceof xk)return super.d(e);
      if(spawned.length()>0)spawned.append(',');spawned.append("["+e.s+","+e.t+","+e.u+","+PortalWartProbe.q(e.getClass().getName())+"]");return true;}
  }
  static P world(long worldRand,int difficulty)throws Exception{
    P w=SpringProbe.world(P.class,0,worldRand);w.spawned=new StringBuilder();
    TerrainProbe.field(ahb.class,"r").set(w,rd.a(difficulty));TerrainProbe.field(ahb.class,"J").set(w,java.util.Calendar.getInstance());TerrainProbe.field(ahb.class,"x").set(w,TerrainProbe.unsafe.allocateInstance(ays.class));
    for(int cx=-2;cx<=2;cx++)for(int cz=-2;cz<=2;cz++){aji[] b=new aji[65536];byte[] m=new byte[65536];
      for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<=FLOOR_Y;y++)b[(x*16+z)*256+y]=aji.e(NETHERRACK);
      SpringProbe.chunk(w,cx,cz,b,m);}
    return w;
  }
  static void put(P w,int x,int y,int z,int id,int meta){w.d(x,y,z,id==0?ajn.a:aji.e(id),meta,2);}
  static String cells(P w,int x0,int y0,int z0,int x1,int y1,int z1){
    StringBuilder s=new StringBuilder("[");
    for(int x=x0;x<=x1;x++)for(int y=y0;y<=y1;y++)for(int z=z0;z<=z1;z++){int id=aji.b(w.a(x,y,z));if(id==0||id==OBS&&false)continue;
      if(s.length()>1)s.append(',');s.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(id).append(',').append(w.e(x,y,z)).append(']');}
    return s.append(']').toString();}
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();akx.M=true;
    amp portal=(amp)aji.e(90);amf wart=(amf)aji.e(115);
    if(aji.b(portal)!=PORTAL||aji.b(wart)!=WART)throw new AssertionError("ids");
    Random pick=new Random(20261105L);
    // ---- frames ----
    int records=0;
    for(int r=0;r<260;r++){
      int axis=pick.nextInt(2),w=2+pick.nextInt(r%13==0?20:5),h=3+pick.nextInt(r%13==0?19:5);
      if(r%13==0&&pick.nextBoolean()){w=2+pick.nextInt(24);h=3+pick.nextInt(24);}
      int mode=r%9,bx=pick.nextInt(9)-4,by=14+pick.nextInt(6),bz=pick.nextInt(9)-4;
      // interior spans (w x h); frame ring around. axis 0: along x (meta 1), axis 1: along z (meta 2). Interior origin bx,by,bz.
      int[] u=axis==0?new int[]{1,0}:new int[]{0,1};
      List<int[]> init=new ArrayList<>();
      for(int i=-1;i<=w;i++)for(int j=-1;j<=h;j++){boolean edge=i==-1||i==w||j==-1||j==h;
        boolean corner=(i==-1||i==w)&&(j==-1||j==h);
        if(edge&&!corner)init.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,OBS,0});}
      // defects
      List<int[]> over=new ArrayList<>();
      if(mode==1&&!init.isEmpty()){int[] c=init.get(pick.nextInt(init.size()));over.add(new int[]{c[0],c[1],c[2],0,0});}
      if(mode==2){int i=pick.nextInt(w),j=pick.nextInt(h);over.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,1,0});}
      if(mode==3){int i=pick.nextInt(w),j=pick.nextInt(h);over.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,FIRE,0});}
      if(mode==4&&!init.isEmpty()){int[] c=init.get(pick.nextInt(init.size()));over.add(new int[]{c[0],c[1],c[2],87,0});}
      if(mode==5){int i=pick.nextInt(w),j=pick.nextInt(h);over.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,PORTAL,1+axis});}
      if(mode==6){int i=pick.nextInt(w),j=pick.nextInt(h);over.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,PORTAL,2-axis});}
      if(mode==7){int i=pick.nextInt(w),j=pick.nextInt(h);over.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i,8,0});}
      if(mode==8){ // add a stray block just outside the frame (adjacent), harmless
        over.add(new int[]{bx+u[0]*(-2),by,bz+u[1]*(-2),OBS,0});}
      // fire block interior start
      int qi=pick.nextInt(3)==0?pick.nextInt(w):0,qj=pick.nextInt(3)==0?pick.nextInt(h):0;
      int qx=bx+u[0]*qi,qy=by+qj,qz=bz+u[1]*qi;
      if(pick.nextInt(12)==0){qx+=pick.nextInt(3)-1;qy+=pick.nextInt(3)-1;qz+=pick.nextInt(3)-1;}
      P world=world(r,2);
      // Fire goes in first (its onBlockAdded runs func_150000_e before the frame exists, so nothing lights); the frame and defects
      // follow with flags 2, then func_150000_e is called directly. A defect of fire/portal type is placed later and may light itself:
      // the recorded "before" list is the true state either way.
      if(r%2==0)put(world,qx,qy,qz,FIRE,0);
      for(int[] c:init)put(world,c[0],c[1],c[2],c[3],c[4]);
      for(int[] c:over)put(world,c[0],c[1],c[2],c[3],c[4]);
      int boxX0=Math.min(bx,bx+u[0]*w)-3,boxX1=Math.max(bx,bx+u[0]*w)+3,boxZ0=Math.min(bz,bz+u[1]*w)-3,boxZ1=Math.max(bz,bz+u[1]*w)+3;
      String before=cells(world,boxX0,FLOOR_Y+1,boxZ0,boxX1,by+h+3,boxZ1);
      int wc0=world.writeCount;
      boolean ok=portal.e(world,qx,qy,qz);
      String after=cells(world,boxX0,FLOOR_Y+1,boxZ0,boxX1,by+h+3,boxZ1);
      System.out.println("{\"kind\":\"frame\",\"index\":"+r+",\"axis\":"+axis+",\"w\":"+w+",\"h\":"+h+",\"origin\":["+bx+","+by+","+bz+"],\"query\":["+qx+","+qy+","+qz+"],\"before\":"+before+",\"result\":"+ok+",\"after\":"+after+",\"writes\":"+(world.writeCount-wc0)+",\"sounds\":["+world.sounds+"]}");
      records++;
      if(ok){ // neighbour-change cascade: remove one block (frame, portal, or add a block into the portal), then notify like World.setBlock does
        int kind=r%4;List<int[]> pc=new ArrayList<>();
        for(int i=0;i<w;i++)for(int j=0;j<h;j++)pc.add(new int[]{bx+u[0]*i,by+j,bz+u[1]*i});
        int[] t;
        if(kind==0||kind==3)t=init.get(pick.nextInt(init.size()));else t=pc.get(pick.nextInt(pc.size()));
        // only blocks that were written/kept as frame
        if(aji.b(world.a(t[0],t[1],t[2]))==0||(kind<3&&aji.b(world.a(t[0],t[1],t[2]))!=OBS&&aji.b(world.a(t[0],t[1],t[2]))!=PORTAL))continue;
        int newId=kind==3?1:0;
        P w2=world;
        w2.d(t[0],t[1],t[2],newId==0?ajn.a:aji.e(newId),0,3);
        String after2=cells(world,boxX0,FLOOR_Y+1,boxZ0,boxX1,by+h+3,boxZ1);
        System.out.println("{\"kind\":\"cascade\",\"index\":"+r+",\"target\":["+t[0]+","+t[1]+","+t[2]+"],\"replacement\":"+newId+",\"after\":"+after2+"}");
        records++;
      }
    }
    // ---- bounds and render sides ----
    for(int meta=0;meta<16;meta++){
      P w=world(1,2);put(w,0,20,0,PORTAL,meta);
      portal.a((ahl)w,0,20,0);
      System.out.println("{\"kind\":\"bounds\",\"meta\":"+meta+",\"bounds\":["+portal.x()+","+portal.y()+","+portal.z()+","+portal.A()+","+portal.B()+","+portal.C()+"]}");records++;
      amf.class.getName();
      wart.a((ahl)w,0,20,0);
      if(meta==0)System.out.println("{\"kind\":\"wartBounds\",\"bounds\":["+wart.x()+","+wart.y()+","+wart.z()+","+wart.A()+","+wart.B()+","+wart.C()+"],\"light\":"+portal.k()+"}");
    }
    // shouldSideBeRendered: neighbour of each type on each side at both axes
    int[] nbIds={0,PORTAL,OBS,1,20,FIRE};
    for(int meta=1;meta<=2;meta++)for(int nb:nbIds)for(int side=0;side<6;side++){
      P w=world(2,2);put(w,0,20,0,PORTAL,meta);
      int[][] d={{0,-1,0},{0,1,0},{0,0,-1},{0,0,1},{-1,0,0},{1,0,0}};
      int nx=-d[side][0]*0,ny=0;
      // side s is the face being tested at (x,y,z) = the block adjacent to that face; the probed cell is the neighbour cell, the portal is the opposite cell
      int cx=d[side][0],cy=20+d[side][1],cz=d[side][2];
      // portal.a(ahl,x,y,z,side) tests the face of the block at x,y,z toward 'side'; the block at x,y,z is the neighbour, facing the portal
      // so place nb at (cx,cy,cz)... the portal is then at side direction opposite
      put(w,cx,cy,cz,nb,nb==PORTAL?meta:0);
      boolean res=portal.a((ahl)w,cx,cy,cz,side);
      System.out.println("{\"kind\":\"side\",\"meta\":"+meta+",\"neighbour\":"+nb+",\"side\":"+side+",\"result\":"+res+"}");records++;
    }
    // ---- pigman spawn chance ----
    for(int r=0;r<14;r++){
      int diff=r%4;long seed=pick.nextLong();
      P w=world(100+r,diff);
      // fixture column x=0,z=0 starting at y=20; r selects the structure below
      int variant=r%7;
      List<int[]> cs=new ArrayList<>();
      int[][] vs={{},{12,1,0},{12,20,0},{12,44,0},{12,44,8},{19,1,0},{15,87,0}};
      if(variant>0)cs.add(vs[variant]);
      if(variant==5)cs.add(new int[]{12,20,0});
      if(r>=7)cs.add(new int[]{21,1,0}); // block above the landing cell
      for(int[] c:cs)put(w,0,c[0],0,c[1],c[2]);
      if(r>=10)for(int y=11;y<=FLOOR_Y+30;y++)put(w,0,y,0,y==21||y==30?0:0,0);
      if(r%3==1)put(w,0,FLOOR_Y+1,0,1,0);
      put(w,0,20,0,PORTAL,1);
      if(r==13)w.rules.a("doMobSpawning","false");
      Random rnd=new Random(seed);StringBuilder ticks=new StringBuilder("[");int n=30000;
      for(int t=0;t<n;t++){int before=w.spawned.length();portal.a(w,0,20,0,rnd);
        if(w.spawned.length()!=before){if(ticks.length()>1)ticks.append(',');ticks.append(t);}}
      System.out.println("{\"kind\":\"pigman\",\"difficulty\":"+diff+",\"seed\":"+q(""+seed)+",\"column\":"+Arrays.deepToString(cs.toArray(new int[0][]))+",\"floor1\":"+(r%3==1)+",\"doMobSpawning\":"+(r!=13)+",\"clear\":"+(r>=10)+",\"ticks\":"+n+",\"spawnTicks\":"+ticks+"],\"spawned\":["+w.spawned+"],\"nextLong\":"+q(""+rnd.nextLong())+"}");records++;
    }
    // ---- nether wart ----
    for(int r=0;r<40;r++){
      long seed=pick.nextLong();int meta0=r%4;
      P w=world(200+r,2);put(w,0,FLOOR_Y,0,SOUL,0);put(w,0,FLOOR_Y+1,0,WART,meta0);
      Random rnd=new Random(seed);StringBuilder seq=new StringBuilder("[");
      for(int t=0;t<200;t++){wart.a(w,0,FLOOR_Y+1,0,rnd);if(t>0)seq.append(',');seq.append(aji.b(w.a(0,FLOOR_Y+1,0))==WART?w.e(0,FLOOR_Y+1,0):-1);}
      System.out.println("{\"kind\":\"wartGrowth\",\"seed\":"+q(""+seed)+",\"meta\":"+meta0+",\"metas\":"+seq+"],\"nextLong\":"+q(""+rnd.nextLong())+"}");records++;
    }
    // support: below blocks and place checks
    for(int below:new int[]{0,1,2,3,SOUL,NETHERRACK,12,13,60,88,87,11,10}){
      P w=world(300,2);put(w,0,FLOOR_Y,0,below,0);
      boolean stay=wart.j(w,0,FLOOR_Y+1,0),place=wart.c(w,0,FLOOR_Y+1,0);
      put(w,0,FLOOR_Y+1,0,WART,2);
      Random rnd=new Random(below+17);wart.a(w,0,FLOOR_Y+1,0,rnd);
      String dropped=w.drops.toString();int id=aji.b(w.a(0,FLOOR_Y+1,0));
      System.out.println("{\"kind\":\"wartSupport\",\"below\":"+below+",\"canBlockStay\":"+stay+",\"canPlaceBlockAt\":"+place+",\"afterTickBlock\":"+id+",\"drops\":["+dropped+"],\"nextLong\":"+q(""+rnd.nextLong())+",\"worldRand\":"+q(""+w.s.nextLong())+"}");records++;
    }
    // placement over occupied cells
    for(int occ:new int[]{0,31,8,9,78,1,51,106}){
      P w=world(310,2);put(w,0,FLOOR_Y,0,SOUL,0);put(w,0,FLOOR_Y+1,0,occ,0);
      System.out.println("{\"kind\":\"wartPlace\",\"occupant\":"+occ+",\"canPlaceBlockAt\":"+wart.c(w,0,FLOOR_Y+1,0)+"}");records++;
    }
    // drops
    for(int meta=0;meta<4;meta++)for(int fortune=0;fortune<4;fortune++)for(int k=0;k<6;k++){
      long ws=meta*1000+fortune*100+k;P w=world(ws,2);
      wart.a(w,0,FLOOR_Y+1,0,meta,1.0f,fortune);
      System.out.println("{\"kind\":\"wartDrops\",\"meta\":"+meta+",\"fortune\":"+fortune+",\"worldRand\":"+q(""+ws)+",\"drops\":["+w.drops+"],\"nextLong\":"+q(""+w.s.nextLong())+"}");records++;
    }
    System.out.println("{\"kind\":\"summary\",\"records\":"+records+"}");
  }
}
