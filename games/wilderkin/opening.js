// The first outing is an invitation on the map. Normal walking and story play work immediately.
(() => {
  "use strict";
  const introductions={
    sprigkit:"A leaf-eared scout who fights with a flurry of leaves.",
    cindlet:"A fire drake who sneezes sparks when it gets excited.",
    dewfin:"A little swimmer who sends a jet of water through the reeds."
  };
  const invitation={
    kicker:"FIRST OUTING",title:"Choose your first partner",description:"Follow a companion to a wild Mossbell’s nest.",
    id:"nav",value:"first-outing"
  };
  function restore(value) {
    return typeof value==="string" && (value==="new" || Object.hasOwn(introductions,value)) ? value : "closed";
  }
  function create({state,commit,setLead,sightings}) {
    function available() {
      const s=state();
      return s.firstOuting==="new" && !s.battle && s.region===0 && s.visited.length===1 &&
        !s.wins && !s.met.length && !s.crests.length && s.seen.every(id=>Object.hasOwn(introductions,id)) && !s.surveys[0] &&
        !s.story.records["chapter-1"]?.done && !Object.keys(s.fieldwork).length;
    }
    const error=message=>({ok:false,kind:"error",message});
    function choose(id) {
      if(!available())return error("Your party is ready. Visit Party to change your leader.");
      if(typeof id!=="string" || !Object.hasOwn(introductions,id))return error("Choose one of Finch’s three companions.");
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
    function model() {
      const offer=game.firstOuting.offer();
      if(!offer)return {title:"Your first outing",kicker:"MOSSBROOK VALE",subtitle:"Your traveling party is ready.",
        sections:[{rows:[row("nav","Return to the trail","world"),row("nav","Visit your party","party")]}]};
      const choices=Object.entries(introductions).map(([id,intro])=>{
        const k=game.species[id];
        return row("outing-choose",k.name,id,k.type+" · "+intro,{image:image(id)});
      });
      return {title:"Who will lead?",kicker:"FIRST OUTING   /   MOSSBROOK VALE",
        subtitle:"Pick a partner to lead the walk to Mossbell’s nest. All three stay in your party.",
        sections:[{rows:choices},{rows:[row("outing-dismiss","Keep exploring",null,"You can choose a leader later in Party.")]}]};
    }
    function act(id,value) {
      if(id!=="outing-choose" && id!=="outing-dismiss")return false;
      const res=id==="outing-choose"?game.firstOuting.choose(value):game.firstOuting.dismiss();
      if(!res.ok)notify(res.message);
      else if(res.site)locate(res.site);
      else go("world",null,"root");
      return true;
    }
    return {model,act};
  }
  window.WilderOpening={restore,create,pages};
})();
