// Warden field lessons. The lodge prints the formation's score before a fight;
// every called maneuver has a response available to the original three companions.
(() => {
  "use strict";
  const drills = {
    screen:["Shelter screen","The crew will brace against ordinary strikes for the next two responses.","Use a guarding strike now to break the screen and expose the front."],
    relay:["Reserve relay","The Warden will move the front kin to the back, keeping its current health.","Switch your own kin on this call to close the exchange lane."],
    aid:["Medic’s interval","The crew will restore one fifth of its front kin’s health instead of attacking.","Use a healing skill or medicine. The crew shares a smaller recovery with both fronts."],
    cadence:["Borrowed beat","A repeated action lets the Warden bank a charged elemental reply for the next beat.","Change your last action family. Strike, guard, care and switch count separately."],
    shunt:["Crosswind gate","The line will send your active kin behind the next conscious teammate.","Hold the front with a guarding strike or choose your own switch."],
    colors:["Signal volley","The Warden will strike with the announced affinity. The next volley uses the other color.","Use a guarding strike or receive the volley with a resistant kin."],
    tangle:["Snared bell cord","An unprotected bell loses up to two duet beats to the Warden’s cord.","Change partners or perform a duet to pass the bell safely."]
  };
  // Name, score, spoken briefing, first cue, interval, choreography and local signal affinities.
  const scripts=[
    ["Fern","The shelter door","Mossbell raises its shell when my elbow lifts. Tap the lip with your own guarding move before it settles. The shelter was built to let small things out.",1,4,["screen"],"Grove","Tide"],
    ["Flint","The cold-lantern round","At Emberwatch we worked in pairs. Take a different job on the lantern beat, then notice which light passes to the next keeper.",2,3,["cadence","relay"],"Ember","Loam"],
    ["Lune","The twin reflection","Watch the second reflection at Moonwell. While my line trades places you can cross in front of it. The next quiet interval belongs to the medic.",1,3,["relay","aid"],"Tide","Gloam"],
    ["Marl","The ferryman’s eddy","Set your feet when I turn the tiller. Otherwise the near bank becomes the far bank. The green and blue flags tell you what current comes next.",1,3,["shunt","colors"],"Grove","Tide"],
    ["Kestrel","Slack in the kite line","The pennant runs down a long cord. Pass the bell before the knot reaches you. A fresh hand keeps the next stroke from tangling.",1,4,["tangle","cadence"],"Vane","Arc"],
    ["Chert","The hollow sounding","The Hearth crews work behind stone shutters. Sound one with a guarding blow, then let the medic hear a partner breathe.",1,3,["screen","aid","cadence"],"Loam","Chime"],
    ["Safa","Two caravan bells","The first caravan bell warns about the ground; the second warns about the wind. Brace for one, and choose the rider who hears the other.",1,3,["colors","tangle"],"Loam","Vane"],
    ["Nacre","Prism handoff","The Prism Parlour turns its painted lamps toward the opposite crew. Count the exchange first. The new color belongs to the next cannon.",1,4,["relay","colors","screen"],"Arc","Gloam"],
    ["Tovan","The tempered hinge","A well-made hinge has a little give. Change your footing when you hear the anvil, then catch the gate with your shoulder.",2,3,["cadence","shunt","screen"],"Alloy","Ember"],
    ["Aster","Rescue at the tarn","A rescuer gets one quiet breath before the rope runs tight. Use that breath to mend a companion, then decide who will take the pull.",2,3,["aid","shunt"],"Tide","Rime"],
    ["Orva","The windward tack","When my sail goes round, both lines must change places. Miss the handoff and the next gust will choose your footing.",1,3,["relay","shunt","cadence"],"Vane","Rime"],
    ["Perrin","Carver’s wedge","This chisel is a wedge, too. A brace takes it cleanly. Watch the other hand for the shield that follows it.",1,4,["shunt","screen","relay"],"Loam","Alloy"],
    ["Velin","The answering choir","You hold a note, I give the answer. Two identical phrases wake the deepest echo. Let the next voice carry the cord.",2,3,["cadence","tangle","colors"],"Chime","Gloam"],
    ["Pipra","The lamp surgeon","The keeper at the kiln works while the light is out. Tend your injuries on that quiet beat; our safety shutters come down on the next one.",2,4,["aid","screen","relay"],"Ember","Arc"],
    ["Siv","The divided pipe","Two pipes hold two different notes. Hear the note before you touch the mouthpiece. The reed that follows can pull a kin out of position.",1,4,["colors","shunt","tangle"],"Rime","Chime"],
    ["Della","The spare towline","A salvager never throws the last line. Give the bell to a free pair of hands, then send the right partner across the opening.",1,3,["tangle","relay","aid"],"Tide","Alloy"],
    ["Ivo","The mill’s blind side","The sail swings past the front twice. Trade stations before the first pass or set your feet against the second.",1,3,["relay","shunt","colors"],"Vane","Ember"],
    ["Quill","The erased turn","I file the record of a turn somebody tried to rub out. Your final stroke tells me what the missing one should sound like.",2,4,["cadence","colors","aid"],"Chime","Tide"],
    ["Anise","The seedkeeper’s screen","The seed canopy catches the hail if its leaves open in time. Challenge the first leaf and the next young shoot has a clear path.",1,3,["screen","colors","tangle"],"Grove","Rime"],
    ["Bryn","Foxfire at the fork","The real firefly always returns a signal. The borrowed one takes a little light from your bell. Follow a different voice across the fork.",1,3,["tangle","colors","relay"],"Gloam","Arc"],
    ["Sorrel","The orchard ward","We keep the orchard gates open for the medicine cart. Help the passenger first. A second crew will offer to take the next part of the road.",2,3,["aid","relay","screen"],"Grove","Loam"],
    ["Bas","A paddle across the bow","An obsidian paddle will turn a boat sideways before it cracks. Brace when I lay it flat, and have the next pair of hands ready.",1,3,["shunt","tangle","relay"],"Loam","Tide"],
    ["Rua","Ash above the plume","A plume can carry one draft above another. Read the bright ash first. A wingbeat later, the lookout changes places.",1,4,["colors","relay","cadence"],"Ember","Vane"],
    ["Alda","The cooling mould","Two shields hold the casting steady while the medicine crew crosses. Repeating the same hammer stroke on cooling metal will split it.",1,3,["screen","cadence","aid"],"Alloy","Rime"],
    ["Niva","Tracks in single file","The last caribou knows when the lead must turn. Cross my front before the herd changes places; hold your ground at the next gust.",1,4,["relay","shunt","aid"],"Rime","Grove"],
    ["Elva","The fault in the halo","The aurora makes two rings on the lens. One shines through; one pulls on the signal line. Watch which color reaches the glass.",1,3,["colors","tangle","cadence"],"Arc","Rime"],
    ["Tam","The loose skate","We keep the gate loose so a skater can step out. Brace for the turn, then use the repair interval while the ice is quiet.",1,3,["shunt","aid","screen"],"Rime","Tide"],
    ["Vega","Two lights at the ferry","A ferry runs between the last lantern and its reflection. Match the first medical pause, then follow the signal off the water.",2,3,["aid","colors","tangle"],"Tide","Gloam"],
    ["Yara","Meridian rope team","The meridian line reaches past both sides of this ridge. Pass the bell safely, stand the gate, and send a fresh pair over.",1,3,["tangle","shunt","relay"],"Arc","Vane"],
    ["Orris","The unstruck interval","My aunt made the central bearing removable. First change the answer you give me. Then show me a gate that can open and a signal someone else can carry.",2,3,["cadence","screen","relay","colors"],"Chime","Grove"]
  ];
  const parts=["strike","guard","switch","care","duet"];
  function plan(region) {return region?.warden?scripts.find(a=>a[0]===region.warden):null;}
  function restore(b,region) {
    const p=plan(region);
    if(!p)return null;
    const heard=Array.isArray(b?.heard)?[...new Set(b.heard.filter(code=>p[5].includes(code)))]:[];
    return {heard,screen:b?.screen===1||b?.screen===2?b.screen:0,
      charge:b?.charge===true,last:parts.includes(b?.last)?b.last:null,action:null};
  }
  function lesson(s,r,i) {
    const p=plan(r);if(!p)return null;
    const total=r.ordinal<3?1:2,mastered=s.wardenLessons.includes(i);
    const heard=s.battle?.kind==="warden"&&s.region===i?s.battle.coach?.heard||[]:[];
    return {title:p[1],coach:p[0],brief:p[2],mastered,progress:mastered?total:Math.min(total,heard.length),total,
      challenge:"Answer "+(total===1?"one call":"two different calls")+" in a single victory. Score order: "+p[5].map(id=>drills[id][0]).join(" → ")+".",
      reward:"A signed lesson seal, one Brighthorn tonic and two Kinweaves."};
  }
  function cue(r,b) {
    const p=plan(r);
    if(!p||!b?.coach)return null;
    const delta=b.turn-p[3],period=p[4],index=delta<0?0:Math.ceil(delta/period),code=p[5][index%p[5].length];
    const wait=p[3]+index*period-b.turn,element=p[6+Math.floor(index/p[5].length)%2];
    return {code,wait,element,title:drills[code][0],description:drills[code][1],counter:drills[code][2]};
  }
  function intent(r,b,base,attack) {
    const c=cue(r,b);if(!c)return base;
    base.guarding=base.guarding||b.coach.screen>0;
    if(c.wait) {
      if(b.coach.charge){base.skill=attack;base.charged=true;base.power=attack.power+2;}
      return base;
    }
    if(c.code==="colors")return {...base,skill:{name:c.element+" signal",type:c.element,power:7},power:7,charged:true,call:c.code};
    return {...base,skill:{name:c.title,type:"Neutral",power:0},power:0,charged:false,support:true,call:c.code};
  }
  function forecast(s,r,i) {
    const b=s.battle;if(b?.kind!=="warden")return null;
    const c=cue(r,b),l=lesson(s,r,i);if(!c||!l)return null;
    const prefix=b.coach.screen>0?"Their screen braces the front. ":b.coach.charge?"A banked reply is charged. ":"";
    let desc=c.description;
    if(c.code==="colors")desc="The Warden calls a "+c.element+" volley. A different color returns on the next volley.";
    if(c.code==="relay"&&!b.remaining.length)desc="The last kin will hold a one-response screen in place of the exchange.";
    return {...l,lesson:l.title,title:c.wait?"Next call · "+c.title:c.title,active:c.wait===0,kind:c.code,
      description:prefix+(c.wait?"In "+c.wait+" turn"+(c.wait===1?"":"s")+". ":"")+desc,
      counter:(c.code==="cadence"?"Previous action: "+(b.coach.last||"none (guard to open)")+". ":"")+c.counter};
  }
  function respond({state:s,region:r,dex,species,member,team,rotate,knockedOut}) {
    const b=s.battle,t=b.coach,c=cue(r,b);if(!c)return null;
    const part=t.action||"duet",last=t.last,active=member(b.activeId);
    t.last=part;t.action=null;t.screen=Math.max(0,t.screen-1);t.charge=false;
    if(c.wait)return null;
    let read=false,message="",shifted=false;
    switch(c.code) {
      case "screen":
        read=part==="guard";
        if(!knockedOut){if(read)b.opening=true;else t.screen=2;}
        message=read?"The guard catches the screen as it opens.":"The crew braces its front for two responses.";break;
      case "relay":
        read=part==="switch";
        if(!read&&!knockedOut) {if(b.remaining.length){rotate();shifted=true;}else t.screen=1;}
        message=read?"Your change closes the exchange lane.":shifted?"The crew relays its wounded front to the back. "+species[b.enemy.id].name+" takes over.":"The rear line holds.";break;
      case "aid":{
        read=part==="care";
        if(!knockedOut){
          const foe=b.enemy,amount=Math.min(foe.maxHp-foe.hp,Math.ceil(foe.maxHp*(read ? .1 : .2)));
          foe.hp+=amount;
          message="The medic restores "+amount+" HP to "+species[foe.id].name+".";
          if(read){const hp=Math.min(active.maxHp-active.hp,Math.ceil(active.maxHp*.1));active.hp+=hp;message+=" The shared field ward restores "+hp+" HP to your front.";}
        }
        break;
      }
      case "cadence":
        read=last?part!==last:part==="guard";if(!knockedOut){if(read)b.opening=true;else t.charge=true;}
        message=read?"Your change leaves the formation open.":"The repeated action lets the Warden bank a charged reply.";break;
      case "shunt":{
        read=part==="guard"||part==="switch";
        if(!read&&!knockedOut){
          const roster=team(),index=roster.indexOf(active),next=[...roster.slice(index+1),...roster.slice(0,index)].find(p=>p.hp>0);
          if(next){b.activeId=next.id;message=species[next.id].name+" is moved to your front.";}
        }
        message=message||"Your front holds its place at the gate.";break;
      }
      case "colors":
        read=part==="guard"||dex.effectiveness(c.element,species[active.id].types)<1;
        message=read?"Your front reads the colored signal.":"";break;
      case "tangle":
        read=part==="switch"||part==="duet";
        if(!read&&!knockedOut){const lost=Math.min(2,b.beats);b.beats-=lost;message="The cord catches "+lost+" of your beats.";}
        else if(read)message="You pass the bell clear of the cord.";break;
    }
    if(read&&!t.heard.includes(c.code)){
      t.heard.push(c.code);message+=(message?" ":"")+r.warden+" marks "+c.title+" on the lesson sheet.";
    }
    return {message:knockedOut&&!read?"":message,shifted};
  }
  window.WilderWardens={restore,lesson,forecast,intent,respond};
})();
