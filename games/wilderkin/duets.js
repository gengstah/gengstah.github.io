// The leading affinity of each Wilderkin determines the shared technique.
// The same score works in either order. Swapping the lead changes who receives the counter.
(() => {
  "use strict";
  const roles = {
    ward: {label:"Cover", cost:2, strength:.78, counter:.25, description:"Both kin strike under cover. The leader takes one quarter of the usual counter."},
    mend: {label:"Recovery", cost:2, strength:.60, counter:1, description:"Both kin strike lightly and restore a quarter of their own maximum health before the counter."},
    relay:{label:"Handoff", cost:2, strength:.88, counter:.50, description:"Both kin strike, then the partner takes the lead with cover against the counter."},
    lure: {label:"Restraint", cost:2, strength:1.25, counter:.50, description:"Drive the foe toward capture range, leaving at least 1 HP. The leader braces against its counter."},
    mark: {label:"Set up", cost:2, strength:.88, counter:1, description:"Both kin strike and expose a survivor. The next ordinary strike deals 50% extra damage and bypasses its guard."},
    rush: {label:"Breakthrough", cost:3, strength:1.48, counter:1, description:"Spend three beats on a full-strength double strike that pierces the foe’s guard."}
  };
  const pairs = new Map();
  function score(first,second,name,role) {
    const key=[first,second].sort().join("/");
    pairs.set(key,{name,role,affinities:key.split("/"),...roles[role]});
  }
  score("Grove","Grove","Bramble Hammock","ward");
  score("Grove","Ember","Firebreak","ward");
  score("Grove","Tide","Rain Garden","mend");
  score("Grove","Vane","Seed Courier","relay");
  score("Grove","Arc","Root Telegraph","mark");
  score("Grove","Loam","Buried Spring","mend");
  score("Grove","Rime","Rime Trellis","lure");
  score("Grove","Gloam","Night Orchard","mend");
  score("Grove","Chime","Bellflower Snare","lure");
  score("Grove","Alloy","Ironwood Canopy","ward");
  score("Ember","Ember","Cinder Chorus","rush");
  score("Ember","Tide","Steam Exchange","relay");
  score("Ember","Vane","Fire Kite","rush");
  score("Ember","Arc","Flash Furnace","rush");
  score("Ember","Loam","Kiln Door","ward");
  score("Ember","Rime","Thermal Fracture","mark");
  score("Ember","Gloam","Night Wick","relay");
  score("Ember","Chime","Signal Flare","mark");
  score("Ember","Alloy","Bell Foundry","rush");
  score("Tide","Tide","Returning Current","mend");
  score("Tide","Vane","Sail Change","relay");
  score("Tide","Arc","Storm Channel","rush");
  score("Tide","Loam","Clay Cradle","lure");
  score("Tide","Rime","Ice Harbor","ward");
  score("Tide","Gloam","Ink Mirror","relay");
  score("Tide","Chime","Sounding Line","mark");
  score("Tide","Alloy","Diving Bell","ward");
  score("Vane","Vane","Slipstream","relay");
  score("Vane","Arc","Thunderhead","rush");
  score("Vane","Loam","Silt Curtain","ward");
  score("Vane","Rime","Whiteout Turn","relay");
  score("Vane","Gloam","Curtain Call","relay");
  score("Vane","Chime","Whistling Net","lure");
  score("Vane","Alloy","Wind Vane","mark");
  score("Arc","Arc","Lightning Ladder","rush");
  score("Arc","Loam","Earth Wire","ward");
  score("Arc","Rime","Static Lattice","lure");
  score("Arc","Gloam","Afterimage","mark");
  score("Arc","Chime","Live Wire","mark");
  score("Arc","Alloy","Magnet Sling","relay");
  score("Loam","Loam","Quiet Burrow","mend");
  score("Loam","Rime","Moraine Wall","ward");
  score("Loam","Gloam","Hidden Warren","lure");
  score("Loam","Chime","Fault Echo","mark");
  score("Loam","Alloy","Load Bearing","ward");
  score("Rime","Rime","Fresh Snow","mend");
  score("Rime","Gloam","Moon Halo","lure");
  score("Rime","Chime","Glass Overtone","rush");
  score("Rime","Alloy","Frost Rivet","mark");
  score("Gloam","Gloam","Double Shadow","lure");
  score("Gloam","Chime","Night Watch","mend");
  score("Gloam","Alloy","Mirror Step","relay");
  score("Chime","Chime","Restoring Round","mend");
  score("Chime","Alloy","Split Harmonic","mark");
  score("Alloy","Alloy","Folded Shield","ward");

  window.WilderDuets = {
    score(first,second) { return pairs.get([first,second].sort().join("/")); }
  };
})();
