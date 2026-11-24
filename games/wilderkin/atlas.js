// The original trail opens onto nine districts. In each expedition route the
// trailhead is accessible before its traversal ability is needed further in.
(() => {
  "use strict";

  const abilities = {
    Raftwake: "Ride a companion across the deep channel.",
    Cloudlift: "Catch an updraft with a sky-borne companion.",
    Stonecleave: "Break a passage through the fallen stone.",
    Lullsong: "Sing the restless herd to sleep and pass quietly.",
    Glowpath: "Let a companion illuminate the unmarked passage.",
    Frostspan: "Freeze a safe crossing over the broken causeway."
  };
  const regions = [
    { name:"Mossbrook Vale", description:"A sleepy woodland village on the banks of the Mossbrook.", warden:"Fern", lodge:"Mossbrook Lodge", crest:"Leaf Crest", dialogue:"See those flowers on Mossbell’s shell? They only open when it feels at home. Let’s see how well you and your companions know each other.", farewell:"Carry this Leaf Crest over the bridge to Cinderfall Ridge.", basicMove:"Pebble Toss", theme:0, wildLevel:4, wardenLevel:6 },
    { name:"Cinderfall Ridge", description:"Lanterns light the trails through a ridge of copper and ember.", warden:"Flint", lodge:"Emberwatch Hall", crest:"Ember Crest", dialogue:"I first met Coalmoth beside a lantern that had long since gone cold. We’ve kept the ridge lights burning ever since. Care for a friendly trial?", farewell:"This Ember Crest opens the trail to Moonwell Reach.", basicMove:"Wing Tap", theme:1, wildLevel:6, wardenLevel:8 },
    { name:"Moonwell Reach", description:"A moonlit river winds between silver trees and an ancient shrine.", warden:"Lune", lodge:"Moonwell Shrine", crest:"Moon Crest", dialogue:"When the water is still, Glimmeray can hear footsteps on the far shore. Yours have come a long way. Shall we take the trial?", farewell:"The old trail ends here. Take the Moon Crest downriver to Reedline Landing, where the ferrymakers keep the next map.", basicMove:"Fin Slap", theme:2, wildLevel:8, wardenLevel:10 }
  ];
  const routes = regions.map((r,i) => {
    Object.assign(r,{district:"The Warden Trail",districtIndex:0,biome:["wood","mesa","night"][i],requiredCrests:i,ability:null,routeStart:i,routeAbility:null,ordinal:i});
    return {start:i,end:i,ability:null,ordinal:i,district:r.district};
  });

  // Each row follows a particular Warden's stretch of trail, from its
  // ungated settlement to its trial grounds. The lines are in travel order.
  const districts = [
    ["The Sundrill Delta", "fen", 0, "Tidecut", [
      ["Marl","Reedglass Boathouse","Heron","Raftwake","The channel markers move with every spring flood. Read the ripples before you choose your next move.","Even the deep water has a rhythm. You found it.",
        "Reedline Landing|Minnow Ditches|Willow Lock|Egret Slough|Glassfloat Weir|Siltbell Ferry"],
      ["Kestrel","Kitewright Loft","Pennant","Cloudlift","I sew the sky ferries one panel at a time. A loose stitch tells you which way the wind is pulling.","Tie this pennant above your pack. The gusts will show you the way.",
        "Tackline Meadow|Ternwind Stairs|Whistling Sill|The Hanging Quay|Highkite Bluff"],
      ["Chert","Limestone Hearth","Ammonite","Stonecleave","The stone under this marsh was once a seabed. Stand still a moment and imagine the weight of that water.","Take a fossil from the wall. The delta remembers you now.",
        "Fossil Steps|Kingfisher Narrows|Crooked Shellbank|Reedstone Quarry|Amber Snail Grotto|Shellvault Rise"]
    ]],
    ["The Ochre Reach", "dune", 1, "Silt Kick", [
      ["Safa","Caravan Pavilion","Bell","Lullsong","Our pack herds hear footfalls a mile away. I will ring my bell just once. Can your team keep its footing?","My caravan will know the sound of that bell.",
        "Rattlegrass Station|Ochre Wash|Drumhoof Plain|Drowsegrass Fold|The Resting Giants|Bellkeeper Mesa"],
      ["Nacre","Geode Parlour","Prism","Glowpath","The crystal veins split one small light into a hundred. Which reflection belongs to your companion?","Your prism holds the color of the true path.",
        "Jasper Caravanserai|Mirrorflake Cut|Glassworm Tunnel|The Singing Geode|Mica Lantern Court"],
      ["Tovan","Coldforge Lodge","Anvil","Frostspan","These vents boil all year. Hold the cold between them long enough and you can forge an ice bridge.","We tempered that anvil together. May your next crossing hold.",
        "Kilnwater Yard|Ashwheel Flats|Tufa Steamfield|Cracked Boiler Run|The Hissing Spillway|Coldhammer Forge"]
    ]],
    ["The Glass Highlands", "alpine", 2, "Hoarflick", [
      ["Aster","Tarnwatch Refuge","Otter","Raftwake","Glacial water is so clear that a drop looks an inch deep. My partner learned to sound the tarn with its tail.","You gave the water the respect it deserves.",
        "Blueglen Shelter|Glaciermilk Bend|Cold Otter Shoal|Cobalt Stair|Drifting Moraine|Tarnwatch Basin"],
      ["Orva","Sailmaker Observatory","Sail","Cloudlift","Up here a shift of an inch can change your whole flight. Keep your partner close until the air lifts you.","My sails are in good company on your trail.",
        "Gullwing Terrace|Lichen Ladder|High Draft Scar|Sundog Col|Stratosail Spire"],
      ["Perrin","Carver’s Gallery","Chisel","Stonecleave","I carved this gallery to follow the faults already in the rock. A good trial works the same way.","You found a line through the hardest stone.",
        "Frostlarch Hold|Split Flint Field|Goatstep Slot|Echoing Blade Pass|Cragcarver Arch|Needlecut Summit"]
    ]],
    ["The Lantern Deeps", "grotto", 2, "Shale Tap", [
      ["Velin","Choir of Stone","Chime","Lullsong","Listen after the last note. The cave will sing back a measure that was never in the song.","Carry a little of our silence with you.",
        "Bellcap Hollow|Velvet Sporebank|Sleepmoth Choir|Hushstone Verge|Cathedral of Echoes"],
      ["Pipra","Lamplighter’s Kiln","Wick","Glowpath","A lamp should show you the floor before it shows you the ceiling. Try a patient opening.","You kept a flame through the darkest bend.",
        "Wickmarket|Glowbeetle Warrens|Winding Ozokerite|Pitchblack Arcade|Pricket Crossing|Wickwarden Vault"],
      ["Siv","The Ice Organ","Icicle","Frostspan","These hanging pipes ring only while the water freezes. Choose your moment and strike a clear note.","I heard your answer in every pipe.",
        "Rimewater Well|White Salamander Run|Dripglass Steps|Frozen Siphon|Pillarorgan Hall"]
    ]],
    ["The Saffron Coast", "shore", 1, "Shell Skim", [
      ["Della","Salvager’s Loft","Anchor","Raftwake","Our boats return with more stories than cargo. What story did your companions bring from the shoals?","That anchor held through a hard tide.",
        "Flotsam Port|Amber Kelp Bed|Crabpot Channel|The Lantern Wreck|Breakerwall Harbor"],
      ["Ivo","Windmill Crown","Vane","Cloudlift","The tallest mill runs backward in a sea squall. Show me you can turn a bad current to your advantage.","A vane should turn freely. So should a traveler.",
        "Saltwheel Strand|Sunspoke Barrow|Canvaswing Point|Gannets’ Stair|White Squall Reach|The Nine Windmills"],
      ["Quill","Salt Archive","Spiral","Stonecleave","I keep the weather records pressed between salt tablets. Every storm leaves a layer. Add your mark.","One more summer is written into the archive.",
        "Brineledger Town|Razorclam Walk|Chalkburst Bay|White Tablet Cut|Spiral Saltworks"]
    ]],
    ["The Crownwood", "wood", 0, "Bark Snap", [
      ["Anise","Seedkeeper’s Bower","Acorn","Lullsong","The oldest tree here survives because three sleeping herds guard its roots. Walk with the weight of a leaf.","We set aside the first acorn of autumn for a keeper like you.",
        "Hazelward Green|Bluebell Ring|Fallowantler Glade|Quietroot Warren|The Elder Canopy"],
      ["Bryn","Foxfire Folly","Firefly","Glowpath","Each lamp here is a colony of tiny lights. No spark leads forever. Let your companions take turns.","The colony will light your way home.",
        "Foxfire Stile|Loam Lanterns|Spiderlace Tunnel|Rootglass Gallery|Winking Stair|The Glowcrown"],
      ["Sorrel","Winter Orchard","Pip","Frostspan","We preserve the late apples in ice and bring them out for the first thaw. Hold your nerve a little longer.","Plant this pip somewhere the winter can find it.",
        "Pipgate Fold|Crabapple Chute|Cold Cider Run|The Silver Windfalls|Winterfruit Crown"]
    ]],
    ["The Ashen Caldera", "basalt", 1, "Cinder Shot", [
      ["Bas","Obsidian Launch","Paddle","Raftwake","Black pumice floats for a while. The trouble is knowing when a stepping stone is about to sink.","You picked a steady course through the caldera.",
        "Pumice Pier|Charwater Bend|Steam Otter Springs|Obsidian Shoals|Blackglass Launch"],
      ["Rua","Phoenix Lookout","Plume","Cloudlift","Watch the ash. When a plume rises straight up, even the lightest wing can climb above the rim.","A plume for your pack, from the first sunrise after the eruption.",
        "Ashmantle Yard|Red Cinder Fan|The Soot Kites|Thermal Ladder|Scoria Rim|Phoenix Overlook"],
      ["Alda","Basalt Foundry","Crucible","Stonecleave","We split the cooled crust before the next flow covers our work. My trial rewards both force and timing.","Our foundry stamp is yours.",
        "Rediron Gate|Hammerfall Scree|Riven Cinder Gut|The Slag Columns|Crucible Bowl"]
    ]],
    ["The Northlight Shelf", "ice", 2, "Sleet Toss", [
      ["Niva","Tundra Listening Post","Caribou","Lullsong","A herd under the northern lights moves as one animal. Wait for the last hoof to settle.","The northbound herd will remember your quiet steps.",
        "Hoarfelt Camp|Snowberry Lea|Ivory Antler Flat|Sleeping Drift|Caribou Watch"],
      ["Elva","Aurora Lenshouse","Halo","Glowpath","The lights overhead are too bright to see your boots by. My lens catches the little light that matters.","You followed a small light farther than a great one.",
        "Frostwick Exchange|Lantern Seal Sound|Snowblind Hinge|Coldglass Lens|The Violet Curtain|Halolight Observatory"],
      ["Tam","Icewright Station","Skate","Frostspan","We lay a rail across the floes each winter and take it up in spring. Find the seam that holds.","The first rail on next winter’s line will bear your name.",
        "Sledrail Depot|Rimehinge Cove|Pressure Ridge|The Blue Lead|Icewright Terminal"]
    ]],
    ["The Starfall Crown", "night", 2, "Comet Dust", [
      ["Vega","Crater Ferryhouse","Comet","Raftwake","A falling star hollowed this lake. On a still night our boat seems to cross the sky twice.","A comet returns by a different road. So may you.",
        "Starling Moor|Meteor Reedflat|Starlit Sounding|Craterwater Gate|Cometmere"],
      ["Yara","The Zenith Roost","Meridian","Cloudlift","I mark the noon shadow of this perch every day. Today your wing crossed it before the sun did.","From this meridian you can see the end of the trail.",
        "Meridian Terrace|Skysilver Hill|The Kite Constellation|Nightdraft Gap|Perihelion Shelf|Zenith Roost"],
      ["Orris","The Last Cairn","Horizon","Stonecleave","This cairn is built with one stone from every Warden. Place yours beside mine, then let the companions decide the last trial.","Thirty crests span the horizon. Wherever you set foot next is a new trail.",
        "Wayfarer’s Rest|Last Light Causeway|The Thirty Stones|Dawnfault Bridge|Horizon Cairn"]
    ]]
  ];
  const habitats = {
    fen:["A kingfisher darts between the marker poles.","Channels wind through reeds taller than your pack.","Sedge islands drift past the landing."],
    dune:["Ochre dust gathers against the lee side of every stone.","Heat shimmers over a band of pale sandstone.","A caravan bell rings beyond the dunes."],
    alpine:["The wind carries the cold smell of the high tarns.","Moraine ridges curl below the snow line.","Sunlight catches the distant glacier."],
    grotto:["Every footstep comes back several heartbeats later.","Lantern beetles trace lines in the dark.","A luminous seam follows the stone passage."],
    shore:["Long rollers break against the outer reef.","Salt dries white on the roots of the shore pines.","Fishing floats bob just beyond the shallows."],
    wood:["Old branches lace together above the trail.","Beetles hum in the shade of the crownwood.","A foxfire glow shines from the hollow trunks."],
    basalt:["Warm air rises through cracks in the old flows.","Black ridges mark the paths of earlier eruptions.","Ash drifts into pockets of sunlit stone."],
    ice:["Pale light travels through the blue ice below.","Powder streams off the frozen shelf.","Distant floes crack with a sound like thunder."],
    night:["Wind polishes the glass left by the starfall.","Small crater lakes reflect the constellations.","The last ridge shines above a blanket of clouds."]
  };

  districts.forEach(([district,biome,theme,basicMove,stages],districtIndex) => {
    stages.forEach(([warden,lodge,crestName,routeAbility,dialogue,farewell,locations]) => {
      const names=locations.split("|");
      const start=regions.length, end=start+names.length-1, ordinal=routes.length;
      const wardenLevel=6+end+Math.min(7,2+Math.floor(ordinal/5));
      routes.push({start,end,ability:routeAbility,ordinal,district});
      names.forEach((name,step) => {
        const isTrial=step===names.length-1;
        const passage=step===2 || step===names.length-2 || isTrial;
        let description=habitats[biome][(step+ordinal)%3];
        if(step===0) description="The trail to "+lodge+" begins here. "+description;
        if(isTrial) description=warden+" keeps the "+crestName+" Crest at "+lodge+".";
        regions.push({
          name,description,district,districtIndex:districtIndex+1,biome,theme,ordinal,
          routeStart:start,routeAbility,requiredCrests:ordinal,ability:passage?routeAbility:null,
          warden:isTrial?warden:null,lodge:isTrial?lodge:null,crest:isTrial?crestName+" Crest":null,
          dialogue:isTrial?dialogue:null,farewell:isTrial?farewell:null,basicMove,
          wildLevel:6+start+step,wardenLevel
        });
      });
    });
  });
  window.WilderAtlas={regions,routes,abilities};
})();
