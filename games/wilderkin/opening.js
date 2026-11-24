// The first outing is an invitation on the map. Normal walking and story play work immediately.
(() => {
  "use strict";
  const assistants={
    sprigkit:{skill:"leaf-flurry",clue:"read-trace",intro:"Brush fallen petals aside to uncover tracks.",
      action:"Uncover the tracks",detail:"Sweep loose petals off the path beside the nest.",
      result:" lifts the petals. Small prints lead into the nest. Larger ones circle it."},
    cindlet:{skill:"ember-pop",clue:"read-surroundings",intro:"Cast a low light to see who moves under the leaves.",
      action:"Light the lantern",detail:"Spark the trail lantern behind the blind and watch the edge of its glow.",
      result:" sparks the lantern. In the light, a small face peeks out when Finch steps back."},
    dewfin:{skill:"bubble-jet",clue:"read-sound",intro:"Still the rattling reeds to hear who calls from the nest.",
      action:"Quiet the reeds",detail:"Wet the dry reeds by the blind so their rattling dies away.",
      result:" quiets the reeds. A cheep comes from the lining, then an answering call from the parent."}
  };
  const invitation={
    kicker:"FIRST OUTING",title:"Choose your first partner",description:"Read the signs at a wild Mossbell’s nest with a companion.",
    id:"nav",value:"first-outing"
  };
  function restore(value) {
    return typeof value==="string" && (value==="new" || Object.hasOwn(assistants,value)) ? value : "closed";
  }
  function create({state,commit,setLead,sightings}) {
    function available() {
      const s=state();
      return s.firstOuting==="new" && !s.battle && s.region===0 && s.visited.length===1 &&
        !s.wins && !s.met.length && !s.crests.length && s.seen.every(id=>Object.hasOwn(assistants,id)) && !s.surveys[0] &&
        !s.story.records["chapter-1"]?.done && !Object.keys(s.fieldwork).length;
    }
    const error=message=>({ok:false,kind:"error",message});
    function choose(id) {
      if(!available())return error("Your party is ready. Visit Party to change your leader.");
      if(typeof id!=="string" || !Object.hasOwn(assistants,id))return error("Choose one of Finch’s three companions.");
      const target=sightings().find(site=>site.species==="mossbell");
      if(!target)return error("The Mossbell trail is unavailable here.");
      // setLead checks health and membership, then saves lead and first choice together.
      const s=state();
      s.firstOuting=id;
      const reply=setLead(id);
      if(!reply.ok){s.firstOuting="new";return reply;}
      return {...reply,site:target.id};
    }
    function dismiss() {
      if(!available())return error("Your party is already on the trail.");
      state().firstOuting="closed";
      return commit("outing","The trail is yours to explore.");
    }
    return {offer:()=>available()?{...invitation}:null,choose,dismiss};
  }
  function pages({game,row,image,go,notify,locate}) {
    function nestAssist(study) {
      const s=game.state,actor=s.lead;
      if(study?.id!=="mossbell" || !study.atSite || study.complete || s.battle || s.region!==0 ||
         !Object.hasOwn(assistants,s.firstOuting) || !Object.hasOwn(assistants,actor) ||
         !s.team.includes(actor) || !s.party.some(p=>p.id===actor && p.hp>0))return null;
      const assist=assistants[actor],kin=game.kin(actor,{owned:true});
      const skill=kin.skills.find(move=>move.id===assist.skill);
      if(!skill || !study.clues.some(c=>c.id===assist.clue && !c.read))return null;
      return {...assist,actor,kin:kin.name,skillName:skill.name};
    }
    function assistRow(study) {
      const a=nestAssist(study);
      return a && row("outing-assist",a.action+" with "+a.kin,a.actor,a.skillName+" · "+a.detail,
        {image:image(a.actor),tone:"primary"});
    }
    function model() {
      const offer=game.firstOuting.offer();
      if(!offer)return {title:"Your first outing",kicker:"MOSSBROOK VALE",subtitle:"Your traveling party is ready.",
        sections:[{rows:[row("nav","Return to the trail","world"),row("nav","Visit your party","party")]}]};
      const choices=Object.entries(assistants).map(([id,assist])=>{
        const k=game.species[id];
        return row("outing-choose",k.name,id,k.type+" · "+assist.intro,{image:image(id)});
      });
      return {title:"Who will lead?",kicker:"FIRST OUTING   /   MOSSBROOK VALE",
        subtitle:"Finch heard something small in Mossbell’s nest. Choose who will help read the signs. All three stay in your party.",
        sections:[{rows:choices},{rows:[row("outing-dismiss","Keep exploring",null,"You can choose a leader later in Party.")]}]};
    }
    function act(id,value) {
      if(id==="outing-assist"){
        const a=nestAssist(game.study("mossbell"));
        if(!a || a.actor!==value){notify("That partner can’t read a new sign here.");return true;}
        const result=game.observe("mossbell",a.clue);
        if(result.ok)go("study","mossbell","replace");
        notify(result.ok?a.kin+a.result:result.message);
        return true;
      }
      if(id!=="outing-choose" && id!=="outing-dismiss")return false;
      const res=id==="outing-choose"?game.firstOuting.choose(value):game.firstOuting.dismiss();
      if(!res.ok)notify(res.message);
      else if(res.site)locate(res.site);
      else go("world",null,"root");
      return true;
    }
    return {model,act,assistRow};
  }
  window.WilderOpening={restore,create,pages};
})();
