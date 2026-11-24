// Pella's field notes capture the first actual trigger of each campaign fitting.
(() => {
  "use strict";
  const kinds={wild:"Wild encounter",expedition:"Expedition patrol",warden:"Warden trial"};
  const validKin=id=>typeof id==="string"&&(Object.hasOwn(window.WilderKinDex?.homes||{},id)||id===window.WilderStillwake?.kin.id);
  function entry(raw){
    if(!raw||!window.WilderTrailFittings?.byId(raw.item)||!validKin(raw.holder)||!validKin(raw.foe)||
       !Object.hasOwn(kinds,raw.kind)||!Number.isInteger(raw.region)||!window.WilderAtlas?.regions[raw.region]||
       !Number.isInteger(raw.turn)||raw.turn<0||raw.turn>100000||typeof raw.text!=="string"||
       !raw.text.trim()||raw.text.length>360||/[\u0000-\u001F\u007F]/.test(raw.text))return null;
    const {item,holder,foe,kind,region,turn,text}=raw;return {item,holder,foe,kind,region,turn,text};
  }
  function restore(raw){
    const notes={};
    for(const item of window.WilderTrailFittings?.items||[]){
      const note=entry(raw?.[item.id]);if(note?.item===item.id)notes[item.id]=note;
    }
    return notes;
  }
  function record(state,raw){
    const note=entry(raw);if(!note||!state.party?.some(k=>k.id===note.holder))return false;
    const notes=state.fittingNotes||={};
    if(Object.hasOwn(notes,note.item))return false;
    notes[note.item]=note;return true;
  }
  function create({game,row,image}){
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const art=id=>"art/gear/"+id+".png";
    const name=id=>game.species[id]?.name||id;
    const back=row("nav","All field notes","kit-notes");
    const loc=note=>(game.regions[note.region]?.name||"On the trail")+" · "+kinds[note.kind]+(note.turn?" · Turn "+note.turn:" · Opening");
    function model(id){
      const book=game.state.fittingNotes||{},kit=game.trailFittings(),kind=kit.items.find(k=>k.id===id);
      if(kind){
        const n=book[id];
        return {title:kind.name,kicker:"PELLA HEM   /   FITTING NOTEBOOK",art:{src:art(id),height:100},
          subtitle:n?loc(n):"No field use recorded yet.",sections:[
            ...(n?[{title:name(n.holder)+" against "+name(n.foe),text:n.text}]:[]),
            {title:"When it works",text:kind.trigger+" "+kind.effect},
            group("Field bench",[row("view","Inspect "+kind.name,"kit-bench|item:"+id,kind.holder?"Held by "+name(kind.holder)+".":""),
              ...(n?[row("view","Meet "+name(n.holder),"kin|"+n.holder,"",{image:image(n.holder)})]:[]),back],2)]};
      }
      const logged=kit.items.filter(k=>book[k.id]),unchecked=kit.items.filter(k=>!book[k.id]);
      function card(k){
        const n=book[k.id];
        return row("view",k.name,"kit-notes|"+k.id,n?name(n.holder)+" · "+game.regions[n.region]?.name:
          k.claimed?(k.holder?"Held by "+name(k.holder):"In the field kit"):"At the camp bench",{image:art(k.id)});
      }
      return {title:"Pella’s fitting notebook",kicker:"FIELD NOTES   /   "+logged.length+" OF "+kit.items.length,
        art:{src:"ui/pella-hem.png",landscape:true,height:142},
        subtitle:logged.length?"Pella keeps the first field use of each fitting here.":"“Bring me the story of the first time that stitch holds.” — Pella Hem, camp outfitter",
        sections:[...(logged.length?[group("Recorded in the field",logged.map(card),2)]:[]),
          ...(unchecked.length?[group("Still to try",unchecked.map(card),2)]:[]),
          group("At camp",[row("nav","Open the field fittings bench","kit-bench","Choose a fitting for a traveling or reserve companion.")])]};
    }
    return {model};
  }
  window.WilderFittingNotes=Object.freeze({restore,record,create});
})();
