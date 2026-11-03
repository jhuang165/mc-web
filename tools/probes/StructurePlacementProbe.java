import java.lang.reflect.*;
import java.security.*;
import java.util.*;
// Calls unchanged village/scattered/stronghold predicates. WorldChunkManager and
// World.setRandomSeed are native; world allocation only bypasses renderer/storage.
public class StructurePlacementProbe {
 static class V extends avn {V(ahb w,int distance){super(Collections.singletonMap("distance",""+distance));c=w;}boolean test(int x,int z){return a(x,z);}avm start(int x,int z,long seed){b=new Random(seed);return b(x,z);}}
 static class T extends atx {T(ahb w,int distance){super(Collections.singletonMap("distance",""+distance));c=w;}boolean test(int x,int z){return a(x,z);}avm start(int x,int z,long seed){b=new Random(seed);return b(x,z);}}
 static class S extends aug {S(ahb w,Map<String,String> options){super(options);c=w;}boolean test(int x,int z){return a(x,z);}avm start(int x,int z,long seed){b=new Random(seed);return b(x,z);}}
 static class W extends TerrainProbe.W {public ahu a(int x,int z){return manager.a(x,z);}}
 static TerrainProbe.W world(long seed,ahm type)throws Exception {TerrainProbe.W source=TerrainProbe.world(seed,type);W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=source.seed;w.manager=source.manager;w.info=source.info;TerrainProbe.set(w.info,"a",seed);TerrainProbe.set(w,"s",new Random(0));return w;}
 static String ids(List list){StringJoiner s=new StringJoiner(",","[","]");for(Object o:list)s.add(""+((ahu)o).ay);return s.toString();}
 static String pieces(avm start)throws Exception {
  StringJoiner out=new StringJoiner(",","[","]");for(Object o:start.b()){avk c=(avk)o;asv bb=c.c();out.add("["+TerrainProbe.q(c.getClass().getName())+","+bb.a+","+bb.b+","+bb.c+","+bb.d+","+bb.e+","+bb.f+"]");}return out.toString();
 }
 static void grid(long seed,ahm type,String typeName,String kind,int distance,int x0,int z0,int size)throws Exception {
  TerrainProbe.W w=world(seed,type);V v=new V(w,distance);T t=new T(w,distance);MessageDigest hash=MessageDigest.getInstance("SHA-1");StringJoiner starts=new StringJoiner(",","[","]");
  for(int x=x0;x<x0+size;x++)for(int z=z0;z<z0+size;z++){boolean accepted=kind.equals("village")?v.test(x,z):t.test(x,z);hash.update((byte)(accepted?1:0));if(accepted){starts.add("["+x+","+z+"]");}}
  System.out.println("{\"kind\":"+TerrainProbe.q(kind)+",\"seed\":"+TerrainProbe.q(""+seed)+",\"type\":"+TerrainProbe.q(typeName)+",\"distance\":"+distance+",\"x\":"+x0+",\"z\":"+z0+",\"size\":"+size+",\"sha1\":"+TerrainProbe.q(TerrainProbe.hex(hash.digest()))+",\"accepted\":"+starts+"}");
 }
 public static void main(String[] args)throws Exception {
  Field f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)f.get(null);aji.p();
  TerrainProbe.W first=world(0,ahm.b);S strong=new S(first,new HashMap<>());System.out.println("{\"kind\":\"config\",\"villageBiomes\":"+ids(avn.e)+",\"templeBiomes\":"+ids((List)TerrainProbe.field(atx.class,"e").get(null))+",\"strongholdBiomes\":"+ids((List)TerrainProbe.get(strong,"e"))+"}");
  for(long seed:new long[]{0,17,8675309,Long.MIN_VALUE})for(String name:new String[]{"village","temple"}) {
   grid(seed,ahm.b,"default",name,32,-128,-128,256);grid(seed,ahm.b,"default",name,17,-64,-64,128);grid(seed,ahm.b,"default",name,32,1874800,-1874999,192);
  }
  for(long seed:new long[]{0,17,8675309,Long.MIN_VALUE})for(int mode=0;mode<3;mode++) {
   ahm type=mode==0?ahm.b:mode==1?ahm.e:ahm.d;String typeName=mode==0?"default":mode==1?"amplified":"largeBiomes";
   for(int count:new int[]{3,8}) {TerrainProbe.W w=world(seed,type);Map<String,String> options=new HashMap<>();options.put("count",""+count);S s=new S(w,options);s.test(0,0);agu[] positions=(agu[])TerrainProbe.get(s,"g");StringJoiner coords=new StringJoiner(",","[","]");for(agu p:positions){if(!s.test(p.a,p.b))throw new AssertionError();coords.add("["+p.a+","+p.b+"]");}
    System.out.println("{\"kind\":\"stronghold\",\"seed\":"+TerrainProbe.q(""+seed)+",\"type\":"+TerrainProbe.q(typeName)+",\"count\":"+count+",\"positions\":"+coords+"}");
   }
  }
  TerrainProbe.W w=world(17,ahm.b);V v=new V(w,32);T t=new T(w,32);S s=new S(w,new HashMap<>());s.test(0,0);agu p=((agu[])TerrainProbe.get(s,"g"))[0];
  for(String kind:new String[]{"village","temple","stronghold"}){int x=p.a,z=p.b;if(!kind.equals("stronghold")){boolean found=false;for(int a=-128;a<128&&!found;a++)for(int b=-128;b<128;b++)if(kind.equals("village")?v.test(a,b):t.test(a,b)){x=a;z=b;found=true;break;}}avm start=kind.equals("village")?v.start(x,z,17):kind.equals("temple")?t.start(x,z,17):s.start(x,z,17);System.out.println("{\"kind\":\"pieces\",\"structure\":"+TerrainProbe.q(kind)+",\"seed\":\"17\",\"x\":"+x+",\"z\":"+z+",\"pieces\":"+pieces(start)+"}");}
 }
}
