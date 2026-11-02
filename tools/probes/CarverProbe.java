import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
// Uses TerrainProbe's World/registry helpers; runs unchanged MapGenBase/Caves/Ravine.
public class CarverProbe {
  public static class W extends TerrainProbe.W {
    public ahu a(int x,int z){return manager.a(x,z);}
  }
  public static class Trace extends aqx {
    StringBuilder rows = new StringBuilder("[");
    protected void a(ahb w,int x,int z,int cx,int cz,aji[] blocks) {
      if(rows.length()>1)rows.append(',');
      rows.append('[').append(x).append(',').append(z).append(',').append(TerrainProbe.q(""+b.nextLong())).append(']');
    }
  }
  static W world(long seed,ahm type)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.manager=new aib(seed,type);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}return w;
  }
  static aji[] fixture(String name){
    aji[] a=new aji[65536];
    for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<=(name.equals("ceiling")?255:100);y++){
      int id=y<=3?7:y==80?2:y>76&&y<80?3:1;
      if(name.equals("materials"))id=new int[]{1,12,2,24,3,159,1,172,2,7,3,110,1,20,3,0}[z];
      if(name.startsWith("water")&&x==8&&y>=15&&y<=90)id=name.equals("water8")?8:9;
      a[(x*16+z)*256+y]=id==0?null:aji.e(id);
    }return a;
  }
  static String runtimeHash(aji[] a)throws Exception {
    java.security.MessageDigest h=java.security.MessageDigest.getInstance("SHA-1");
    for(aji b:a){int id=b==null?0:aji.b(b);if(id==8)id=9;if(id==10)id=11;h.update((byte)id);h.update((byte)(id>>8));}return TerrainProbe.hex(h.digest());
  }
  static String changes(aji[] before,aji[] after){
    StringBuilder s=new StringBuilder("[");for(int i=0;i<after.length;i++)if(before[i]!=after[i]){if(s.length()>1)s.append(',');s.append('[').append(i).append(',').append(after[i]==null?0:aji.b(after[i])).append(']');}return s.append(']').toString();
  }
  static void tunnel(String kind,String fixture,long seed,int x,int z,double px,double py,double pz,float width,float yaw,float pitch,int start,int end,double vertical)throws Exception{
    W w=world(8675309,ahm.b);aqx gen=kind.equals("cave")?new aqw():new aqs();TerrainProbe.set(gen,"c",w);TerrainProbe.set(gen,"b",new Random(1234));
    aji[] blocks=fixture(fixture),before=blocks.clone();
    Method m=gen.getClass().getDeclaredMethod("a",long.class,int.class,int.class,aji[].class,double.class,double.class,double.class,float.class,float.class,float.class,int.class,int.class,double.class);m.setAccessible(true);
    m.invoke(gen,seed,x,z,blocks,px,py,pz,width,yaw,pitch,start,end,vertical);
    System.out.println("{\"kind\":\"tunnel\",\"carver\":"+TerrainProbe.q(kind)+",\"fixture\":"+TerrainProbe.q(fixture)+",\"seed\":"+TerrainProbe.q(""+seed)+",\"chunk\":["+x+","+z+"],\"params\":["+px+","+py+","+pz+","+(double)width+","+(double)yaw+","+(double)pitch+","+start+","+end+","+vertical+"],\"sha1\":"+TerrainProbe.q(TerrainProbe.hash(blocks))+",\"changes\":"+changes(before,blocks)+"}");
  }
  static void chunk(long seed,ahm type,int x,int z)throws Exception{
    TerrainProbe.resetMesa();W w=world(seed,type);aqz terrain=new aqz(w,seed,false);aji[] blocks=new aji[65536];byte[] meta=new byte[65536];
    ((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,w.manager.b(null,x*16,z*16,16,16));
    aji[] before=blocks.clone();new aqw().a(null,w,x,z,blocks);String caveHash=TerrainProbe.hash(blocks),caveChanges=changes(before,blocks);aji[] caves=blocks.clone();new aqs().a(null,w,x,z,blocks);
    System.out.println("{\"kind\":\"chunk\",\"seed\":"+TerrainProbe.q(""+seed)+",\"type\":"+TerrainProbe.q(TerrainProbe.type(type))+",\"x\":"+x+",\"z\":"+z+",\"inputSha1\":"+TerrainProbe.q(TerrainProbe.hash(before))+",\"cavesSha1\":"+TerrainProbe.q(caveHash)+",\"sha1\":"+TerrainProbe.q(TerrainProbe.hash(blocks))+",\"runtimeSha1\":"+TerrainProbe.q(runtimeHash(blocks))+",\"metadataSha1\":"+TerrainProbe.q(TerrainProbe.hash(meta))+",\"caves\":"+caveChanges+",\"ravines\":"+changes(caves,blocks)+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();
    for(long seed:new long[]{0,-1,Long.MIN_VALUE,Long.MAX_VALUE})for(int[] pos:new int[][]{{0,0},{-23,17},{1874999,-1874999}}){
      W w=world(seed,ahm.b);Trace trace=new Trace();trace.a(null,w,pos[0],pos[1],new aji[65536]);
      System.out.println("{\"kind\":\"base\",\"seed\":"+TerrainProbe.q(""+seed)+",\"x\":"+pos[0]+",\"z\":"+pos[1]+",\"sources\":"+trace.rows.append(']')+"}");
    }
    for(String kind:new String[]{"cave","ravine"})for(long seed:new long[]{0,1,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE}){
      for(String fixture:new String[]{"stone","water8","water9","materials"})
        tunnel(kind,fixture,seed,0,0,8,45,8,4,0.3f,-0.04f,0,70,kind.equals("cave")?1:3);
      for(String wet:new String[]{"water8","water9"})tunnel(kind,wet,seed,0,0,8,45,8,4,0.3f,-0.04f,-1,70,kind.equals("cave")?1:3);
      tunnel(kind,"stone",seed,-2,3,-24,8,56,5,-1.2f,0.3f,-1,-1,kind.equals("cave")?0.5:3);
      tunnel(kind,"ceiling",seed,1874999,-1874999,1874999*16.0+7,249,-1874999*16.0+8,7,2.3f,-0.4f,0,48,kind.equals("cave")?1:3);
      tunnel(kind,"stone",seed,0,0,8,80,8,6,0,0,-1,60,kind.equals("cave")?0.5:3);
    }
    for(long seed:new long[]{0,8675309,-123456789})for(ahm type:new ahm[]{ahm.b,ahm.e,ahm.d}){
      W w=world(seed,type);axl.a();agt pos=w.manager.a(0,0,256,w.manager.a(),new Random(seed));
      int ox=((pos==null?0:pos.a>>4)-4)*16,oz=((pos==null?0:pos.c>>4)-4)*16;
      System.out.println("{\"kind\":\"viewport\",\"seed\":"+TerrainProbe.q(""+seed)+",\"type\":"+TerrainProbe.q(TerrainProbe.type(type))+",\"origin\":["+ox+","+oz+"]}");
      for(int[] c:new int[][]{{0,0},{4,4},{7,7}})chunk(seed,type,ox/16+c[0],oz/16+c[1]);
    }
    for(String line:Files.readAllLines(Paths.get(args[0]))){String[] a=line.split(",");chunk(Long.parseLong(a[0]),a[1].equals("amplified")?ahm.e:a[1].equals("largeBiomes")?ahm.d:ahm.b,Integer.parseInt(a[2]),Integer.parseInt(a[3]));}
  }
}
