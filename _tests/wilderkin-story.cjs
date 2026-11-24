// Run with: node --test _tests/wilderkin-story.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({window:{}});
for (const name of ["atlas","story"]) {
  const file = path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
const story = context.window.WilderStory;
const atlas = context.window.WilderAtlas;
const newState = () => ({story:story.restore(null),crests:[],visited:[0],licenses:[],surveys:{},localWins:{},crafted:{}});
const clone = value => JSON.parse(JSON.stringify(value));
const permits = ["Raftwake","Cloudlift","Stonecleave","Lullsong","Glowpath","Frostspan"];

function progressWorld(s,ordinal) {
  const r=atlas.routes[ordinal];
  for (let i=0;i<=r.end;i++) {
    if (!s.visited.includes(i)) s.visited.push(i);
    s.surveys[i]=3;
    s.localWins[i]=3;
  }
  s.crests=atlas.routes.slice(0,ordinal).map(route=>route.end);
  s.licenses=permits;
  s.crafted.balm=3;
}

function read(s,id,pick=options=>options[0].id) {
  const turns=[];
  for (let n=0;n<30;n++) {
    const p=story.scene(s,id);
    if (p.status==="complete") return turns;
    assert.notEqual(p.status,"locked",id+": "+p.requirement);
    assert.ok(story.characters.some(c=>c.id===p.speakerId),p.speakerId);
    assert.ok(p.text.length>0);
    const choice=p.choices.length ? pick(p.choices) : undefined;
    turns.push(p);
    const outcome=story.advance(s,id,choice);
    assert.ok(outcome.ok,id+": "+outcome.message);
    const restored=story.restore(clone(s.story));
    assert.deepEqual(clone(restored),clone(s.story),"A reload changed the current dialogue cursor");
    s.story=restored;
  }
  assert.fail("Scene did not finish: "+id);
}

function allChapters(s,pick) {
  for(let ordinal=0;ordinal<30;ordinal++) {
    progressWorld(s,ordinal);
    const id="chapter-"+(ordinal+1);
    const lines=read(s,id,pick);
    assert.ok(lines.length>=6,id);
    assert.equal(story.chapterDone(s,ordinal),true);
  }
  s.crests=atlas.routes.map(r=>r.end);
}

test("the chapter trail, named cast, lessons and six companion arcs match the playable atlas",()=>{
  const s=newState();
  const all=story.catalog(s);
  assert.equal(new Set(all.map(d=>d.id)).size,55);
  assert.equal(new Set(all.map(d=>d.title)).size,55);
  for(const [i,chapter] of all.filter(c=>c.kind==="chapter").entries()) {
    assert.equal(chapter.region,atlas.routes[i].start,chapter.title);
    assert.equal(chapter.chapter,i+1);
  }
  assert.equal(all.filter(d=>d.kind==="bond").length,18);
  assert.equal(all.filter(d=>d.kind==="lesson").length,6);
  assert.equal(story.bonds(s).length,6);
  assert.ok(story.bonds(s).every(b=>b.total===3));
  assert.equal(story.scene(s,"ending").status,"locked");
  for(const d of all) {
    assert.ok(story.characters.some(c=>c.id===d.character));
    assert.ok(atlas.regions[d.region]);
    assert.ok(d.summary.length>=24);
  }
});

test("reading, choices, callbacks, bond trust and the journal transcript survive a reload",()=>{
  const left=newState(),right=newState();
  let p=story.scene(left,"chapter-1");
  assert.equal(story.transcript(left,p.id).length,1);
  assert.ok(!story.advance(left,p.id,"a").ok);
  const first=read(left,p.id,options=>options[0].id);
  read(right,p.id,options=>options[1].id);
  assert.ok(first.some(t=>t.choices.length===2));
  assert.ok(!story.advance(left,p.id).ok);
  assert.equal(story.bonds(left).find(b=>b.id==="nessa").points,1);
  assert.equal(story.bonds(right).find(b=>b.id==="edda").points,1);
  assert.ok(story.transcript(left,p.id).some(l=>l.speakerId==="finch" && l.text==="Give the mill families a copy"));
  assert.ok(!story.transcript(right,p.id).some(l=>l.text.includes("bread scale")));
  progressWorld(left,2);progressWorld(right,2);
  assert.match(story.scene(left,"chapter-3").text,/thumbprints/);
  assert.match(story.scene(right,"chapter-3").text,/time sheet/);
  assert.equal(story.scene(left,"__proto__"),null);
});

test("a personal errand must be accepted, its particular field task performed, and its reward elicited",()=>{
  const s=newState();
  const id="bond-nessa-1";
  assert.equal(story.scene(s,id).status,"locked");
  progressWorld(s,3);
  const location=atlas.routes[3].start;
  s.surveys[location]=0;
  assert.equal(story.scene(s,id).choices[0].id,"accept");
  assert.ok(!story.advance(s,id,"b").ok);
  assert.equal(story.advance(s,id,"accept").kind,"accepted");
  assert.match(story.scene(s,id).requirement,/Chart 2 field legs in Reedline Landing/);
  s.story=story.restore(clone(s.story));
  assert.ok(!story.advance(s,id).ok);
  s.surveys[location]=2;
  read(s,id);
  const bond=story.bonds(s).find(b=>b.id==="nessa");
  assert.equal(bond.completed,1);
  assert.ok(bond.points>=3);
  assert.equal(story.scene(s,"bond-nessa-2").status,"locked");
});

test("all six field lessons become completable before their first ability crossing",()=>{
  const s=newState();
  for(const name of permits) {
    const route=atlas.routes.find(r=>r.ability===name);
    const id="lesson-"+name;
    assert.ok(!story.hasLesson(s,name));
    s.crests=atlas.routes.slice(0,route.ordinal).map(r=>r.end);
    s.visited=s.visited.filter(i=>i!==route.start);
    assert.equal(story.scene(s,id).status,"locked");
    s.visited.push(route.start);
    assert.ok(!atlas.regions[route.start].ability);
    read(s,id);
    assert.ok(story.hasLesson(s,name));
  }
});

test("all four final outcomes can be earned, and the traveling watch needs six finished arcs",()=>{
  const s=newState();
  allChapters(s,options=>options[1].id);
  assert.ok(!story.ending(s));
  const beforeBonds=clone(s);
  for(const c of story.catalog(s).filter(d=>d.kind==="bond")) read(s,c.id);
  assert.ok(story.bonds(s).every(b=>b.completed===3 && b.rank==="Lifelong ally"));
  const conclusions=new Set();
  for(const choiceId of ["commons","relay","wild","watch"]) {
    const branch=clone(s);
    read(branch,"ending",options=>{
      assert.ok(options.some(c=>c.id===choiceId),choiceId);
      return choiceId;
    });
    conclusions.add(story.ending(branch));
    assert.equal(story.scene(branch,"ending").text,story.ending(branch));
    assert.equal(story.epilogue(branch).length,8);
    assert.ok(story.transcript(branch,"ending").length>=16);
  }
  assert.equal(conclusions.size,4);
  let scene=story.scene(beforeBonds,"ending");
  while(!scene.choices.length) {
    assert.ok(story.advance(beforeBonds,"ending").ok);
    scene=story.scene(beforeBonds,"ending");
  }
  assert.ok(!story.advance(beforeBonds,"ending","watch").ok);
  assert.ok(scene.lockedChoices.some(c=>c.label.includes("watch")));
  assert.ok(!story.ending(beforeBonds));
});

test("both authored responses for every chapter, field lesson and personal errand deliver distinct dialogue",()=>{
  for (const pickId of ["a","b"]) {
    const s=newState();
    progressWorld(s,29);
    for (const record of story.catalog(s).filter(d=>d.kind!=="ending")) {
      const turns=read(s,record.id,options=>options.length===1 ? options[0].id : pickId);
      assert.ok(turns.some(p=>p.choices.length===2),record.id);
      const transcript=story.transcript(s,record.id);
      assert.equal(s.story.records[record.id].choice,pickId);
      assert.ok(transcript.at(-2).speakerId!=="trail",record.id);
      assert.ok(transcript.at(-1).text.length>15,record.id);
    }
  }
});
