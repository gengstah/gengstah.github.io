// The opening habitats teach couriers to take one newly befriended kin to meet another.
(() => {
  "use strict";

  const requests = {
    mossbell: {
      title:"The thirsty shell garden", target:"the shell garden", affinity:"Tide", motif:"flowers",
      scene:"Mossbell turns its back to the stream. The tiny yellow bells on its shell hang limp.",
      answer:"Water the flowers with a Tide strike.",
      response:"Each flower lifts its head. Mossbell comes closer, its little garden ringing in the rain."
    },
    gustlance: {
      title:"A cold takeoff stone", target:"the takeoff stone", affinity:"Ember", motif:"stone",
      scene:"Gustlance spreads its sail-feathers over a flat stone. Cold mist holds them down.",
      answer:"Warm the stone with an Ember strike to make an updraft.",
      response:"The mist lifts. Gustlance floats a wingbeat above the warm stone, then lands beside your team."
    },
    opalclasp: {
      title:"A signal past the reeds", target:"the far reed bed", pass:"beacon", motif:"reeds",
      scene:"Opalclasp taps a clear note with its small claw. From behind a wall of reeds comes a faint answer.",
      answer:"Have a heron such as Gustlance use Beacon Pass. Choose who will carry the signal the rest of the way.",
      response:"Two notes answer from the far bank. Opalclasp's petals hum the reply as it climbs out to meet the relay team."
    },
    leafshuttle: {
      title:"A gap in the leaf fan", target:"the leaf fan", affinity:"Grove", motif:"leaves",
      scene:"One shaft of sun slips through a gap in Leafshuttle's green fan. It tries to lift a fresh leaf from the bank.",
      answer:"Sweep fresh leaves within reach with a Grove strike.",
      response:"Leafshuttle threads a leaf into the gap. Its patchwork fan opens, and it settles beside the kin that helped."
    },
    coalmoth: {
      title:"The smoke-bound lantern", target:"the lantern vent", affinity:"Vane", motif:"stone",
      scene:"Coalmoth's glowing wings disappear in the smoke leaking from an old mine lantern. Its flight keeps circling the vent.",
      answer:"Send a Vane strike across the vent to clear the smoke.",
      response:"A ribbon of clean air opens. Coalmoth follows it out and hangs its warm wings over your shoulder."
    },
    cragroll: {
      title:"The hollow ledge", target:"the split ledge", affinity:"Chime", motif:"stone",
      scene:"Cragroll taps the cliff three times. It puts its weight on one plate, listening for a crack too deep to see.",
      answer:"Sound the ledge with a Chime strike so Cragroll can hear the hollow.",
      response:"A low echo gives the crack away. Cragroll takes the solid ledge and taps a fourth time at your feet."
    },
    sandtine: {
      title:"A buried trail mark", target:"the sand drift", affinity:"Vane", motif:"stone",
      scene:"Sandtine's ridged horns scrape at a drift. Half a crescent shows where it marked the way to shelter.",
      answer:"Blow the loose sand off the trail mark with a Vane strike.",
      response:"The full crescent appears. Sandtine traces the curve with one hoof, then shows your team the sheltered side."
    },
    dunehop: {
      title:"The thin burrow roof", target:"the burrow roof", affinity:"Loam", motif:"stone",
      scene:"The crust above Dunehop's burrow sags under one hind foot. From below, two smaller feet thump back.",
      answer:"Bank fresh earth against the roof with a Loam strike.",
      response:"The roof holds. Dunehop stamps twice and a pair of little ears pokes through the safe entrance."
    },
    glimmeray: {
      title:"A star in the weeds", target:"the stillwater reeds", affinity:"Chime", motif:"reeds",
      scene:"The pool is utterly still. Glimmeray tilts its shining back toward one point of starlight caught in the reeds.",
      answer:"Ring the reeds with a Chime strike to send ripples around the reflected star.",
      response:"Circles of starlight spread across the pool. Glimmeray glides through each one and comes to rest beside you."
    },
    iceribbon: {
      title:"An unfinished ice bridge", target:"the dry seam", affinity:"Tide", motif:"stone",
      scene:"Iceribbon has frozen two rims of a pool. A strip of bare gravel breaks the glistening trail in the middle.",
      answer:"Wet the gravel with a Tide strike so Iceribbon can finish the bridge.",
      response:"Iceribbon breathes a sheet of ice across the seam. It skates to your boots with its long tail raised."
    },
    icemaul: {
      title:"A light over thin ice", target:"the ice shelf", affinity:"Rime", motif:"stone",
      scene:"Icemaul dangles its lure beside a crack in the shelf. Small fish dart toward the light and away from the falling edge.",
      answer:"Bind the cracked shelf with a Rime strike.",
      response:"The crack seals and the fish scatter safely. Icemaul draws a bright loop in the water beside your team."
    },
    galepincer: {
      title:"The broken reed gauge", target:"the reed gauge", affinity:"Alloy", motif:"reeds",
      scene:"Galepincer measures the wind with a reed balanced on a metal pin. Each gust bends the pin flat.",
      answer:"Brace the pin with an Alloy strike so the reed can turn.",
      response:"The reed swings cleanly. Galepincer reads the wind, spreads its sail-feathers and settles next to its helpers."
    }
  };

  function forKin(id, kin = window.WilderGame?.species[id]) {
    if (!kin || kin.id !== id) return null;
    const local = Object.hasOwn(requests, id) ? requests[id] : null;
    const request = local || window.WilderCallHabitats?.forKin(kin, window.WilderKinDex.shapeOf(id));
    return request ? {id, affinity:null, pass:null, ...request} : null;
  }

  function answeringMoves(kin, call) {
    if (call.pass) {
      const pass = window.WilderFamilyTechniques.forKin(kin.id);
      return pass?.id === call.pass ? [pass] : [];
    }
    return kin.skills.filter(s => s.kind === "attack" && !s.trained && s.type === call.affinity);
  }

  function helper(game, call) {
    if (!call || call.waiting || call.options.some(o => o.available)) return null;
    const state = game.state;

    // Prefer a companion the courier has already met, including one whose second affinity answers.
    const owned = state.party.map(p => ({p, move:answeringMoves(game.species[p.id], call)[0]}))
      .filter(({p, move}) => move && p.id !== call.id)
      .sort((a, b) => Number(b.p.hp > 0) - Number(a.p.hp > 0));
    if (owned.length) {
      const {p, move} = owned[0];
      return {id:p.id, name:game.kin(p.id, {owned:true}).name, skill:move.name,
        owned:true, traveling:state.team.includes(p.id), healthy:p.hp > 0, region:state.region};
    }

    // A spider that needs an Arc strike to join cannot be the party's first cooperative Arc helper.
    // Prefer a helper whose own call the courier already has the moves to answer.
    const knownResponses = new Map();
    function canAnswer(request) {
      if (!request) return false;
      const key = request.pass || request.affinity;
      if (!knownResponses.has(key)) {
        knownResponses.set(key, state.party.some(p => answeringMoves(game.species[p.id], request).length));
      }
      return knownResponses.get(key);
    }
    const habitats = game.pools.flatMap((pool, region) => {
      const candidates = pool.flatMap(id => {
        if (id === call.id) return [];
        const kin = game.species[id], move = answeringMoves(kin, call)[0];
        return move ? [{id, name:kin.name, skill:move.name, region, canAnswer:canAnswer(forKin(id,kin))}] : [];
      });
      if (!candidates.length) return [];
      const open = game.access(region).open;
      return candidates.map(candidate => ({...candidate, open}));
    });
    habitats.sort((a, b) => Number(b.canAnswer) - Number(a.canAnswer) || Number(b.open) - Number(a.open) ||
      (a.open ? Math.abs(a.region-state.region) - Math.abs(b.region-state.region) : 0) || a.region - b.region);
    return habitats.length ? {...habitats[0], owned:false, traveling:false} : null;
  }

  window.WilderWildCalls = {forKin, answeringMoves, helper};
})();
