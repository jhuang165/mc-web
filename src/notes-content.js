// The port's own build notes page (previously the DOM modal notes(); moved here as data). Not a 1.7.10 screen.
export const NOTES = {
 "title": "Rebuilding 1.7.10, system by system.",
 "subtitle": "Minecraft Java 1.7.10 is the compatibility target. Full parity is still unfinished.",
 "sections": [
  {
   "tag": "VERIFIED AGAINST BYTECODE",
   "text": "REA inventories the original JAR. MCP mappings and javap locate the original movement, FoodStats, crafting, furnace, and world-clock implementations."
  },
  {
   "tag": "IMPLEMENTED IN THIS BUILD",
   "text": "Creative and Survival, health, hunger, saturation, exhaustion, experience orbs/levels, regeneration, fall damage, drowning, death and recoverable inventory drops. Broken blocks, mob kills and thrown stacks drop item entities that fall, merge and are picked up. The Java 36-slot inventory with cursor, drag-splitting, shift- and double-click rules; shaped crafting, a crafting table, a fuel-driven furnace and single/large chests on real slots; the tabbed creative inventory with search; wood, stone, iron, diamond and gold tools with per-item durability and repair; leather, chain, iron, gold and diamond armor. Original 1.7.10 block/item textures, HUD sprites, sun, moon and sound effects; hand swings, equip transitions, bobbing, eating, animated water, crack frames and entity shadows. Pigs, cows, sheep, chickens and night-time zombies with 1.7.10 movement, knockback, pathfinding and AI task lists, melee combat with sprint knockback and critical hits, and food drops. Cows and sheep follow wheat and breed, pigs follow carrots and breed, chickens follow seeds and lay eggs; sheep graze, can be sheared and dyed. Sneaking slows you, lowers the view and stops you at edges. Flowing water and lava spread, mix into obsidian, cobblestone and stone, and lava burns players, mobs and items; buckets pick up and place liquids and milk cows; lakes and springs generate; flowers grow and craft into 16 dyes for wool; snowballs and eggs can be thrown; ladders can be placed and climbed; F5 shows the player model with armor. Rain and thunderstorms follow the original weather timers, darken the sky and light, and bring lightning that strikes and starts fires; fire spreads through wood, wool and leaves and is lit with flint and steel. The Snowy Tundra landscape has snowfall, snow layers and ice. Bows draw and fire arrows, and skeletons shoot back at night and burn by day. Oak saplings grow into trees, with bone meal or over time, and leaves decay and drop saplings and apples. Java worlds now use the original biome layers, terrain surfaces, caves and ravines at 256-block height; new Java worlds also generate mineshafts with cave-spider spawners and chest minecarts; ores, trees, lakes, dungeons, biome plants, animals and snow now generate too. Villages, strongholds and temples remain unfinished. Legacy landscapes keep their existing decoration. Torches; 1.7.10 sky/block light, smooth lighting, lightmap, sky, stars, fog and fancy clouds. Wheat, carrot and potato farming with five hoe tiers, moisture, eight growth stages, bone meal and harvesting; bread crafting and baked potatoes. Zombies rarely drop carrots, potatoes or iron when killed after a player hit. Creepers and TNT explode with block shielding, entity knockback, original puff/smoke effects and item drops; burning arrows light TNT and its fuse emits smoke. Sugar cane and cactus grow, paper/sugar/books craft, and sand/gravel fall and can be deflected by explosions."
  },
  {
   "tag": "MAJOR GAPS REMAIN",
   "text": "Streamed population and remaining Java structures, the complete block/item registry, most mobs and their full AI, other crops, advanced combat, enchantments, hoppers and other storage, redstone, dimensions, structures, other biomes, void fog, Java saves, and multiplayer. The renderer, terrain, entity AI and several interactions remain simplified. Original sounds and textures retain Mojang/Microsoft ownership."
  }
 ],
 "facts": [
  {
   "value": "20 Hz",
   "label": "Physics ticks"
  },
  {
   "value": "200",
   "label": "Ticks / smelt"
  },
  {
   "value": "24,000",
   "label": "Ticks / day"
  }
 ],
 "links": [
  {
   "label": "Textures & farming",
   "url": "/research/textures-and-farming.md"
  },
  {
   "label": "Animation & audio",
   "url": "/research/animations-and-sounds.md"
  },
  {
   "label": "Investigation",
   "url": "/research/investigation.md"
  },
  {
   "label": "Item drops",
   "url": "/research/items.md"
  },
  {
   "label": "Creative inventory",
   "url": "/research/creative.md"
  },
  {
   "label": "Entity shadows",
   "url": "/research/shadows.md"
  },
  {
   "label": "Flowing water",
   "url": "/research/fluids.md"
  },
  {
   "label": "Third person",
   "url": "/research/third-person.md"
  },
  {
   "label": "Sheep & wool",
   "url": "/research/sheep.md"
  },
  {
   "label": "Snowballs",
   "url": "/research/projectiles.md"
  },
  {
   "label": "Lava",
   "url": "/research/lava.md"
  },
  {
   "label": "Buckets & lakes",
   "url": "/research/buckets.md"
  },
  {
   "label": "Chickens & eggs",
   "url": "/research/chickens.md"
  },
  {
   "label": "Flowers & dyes",
   "url": "/research/dyes.md"
  },
  {
   "label": "Sneaking & attacks",
   "url": "/research/sneaking.md"
  },
  {
   "label": "Pathfinding & AI",
   "url": "/research/pathfinding.md"
  },
  {
   "label": "Weather",
   "url": "/research/weather.md"
  },
  {
   "label": "Fire",
   "url": "/research/fire.md"
  },
  {
   "label": "Snow & ice",
   "url": "/research/snow.md"
  },
  {
   "label": "Bows & skeletons",
   "url": "/research/bows.md"
  },
  {
   "label": "Crops & pigs",
   "url": "/research/crops.md"
  },
  {
   "label": "Saplings & trees",
   "url": "/research/trees.md"
  },
  {
   "label": "Ladders",
   "url": "/research/ladders.md"
  },
  {
   "label": "Java generation",
   "url": "/research/generation.md"
  },
  {
   "label": "Feature coverage",
   "url": "/research/parity.md"
  },
  {
   "label": "REA",
   "url": "https://github.com/morluto/rea"
  }
 ]
};
