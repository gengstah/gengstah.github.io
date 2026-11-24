// Training changes an owned starter's fourth skill. Its field identity and health remain its own.
(() => {
  "use strict";
  function course(id,name,description,move,title,type,kind,cost,mechanic) {
    return {id,name,description,skill:{id:move,name:title,type,kind,power:0,cost,description:mechanic,trained:true}};
  }
  const forms={
    sprigkit:{formId:"brackenveil",formName:"Brackenveil",description:"Layered fern fronds meet above its shoulders. On a narrow trail it can spread them across a second set of footprints.",
      milestone:"Earn the Leaf Crest at Mossbrook Lodge.",demonstration:"Have Sprigkit use Brush Dash and take a charged enemy counter.",
      disciplines:[
        course("hedgekeeper","Hedgekeeper","A moving shelter for the next kin to take the field.","wattle-ward","Wattle Ward","Grove","guard",2,
          "Raise cover for the next two enemy hits. Each deals 40% of its usual damage, even if you switch kin. The foe can answer immediately."),
        course("seamreader","Seamreader","Lure a braced foe into exposing the seam in its guard.","briar-seam","Briar Seam","Grove","attack",1,
          "Strike lightly and expose the foe for the next attack. Against a braced foe, deal twice this move’s damage and refund its beat.")
      ]},
    cindlet:{formId:"kilnwing",formName:"Kilnwing",description:"Its split tail feeds two bright wing furnaces. The membranes vent with a soft whistle when its partner moves into place.",
      milestone:"Visit Cinderfall Ridge.",demonstration:"Perform a Trail Duet with Cindlet as leader or partner.",
      disciplines:[
        course("fluewatch","Fluewatch","Time a gust to scatter the enemy’s charged technique.","backdraft-cut","Backdraft Cut","Ember","attack",1,
          "Interrupt a charged enemy counter with an Ember strike. The opponent spends its turn without hitting you. Only available against a charged move."),
        course("kindler","Kindler","Pay some of your own strength to launch a teammate’s duet.","cinder-handoff","Cinder Handoff","Ember","swap",0,
          "Pay one sixth of Kilnwing’s maximum HP and pass the lead to the next healthy teammate. Add up to two beats. The new lead halves the incoming hit.")
      ]},
    dewfin:{formId:"rillwarden",formName:"Rillwarden",description:"Its fins settle into a dark-blue saddle. Schools of smaller Wilderkin gather in the pocket of still water behind its tail.",
      milestone:"Visit Moonwell Reach.",demonstration:"Have Dewfin restore its own HP with Dew Bath in a trail battle.",
      disciplines:[
        course("harborhand","Harborhand","Shelter the companion with the worst injuries while keeping your place in the fight.","harbor-pool","Harbor Pool","Tide","heal",1,
          "Restore one third of the most injured conscious teammate’s maximum HP, including yourself. Rillwarden halves the enemy’s counter."),
        course("lockpilot","Lockpilot","Open the floodgate to control the order of the opposing formation.","turn-the-lock","Turn the Lock","Tide","guard",2,
          "Send the current opponent to the back of its formation at its present HP and halve the new foe’s reply. A lone foe becomes exposed and its reply is halved.")
      ]}
  };
  function restore(raw) {
    return Object.fromEntries(Object.entries(forms).map(([id,form])=>{
      const record=raw?.[id],selected=record?.demonstrated===true&&form.disciplines.some(d=>d.id===record.selected)?record.selected:null;
      return [id,{demonstrated:record?.demonstrated===true,selected,classic:record?.classic===true}];
    }));
  }
  function info(state,id) {
    const f=forms[id];if(!Object.hasOwn(forms,id))return null;
    const r=state.growth[id];
    const milestone=id==="sprigkit"?state.crests.includes(0):state.visited.includes(id==="cindlet"?1:2);
    const requirements=[{label:f.milestone,done:milestone},{label:f.demonstration,done:r.demonstrated}];
    const earned=requirements.every(t=>t.done),selected=earned?r.selected:null;
    return {id,formId:f.formId,formName:f.formName,description:f.description,earned,atCamp:state.landmark==="camp"&&!state.battle,
      requirements,selected,classic:r.classic,disciplines:f.disciplines};
  }
  function decorate(base,state) {
    if(!Object.hasOwn(forms,base.id)||!state.growth[base.id]?.selected)return base;
    const training=info(state,base.id),discipline=training.disciplines.find(d=>d.id===training.selected);
    if(!discipline)return base;
    return {...base,name:training.formName,description:training.description,formId:training.formId,
      appearanceId:training.classic?base.id:training.formId,discipline,skills:[...base.skills,discipline.skill]};
  }
  window.WilderGrowth={restore,info,decorate};
})();
