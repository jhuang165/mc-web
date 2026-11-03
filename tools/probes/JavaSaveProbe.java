import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
// Native storage acceptance only. Count real payloads via native NBT, then omit
// entity/tile construction while loading sections in the explicit World double.
public class JavaSaveProbe {
 public static void main(String[] args)throws Exception {
  Field f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);sun.misc.Unsafe unsafe=(sun.misc.Unsafe)f.get(null);aji.p();
  Path dir=Paths.get(args[0]);dh root;try(InputStream in=Files.newInputStream(dir.resolve("level.dat"))){root=du.a(in);}
  dh data=root.m("Data");if(data.f("version")!=19133||data.g("RandomSeed")!=17L)throw new AssertionError("level.dat");
  dq playerInventory=data.m("Player").c("Inventory",10);boolean checkedPlayerTags=false;
  for(int i=0;i<playerInventory.c();i++){dh stack=playerInventory.b(i);if(stack.e("id")!=278)continue;dh tag=stack.m("tag");dq ench=tag.c("ench",10);
   if(tag.f("RepairCost")!=7||!"Mining pick".equals(tag.m("display").j("Name"))||ench.c()==0||ench.b(0).e("id")!=32||ench.b(0).e("lvl")!=3||!tag.n("Unbreakable"))throw new AssertionError("player item tag NBT");checkedPlayerTags=true;}
  if(!checkedPlayerTags)throw new AssertionError("player item tags missing");
  ChunkNbtProbe.W w=(ChunkNbtProbe.W)unsafe.allocateInstance(ChunkNbtProbe.W.class);w.time=100;w.scheduled=new ArrayList<>();aqo provider=(aqo)unsafe.allocateInstance(aqq.class);ChunkNbtProbe.field(ahb.class,"t").set(w,provider);
  aqk loader=new aqk(dir.toFile());Method reader=aqk.class.getDeclaredMethod("a",ahb.class,dh.class);reader.setAccessible(true);int chunks=0,tiles=0,entities=0,ticks=0;boolean checkedStoredTags=false;
  try(java.util.stream.Stream<Path> files=Files.list(dir.resolve("region"))) {
   for(Path path:(Iterable<Path>)files::iterator){aqh region=new aqh(path.toFile());try{for(int z=0;z<32;z++)for(int x=0;x<32;x++)try(DataInputStream in=region.a(x,z)){
    if(in==null)continue;dh saved=du.a((DataInput)in,new ds(16*1024*1024)),level=saved.m("Level");tiles+=level.c("TileEntities",10).c();entities+=level.c("Entities",10).c();ticks+=level.c("TileTicks",10).c();
    dq tileList=level.c("TileEntities",10);for(int ti=0;ti<tileList.c();ti++){dq items=tileList.b(ti).c("Items",10);for(int si=0;si<items.c();si++){dh item=items.b(si);if(item.e("id")!=403)continue;dh tag=item.m("tag");dq stored=tag.c("StoredEnchantments",10);if(tag.f("RepairCost")!=4||!"Chest book".equals(tag.m("display").j("Name"))||stored.c()==0||stored.b(0).e("id")!=16||stored.b(0).e("lvl")!=2)throw new AssertionError("stored item tag NBT");checkedStoredTags=true;}}
    level.a("Entities",new dq());level.a("TileEntities",new dq());apx chunk=(apx)reader.invoke(loader,w,level);
    if(chunk.g!=level.f("xPos")||chunk.h!=level.f("zPos")||!chunk.k||chunk.l)throw new AssertionError("chunk flags/position");
    dq sections=level.c("Sections",10);for(int i=0;i<sections.c();i++){dh s=sections.b(i);int y=s.d("Y");if(!Arrays.equals(s.k("Blocks"),chunk.i()[y].g())||!Arrays.equals(s.k("Data"),chunk.i()[y].j().a))throw new AssertionError("section roundtrip");}chunks++;
   }}finally{region.c();}}
  }
  if(chunks!=65||tiles!=1||entities!=1||ticks!=1||w.scheduled.size()!=1||!checkedStoredTags)throw new AssertionError("payload counts/tags "+chunks+","+tiles+","+entities+","+ticks+","+checkedStoredTags);
  System.out.println("Native RegionFile/NBT/AnvilChunkLoader accepted "+chunks+" exported columns; player ench/RepairCost/display/Unbreakable and chest StoredEnchantments/RepairCost/display tags retained; "+tiles+" container, "+entities+" entity, "+ticks+" pending tick parsed; sections exact. Entity/tile construction not executed.");
 }
}
