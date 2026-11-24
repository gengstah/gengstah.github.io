// A shared Hall recording has two teams and a finished tape. Its viewer has no playing seat.
(() => {
  "use strict";
  function create({game,image,row,go,openPractice,share}){
    const arena=window.WilderBellpostArena.create({game,image,row,rehearse:true});
    let film=null;
    const show=view=>go("hall-film",view,"replace");
    function load(entry,index){
      film=entry;
      return Number.isInteger(index)?"film|"+index:"result";
    }
    function model(view){
      if(!film)return {title:"Hall film",sections:[{rows:[row("nav","Open the Film Room","film-room")]}]};
      const [section,raw]=String(view||"result").split("|"),r=film.source;
      if(section==="film"||section==="gear")return arena.review(r,Number(raw),section==="gear"?"crew":"");
      const page=arena.model(r,section==="crew"?"crew":"");
      return {...page,sections:[...page.sections,{title:"Film desk",rows:[
        row("hall-film-share","Copy original film link",null,"Share the recorded moves and original teams."),
        row("nav","Open the Film Room","film-room")]}]};
    }
    function act(id,value,view){
      if(!film)return false;
      const [section,index]=String(view||"result").split("|");
      switch(id){
        case "post-film":case "post-film-step":show("film|"+Number(value));break;
        case "post-battle":show("result");break;
        case "post-panel":if(value==="crew")show("crew");break;
        case "spar-view":if(value!=="equipment")return false;show(section==="film"?"gear|"+index:"crew");break;
        case "post-rehearse":openPractice(film.source,Number.isInteger(value)?value:null,film);break;
        case "hall-film-share":share(film.publicHash);break;
        default:return false;
      }
      return true;
    }
    return {load,model,act,hash:()=>film?.publicHash};
  }
  window.WilderHallFilm={create};
})();
