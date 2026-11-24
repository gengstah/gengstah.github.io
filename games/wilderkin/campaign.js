// Field commissions interleave local ecology, quartermaster work and formation battles.
(() => {
  "use strict";

  const items = {
    reed:{name:"Silver reed",use:"material",description:"Fibers harvested from trail edges. Used to weave capture loops and splints."},
    sap:{name:"Sun sap",use:"material",description:"A fragrant resin for medicine and kin-binding knots."},
    ore:{name:"Bellstone",use:"material",description:"A resonant mineral that holds a charge in emergency supplies."},
    kinweave:{name:"Kinweave",use:"capture",recipe:{reed:2,sap:1},description:"A soft, resonant loop. Befriend a wild kin at half health or lower. A successful invitation uses one weave."},
    balm:{name:"Fern balm",use:"heal",recipe:{sap:2,reed:1},description:"Restore half of a conscious companion’s health. Using medicine in a battle spends a turn."},
    tonic:{name:"Brighthorn tonic",use:"heal",recipe:{sap:3,ore:1},description:"Restore all health to one conscious companion. It takes one battle turn."},
    sparkseed:{name:"Sparkwake seed",use:"revive",recipe:{ore:2,sap:2,reed:1},description:"Revive a resting companion with half its health. The enemy acts after an in-battle revival."}
  };
  for (const [id,item] of Object.entries(items)) item.id = id;

  // Each operation has an objective, a relevant landmark, and two genuinely different ways to meet it.
  const operations = [
    ["Nursery convoy","camp","The youngest {kin} have gathered around a broken trail-bell. Move the nursery before dusk.","Caravan","escort"],
    ["Echo sounding","travel","Something under the trail is repeating the footsteps of {kin}. Sound the ground before sending a party across.","Listen","read"],
    ["Narrow crossing","wild","A {kin} migration has filled the only clear passage. A frightened animal could scatter the entire column.","Crossing","passage"],
    ["Missing lookouts","activities","Two lookouts sent a distress rhythm and went silent. Their lantern chain ends in fresh {kin} tracks.","Rescue","escort"],
    ["Bent markers","travel","Heavy footprints have twisted the route markers. Rebuild a stable line or guard a surveyor as they reset it.","Repair","repair"],
    ["Break the ring","wild","Three schools of {kin} are circling a stranded pack animal. Draw the first school off without flushing the others.","Ring","tactic"],
    ["Cold infirmary","camp","The field medic is down to one warm blanket. Help the patients travel, or supply medicine and let them rest.","Medicine","supply"],
    ["Hazard census","wild","The drawings show a {kin} shedding its old markings. Read its affinities to choose a safe survey partner.","Census","read"],
    ["Night dispatch","travel","The warning for the next settlement must cross a noisy feeding ground. Carry it quietly or screen the courier.","Dispatch","tactic"],
    ["Broken beacon","activities","The beacon ward is drawing {kin} away from their nests. Repair its resonator or protect a crew while they retune it.","Beacon","repair"],
    ["Return to the herd","camp","An exhausted {kin} will not follow the main herd on its own. Its family is calling from beyond the pass.","Reunion","passage"],
    ["Twin patrols","wild","Two patrols have met head-on near a shelter. A well-chosen opening will break their rhythm and spare both teams a long fight.","Patrol","tactic"],
    ["Lost provisions","activities","A wayhouse lost its stores in the night. Search the {kin} nesting grounds or provision the house from your pack.","Stores","supply"],
    ["Riverglass assay","travel","The scout found scales beside a seam of riverglass. Determine which threat the local {kin} would struggle to resist.","Assay","read"],
    ["Silent crossing","wild","A wounded herd has stopped beneath a leaning outcrop. Move the exposed animals in small groups or clear the longer road.","Rescue","passage"],
    ["Trailhead vigil","activities","The next relief caravan is nearly here. Keep the approach open while the scouts finish their regional chart.","Vigil","escort"],
    ["Emergency litter","camp","The patrol has a casualty and its carrying frame has snapped. Fit a reed splint or accompany the doctor along the exposed bypass.","Litter","repair"],
    ["Decoy tracks","wild","Fresh prints loop back toward the depot. Find the {kin} that laid the trail before the rest of its formation closes in.","Decoy","tactic"],
    ["Signal audit","activities","A warning bell calls at the wrong pitch for this herd. Test its response with a partner the local {kin} will recognize.","Signal","read"],
    ["Rescue cache","travel","The marker for a relief cache has gone dark. Hand over a spare kit or lead the retrieval party into the thicket.","Relief","supply"]
  ];

  const opening = [
    [7,0,5], [4,2,6,9], [13,3,8,11,15]
  ];
  function length(index) {
    return index < opening.length ? opening[index].length : 11 + (index % 4);
  }
  function operation(index, completed) {
    return opening[index]?.[completed] ?? (index * 7 + completed * [3,7,9,11][index%4]) % operations.length;
  }

  const conditions = {
    echo:{name:"Echo chamber",description:"Repeating the same damaging technique in succession deals 25% less damage. Rotate your strikes."},
    shelter:{name:"Nurse grove",description:"Each defeated formation member releases pollen that restores 12% HP to your active kin."},
    ledge:{name:"Loose footing",description:"A guarding strike blunts the counterattack to one third. Braced opponents are especially vulnerable to guard breaks."},
    gale:{name:"Shift wind",description:"Switching partners under cover reduces that turn’s counterattack to one quarter."}
  };
  const terrainRule={wood:"shelter",fen:"shelter",grotto:"echo",night:"echo",mesa:"ledge",basalt:"ledge",ice:"ledge",alpine:"gale",shore:"gale"};
  const recipes = ["balm","tonic","sparkseed"];
  function leg(index, step, ctx) {
    const {region, pool, species, dex, bag, owned, team} = ctx;
    const spec = operations[operation(index,step)];
    const [title,site,brief,,kind] = spec;
    const focus = pool[(index + 2*step) % pool.length];
    const kin = species[focus];
    const count = index < 3 ? 1 + (index > 0 ? 1 : 0) : 3 + (index + step) % 3;
    const choices = [];
    function add(id,label,description,foes,cost=null,requirement=null,bonus=null) {
      const affordable = !cost || Object.entries(cost).every(([item,n]) => bag[item] >= n);
      const needs = !affordable ? "Needs "+Object.entries(cost).map(([item,n]) => n+" "+items[item].name).join(", ")+". " : "";
      choices.push({id,label,description:needs+(requirement ? requirement+" " : "")+description,foes,cost,bonus,available:affordable&&!requirement});
    }
    if (kind === "read") {
      const all = Object.keys(dex.types);
      const best = all.reduce((best,t) => dex.effectiveness(t,kin.types)>dex.effectiveness(best,kin.types) ? t : best,all[0]);
      const alternatives = all.filter(t=>dex.effectiveness(t,kin.types)<dex.effectiveness(best,kin.types));
      const options = [best, alternatives[(index+step)%alternatives.length], alternatives[(index+step+1)%alternatives.length]];
      const start = (index+step)%options.length;
      for (let n=0;n<options.length;n++) {
        const type = options[(start+n)%options.length];
        add(type,"Use a "+type+" signal","Predict which signal can disperse the "+kin.types.join(" / ")+" formation.",type===best ? 0 : Math.max(1,count-1));
      }
    } else if (kind === "supply" || kind === "repair") {
      const item = kind === "repair" ? ["reed","ore","sap"][(index+step)%3] : recipes[(index+step)%3];
      const amount = kind === "repair" ? 2+(index%2) : 1;
      add("kit","Deliver "+items[item].name,"Spend "+amount+" to finish this leg immediately.",0,{[item]:amount});
      add("escort","Escort the relief crew","Recover provisions by facing "+count+" local opponents.",count,null,null,"supplies");
    } else if (kind === "passage") {
      const helper = pool.find(id => owned(id) && species[id].types.some(t=>kin.types.includes(t)));
      const price = {kinweave:1};
      add("guide","Guide the herd with a companion","Use a Kinweave as a tether and face "+Math.max(1,count-2)+" stragglers.",
        Math.max(1,count-2),price, helper ? null : "Befriend a local kin with a matching affinity.");
      add("detour","Take the guarded detour","Keep your supplies and face "+count+" opponents.",count);
    } else if (kind === "tactic") {
      const type = kin.types[0];
      const qualified = team.some(p=>p.hp>0 && species[p.id].skills.some(s=>s.kind==="attack" && dex.effectiveness(s.type,[type])>1));
      add("flank","Counter the "+type+" flank","A matching counter cuts one opponent from the patrol.",Math.max(1,count-1),null,qualified ? null : "Field a healthy companion with an advantage against "+type+".");
      add("draw","Draw out the whole patrol","Win the longer stand and recover extra medicine ingredients.",count+1,null,null,"supplies");
    } else {
      add("screen","Screen the caravan","Protect the wagons in a "+count+"-opponent relay battle.",count);
      add("decoy","Lay a bellstone decoy","Spend a bellstone to divert the rear guard.",Math.max(1,count-1),{ore:1});
    }
    return {
      title, description:brief.replaceAll("{kin}",kin.name), targetSite:site, focus,
      heading:region.name+" · "+title,choices,kind,condition:terrainRule[region.biome] || "gale",forecast:conditions[terrainRule[region.biome] || "gale"]
    };
  }

  window.WilderCampaign = {items,length,leg,conditions};
})();
