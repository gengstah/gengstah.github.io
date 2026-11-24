// The field melody leaves a rest for the second bell. A partner answers that rest in battle.
(() => {
  "use strict";
  const pieces={
    woodland:{key:62,scale:[0,2,4,7,9],roots:[0,-5,-3,-5],phrase:[0,null,2,1,null,3,null,null,1,null,2,4,3,null,null,null]},
    water:{key:65,scale:[0,2,5,7,9],roots:[0,-5,-7,-5],phrase:[0,null,null,2,3,null,1,null,4,null,3,null,2,1,null,null]},
    rock:{key:60,scale:[0,3,5,7,10],roots:[0,-2,-5,-2],phrase:[2,null,1,null,0,null,null,3,2,null,4,3,null,1,null,null]},
    night:{key:63,scale:[0,2,3,7,10],roots:[0,-5,-2,-7],phrase:[0,null,3,null,null,2,null,1,3,null,null,4,2,null,null,null]}
  };
  const habitats={wood:"woodland",fen:"water",shore:"water",mesa:"rock",dune:"rock",basalt:"rock",alpine:"night",grotto:"night",night:"night",ice:"night"};
  const freq=midi=>440*Math.pow(2,(midi-69)/12);
  function voice(ctx,bus,{note,at,duration,gain,wave="sine",detune=0}) {
    const o=ctx.createOscillator(),env=ctx.createGain();
    o.type=wave;o.frequency.value=freq(note);o.detune.value=detune;
    env.gain.setValueAtTime(.0001,at);
    env.gain.exponentialRampToValueAtTime(gain,at+Math.min(.065,duration*.12));
    env.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*.28),at+duration*.55);
    env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(env).connect(bus);o.start(at);o.stop(at+duration+.02);
    o.onended=()=>{o.disconnect();env.disconnect();};
  }
  function notes(piece,step,battle,duet) {
    const bar=Math.floor(step/16),i=step%16,root=piece.key+piece.roots[bar%4];
    const voices=[];
    if(i===0 || (battle && i===8)) voices.push([root-12,battle?3:6,.11,"sine"]);
    const degree=piece.phrase[(i+(bar%4===2?4:0))%16];
    if(degree!=null) voices.push([root+piece.scale[degree]+(bar%4===3?12:0),battle?1.2:2.3,.068,"triangle"]);
    if(i%4===2 && (battle||bar%2===0)) voices.push([root+7,.85,.032,"sine"]);
    if(duet && (i%4===1||i%4===3)) voices.push([root+12+piece.scale[(bar+i)%5],1.8,.058,"sine"]);
    return voices;
  }
  function create({context}) {
    let ctx,bus,timer=null,step=0,next=0,answerUntil=0,unlocked=false;
    let mix=0,battle=false,piece=pieces.woodland;
    function tick(){
      if(!ctx || ctx.state!=="running")return;
      const unit=battle?.157:.245;
      if(next<ctx.currentTime-.15)next=ctx.currentTime+.03;
      while(next<ctx.currentTime+.18){
        for(const [note,beats,gain,wave] of notes(piece,step,battle,step<answerUntil)){
          voice(ctx,bus,{note,at:next,duration:beats*unit,gain,wave});
        }
        step++;next+=unit;
      }
    }
    function update(){
      const on=unlocked&&mix>0&&!document.hidden;
      if(!on) {
        clearInterval(timer);timer=null;
        if(bus)bus.gain.setTargetAtTime(.0001,ctx.currentTime,.025);
        return;
      }
      try {
        ctx ||= context();
        if(!ctx)return;
        if(!bus){bus=ctx.createGain();bus.gain.value=.0001;bus.connect(ctx.destination);}
        bus.gain.setTargetAtTime(mix===1?.29:.54,ctx.currentTime,.09);
        if(ctx.state==="suspended")ctx.resume().catch(()=>{});
        if(timer==null){next=ctx.currentTime+.04;timer=setInterval(tick,85);tick();}
      } catch { /* The trail remains playable with audio unavailable. */ }
    }
    document.addEventListener("visibilitychange",update);
    const unlock=()=>{unlocked=true;update();};
    document.addEventListener("pointerdown",unlock,{once:true});document.addEventListener("keydown",unlock,{once:true});
    return {
      scene(biome,inBattle,level){
        const nextPiece=pieces[habitats[biome]]||pieces.woodland;
        if(nextPiece===piece && battle===inBattle && mix===level)return;
        if(battle!==inBattle || nextPiece!==piece){step=0;answerUntil=0;}
        piece=nextPiece;battle=inBattle;mix=level;update();
      },
      answer(){answerUntil=step+16;}
    };
  }
  window.WilderScore={create};
})();
