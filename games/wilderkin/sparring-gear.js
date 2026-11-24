// Fittings belong to a borrowed species in this lineup. Both crews can inspect them before play.
(() => {
  "use strict";
  const items=[
    {id:"relay-bell",name:"Relay Bell",role:"Switch tempo",
      trigger:"Switch directly to the holder with room for a beat after the usual gain.",
      effect:"Add 1 extra team beat, up to 3.",
      cost:"The switch takes your action. A free replacement or relay duet keeps the bell ready."},
    {id:"last-stitch",name:"Lifeline Stitch",role:"Knockout rescue",
      trigger:"An opposing hit would knock the holder out from 2 HP or more.",
      effect:"Survive that hit at 1 HP.",
      cost:"The next hit can finish the holder. A lure can already leave it at 1 HP."},
    {id:"seam-hook",name:"Seam Hook",role:"Beat denial",
      trigger:"The holder uses an ordinary attack to consume exposure while the rival has beats.",
      effect:"Remove up to 2 rival beats before their reply.",
      cost:"Set up the exposure with a mark duet. The rival can switch the marked kin out."},
    {id:"mender-wrap",name:"Mender’s Wrap",role:"Bench support",
      trigger:"The holder uses a guard skill with an injured, standing reserve.",
      effect:"Heal the reserve missing the largest share of its HP by one fifth of its maximum, rounded up. Formation order breaks ties.",
      cost:"Guard spends the turn. The wrap heals a reserve, even when its holder is hurt."},
    {id:"prism-lens",name:"Prism Lens",role:"Resisted coverage",
      trigger:"The holder uses an ordinary attack the target resists.",
      effect:"Use neutral affinity for this strike. Cover and exposure still apply.",
      cost:"A weak resisted strike can spend the lens before a stronger target arrives."},
    {id:"opening-pennant",name:"Opening Pennant",role:"Opening support",
      trigger:"The holder occupies the lead slot at the opening bell.",
      effect:"Start with 1 team beat. Both sides can carry a pennant.",
      cost:"A benched pennant stays idle for the whole match."}
  ].map(Object.freeze);
  const catalog=new Map(items.map(item=>[item.id,item]));
  const byId=id=>catalog.get(id)||null;
  const record=value=>value!==null&&Object.prototype.toString.call(value)==="[object Object]";
  function normalize(raw,left,right) {
    function side(entries,ids) {
      const pairs=[],used=new Set();
      for(const id of Array.isArray(ids)?ids:[]) {
        const item=record(entries)&&Object.hasOwn(entries,id)?entries[id]:null;
        if(catalog.has(item)&&!used.has(item)){used.add(item);pairs.push([id,item]);}
      }
      return Object.fromEntries(pairs);
    }
    const provided=key=>record(raw)&&Object.hasOwn(raw,key)?raw[key]:null;
    return {left:side(provided("left"),left),right:side(provided("right"),right)};
  }
  function validate(raw,left,right) {
    if(raw===undefined)return {left:{},right:{}};
    if(!record(raw)||Object.keys(raw).some(k=>k!=="left"&&k!=="right"))return null;
    const clean=normalize(raw,left,right);
    for(const side of ["left","right"]) {
      if(!Object.hasOwn(raw,side))continue;
      if(!record(raw[side])||Object.keys(raw[side]).some(k=>!Object.hasOwn(clean[side],k)||clean[side][k]!==raw[side][k]))return null;
    }
    return clean;
  }
  window.WilderSparringGear=Object.freeze({items:Object.freeze(items),byId,normalize,validate});
})();
