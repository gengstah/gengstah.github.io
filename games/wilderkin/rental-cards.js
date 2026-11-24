// A rental is an ordered, fitted Scout Table four. Each saved variation occupies its own storage key.
(() => {
  "use strict";
  const prefix="#rental-v1=",shelf="wilderkin.rental.v1.",limit=640;
  const featured=[
    {card:{name:"Rain Garden Relay",ids:["dewfin","thicketowl","kilnclaw","cairnwatch"],
      gear:{dewfin:"opening-pennant",thicketowl:"mender-wrap",kilnclaw:"last-stitch",cairnwatch:"relay-bell"}},
      lead:"dewfin",plan:"Open with Dewfin’s pennant. Bring Thicketowl to restore both partners with Rain Garden. Pick Kilnclaw for Mossbell or Cairnwatch for Pincoil."},
    {card:{name:"Beacon Runners",ids:["gustlance","kilnbeak","arcbill","iceribbon"],
      gear:{gustlance:"opening-pennant",kilnbeak:"seam-hook",arcbill:"prism-lens",iceribbon:"last-stitch"}},
      lead:"gustlance",plan:"Use Gustlance’s opening beat for Beacon Pass to Kilnbeak. Backdraft hits the marked target and Seam Hook removes up to two rival beats. Bring Arcbill against Tide."},
    {card:{name:"Foundry Breakers",ids:["smelteroll","ironblink","brookpeep","sprigkit"],
      gear:{smelteroll:"opening-pennant",ironblink:"relay-bell",brookpeep:"last-stitch",sprigkit:"mender-wrap"}},
      lead:"smelteroll",plan:"Open with Smelteroll and switch to Ironblink. Relay Bell fills the meter for Bell Foundry to break through cover. Pick Brookpeep for Ember or Sprigkit for Tide."}
  ];
  function title(value) {
    if(typeof value!=="string"||value.length>256||/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}<>]/u.test(value))return null;
    const clean=value.normalize("NFC").trim().replace(/\s+/gu," ");
    return clean&&Array.from(clean).length<=36?clean:null;
  }
  const titleField=text=>encodeURIComponent(text).replace(/[!'()*.~]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
  const barred=e=>e?.name==="SecurityError"||e?.name==="NotAllowedError"||
    !/quota/i.test((e?.name||"")+" "+(e?.message||""))&&/denied|disabled|blocked|unavailable/i.test(e?.message||"");
  function create({game,storage}) {
    const codec=window.WilderBellpostRules.create({game,storage:null}).filmCodec;
    let persistent=false,known=new Set();
    try{
      if(storage===undefined)storage=window.localStorage;
      persistent=!!storage&&["getItem","setItem","removeItem","key"].every(k=>typeof storage[k]==="function")&&Number.isInteger(storage.length);
      if(persistent)storage.getItem(shelf);
    }catch{persistent=false;}
    function encode(card) {
      const name=title(card?.name);
      if(!name)return null;
      const team=codec.team(card,4);
      if(!team)return null;
      const hash=prefix+titleField(name)+"."+team;
      return hash.length<=limit?hash:null;
    }
    function decode(hash) {
      if(typeof hash!=="string"||hash.length>limit||!hash.startsWith(prefix))return null;
      const split=hash.indexOf(".",prefix.length);
      if(split<0)return null;
      let name;
      try{name=title(decodeURIComponent(hash.slice(prefix.length,split)));}catch{return null;}
      const team=codec.readTeam(hash.slice(split+1),4);
      if(!name||!team)return null;
      const card={name,ids:team.ids,gear:team.gear};
      return encode(card)===hash?card:null;
    }
    const failed=(code,message)=>({ok:false,code,message,persistent});
    const success=(id,code,message)=>({ok:true,id,code,message,persistent});
    function save(card) {
      const hash=encode(card);
      if(!hash)return failed("invalid","Give this card a name of 1–36 characters and four different standard kin with legal equipment.");
      const id=hash.slice(prefix.length),key=shelf+id;
      let duplicate=known.has(id);
      if(persistent)try{
        duplicate=storage.getItem(key)===hash;
        if(!duplicate){
          storage.setItem(key,hash);
          if(storage.getItem(key)!==hash)return failed("storage","The card could not be saved on this device.");
        }
      }catch(e){
        if(!barred(e))return failed("storage","The card could not be saved on this device. Your existing rentals are still on the shelf.");
        persistent=false;duplicate=known.has(id);
      }
      known.add(id);
      return duplicate?success(id,"duplicate",persistent?"This rental is already saved.":"This rental is already on this session’s shelf."):
        success(id,persistent?"saved":"session",persistent?"Rental saved to your shelf.":"Rental saved for this session only.");
    }
    function list() {
      if(persistent)try{
        const found=new Set();
        for(let i=0;i<storage.length;i++){
          const key=storage.key(i);
          if(!key?.startsWith(shelf)||key.length>shelf.length+limit)continue;
          const id=key.slice(shelf.length),hash=storage.getItem(key);
          if(hash===prefix+id&&decode(hash))found.add(id);
        }
        known=found;
      }catch{persistent=false;}
      return [...known].map(id=>({id,card:decode(prefix+id)})).sort((a,b)=>a.card.name.localeCompare(b.card.name,"en")||a.id.localeCompare(b.id,"en"));
    }
    function remove(id) {
      if(typeof id!=="string"||!decode(prefix+id))return failed("invalid","Choose a saved rental to remove.");
      if(persistent)try{
        const key=shelf+id;
        if(storage.getItem(key)!==prefix+id){known.delete(id);return failed("missing","This rental is no longer on your shelf.");}
        storage.removeItem(key);
        if(storage.getItem(key)!==null)return failed("storage","The card is still saved on this device.");
      }catch{return failed("storage","This device could not remove the saved card.");}
      else if(!known.has(id))return failed("missing","This rental is no longer on your shelf.");
      known.delete(id);
      return success(id,"removed",persistent?"Rental removed from your shelf.":"Rental removed from this session’s shelf.");
    }
    return {encode,decode,save,list,remove,featured:()=>featured.map(({card,lead,plan})=>({
      card:{name:card.name,ids:card.ids.slice(),gear:{...card.gear}},lead,plan})),get persistent(){return persistent;}};
  }
  window.WilderRentalCards=Object.freeze({create});
})();
