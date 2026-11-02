import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Executes unchanged WorldGenLakes. World services are explicit test doubles.
public class LakeProbe {
  static class W extends PopulationProbe.W {
    boolean building; int ground; MessageDigest calls; int callCount;
    void call(int type,int... values){callCount++;for(int v:valuesWithType(type,values))for(int s=0;s<32;s+=8)calls.update((byte)(v>>s));}
    int[] valuesWithType(int t,int[] vs){int[] a=new int[vs.length+1];a[0]=t;System.arraycopy(vs,0,a,1,vs.length);return a;}
    public aji a(int x,int y,int z){call(0,x,y,z);if(y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000)return aji.e(0);aji b=edits.get(PopulationProbe.key(x,y,z));if(b!=null)return b;
      if(fixture.equals("natural")){aji[] c=chunks.get((x>>4)+","+(z>>4));if(c==null)throw new AssertionError("Missing chunk "+x+","+z);b=c[((x&15)*16+(z&15))*256+y];return b==null?aji.e(0):b;}
      int id=1;
      if(fixture.equals("air"))id=0;
      else if(fixture.equals("water"))id=9;
      else if(fixture.equals("flowingWater"))id=8;
      else if(fixture.equals("lava"))id=11;
      else if(fixture.equals("flowingLava"))id=10;
      else if(fixture.equals("hollow"))id=Math.floorMod(x+z,5)==0?0:1;
      else if(fixture.equals("plants"))id=Math.floorMod(x+z,5)==0?31:1;
      else if(fixture.equals("lowerWater"))id=y<ground?9:1;
      else if(fixture.equals("lowerLava"))id=y<ground?11:1;
      else if(!fixture.equals("solid"))id=y>ground?0:y>=ground-3?3:1;
      return aji.e(id);
    }
    public boolean c(int x,int y,int z){return a(x,y,z)==aji.e(0);}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(1,x,y,z,aji.b(b),meta,flags);return super.d(x,y,z,b,meta,flags);}
    public int b(ahn light,int x,int y,int z){if(light!=ahn.a)throw new AssertionError();call(2,x,y,z);return fixture.equals("dark")?0:15;}
    public ahu a(int x,int z){if(building)return manager.a(x,z);call(3,x,z);return fixture.equals("mycelium")?ahu.C:ahu.q;}
    public boolean r(int x,int y,int z){call(4,x,y,z);return fixture.equals("cold")&&Math.floorMod(x+z,3)==0;}
  }
  static void run(long seed,String fixture,int liquid,int x,int y,int z)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.fixture=fixture;w.ground=Math.min(y,64);w.edits=new HashMap<>();w.writes=new StringBuilder("[");w.calls=MessageDigest.getInstance("SHA-1");
    Random r=new Random(seed);boolean ok=new arx(aji.e(liquid)).a(w,r,x,y,z);
    System.out.println("{\"seed\":"+TerrainProbe.q(""+seed)+",\"fixture\":"+TerrainProbe.q(fixture)+",\"liquid\":"+liquid+",\"pos\":["+x+","+y+","+z+"],\"result\":"+ok+",\"writes\":"+w.writes+"],\"callCount\":"+w.callCount+",\"callSha1\":"+TerrainProbe.q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+TerrainProbe.q(""+r.nextLong())+"}");
  }
  static void natural(long seed,int cx,int cz,int liquid)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.fixture="natural";w.seed=seed;w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.edits=new HashMap<>();w.chunks=new HashMap<>();w.writes=new StringBuilder("[");w.calls=MessageDigest.getInstance("SHA-1");
    w.building=true;TerrainProbe.resetMesa();aqz terrain=new aqz(w,seed,false);aqw caves=new aqw();aqs ravines=new aqs();StringBuilder inputs=new StringBuilder("[");
    for(int x=cx;x<=cx+1;x++)for(int z=cz;z<=cz+1;z++){
      aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
      axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,w.manager.b(null,x*16,z*16,16,16));caves.a(null,w,x,z,blocks);ravines.a(null,w,x,z,blocks);w.chunks.put(x+","+z,blocks);
      if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(TerrainProbe.q(TerrainProbe.hash(blocks))).append(']');
    }
    w.building=false;Random r=new Random(1234);int x=cx*16+16,z=cz*16+16,y=80;boolean ok=new arx(aji.e(liquid)).a(w,r,x,y,z);
    System.out.println("{\"seed\":\"1234\",\"worldSeed\":"+TerrainProbe.q(""+seed)+",\"fixture\":\"natural\",\"liquid\":"+liquid+",\"pos\":["+x+","+y+","+z+"],\"inputs\":"+inputs+"],\"result\":"+ok+",\"writes\":"+w.writes+"],\"callCount\":"+w.callCount+",\"callSha1\":"+TerrainProbe.q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+TerrainProbe.q(""+r.nextLong())+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();
    Set<String> materialClasses=new TreeSet<>();StringBuilder materials=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(b==null)continue;materialClasses.add(b.o().getClass().getName());if(materials.length()>1)materials.append(',');materials.append('[').append(id).append(',').append(b.o().a()).append(',').append(b.o().d()).append(']');}StringBuilder mc=new StringBuilder("[");for(String name:materialClasses){if(mc.length()>1)mc.append(',');mc.append(TerrainProbe.q(name));}System.out.println("{\"materials\":"+materials+"],\"materialClasses\":"+mc+"]}");
    for(long seed:new long[]{0,1,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE}){
      for(String fixture:new String[]{"solid","surface","dark","mycelium","cold","air","water","flowingWater","lava","flowingLava","hollow","plants","lowerWater","lowerLava"})for(int liquid:new int[]{9,11})for(int[] p:new int[][]{{0,70,0},{-17,12,29}})run(seed,fixture,liquid,p[0],p[1],p[2]);
      for(String fixture:new String[]{"lowerWater","lowerLava"})for(int liquid:new int[]{8,10})for(int[] p:new int[][]{{0,70,0},{-17,12,29}})run(seed,fixture,liquid,p[0],p[1],p[2]);
      for(int liquid:new int[]{8,9,10,11})for(int[] p:new int[][]{{0,4,0},{0,5,0},{0,255,0},{29999999,64,-29999999},{-30000000,64,23}})run(seed,"surface",liquid,p[0],p[1],p[2]);
    }
    for(long seed:new long[]{0,8675309,-123456789})for(int[] c:new int[][]{{0,0},{-17,29}})for(int liquid:new int[]{9,11})natural(seed,c[0],c[1],liquid);
  }
}
