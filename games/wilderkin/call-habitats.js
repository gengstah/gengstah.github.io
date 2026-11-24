// Each animal leaves a request in its surroundings. The player's move is aimed at the named object.
(() => {
  "use strict";
  const habitats={
    mole:{
      title:"Mud at the back door",target:"clay plug",affinity:"Tide",
      scene:"pushes a claw through a sun-baked plug. Loose dirt trickles back into its tunnel.",
      answer:"Wash the clay soft enough to dig with a Tide strike.",
      response:"rakes the wet clay aside and pops up on the far side with mud on its nose."
    },
    heron:{
      title:"The sunken perch",target:"waterlogged reed bed",affinity:"Grove",
      scene:"lifts one long foot, then the other. Its fishing perch has sunk just beyond its reach.",
      answer:"Raise green shoots through the sodden reeds with a Grove strike.",
      response:"tests the new perch with one toe. A silver minnow circles in its shadow."
    },
    ram:{
      title:"One hoof short",target:"loose scree",affinity:"Loam",
      scene:"taps a narrow ledge with one hoof. Each tap sends another pebble over the edge.",
      answer:"Pack the loose scree into a firm step with a Loam strike.",
      response:"puts its full weight on the step, then skips back to lead a smaller ram across."
    },
    dragonfly:{
      title:"Four wings in the dew",target:"cold basking stone",affinity:"Ember",
      scene:"holds all four wings out over a cold stone. Beads of dew cling to their tips.",
      answer:"Warm the basking stone with an Ember strike.",
      response:"whirs its dry wings in pairs and rises straight up from the stone."
    },
    toad:{
      title:"The hollow reed",target:"hollow reed",affinity:"Chime",
      scene:"inflates its throat beside a broken reed. A little throat answers from somewhere down the bank.",
      answer:"Sound the hollow reed with a Chime strike so the two calls carry.",
      response:"answers the ringing reed. A tiny toad squeezes out from under a leaf."
    },
    armadillo:{
      title:"The broken runout",target:"bare root mat",affinity:"Grove",
      scene:"uncurls at the foot of a slope. Its round tracks run straight to a crumbling edge.",
      answer:"Use a Grove strike to grow a soft stop at the bottom.",
      response:"rolls downhill and lands neatly in the roots. Its nose pokes out first."
    },
    newt:{
      title:"A tail-width of water",target:"dry runnel",affinity:"Tide",
      scene:"sweeps its tail across a dry runnel. Wriggling young crowd the shrinking pool behind it.",
      answer:"Send a Tide strike down the runnel to connect the pools.",
      response:"flicks its tail into the new current. The small swimmers follow it across."
    },
    owl:{
      title:"Light in the hollow",target:"glinting trail mirror",affinity:"Gloam",
      scene:"blinks at a trail mirror. A bar of white glare cuts right across the mouth of its roost.",
      answer:"Shade the mirror with a Gloam strike so the owl can see its entrance.",
      response:"turns its broad face to the dark hollow, then glides inside on silent wings."
    },
    glider:{
      title:"The far landing",target:"far landing branch",pass:"beacon",
      scene:"stretches its gliding skin toward two crossing branches. From here they look like one.",
      answer:"Call a Beacon Pass to signal the far landing.",
      response:"follows the signal across the gap and catches the far branch with all four feet."
    },
    hedgehog:{
      title:"Bedding caught in burrs",target:"low burr stem",affinity:"Vane",
      scene:"backs away from a low stem. Its bundle of bedding leaves hangs from the burrs.",
      answer:"Lift the leaves free with a Vane strike.",
      response:"shuffles under the drifting leaves and carries a fresh bundle off on its quills."
    },
    hare:{
      title:"The bright crossing",target:"open stretch of path",affinity:"Gloam",
      scene:"flattens its ears at a patch of bare path. Two much smaller pairs of ears wait behind it.",
      answer:"Lay a strip of shade across the path with a Gloam strike.",
      response:"bounds through the shade. Two young hares hop into its tracks."
    },
    seal:{
      title:"Room on the ice",target:"split ice shelf",affinity:"Rime",
      scene:"rests its chin on a shelf of ice. A crack opens a little wider under each flipper.",
      answer:"Freeze the crack shut with a Rime strike to give the seal a place to haul out.",
      response:"pulls itself onto the joined ice and pats the sound edge with a flipper."
    },
    gecko:{
      title:"The slippery overhang",target:"wet slate",affinity:"Ember",
      scene:"spreads its toe pads against an overhang. A film of water sends one foot skidding.",
      answer:"Dry a narrow foothold on the wet slate with an Ember strike.",
      response:"sets one broad toe on the dry stone and strolls upside down to its crevice."
    },
    crab:{
      title:"A shelter for shedding",target:"bent tin arch",affinity:"Alloy",
      scene:"holds a bent scrap of tin over a smaller crab. A freshly shed shell lies beside them.",
      answer:"Use an Alloy strike to straighten the tin arch over the shelter.",
      response:"measures the arch with its small pincer, then releases the prop with its large one."
    },
    stag:{
      title:"An antler-wide gate",target:"tangle of living stems",affinity:"Grove",
      scene:"tilts its antlers sideways at a thicket. The worn track runs under a knot of live stems.",
      answer:"Use a Grove strike to guide the stems into an arch over the track.",
      response:"walks through with its antlers held high. The smallest twig passes between its tines."
    },
    jelly:{
      title:"The silent float",target:"copper marker float",affinity:"Arc",
      scene:"pulses its bell beneath a copper float. A string of tiny bells is drifting past the silent marker.",
      answer:"Light the copper float with an Arc strike.",
      response:"flashes back at the marker. The smaller bells gather in a bright cluster."
    },
    serpent:{
      title:"After the cold rain",target:"flat coil stone",affinity:"Ember",
      scene:"touches its tongue to a flat stone, then recoils. Cold rain still fills its shallow grooves.",
      answer:"Warm the stone with an Ember strike so the serpent can bask.",
      response:"tests the warmth with its chin and winds itself into a loose, comfortable coil."
    },
    falcon:{
      title:"Signal at the fork",target:"high fork of the roost",pass:"beacon",
      scene:"circles a tall fork. A fledgling has reached the lower branch and hesitates before the final hop.",
      answer:"Call a Beacon Pass to show the fledgling the high fork.",
      response:"banks beside the light. The fledgling follows and settles beneath its wing."
    },
    pika:{
      title:"Keep the cache cool",target:"warm cache stone",affinity:"Rime",
      scene:"keeps pulling wilted stems from a hay cache. Its stone lid is warm to the touch.",
      answer:"Chill the stone lid above the winter hay with a Rime strike.",
      response:"tucks its best stems beneath the cool stone and gives a short whistle."
    },
    snail:{
      title:"Chalk beneath the grit",target:"buried chalk seam",affinity:"Loam",
      scene:"rasps at a few white grains. A pale seam runs under the loose grit just ahead.",
      answer:"Part the grit with a Loam strike to uncover the chalk.",
      response:"glides onto the seam and leaves a clean crescent where it grazes."
    },
    angler:{
      title:"A light that leads astray",target:"shining scrap",affinity:"Gloam",
      scene:"swings its own lure beside a shining scrap. The young keep following the wrong light.",
      answer:"Darken the scrap with a Gloam strike so the living lure stands out.",
      response:"makes one slow sweep with its lure and leads the young away from the scrap."
    },
    fungus:{
      title:"The dry nurse log",target:"cracked nurse log",affinity:"Tide",
      scene:"taps its cap over a cracked log. Its fine spores slide straight off the dry bark.",
      answer:"Wet the bark with a Tide strike so the spores can settle in its grooves.",
      response:"shakes a fresh dusting onto the damp bark and settles beside the log."
    },
    bat:{
      title:"Three hollow trunks",target:"hollow trunks",affinity:"Chime",
      scene:"hangs between three trunks. A small call comes from inside one, too faint to place.",
      answer:"Ring the hollow wood with a Chime strike so the occupied trunk answers.",
      response:"follows the answering squeak into the middle trunk. Two faces peek out."
    },
    mantis:{
      title:"A perch above the midges",target:"bent tin sign",affinity:"Alloy",
      scene:"hangs by one foot from a bent sign. Midges gather just above the spot where the top edge used to be.",
      answer:"Straighten the tin sign with an Alloy strike to bring its perch level with the midges.",
      response:"climbs along the level edge. One foreleg shoots out and returns with a midge."
    },
    gryphon:{
      title:"Feathers over the ledge",target:"loose flight feathers",affinity:"Vane",
      scene:"stamps at the edge of its eyrie. Loose feathers lie still above a steep drop.",
      answer:"Lift the feathers with a Vane strike to show the rising air.",
      response:"watches the feathers climb, spreads its wings and runs straight into the lift."
    },
    spider:{
      title:"A bell on the wrong thread",target:"copper trip line",affinity:"Arc",
      scene:"taps its front feet along a web fastened to copper. Two threads meet where the line has gone quiet.",
      answer:"Send an Arc strike along the copper so the carrying thread trembles.",
      response:"finds the trembling strand by touch and tightens it with a single turn of silk."
    }
  };
  function forKin(species,shape){
    if(!species||typeof species.name!=="string"||!species.name||typeof shape!=="string"||!Object.hasOwn(habitats,shape))return null;
    const h=habitats[shape];
    return {title:h.title,scene:species.name+" "+h.scene,target:"the "+h.target,affinity:h.affinity||null,pass:h.pass||null,
      answer:h.answer,response:species.name+" "+h.response};
  }
  window.WilderCallHabitats={forKin};
})();
