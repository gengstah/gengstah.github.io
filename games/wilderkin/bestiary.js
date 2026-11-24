(() => {
  "use strict";

  // A field morph changes the animal's anatomy, habitat, affinities and available skills.
  // The family rows list the nineteen individual species in the same order as the morphs below.
  const types = {
    Grove: { color:"#477343", strengths:["Tide","Loam"], description:"Living roots drink deep water and bind loose earth.", moves:["Leaf Lance","Briar Net","Seed Burst","Tendril Whip"] },
    Ember: { color:"#b64e30", strengths:["Grove","Rime"], description:"Radiant heat scorches growth and thaws frost.", moves:["Singe Needle","Cinder Star","Hearth Rush","Flare Thread"] },
    Tide: { color:"#297587", strengths:["Ember","Alloy"], description:"Currents quench fire and corrode metal.", moves:["Riptide Curl","Rill Jet","Foam Hammer","Breaker Roll"] },
    Vane: { color:"#527f79", strengths:["Chime","Gloam"], description:"Crosswinds scatter echoes and pull shadows apart.", moves:["Crosswind Cut","Thermal Rise","Shear Spiral","Squall Kick"] },
    Arc: { color:"#96701c", strengths:["Vane","Tide"], description:"Static rides air currents and races through water.", moves:["Coil Snap","Forked Flash","Spark Thread","Corona Tap"] },
    Loam: { color:"#89623f", strengths:["Arc","Ember"], description:"Mineral ground drains charge and smothers flames.", moves:["Shale Wave","Fault Stamp","Gravel Fan","Clay Anchor"] },
    Rime: { color:"#4c819b", strengths:["Loam","Vane"], description:"Frost splits stone and weighs down wings.", moves:["Hail Stitch","Sleet Shard","Ice Lattice","Rime Needle"] },
    Gloam: { color:"#725582", strengths:["Alloy","Arc"], description:"Deep shade hides metal edges and disperses charge.", moves:["Dusk Stitch","Umbra Veil","Shadow Fold","Night Ripple"] },
    Chime: { color:"#9a6177", strengths:["Gloam","Grove"], description:"Clear harmonics pierce darkness and shake roots loose.", moves:["Bell Ring","Overtone Lash","Resonant Wave","Tuning Fork"] },
    Alloy: { color:"#667482", strengths:["Rime","Chime"], description:"Tempered plates crush ice and dampen vibration.", moves:["Rivet Rush","Nickel Edge","Anvil Knock","Iron Spiral"] }
  };

  const abilities = {
    Raftwake: { description:"Carries the expedition over deep water and swift channels." },
    Cloudlift: { description:"Rides a thermal with its rider to reach high ledges and floating trails." },
    Stonecleave: { description:"Splits fallen slabs to clear blocked passes and tunnels." },
    Lullsong: { description:"Coaxes sleeping giants to stir and move away from narrow paths." },
    Glowpath: { description:"Illuminates the trail through unlit caverns and night fog." },
    Frostspan: { description:"Freezes a chain of stepping stones across unstable wetlands." }
  };

  // primary affinity, physical adaptation, behavior, and specialist field ability
  const morphs = [
    ["Tide","webbed fins","It feels the shape of underwater passages by following the smallest returning ripple.","Raftwake"],
    ["Ember","a flame crest","At dusk it tends a bed of warm ash, banking enough heat for a cold night.","Glowpath"],
    ["Loam","a wedge of stone armor","It tests a cliff for hidden cracks with three measured taps.","Stonecleave"],
    ["Vane","long sail-feathers","It circles above sun-warmed rocks until the rising air can lift a second rider.","Cloudlift"],
    ["Arc","branching copper prongs","Before a thunderstorm it draws tiny blue sparks between its prongs.",null],
    ["Gloam","a veil of night beads","Its low, soft call travels through the ground to sleeping neighbors.","Lullsong"],
    ["Rime","a crown of ice splinters","It lays down clear ice by breathing across still pools in short bursts.","Frostspan"],
    ["Grove","a fan of new leaves","It turns its leaf fan to the morning sun before it begins to forage.",null],
    ["Alloy","interlocking iron plates","It rubs fresh iron against its plates until their scratches gleam.","Stonecleave"],
    ["Chime","hollow bell buds","Its bell buds sound at different pitches after a rain shower.","Lullsong"],
    ["Loam","ridged sand horns","It leaves neat crescents in loose sand to mark the best shelter from a storm.",null],
    ["Tide","forking coral fronds","Its fronds comb small drifting seeds from the retreating tide.","Raftwake"],
    ["Grove","trailing fern fronds","It drapes its hanging fronds over bare soil to shelter young seedlings.",null],
    ["Ember","glowing vent scales","Small puffs from its vents show where a cave draft leads to open air.","Glowpath"],
    ["Vane","a forked wind ribbon","It sends its ribbon ahead of a leap to judge the current between ledges.","Cloudlift"],
    ["Arc","paired spark whiskers","Its whiskers point toward the next lightning strike a heartbeat before it lands.",null],
    ["Gloam","luminous dusk pearls","When a flock goes missing underground, its pearls blink until the stragglers return.","Glowpath"],
    ["Rime","layered glacier plates","It draws moisture into its outer plates and sheds it as a walkable crust.","Frostspan"],
    ["Chime","a ring of opal petals","Its petals hum back the last clear note they heard, even hours later.","Lullsong"]
  ];

  // shape, family affinity, typical health, field observation, defensive technique, recovery technique
  function family(shape, affinity, hp, observation, guard, heal, names) {
    return {shape, affinity, hp, observation, guard, heal, names:names.split(" ")};
  }

  const families = [
    family("mole","Loam",34,"A tunneler that draws crooked maps in soft soil with its broad foreclaws.","Tunnel Feint","Nest Down",
      "Mudsnout Kilnclaw Slatebur Whifflewick Pincoil Dusksnout Frostmull Rootdrill Boltbur Bellmole Duneshove Tidemull Fernscrape Coalgnaw Wispborer Sparktuft Cavernip Bergpaddle Opalmull"),
    family("heron","Vane",29,"This long-legged fisher keeps one toe in motion to lure curious minnows.","Reed Lunge","Still Perch",
      "Fenstillet Charquill Flintstilt Gustlance Arcbill Hushplume Icereeve Frondstilt Ferribill Gongreed Dunelance Brinestep Reedrill Kilnbeak Whistlefen Pinionarc Shadecrake Bergstilt Sonareeve"),
    family("ram","Loam",36,"A sure-footed climber that drums its horns against rock before choosing a ledge.","Horn Brace","Ledge Rest",
      "Marshcurl Fyrhorn Cragtup Vanehorn Coilcrown Veiltup Rimecurl Lichenram Tinwether Bellwether Sandswirl Reefhorn Boughbuck Scoriaram Skyshear Cracklehorn Duskcurl Bergwether Opalhorn"),
    family("dragonfly","Vane",28,"Its four narrow wings can beat out of step so it can reverse direction without turning.","Reed Parry","Wing Fold",
      "Rillneedle Glowdarter Flintlace Breezeflet Voltdarter Duskshuttle Rimelace Leafshuttle Steelneedle Chimeskater Duneskein Reefdarter Ferndarter Ashshuttle Gustneedle Sparkdancer Veildarter Snowshuttle Opaldarter"),
    family("toad","Tide",35,"This squat singer inflates its throat to carry a call well beyond the pond.","Rebound Bump","Puddle Rest",
      "Puddlemug Charcroak Rockgullet Gustgulp Staticroak Nightgob Frostgulp Mossgob Tinwattle Bellowsprong Dunesquat Saltwattle Fernwattle Cindersing Windcroak Cracklegob Gloombubble Glazegob Opaloo"),
    family("armadillo","Alloy",37,"Its overlapping back plates lock when it curls into a ball on steep slopes.","Roll Brace","Curl Nap",
      "Creekroll Smelteroll Cragroll Windgird Pinwheelkin Lullgird Sleetcoil Mossmantle Rivetroll Brassrattle Dunegird Brineroll Canopycoil Cinderplate Sailgird Coilrivet Shadegird Iceramp Opalroll"),
    family("newt","Tide",30,"A long-tailed swimmer that can turn back inside the length of its own body.","Tail Check","Pool Soak",
      "Rillribbon Cindertail Shaleswim Kiteswirl Ampnewt Lullribbon Iceribbon Pondfern Tinstripe Chordtail Duneslink Sprayribbon Reedslink Ashfrill Streamergale Surgefrill Grottofrill Floeribbon Echofrill"),
    family("owl","Gloam",32,"Its broad facial disc catches echoes from small movements under deep cover.","Talon Block","Perch Doze",
      "Brookhoot Kilnowl Cairnwatch Vesperowl Coilhoot Hushdisc Frostgaze Mossmask Ironblink Chordowl Sandwatch Brinehoot Thicketowl Ashmask Gustgaze Stormhoot Pearlwatch Glacierowl Opalwatch"),
    family("glider","Vane",28,"It spreads the loose skin between its feet like a map and drifts silently between perches.","Sail Juke","Bough Nap",
      "Rillsail Fireskip Cragkite Updraftkin Arcsail Duskwisp Flakesail Nettlewing Steelglide Chordkite Dunesail Reefswing Fernkite Ventglider Galeskip Sparkkite Gloamsail Floeglide Glissail"),
    family("hedgehog","Grove",35,"A small forager that leaves a line of tiny quill marks wherever it sleeps.","Quill Brace","Nest Curl",
      "Fenprick Emberpincairn Flintspike Windquill Flickerthorn Lullprickle Icespur Burrbristle Tackspine Bellbur Sandspool Reefbristle Fernprickle Ashprong Gustbur Wirebristle Lanternbur Bergbristle Opalprick"),
    family("hare","Vane",29,"It swivels its long ears independently while its powerful hind feet test the ground.","Heel Feint","Warren Rest",
      "Waterbound Kilnbun Cragskip Fleetear Wireleap Duskloper Sleetbound Sprigleap Tinheel Pealear Dunehop Brineloper Brackenbun Ashbound Galeloper Arcleap Moonloper Snowheel Opalloper"),
    family("seal","Tide",35,"A sleek shore swimmer that hauls itself onto flat banks to greet returning boats.","Flipper Check","Bank Rest",
      "Rillpup Steampelt Cragfluke Windslick Pulsepup Duskflipper Frostwhisk Kelpslick Ferripelt Bellslick Sandfluke Saltwhisk Reedpelt Ashwhisk Galeslick Wirewhisk Nightfluke Bergpup Opalwhisk"),
    family("gecko","Grove",30,"Each of its broad toe pads grips stone at a slightly different angle.","Grip Feint","Wall Rest",
      "Poolpad Charpad Cragtoe Wispgeck Staticko Shadegrip Icepad Leafgeck Ferrigrip Chordpad Dunepad Reefgrip Vinepad Ashgeck Vanepad Arcgrip Lanternpad Glazetoe Pearlgrip"),
    family("crab","Tide",34,"One pincer measures objects while the larger claw does the heavy work.","Pincer Block","Burrow Rest",
      "Creekclasp Cinderclasp Shaleclamp Galepincer Coilclack Duskclasp Rimeclaw Eelgrassnip Tinclamp Bellclack Dunepincer Coralcuff Brackennip Scoriaclamp Gustclasp Arcnipper Grottonip Bergclack Opalclasp"),
    family("stag","Grove",34,"This quiet grazer threads its branching antlers between trunks without disturbing a leaf.","Antler Turn","Meadow Rest",
      "Brookhart Cinderhart Stonetine Sailhart Volttine Velvethush Hoarhart Bramblehart Bronzebrow Chordhart Sandtine Reefhart Ferncrown Ashantler Wispantler Fulgarhart Moonbrow Glazehart Opalinehart"),
    family("jelly","Chime",28,"Its bell contracts in a slow pulse while trailing streamers taste the air or water around it.","Bell Recoil","Still Pulse",
      "Rillveil Lanternjell Quartzveil Sailbell Arcmedusa Duskveil Snowbell Leafjell Silverjell Tuningjell Duneveil Reefveil Sedgejell Ashlantern Skyveil Stormjell Grottojell Bergjell Prismjell"),
    family("serpent","Gloam",32,"Its looping coils tighten around warm stones, and its forked tongue reads the passing breeze.","Coil Brace","Sun Coil",
      "Rillcoil Emberasp Cragadder Sailcoil Wireasp Duskadder Iceslip Mosscoil Steelasp Rattlehymn Duneadder Reefasp Fernasp Ashadder Galecoil Stormadder Nightasp Bergcoil Opalasp"),
    family("falcon","Vane",29,"A sharp-eyed stooper that folds its wings close to its flanks when it dives.","Talon Swerve","Cliff Rest",
      "Brooktalon Emberstoop Flintkestrel Updraftal Arcstoop Duskkestrel Rimefalch Leafstoop Rivetwing Chordkestrel Dunehook Salttalon Fernfalch Ashkestrel Galefalch Sparktalon Veilkestrel Snowsickle Prismtalon"),
    family("pika","Rime",31,"A round-eared gatherer that arranges its food stores by scent rather than size.","Cache Feint","Den Doze",
      "Brookpeep Coalpika Cragcheek Windpeep Sparkcheek Lullpika Rimepeep Mosscheek Tinpeep Bellpeep Dunecheek Saltpika Fernpeep Ashcheek Galesqueak Pulsepika Nightpeep Floepika Prismpeep"),
    family("snail","Loam",37,"Its spiral shell records each summer as a wider ring that can be read like a tree trunk.","Shell Door","Spiral Rest",
      "Rillwhorl Hearthwhorl Cragwhelk Sailwhorl Coilwhelk Hushwhorl Rimewhelk Mosscurl Ironwhorl Chordwhelk Dunewhelk Brinewhorl Vinewhorl Ventwhelk Galewhelk Arcwhorl Grottohelix Floewhelk Prismwhorl"),
    family("angler","Tide",32,"A deep-pool hunter that uses a flexible lure to draw travelers away from dangerous currents.","Fin Parry","Deep Drift",
      "Rilllure Embermaw Craglure Vanelure Arclure Duskgape Icemaul Grovegape Ferrolure Chordgape Dunejaw Saltlure Fernmaw Ventmaw Gustgape Sparkgape Lanternmaw Berglure Prismlure"),
    family("fungus","Grove",33,"Its sturdy feet plant a circle of spores in each clearing where the colony rests.","Cap Guard","Spore Rest",
      "Brookcap Charcap Flintgill Sailgill Chargill Lullcap Frostgill Mossgill Tincap Bellgill Dunecap Reefgill Ferncap Ashgill Galecap Arccap Nightgill Bergcap Opalgill"),
    family("bat","Gloam",30,"It grips its perch with folded hind feet and maps the trail ahead in brief bursts of sound.","Wing Shroud","Roost Rest",
      "Rillroost Emberpip Cragecho Vanepip Sparkroost Hushpip Rimepip Leafroost Tinwing Bellpip Duneroost Reefpip Fernroost Ashpip Galeroost Arcpip Nightroost Glazepip Opalpip"),
    family("mantis","Alloy",30,"It holds its scythe-like forelimbs motionless until a falling seed comes within reach.","Scythe Parry","Stalk Rest",
      "Rillscythe Charsickle Flintscythe Windsickle Voltscythe Dusksickle Frostscythe Leafscythe Ferrisickle Chordsickle Dunescythe Reefsickle Fernsickle Ashscythe Galescythe Arcsickle Nightsickle Bergscythe Opalsickle"),
    family("gryphon","Ember",35,"A feather-necked runner with heavy back paws that stamp a rhythm before flight.","Beak Guard","Eyrie Rest",
      "Brookgryph Hearthgryph Flintmane Sailmane Voltmane Lullgryph Frostmane Mossgryph Tinmane Bellgryph Dunemane Saltgryph Ferngryph Ashmane Galegryph Arcgryph Grottoflank Berggryph Opalmane"),
    family("spider","Arc",29,"This eight-legged weaver measures the tension of a line with its front pair of feet.","Silk Check","Web Rest",
      "Rillweft Fireweft Slateweaver Vaneweft Staticloom Duskweft Frostweaver Leafweft Tinloom Bellweft Duneweaver Reefweft Fernloom Ashweft Galeweaver Stormweft Nightloom Bergweaver Opalweft")
  ];

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  }

  function effectiveness(attackType, defenderTypes) {
    const attack = types[attackType];
    if (!attack) return 1;
    const defense = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
    let balance = 0;
    for (const type of new Set(defense)) {
      if (attack.strengths.includes(type)) balance++;
      else if (types[type]?.strengths.includes(attackType)) balance--;
    }
    // A weakness to one element can be canceled by the other affinity's resistance.
    return balance > 0 ? 1.5 ** balance : 0.7 ** -balance;
  }

  function attack(type, n) {
    const name = types[type].moves[n % types[type].moves.length];
    return {id:slug(name), name, type, kind:"attack", power:9+n%3,
      description:"A "+type+" strike. Strong against "+types[type].strengths.join(" and ")+"."};
  }

  const legacyIDs = ["sprigkit","cindlet","dewfin","mossbell","coalmoth","glimmeray"];
  const legacyAbilities = { mossbell:"Lullsong", coalmoth:"Glowpath", glimmeray:"Raftwake" };
  const emberArts={
    1:Object.freeze({id:"banked-warmth",name:"Banked Warmth",type:"Ember",cost:0,uses:1,power:0,
      summary:"Warm an injured reserve and brace for the next hit.",
      description:"Once per battle, share banked heat with a conscious reserve to restore up to a quarter of its maximum HP. The user stays in front under half cover."}),
    13:Object.freeze({id:"backdraft",name:"Backdraft",type:"Ember",cost:0,uses:1,power:6,
      summary:"Vent an Ember strike and recover your own HP.",
      description:"Once per battle, strike with Ember and restore up to a quarter of your maximum HP. The strike can use an opening, even at full health."})
  };
  const designs = new Map();
  const additions = {};
  for (const [f,clan] of families.entries()) {
    for (const [m,name] of clan.names.entries()) {
      const [primary,feature,behavior,ability] = morphs[m];
      const id = slug(name);
      const dual = primary !== clan.affinity && (f + 2*m) % 4 !== 0;
      const affinities = dual ? [primary, clan.affinity] : [primary];
      const skills = [attack(primary,f+m)];
      if (dual) skills.push(attack(clan.affinity,2*f+m+1));
      skills.push({id:slug(clan.guard), name:clan.guard, type:"Neutral", kind:"guard", power:6+(f+m)%2,
        description:"Strike while bracing to halve the next hit."});
      skills.push({id:slug(clan.heal), name:clan.heal, type:"Neutral", kind:"heal",
        description:"Recover one third of this companion’s maximum health."});
      additions[id] = {
        id, name, type:primary, types:affinities, baseHp:clan.hp+(m%5)-2, skills,
        ...(emberArts[m]?{emberArt:emberArts[m]}:{}),
        ability, description:clan.observation+" You can recognize "+name+" by "+feature+". "+behavior
      };
      designs.set(id,{shape:clan.shape,morph:m,secondary:dual ? clan.affinity : null});
    }
  }

  function expand(originalSpecies) {
    const all = {};
    for (const id of legacyIDs) {
      const entry = originalSpecies[id];
      all[id] = {...entry, types:[entry.type], ability:legacyAbilities[id] || null};
    }
    Object.assign(all,additions);
    if(window.WilderStillwake)all.stillwake=window.WilderStillwake.kin;
    return all;
  }

  const allIDs = [...legacyIDs,...Object.keys(additions)];
  const affinity = id => additions[id]?.type || ["Grove","Ember","Tide"][legacyIDs.indexOf(id)%3];
  const fieldSkill = id => additions[id]?.ability || legacyAbilities[id];
  const locales = window.WilderAtlas?.regions || [];
  const routes = window.WilderAtlas?.routes || [];
  const themeTypes = [
    ["Grove","Loam","Vane","Chime"], ["Ember","Arc","Alloy","Loam"], ["Tide","Rime","Gloam","Chime"]
  ];
  const encounterPools = Array.from({length:150}, () => []);
  // Keep the original opening opponents and give the first three wild clearings one early
  // recruit for every field skill. Route trailheads also host a relevant local specialist.
  encounterPools[0].push("mossbell","gustlance");
  encounterPools[1].push("coalmoth","cragroll");
  encounterPools[2].push("glimmeray","iceribbon");
  const placed = new Set(encounterPools.flat());
  function place(index,id) {
    encounterPools[index].push(id);
    placed.add(id);
  }

  function rank(id,index) {
    let value = 2166136261 ^ index;
    for (const letter of id) value = Math.imul(value ^ letter.charCodeAt(0),16777619);
    return value >>> 0;
  }

  function select(index,requiredAbility) {
    const pool = encounterPools[index];
    const local = themeTypes[locales[index]?.theme ?? index%3];
    const neighbors = new Set(pool.map(id => designs.get(id)?.shape));
    const candidates = allIDs.filter(id => !placed.has(id) && (!requiredAbility || fieldSkill(id) === requiredAbility));
    function score(id) {
      const mismatch = local.includes(affinity(id)) ? 0 : 3;
      const duplicateShape = neighbors.has(designs.get(id)?.shape) ? 5 : 0;
      return mismatch + duplicateShape + rank(id,index)/0x100000000;
    }
    let best, lowest = Infinity;
    for (const id of candidates) {
      const priority = score(id);
      if (priority < lowest) {
        lowest = priority;
        best = id;
      }
    }
    return best;
  }

  for (const route of routes) {
    if (!route.ability || encounterPools[route.start].some(id => fieldSkill(id) === route.ability)) continue;
    place(route.start,select(route.start,route.ability));
  }
  // Deal in rounds. This preserves three or four species per region even at the far end
  // of the map and distributes all 500 species, including the three original starters.
  for (let round=1; placed.size<allIDs.length; round++) {
    for (let i=0;i<encounterPools.length && placed.size<allIDs.length;i++) {
      if (encounterPools[i].length<round) place(i,select(i));
    }
  }

  const nativePools=encounterPools.slice();
  const homes=Object.fromEntries(allIDs.map(id=>[id,[]]));
  nativePools.forEach((pool,i)=>pool.forEach(id=>homes[id].push(i)));
  // The roosts are extra wild sightings. Keep the original trail addresses and challenge lineups.
  for(const [region,id] of [[0,"charquill"],[1,"kilnbeak"]]){
    encounterPools[region]=[...nativePools[region],id];
    homes[id].push(region);
  }

  function spriteUrl(id) {
    const design = designs.get(id);
    return design ? window.WilderKinArt.sprite(id,design) : "art/"+id+".png";
  }

  const beacon = {id:"beacon", family:"Heron", name:"Beacon Pass",
    summary:"Pass to a reserve and mark the rival. Your next ordinary attack against that rival hits 50% harder and breaks through its guard."};
  const slipstream = {id:"slipstream", family:"Glider", name:"Slipstream Pass",
    summary:"Pass to a reserve and restore up to a quarter of its maximum HP before it takes the rival’s reply."};
  const familyPasses = {heron:beacon, glider:slipstream};
  window.WilderFamilyTechniques = {
    forKin:id=>familyPasses[designs.get(id)?.shape] || null,
    byId:id=>id===beacon.id?beacon:id===slipstream.id?slipstream:null
  };
  const guardRoles = {
    armadillo:{id:"shell",family:"Armadillo",name:"Shell Escort",guard:"Roll Brace",
      summary:"Roll Brace sets up a protected switch. Call in a teammate and it takes only a quarter of the incoming hit."},
    crab:{id:"pincer",family:"Crab",name:"Pincer Hold",guard:"Pincer Block",
      summary:"Pincer Block exposes a charging rival for the next ordinary attack. Against a Warden’s Reserve relay, it holds that rival in place."}
  };
  window.WilderGuardSchool = {forKin:id=>guardRoles[designs.get(id)?.shape] || null};
  window.WilderKinDex = {expand, encounterPools, nativePools, homes, effectiveness, types, abilities, spriteUrl,
    shapeOf:id=>designs.get(id)?.shape || null};
})();
