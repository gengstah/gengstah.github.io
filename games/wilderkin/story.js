/* The Missing Beat. Chapter ordinals follow WilderAtlas.routes; sessions store only
   the player's place and decisions, so dialogue remains readable after a reload. */
(() => {
  "use strict";

  const atlas = window.WilderAtlas;
  const characters = [
    ["finch","Finch Vale","Dispatch rider","You grew up delivering route slips from Mossbrook Lodge. During the Twelve-Bell Flood you carried an evacuation order upstream. Your copy said to wait an extra beat. You have kept the rain-stained slip in your boot for eleven years."],
    ["nessa","Nessa Brine","River pilot","Nessa teaches young pilots to count passengers by the weight under their feet. Her ferry saved forty people during the flood. The official tally says thirty-nine. Her brother Lev refuses to tell the harbor board whose name he erased."],
    ["tal","Tal Kest","Kitewright","Tal mends sailcloth with thread picked from old flour sacks. His mother Ina flew the last weather kite above the valley. Tal drew the trajectory on her missing-person report and has quietly redrawn it every year since."],
    ["hedd","Hedd Slate","Stone surveyor","Hedd can tell the direction of a break by the grit it leaves on his thumbnail. His mason's mark survives at the floodgate. Its straight cut points blame at the wrong shift. He has begun teaching apprentices to leave their mistakes visible."],
    ["mina","Mina Bell","Herd listener","Mina grew up between two pack caravans. When the Office bought her father's bell call, she believed they wanted to find lost animals. Now entire herds turn toward brass loudspeakers, even with their young still across the water."],
    ["edda","Edda Wick","Lamp technician","Edda built the amber lenses in the old alarm towers. She wears smoked glass after a bench explosion and identifies bulbs by heat. Her daughter Nell thinks the towers are haunted because Edda has never explained who dimmed them."],
    ["sol","Sol Rime","Icewright","Sol measures the shelf with a string of mismatched spoons. One is stamped with the number of his family's evacuation sled. The sled was sent back to save people on the mainland. Nobody asked those already riding in it."],
    ["mara","Director Mara Vell","Continuity Office","Vell founded the Office after the Twelve-Bell Flood. Its brass instruments gave isolated settlements a common alarm. She now wants all thirty crest circuits to obey one master beat. A child's river shoes hang over her office stove."],
    ["ada","Ada Pell","Office field auditor","Pell counts the return stroke of every bell to test whether it actually rang. She signed hundreds of reports without meeting the people in them. Her yellow gloves have blank cuffs for the names of witnesses."],
    ["fern","Fern","Warden of Mossbrook","Fern kept the shelter at Mossbrook open through the flood. She let the Wilderkin choose their own crossing. Her original feeding ledger survived under the boards of the lodge."],
    ["orris","Orris","Keeper of the Last Cairn","Orris tends the thirty hand bells at Horizon Cairn. The iron frame predates the Office. His aunt made its central bearing removable, so a keeper could always disarm the line by hand."],
    ["trail","Field notes","Your notebook","Finch keeps the dispatch slip and the names of witnesses in the same weatherproof book."]
  ].map(([id,name,role,bio]) => ({id,name,role,bio}));
  const cast = Object.fromEntries(characters.map(c => [c.id,c]));
  const allies = ["nessa","tal","hedd","mina","edda","sol"];
  const chapters = [], all = [], definitions = {};
  const line = (speakerId,text) => ({speakerId,text});
  const choice = (label,friend,policy,speaker,text,consequence) =>
    ({label,friend,policy,reply:line(speaker,text),consequence});
  const callback = (id,a,b) => ({id,a,b});
  const chapterId = ordinal => "chapter-"+(ordinal+1);

  function register(scene) {
    all.push(scene);
    definitions[scene.id] = scene;
    return scene;
  }
  function chapter(title,summary,character,lines,options,echo) {
    const ordinal = chapters.length;
    const route = atlas.routes[ordinal];
    const scene = register({id:chapterId(ordinal),title,summary,character,kind:"chapter",
      chapter:ordinal+1,region:route.start,lines,options,echo});
    chapters.push(scene);
  }

  chapter("The Bell without a Clapper","A signal for evacuation rings in Mossbrook on a cloudless morning.","fern",[
    line("trail","The first bell catches Finch with one boot in the millrace. On the bank a Mossbell presses its chin into the mud and refuses to follow the sound."),
    line("finch","The river is barely up to my ankle. Fern, who rang the flood bell?"),
    line("fern","Nobody here. Feel inside it. I took the clapper out last winter for melting scrap."),
    line("ada","Continuity Office, field inspection. Give me the time and the names of any animals that disobeyed the notice."),
    line("finch","That pause before the last stroke. I heard it on the night of the flood. It's written on the slip in my boot."),
    line("fern","Pell wants a signed account before sundown. Who takes the first copy?")],[
    choice("Give the mill families a copy","nessa","commons","fern","I'll put it by the bread scale. Nobody in this village has to wait for a clerk to read their own name.","The mill families keep the first witness list."),
    choice("Sign Pell's time sheet","edda","relay","ada","Put your name beside mine. If someone changes the time, both of us will have to answer for it.","Pell carries a second signature back to the Office.")]);

  chapter("Cold Ink at Emberwatch","Flint's kiln develops a second line on the eleven-year-old dispatch.","hedd",[
    line("hedd","Warm the slip above the ash, not the flame. Old gate ink had iron filings in it. See the letters bruise through?"),
    line("finch","'Hold east gate one beat.' I thought that was a rain crease. The school copy just says 'open.'"),
    line("edda","I ground that ink myself. There were twenty jars. Nineteen went to ferry houses and one to a woman who had just lost her son."),
    line("ada","Director Vell paid for all twenty. A receipt proves a purchase. It doesn't say who held the pen."),
    line("hedd","We get one good rubbing before the heat darkens the whole sheet. Which part do you want?")],[
    choice("Lift the gatekeeper's initials","hedd","commons","hedd","That's my H beside the stain. I never wrote 'open.' I'll come along to tell the difference under oath.","Hedd volunteers to identify the handwriting."),
    choice("Lift the interval marks","edda","relay","edda","There. Long, short, short, blank. That's a machine instruction, Finch. A tired pilot doesn't count in that rhythm.","Edda copies a sequence that a tower can replay.")]);

  chapter("The Thirteenth Stroke","A drowned recording reveals why the Crown wants the Warden crests.","mara",[
    line("trail","Lune lowers a blue bottle into the moonwell. Glimmeray lights the scratches in the glass. When Finch turns it, the lip whistles an extra note."),
    line("mara","I heard that note once while a boy in red shoes waited on a roof. If every village had opened on the same stroke, I would have reached him."),
    line("finch","You sent a test through an empty bell this morning. Why wake the animals?"),
    line("mara","A Wilderkin hears the ground before the water moves. Give me a path through thirty crests and every valley will have its full minute of warning."),
    line("mina","They hear orders, too. That Mossbell buried its ears. Who tells the machine when a creature has said no?")],[
    choice("Count the creatures that turn away","mina","wild","mina","Make a column for the ones that stay. Ink on both sides of a ledger is harder to fold out of sight.","Refusals enter Finch's migration ledger."),
    choice("Ask Vell for the circuit plans","tal","relay","mara","You can have my working copy. If you can find a better minute, I'll listen.","Vell releases a diagram of the Crown circuit.")],
    callback("chapter-1","The bread-scale list already carries forty-seven thumbprints. One describes a bell that shook before the sound came.","Pell opens Finch's signed time sheet. The tower's receipt is stamped a full second later than both witnesses."));

  chapter("The Weight of One Passenger","Nessa's old boat still rides lower on one side of the delta.","nessa",[
    line("nessa","Step on the tar square. Now the loose board. Feel the difference? That's how you count bodies when the cabin goes dark."),
    line("finch","Your return log calls this boat empty on the last eastbound crossing."),
    line("nessa","Lev was steering. He took an Office prisoner off a piling. Report him and the harbor board strips his ferry papers. Say nothing and that prisoner stays officially drowned."),
    line("ada","The prisoner was a tower mechanic named Ulo. A dead man can't contradict a public inquest."),
    line("nessa","I'm done letting paper decide who made it home. How shall we put him back aboard?")],[
    choice("Ask Ulo to mark his own seat","nessa","commons","nessa","He can make a mark or walk away. I'll keep the seat dry until he decides.","Ulo is invited to testify on his own terms."),
    choice("Trace the boat's waterline","hedd","relay","hedd","A loaded hull left a tar line in the lock. I can show the crossing happened without giving the board a name.","The delta case gains a physical record of the crossing.")]);

  chapter("Thread from a Missing Sail","Tal finds his mother's repair in the rigging of a new Office kite.","tal",[
    line("tal","This blue diagonal is Mum's. She used three short stitches and one long so she could feel a repair in the dark."),
    line("finch","That cloth is eleven years old. Who took it from Ina's kite?"),
    line("ada","The recovery crew cut this panel above the Hanging Quay. It went into storage under 'unclaimed linen.' No pilot was listed."),
    line("tal","They taught me she flew north. I've searched the north wall every thaw. The quay is south."),
    line("mara","The next launch is in fifteen minutes. If you cut down the panel the trial is over. Tell me what you need it for.")],[
    choice("Cut a strip for Tal's archive","tal","commons","tal","One stitch is enough. I'll send it to my sister with the real place name on the envelope.","Ina's family learns where the sail was found."),
    choice("Fly Ina's pattern above the quay","tal","wild","tal","Look at the Vane kin! They settle in the hollow behind her stitch. She was making shade for them.","Tal charts a safe thermal using the original sail.")]);

  chapter("A Mason's Signature","A false fault line beneath Shellvault points back to the floodgate.","hedd",[
    line("hedd","A fault walks sideways between two stones. This line goes straight through a fossil shell. Someone wanted it to look natural."),
    line("finch","Your old flood report blames a fault like this one."),
    line("hedd","My apprentice warned me about the tool marks. I signed because the Office was paying for new roofs. She left with her chisels still under my bench."),
    line("ada","Her name was Sen. She is alive and carving names on grave markers in the Ochre Reach."),
    line("hedd","If we tell the crew what the line means, a hundred roofs suddenly belong to a lie. Where do I start?")],[
    choice("Write a correction in Hedd's hand","hedd","commons","hedd","No passive verbs. 'I saw the cut. I signed anyway.' Sen can decide whether she wants my letter.","The quarry posts Hedd's signed correction."),
    choice("Have the apprentices test the stone","hedd","wild","hedd","They're arguing with me already. Good. I'll pay them for the day even if they prove me wrong.","Three apprentices independently examine the cut.")]);

  chapter("A Call Bought by the Yard","At Bellkeeper Mesa a loudspeaker copies Mina's welcome call.","mina",[
    line("mina","Hear the last two notes? My father played those when a calf lost sight of its mother. That speaker is calling every calf in the valley."),
    line("mara","Movement before the rain is safer than movement after it. The license was signed and paid for."),
    line("mina","He sold a tune to a lost-animal service. He never sold you the right to sound like somebody's mother."),
    line("finch","The herd has split around our wagon. The adults are waiting for a sound they're never going to hear."),
    line("mina","I can answer from the wagon or take the horn out of the pole. Which will bring them back together?")],[
    choice("Let Mina answer the calves","mina","wild","mina","A calf can tell a living throat from a horn if you leave space between the notes. Watch their ears turn.","The herd regroups around Mina's living reply."),
    choice("Lower the speaker and summon its owner","mina","commons","ada","I'll sign the removal order. My signature can earn its supper for once.","The Office seals the borrowed call pending a hearing.")]);

  chapter("Light with a Second Shadow","A geode separates alarm light into a public beam and a hidden timing signal.","edda",[
    line("edda","One lamp and two shadows. Hold your thumb over the amber seam. See the blue dot on your cuff?"),
    line("finch","It moves when the pulse stops. Someone is sending a second instruction inside the alarm."),
    line("ada","The plans Vell released show one signal line. A correction page used to be stitched between these holes."),
    line("edda","I made a blue filter after the flood. My eyes hurt for weeks. Nell still puts a towel over our kitchen lamp when I visit."),
    line("edda","We can split the beam across the whole market or carry the prism quietly to the next tower.")],[
    choice("Project both beams on the market wall","edda","commons","edda","Watch the children count them. Six fingers, a pause, and six again. No one can put that knowledge back in the box.","Market witnesses see the concealed timing signal."),
    choice("Measure the hidden pulse privately","edda","relay","edda","It arrives before the amber flash. The silence is an instruction to wait, just like the line in your boot.","Finch and Edda establish the order of the signals.")]);

  chapter("The Empty Sled","Sol identifies the reason his family's sled came back without them.","sol",[
    line("sol","My smallest spoon fits that groove. The ice station stamped our sled with it before the winter crossing."),
    line("finch","It was sent back for twelve tower workers. The margin lists your family as 'safe to defer.'"),
    line("sol","My sister slept on a salt bin for thirty nights. She still eats the heel of a loaf first in case someone takes the rest."),
    line("mara","I signed that return. Those workers kept gates open all winter. I did not know the shelter roof had gone."),
    line("sol","She says the roof doesn't fit in her table. I want to know what does.")],[
    choice("Put a shelter bed beside every number","sol","commons","sol","Let's draw the bin, too. It belongs on the page even if no ruler can tell you how cold it was.","Sol adds shelter conditions to the evacuation ledger."),
    choice("Let the last sled report before routing","sol","relay","sol","A spoon against the runner makes a little knock. If the last sled can't knock, the route never counts as empty.","The icewrights propose a return signal from each sled.")]);

  chapter("Sounding the High Tarn","An alpine lake gives Finch a way to measure the machine's missing time.","nessa",[
    line("nessa","Drop this weighted spool. A ripple can reach the far bank before a heavy boat makes the turn. That's why pilots ask twice."),
    line("finch","The Crown sends its second signal before the spool hits bottom. A ferry doesn't have time to answer."),
    line("mara","An answer from every boat multiplies delay. Put the two intervals on paper and make your choice."),
    line("nessa","I've got room for one new rule on the wheel. Which one should strangers read when they take my shift?")],[
    choice("Write 'wait for the last boat'","nessa","commons","nessa","I'll carve it deep. Captains like rules they can feel through a wet glove.","Ferries demand a last-boat acknowledgment."),
    choice("Give a circling kin the right of way","mina","wild","nessa","A turn in the water is an answer a radio can't swallow. I'll teach the pilots to spot it.","Pilots accept a kin's turn as a crossing signal.")],
    callback("chapter-4","Ulo has scratched a tiny seat plan into the wheel. The spare seat is his.","Hedd's drawing of the tar line hangs beside the wheel, in a frame made from the old rudder."));

  chapter("A Wind That Kept Its Letter","A high observatory receives a message Ina never sent home.","tal",[
    line("tal","Inside the wind sock. Somebody sewed a letter in backward so it would read straight through wet cloth."),
    line("trail","Ina left six words in the sail. 'Keep a gap for the wingbeats.' A small feather is folded into the hem."),
    line("edda","The empty beat gave a flock time to leave the cable. When the Office closed it, Ina cut her own line."),
    line("tal","I made her into a hero who wouldn't turn back. She did turn. She was looking after something smaller than herself."),
    line("tal","There's a plaque with her name on the wrong mountain. What should I do with it?")],[
    choice("Move the plaque to the nesting ledge","tal","wild","tal","Down low, then. A child can lean over it and watch the chicks learn the turn.","Ina's memorial becomes a nesting watch."),
    choice("Leave a correction beside the old plaque","tal","commons","tal","People deserve to see how the story changed. I'll take the first party up myself.","Hikers can read both versions of Ina's last flight.")]);

  chapter("Testimony in a Handspan","Sen returns to cross-examine Hedd at Needlecut Summit.","hedd",[
    line("hedd","Sen put a chisel in front of me and asked which side my thumb hurt. I remembered the answer before I remembered her face."),
    line("ada","She has agreed to speak, provided her words travel in her handwriting. The Office recorder makes everyone sound like a clerk."),
    line("finch","She says they cut a relief channel before the flood. On paper it became a natural crack afterward."),
    line("hedd","I can give her my chair at the inquiry. Or I can sit beside her and answer the questions I've been ducking.")],[
    choice("Leave the chair to Sen","hedd","commons","hedd","I'll stand in the gallery. She carried the tools. She can carry the argument.","Sen presents her original plans in person."),
    choice("Ask Hedd to demonstrate the cut","hedd","relay","hedd","The angle has to be mine. Tell Sen she can stop my hand if I start making excuses.","Hedd recreates the cut while Sen records his hand.")],
    callback("chapter-6","The clerk receives Hedd's signed correction before hearing a single word of live evidence.","The apprentices lay their three independent rubbings on the clerk's desk. The cuts line up."));

  chapter("The Cave Answers Twice","Mina hears a second herd under a ceiling the Office marked empty.","mina",[
    line("mina","There's an undertone beneath the echo. Count the long breaths. Those are animals in the lower gallery, sleeping through our visit."),
    line("ada","My map says the lower gallery was emptied four days ago. I have three signatures."),
    line("finch","A Wilderkin went back to fetch its young. Our map stopped counting when the first animal left."),
    line("mina","Our choice is going to decide who gets to call a place empty after this.")],[
    choice("Leave an open listening hour","mina","wild","mina","Sit with me. You can hear the second calf roll over before it finds its feet.","The cave choir gives returning herds a listening hour."),
    choice("Send a second survey crew below","hedd","relay","ada","I'll walk in last. If the number is wrong again I want mud on my boots when I change it.","Pell starts a second count at the lowest exit.")]);

  chapter("The Lamplighter's Daughter","Nell opens Edda's tool bag and asks why the blue filter is missing.","edda",[
    line("edda","Nell says I took as much care packing the gap in this case as I did packing the lens."),
    line("finch","Do you want me to tell her why? I was the one carrying the order."),
    line("edda","Give me a minute. Nell, when the first lamp failed, I took its filter out. I thought the crews would hear the extra beat. They saw an ordinary light and kept working."),
    line("ada","No one wound a deadman's timer on that shift. The official inquiry skipped right over the lamp bench."),
    line("edda","My daughter has asked for the key to the bench. Shall I give her the key or ask her to stay for a lesson?")],[
    choice("Give Nell the key unconditionally","edda","commons","edda","I'll take a spare stool out of storage. She can decide whether either of us sits on it.","Nell becomes an independent keeper of the lamp bench."),
    choice("Build a fail-dark lamp together","edda","relay","edda","She wants the shutter to fall if the timing pin comes out. She's already drawn a better spring than mine.","Nell and Edda build a lamp that signals its own failure.")]);

  chapter("What the Ice Organ Remembers","A pipe frozen on flood night contains the unaltered trial run.","sol",[
    line("sol","I usually thaw pipes with my thumb. This one I want to hear break. Put your ear at the fat end and let me warm the seam."),
    line("trail","The air pocket sings twelve equal beats. A final little cough follows. The Crown had already been tested on the night of the flood."),
    line("mara","My son was on the wrong bank. I pressed the test key early to give his crew another minute. I didn't know the key reached the eastern gate."),
    line("finch","My order told them to hold the east gate while your key told them to move. We were following different versions of the same plan."),
    line("sol","Vell has put that in words at last. Where do the words go?")],[
    choice("Have Vell tell the crews herself","sol","commons","mara","Give me the hand horn. They may throw it back at me. I'll still be here when it lands.","Vell addresses the shift she endangered."),
    choice("Seal the sound in two witness pipes","edda","relay","sol","Two pipes, two boxes, two different routes home. A fire in one record room won't finish the job.","The original signal is preserved in separate archives.")]);

  chapter("A Keel under the Lantern Wreck","Ulo shows the expedition what the first machine called a rescue.","nessa",[
    line("nessa","That lump under the keel is a crate of signal weights. Eleven families pooled their brass spoons to pay for it."),
    line("ada","Ulo says his order was to throw that ballast overboard. The harbor would have lost the only working alarm on the coast."),
    line("finch","So he jumped to the piling and waited with the box. Lev pulled a man and an alarm bell out of the river."),
    line("nessa","Ulo wants his old job back. Lev wants somebody to say he would do the same thing again. That isn't mine to promise.")],[
    choice("Bring both men to the hearing","nessa","commons","nessa","Lev's been practicing 'I'm afraid' in the mirror. It will be good for him to hear another man say it first.","The harbor hearing accepts personal testimony."),
    choice("Return the bell to the fisher families","nessa","wild","nessa","We'll hang it on a short rope. Even the youngest child can reach it from the quay.","Fishing families get their own warning bell back.")]);

  chapter("Windmills Running Backward","Tal tests a relay that leaves a gap for dissent at every tower.","tal",[
    line("tal","The coast mills turned backward last winter. The register thought the whole town had quietly evacuated."),
    line("mara","Your sail would let one observer stop a warning meant for a thousand. Would you spend their minute on doubt?"),
    line("finch","The machine has already spent eleven years making a single mistake look like three hundred concurring votes."),
    line("tal","I built two brakes. One needs a second keeper. The other trips when a nesting kite refuses the thermal. Choose one for the live trial.")],[
    choice("Try the two-keeper brake","edda","relay","tal","Those two women at opposite windows have never spoken before. Look at them wave the all-clear together.","The coast tests a two-key relay."),
    choice("Try the wing-sensitive brake","tal","wild","tal","It caught a wingbeat through a full sea gale. I wish Mum could see the red feather on the dial.","The coast tests a Wilderkin veto on the relay.")]);

  chapter("The Salt Copy","Pell discovers the order she has spent years copying does not exist.","ada",[
    line("ada","I've rubbed this tablet six times. 'All settlements consent.' The letters underneath say 'all settlements contacted.'"),
    line("mara","The first winter's clerk shortened it to fit the salt. I read the shorter word aloud at every budget hearing since."),
    line("finch","A village can receive a letter and still say no."),
    line("ada","I have forty forms with that bad sentence in my own writing. Thirty minutes before the tide eats the salt. What do we carry out?")],[
    choice("Copy the original petitions","nessa","commons","ada","I'll find the people who put their marks here. They deserve to answer a question someone actually asked.","Pell reopens the village consent register."),
    choice("Cast the tablet in a kin-made mould","mina","wild","ada","The shell holds both layers at once. A person can see what we erased and what we meant to keep.","A Wilderkin preserves the disputed text in relief.")]);

  chapter("Roots under the Meter","The Crownwood nursery exposes a flaw that no evacuation ledger can count.","mina",[
    line("mina","See the pale roots near the hoofprints? The big herd walks a new line each thaw so the trees have room to breathe."),
    line("mara","The survey says those are abandoned routes. Taking them out of service would save a hundred towers."),
    line("finch","The forest uses a path even when no animal is standing on it."),
    line("mina","I grew up counting the creatures I could call back. I've never written down a place they have the right to leave alone.")],[
    choice("Mark fallow paths on the public map","sol","commons","mina","We'll use a hollow hoof instead of a cross. Nobody should mistake resting ground for lost ground.","Dormant paths gain standing in the public atlas."),
    choice("Take the meters out of the nursery","mina","wild","mina","Listen to that. The calves are calling to each other already, without waiting for the horn.","The nursery becomes the first unmetered sanctuary.")]);

  chapter("An Honest Darkness","Edda shows Nell's redesign to a board that will pay only for brighter lamps.","edda",[
    line("edda","Most of my life I've been paid to make a warning visible from farther away. This one does its best work when it goes dark."),
    line("ada","A dark tower could mean clear weather, broken glass or a keeper refusing a dangerous order. The board wants a single meaning."),
    line("finch","We could put an answering bell in the keeper's hand. Let them tell the waiting village why the glass went black."),
    line("edda","A child has to be able to understand the signal through a shut bedroom window. Which signal will she hear?")],[
    choice("Give each street its own answer bell","edda","commons","edda","Nell used to count the fishmonger's chimes from her bed. She'll know this one before she opens her eyes.","Every street can ask a dark tower for an answer."),
    choice("Teach the lamps a distinct fault pulse","edda","relay","edda","Three slow blinks. I can read that through my bad lens. Someone smaller than me might, too.","The repair crews adopt a separate fault signal.")],
    callback("chapter-14","The bench key has left a bright dent in Nell's pocket. She wrote the first training card in her own hand.","Nell's fail-dark shutter clicks shut before Edda has finished turning off the test current."));

  chapter("A Winter Apple in Summer","Sol takes Finch to the storehouse where his sister still sleeps near the door.","sol",[
    line("sol","People send her fancy fruit at Midwinter. She halves every apple, labels one half 'tomorrow,' and apologizes for being difficult."),
    line("finch","She's left two chairs by the door. She knew we'd come."),
    line("sol","She wants to be named in the archive as a builder. During those thirty nights she roofed the salt bin herself. We've kept telling the story as if she only waited there."),
    line("sol","Can we ask her to speak, or are we asking for the old story again?")],[
    choice("Ask her how she made the roof","sol","commons","sol","She's pulled out the chalk. That's the first time anyone has come looking for her plans.","Sol's sister Ena is credited as a shelter builder."),
    choice("Ask her to inspect the new shelters","sol","relay","sol","She's already checking the handles from the inside. That's the bit every inspector forgets.","Ena takes a paid winter shelter inspection.")]);

  chapter("Pumice Floats until It Doesn't","Mara's new trial traps a rescue skiff inside the caldera.","mara",[
    line("trail","A black stone under the skiff hisses once, fills with water, and slides beneath the foam. Three Office runners are still aboard."),
    line("mara","I gave that skiff the safest route in my tables. Current, depth, load, wind. Tell me which number I missed."),
    line("nessa","Time since the stones first floated. It isn't a number we know. Pass me the long rope."),
    line("finch","We have enough rope to pull the skiff or enough time for the kin to move it downstream. Both crews need to know whose word to follow.")],[
    choice("Put the line in Nessa's hands","nessa","commons","nessa","Take the slack off slowly. That third runner's asleep on his feet. Nobody let him promise he's fine.","A local pilot leads the Office rescue."),
    choice("Ride the skiff with Glimmeray","tal","wild","mara","All my runners back. I'll put the animal's turn on the report, precisely where my order failed.","The Caldera report credits a kin-led rescue.")]);

  chapter("An Ash Kite Carries a Voice","At Phoenix Overlook Tal answers the last thing his mother asked.","tal",[
    line("tal","The note has another seam. She wrote: 'Tell my son he can mend a kite without climbing into it.' She knew about my fear of heights."),
    line("finch","You have flown every ridge since the delta. Do you still want to?"),
    line("tal","Some days. Today I want to watch someone else take off and feel glad when they come back."),
    line("mara","The Office has six hundred trainee pilots and no set of orders for what they can decline. Give me a sentence I can print.")],[
    choice("Let a pilot hand a launch to a friend","tal","commons","tal","I like that word 'friend.' It means the relief pilot gets to say yes, too.","Pilots gain the right to hand over a launch."),
    choice("Let the riding kin ground the kite","tal","wild","tal","I'll sew a release by the talon rest. The animal should be able to reach it without throwing its rider.","The new harness gives the kin a ground-release.")]);

  chapter("The Casting with Two Handles","The foundry can rebuild the heart of the Crown as one key or two.","hedd",[
    line("hedd","Sen made this mould with a hollow down the middle. It takes more brass, but two small bearings can turn where one big bearing would seize."),
    line("mara","The next storm reaches the Shelf in nine days. Can you cast a part you can trust in nine days?"),
    line("ada","Trusting a thing through a winter used to take a winter. Perhaps one piece should be easy to take out."),
    line("finch","We can't carry three designs. Give the crew one change they can finish before nightfall.")],[
    choice("Cast separate keys for two crews","hedd","relay","hedd","Two handles, same weight. I won't mark either one 'master.'","The Crown receives reversible, divided controls."),
    choice("Cast a hand-removable centre pin","hedd","commons","hedd","A keeper can lift this with a stove poker. I'll leave the lifting hole on the outside.","Any settlement can disconnect its tower by hand.")]);

  chapter("The White Hoofprint","Mina follows a herd that chooses to walk against the evacuation arrows.","mina",[
    line("mina","Those hoofprints lead into the storm. If we followed the Manual we'd turn the herd around."),
    line("sol","Pressure ridges grow on the lee side. The herd is heading into the wind to find solid ice. They know because they feel it break."),
    line("mara","I ordered the eastern villages out an hour ago. If you change the arrows now, the line will look like panic."),
    line("mina","Then tell them exactly who changed the arrows. I can answer for myself.")],[
    choice("Paint the route in Mina's name","mina","commons","mina","Write my name big enough to read through blowing snow. A caller ought to be findable afterward.","Mina takes public responsibility for a route change."),
    choice("Let the front of the herd choose","mina","wild","sol","Their first two steps look wrong. The third lands on a slab thick enough for a whole street.","The herd leads the Shelf evacuation.")],
    callback("chapter-7","Mina answers the last calf with the living call from Bellkeeper Mesa. The adults wait for it.","Pell takes the Office seal off the spare speaker. This time the herd caller has the switch."));

  chapter("The Lens Faces Inward","Vell opens her locked signal cabinet beneath the aurora.","mara",[
    line("mara","My son's name was Ren. I have spent eleven years describing him as 'a boy on the east roof' because no one will refuse a grieving mother to her face."),
    line("finch","The person who wrote the order to wait. Was it you?"),
    line("mara","Yes. I asked for one extra beat. The dispatcher made it an order for everybody while the machine sent the old route. You carried both halves of my mistake."),
    line("ada","I'm entering this under your name and mine. What about the family record in the cabinet?")],[
    choice("Return Ren's letters to Vell","nessa","commons","mara","Keep the order. Give me the page about his red shoes. I have wanted to read that page without a clerk in the room.","The inquiry separates private grief from public evidence."),
    choice("Invite Vell to record her own account","edda","relay","mara","Let the witnesses hear my voice shake. Nobody ever shook in the printed version.","Vell puts her account on a witness cylinder.")]);

  chapter("Everyone off the Last Rail","Sol has to choose who watches the final crossing.","sol",[
    line("sol","The rail is going to crack under the last wagon. I can hear the note climbing. Nobody has time to run back for the inspector."),
    line("finch","Tell me what you need from this side."),
    line("sol","Somebody to look me in the face and tell me that saving the wagon isn't worth the people under it."),
    line("ada","We have one empty sled. This time I am asking those already aboard what they're willing to do.")],[
    choice("Let the riders design the transfer","sol","commons","sol","They're putting the heavy cases in the snow. My sister has the smallest child by the hand. Good. Everyone counts twice.","Each rider takes part in the transfer decision."),
    choice("Have Frostspan carry the last load","sol","wild","sol","Two short spans and a rest between. Enough for a child to scramble across with both mittens on.","Sol records a limit on how long an ice partner must hold.")],
    callback("chapter-9","Ena unfolds a sketch of the old salt-bin roof to show how much load its slope could hold.","A spoon knocks twice against the last runner. The entire crew waits for its answer."));

  chapter("A Star at the Bottom of the Boat","A comet crater returns the very first message Finch ever carried.","finch",[
    line("trail","The boat's reflection makes the sky look deep enough to drown in. Finch takes the paper from the boot and lays it on a dry thwart."),
    line("finch","I've called this my evidence for eleven years. I think I was keeping it because it meant someone else gave the order."),
    line("nessa","You were a kid in a wet coat. You still carried it. Both those things can be true without one of them swallowing the other."),
    line("ada","There's a blank line on my witness roll. The writer gets to choose how their part will be named.")],[
    choice("Sign as a witness to the missing beat","nessa","commons","finch","My name fits. It always would have fit. Thank you for letting me write it myself.","Finch signs the public testimony in person."),
    choice("Attach the slip as an unanswered call","mina","wild","finch","Leave room under it. Somebody who heard the other side might still want to answer.","The original dispatch becomes an open invitation to testify.")]);

  chapter("The Interval before Dawn","At Zenith Roost, the crew sees which settlements the next storm will touch.","ada",[
    line("ada","Every yellow light is a village that has returned an answer. Every blue light is one that has only received our warning."),
    line("mara","I used to count blue as yellow. Pretty maps made convincing speeches. Tonight I've kept the colors separate."),
    line("tal","There's weather on both sides of the ridge. The Crown can give everyone a warning. It cannot tell everyone which way to turn."),
    line("finch","The last Warden has asked who should carry the bell frame to the cairn. Who will the waiting towns see coming up the ridge?")],[
    choice("Invite the local crews to carry it","hedd","commons","ada","The path will take a little longer. A different pair can take each turn. I'll walk with the last one.","A procession of local keepers brings the frame to Orris."),
    choice("Harness a mixed team of Wilderkin","mina","wild","tal","Leave the front rope loose. A partner should always be able to step out of a harness.","A team of willing kin brings the frame to Orris.")]);

  chapter("The Hand on the Last Cairn","Before the final trial, Finch and Vell stand at opposite ends of the same bell rope.","orris",[
    line("orris","Thirty bells are a network, not a verdict. My aunt built the bearing so we could lift the middle out if a verdict ever got stuck in it."),
    line("mara","If the whole line disagrees with me tonight, I want it to be able to stop me. I spent eleven years making the opposite machine."),
    line("finch","The first beat warns us. The beat we leave empty is where a village, a pilot or a frightened calf can answer."),
    line("ada","And if it never answers?"),
    line("orris","Then we go and look. There are a few ways to bear that work. First, the trial. Finch, whose name do I write beside yours on its record?")],[
    choice("Record the people who kept the lamps","edda","relay","orris","I'll leave space for ordinary names instead of a line of grand titles. Make the climb. Your partners are ready.","The final trial honors the working keepers."),
    choice("Record the kin who brought us here","mina","wild","orris","I'll set a wet clay tablet for their feet. It can dry while the two of us take the field.","The final trial honors the Wilderkin witnesses.")]);

  function lesson(ability,instructor,summary,lines,options) {
    const route = atlas.routes.find(r => r.ability === ability);
    register({id:"lesson-"+ability,title:ability+" field lesson",kind:"lesson",chapter:route.ordinal+1,
      character:instructor,region:route.start,summary,lines,options});
  }
  lesson("Raftwake","nessa","Read the current with a Wilderkin before taking passengers across it.",[
    line("nessa","A crossing begins on the bank. If the reeds lean one way at the tips and another at their roots, the deep current turns under the surface."),
    line("finch","The little wake at the edge is going upstream. Is the water going backward?"),
    line("nessa","An eddy, yes. A Raftwake partner can bring us in through that pocket. Never ask it to shoulder the whole river. Where should the passenger sit?")],[
    choice("Low, behind the partner's shoulders","nessa","relay","nessa","Good. It can lift its head to sound the water. Chart two local field legs and win two local encounters with the crossing still in mind.","Nessa endorses the river handling lesson."),
    choice("Where we can see the partner signal","nessa","wild","nessa","Exactly. If it taps the rail twice, you land on the next safe bank. Earn your local field marks, then bring me a Raftwake partner.","Nessa endorses the river signals lesson.")]);
  lesson("Cloudlift","tal","Practice a grounded launch before lifting above the Highkite bluffs.",[
    line("tal","Hold the line loose. That flutter travels down it before the wing moves. A heavy rider who waits for the wing will be late every time."),
    line("finch","There's an updraft in front of us and a straight drop behind the shed."),
    line("tal","Both can lift a pennant. Only one can carry us beyond the first turn. The launch marshal is waving. What do you check first?")],[
    choice("Watch the second pennant uphill","tal","relay","tal","It's slack, so we wait. Good pilots sometimes spend all morning sewing. Chart two field legs and prove your footing in two local encounters.","Tal endorses Finch's reading of a thermal."),
    choice("Wait for the kin to set its feet","tal","wild","tal","See it turn its back to the drop? Let it. When you have a Cloudlift partner and your local field marks, I'll sign your flight license.","Tal endorses a kin-led launch.")]);
  lesson("Stonecleave","hedd","Find a load-bearing seam before opening a stone pass.",[
    line("hedd","Tap here with the back of the mallet. That hollow sound tells us where the old river ran. A cut there would bring the whole shelf down."),
    line("finch","The thin dark line beside it sounds solid. If our partner pushes straight ahead it'll jam the opening."),
    line("hedd","So show me how to give the broken stone somewhere to go.")],[
    choice("Score a relief cut to the side","hedd","relay","hedd","A wedge only needs the width of a thumbnail at the start. Two local field legs and two encounter marks will put that lesson in your hands.","Hedd approves a relief cut before the main break."),
    choice("Clear a runout beneath the seam","hedd","commons","hedd","Even a perfect cut is bad work if its spoil lands on somebody's boots. Return with your local field marks and a Stonecleave partner.","Hedd approves a safe fall zone.")]);
  lesson("Lullsong","mina","Learn a call the resting herd can decline.",[
    line("mina","Don't start with the tune. Listen for the slowest breath. If we match the quick one, the whole herd thinks we are frightened."),
    line("finch","The calf by the wheel stopped chewing as soon as I lifted the bell."),
    line("mina","Then it heard you. The path is narrow. How do we ask the adults to leave enough space?")],[
    choice("Call from the open side of the path","mina","commons","mina","Now they can see where to go. Count two local field legs and two encounters before you ask the herd to trust the call.","Mina signs off on an open exit."),
    choice("Leave a breath for an answer","mina","wild","mina","That little grunt means 'later.' Later is a perfectly good instruction. Bring your Lullsong partner and field marks for the license.","Mina signs off on a voluntary call.")]);
  lesson("Glowpath","edda","Cast a low, readable light in a crystal tunnel.",[
    line("edda","A bright cave can be harder to cross than a dark one. Every reflection in this quartz comes from one lamp."),
    line("finch","The floor falls away three steps ahead. Which light tells a walker where the edge is?"),
    line("edda","The one that throws the railing's shadow onto their boots. How would you set up your partner's light?")],[
    choice("Shade the upper half of the glow","edda","relay","edda","That puts a clean line on the near edge. Test the idea on two local field legs and two encounters. A license belongs to a practiced pair.","Edda endorses a shielded light."),
    choice("Let the partner blink at each drop","edda","wild","edda","The pause gives a dazzled eye a chance to catch up. Return with local field marks and a Glowpath companion for your license.","Edda endorses a pulsed warning.")]);
  lesson("Frostspan","sol","Lay a crossing that can release pressure beneath the ice.",[
    line("sol","A clever kin can make a perfectly level sheet in a second. A foolish rider can crack the whole sheet in two."),
    line("finch","The current pushes hardest beside the vent. A single straight span will have nowhere to bend."),
    line("sol","Build me a crossing that can lose a piece and still get everybody back to shore.")],[
    choice("Make short spans with seams between","sol","relay","sol","Now the middle one can roll without pulling the bank loose. Learn the route on two local field legs and two encounters before you sign on.","Sol approves a segmented ice bridge."),
    choice("Keep a resting island at each turn","sol","wild","sol","The partner gets a rest, too. Show me a Frostspan companion and your field marks when you're ready for real passengers.","Sol approves resting islands.")]);

  const bondScenes = Object.fromEntries(allies.map(id => [id, []]));
  function bond(friend,ordinal,title,offer,task,lines,options) {
    const arc = bondScenes[friend];
    const stage = arc.length+1;
    const id = "bond-"+friend+"-"+stage;
    const scene = register({id,title,kind:"bond",chapter:ordinal+1,region:atlas.routes[ordinal].start,
      character:friend,summary:offer,offer,task,lines,options,previous:arc.at(-1)?.id});
    arc.push(scene);
  }
  const visited = name => {
    const region = atlas.regions.findIndex(r => r.name === name);
    if (region < 0) throw new Error("Unknown story destination "+name);
    return {label:"Visit "+name, test:s => s.visited.includes(region)};
  };
  const local = (ordinal,metric,count) => {
    const region = atlas.routes[ordinal].start;
    const action = metric === "surveys" ? "Chart" : "Win";
    const noun = metric === "surveys" ? "field legs" : "encounters";
    return {label:action+" "+count+" "+noun+" in "+atlas.regions[region].name,
      test:s => (s[metric]?.[region] || 0) >= count};
  };
  const licensed = name => ({label:"Earn the "+name+" field license",test:s => s.licenses?.includes(name)});
  const crafted = (name,n,label) => ({label:"Craft "+n+" "+label,test:s => (s.crafted?.[name] || 0) >= n});

  bond("nessa",3,"The Passenger under the Bench","Ulo left a fiddle case in the delta. Nessa asks you to survey the ferry approaches before she risks a second crossing. The case holds the only photograph inside his prison file.",local(3,"surveys",2),[
    line("nessa","The latch is rusted shut. When we fished him out, he kept asking for this case. I told him his hands were worth more than any fiddle."),
    line("finch","His daughter's face is tucked behind the bridge. He's written every birthday on the back."),
    line("nessa","She's old enough to tell us what she wants to know. Help me find the first words.")],[
    choice("Write to his daughter privately","nessa","commons","nessa","Dear Lina. Your dad still tunes the high string too tight. That's a beginning she might believe.","Nessa sends a letter Lina can open alone."),
    choice("Let Ulo play the tune himself","nessa","wild","nessa","He says his hands shake. I told him I've never once heard a birthday song played perfectly.","Ulo sends Lina a recording of her old tune.")]);
  bond("nessa",9,"A Pilot with Two Names","Lev will meet his sister on a boat only if Finch can pilot it home. Nessa asks you to bring your Raftwake license rather than putting Lev back at the wheel.",licensed("Raftwake"),[
    line("nessa","He sat on the tar square the whole crossing. Wouldn't even touch a rope. I used to think he missed his license more than he missed me."),
    line("finch","What did he say when you showed him Lina's note?"),
    line("nessa","That he remembers her father's life jacket was too small. Eleven years of practicing an explanation and all he could talk about was a buckle.")],[
    choice("Give Lev a shift as a passenger","nessa","commons","nessa","I'll pack the good lunch. We can be a family for the length of one boat ride.","The siblings arrange a Sunday crossing."),
    choice("Ask him to mend the old jacket","nessa","relay","nessa","He's already gone for a needle. Some people can get at a feeling once their hands have work.","Lev repairs life jackets at the school boathouse.")]);
  bond("nessa",20,"The Seat Kept Dry","Lina has brought her own child to the rebuilt harbor. Nessa wants you to inspect the new launch at Blackglass Launch before she gives them the spare seat.",visited("Blackglass Launch"),[
    line("nessa","Three generations sat on that bench today. The child counted two passengers and forgot to count herself."),
    line("finch","What did you tell her?"),
    line("nessa","That the person with the pencil takes up space too. I've put your name in my tide book. You can bring it back when we're both old.")],[
    choice("Put the tide book in the ferry school","nessa","commons","nessa","Leave the tar smudge on the cover. The children ought to know a book can be taken aboard.","Finch and Nessa endow a working tide library."),
    choice("Keep the spare seat unnumbered","nessa","wild","nessa","For whoever the list forgets next time. I can steer by that.","Finch and Nessa preserve an emergency passenger seat.")]);

  bond("tal",4,"Flour-Sack Thread","Tal's sister remembers Ina's patch but not the color of her wing. Help Tal chart the meadow launch so he can take a sample without cutting a live line.",local(4,"surveys",2),[
    line("tal","There's a second color inside the hem. Mum reused a flour sack from the shop where my sister worked."),
    line("finch","Your sister helped build the sail. Perhaps that is why she wanted to remember the color."),
    line("tal","I took all the maps away after Mum vanished. I might have taken the best part of her memory with them.")],[
    choice("Give his sister the original strip","tal","commons","tal","I'll keep a rubbing. She can let the thread fade in a sunny room if she wants to.","Ina's family divides a private keepsake."),
    choice("Sew two patches from the strip","tal","relay","tal","One for a kite that flies and one for a kite that stays safely on the wall.","The two siblings stitch halves of a matching sail.")]);
  bond("tal",10,"A Landing without Applause","Tal has promised to show a new pilot how to cancel a launch. Bring your Cloudlift license so you can relieve him if his hands lock on the training line.",licensed("Cloudlift"),[
    line("tal","We stood on the ledge all afternoon. Three children asked when the trick would start."),
    line("finch","And the new pilot?"),
    line("tal","She said the lesson was the best thing she'd flown all year. Then she walked home. My knees didn't stop shaking for another hour.")],[
    choice("Practice the release together","tal","relay","tal","You take the high loop, I'll take the low. We can do this on the ground until it feels like tying a shoe.","Tal teaches an abort drill every market day."),
    choice("Write the pilot's words on the sail","tal","commons","tal","Underneath where the rider can read them. Spectators never needed this lesson as much as we did.","The school sail carries a pilot's right to decline.")]);
  bond("tal",21,"A Rope Long Enough for Two","Tal's sister wants to fly a memorial kite of her own. Visit Phoenix Overlook to find a launch where both siblings can stand on the ground.",visited("Phoenix Overlook"),[
    line("tal","She chose a square tail. Mum hated square tails. When I started to say so she laughed until she had to put down the spool."),
    line("finch","Did the kite fly?"),
    line("tal","Terribly. It spent most of the morning in a plum tree. I haven't had that good a day in years.")],[
    choice("Keep a feather from the plum tree","tal","wild","tal","It can go in my flight log under 'excellent landing.'","Tal's family keeps a happy landing in its archive."),
    choice("Build a square-tailed club kite","tal","commons","tal","The entry fee is one bad idea. We have plenty of those between us.","Finch and Tal start a school for first-time fliers.")]);

  bond("hedd",5,"The Apprentice's Chisels","Sen's tools have sat under Hedd's bench for eleven years. Chart the Fossil Steps so a courier can return them by a route she trusts.",local(5,"surveys",2),[
    line("hedd","Smallest chisel has a red grip. She wrapped it on her first day so I wouldn't keep picking it up by mistake."),
    line("finch","There's a note in the case. 'Ask him what I sounded like when he stopped listening.'"),
    line("hedd","Like somebody speaking much too quietly in a room full of paid men. I could have asked them to shut up.")],[
    choice("Let Hedd answer in a letter","hedd","commons","hedd","I'll write it myself, including that last part.","Sen receives Hedd's first direct apology."),
    choice("Ask for a meeting on Sen's terms","hedd","relay","hedd","No guild table and no audience. I'll meet her wherever she's already working.","Sen sets the time and place of the meeting.")]);
  bond("hedd",11,"The Chisel Fits the Cut","Sen will repeat the inspection with Hedd if the entire crew can come home safely. Show them your Stonecleave field license.",licensed("Stonecleave"),[
    line("hedd","She made me carry the apprentice's bag. The strap gouged my neck all the way up. No wonder she walked hunched beside me."),
    line("finch","Did she ask for her place at the bench again?"),
    line("hedd","She asked for her wages. Back to the first set of rubbings I put my name on.")],[
    choice("Help Sen audit the old accounts","hedd","relay","hedd","I found the pay books. I can start with interest on the first winter.","The guild repays Sen for her survey work."),
    choice("Put Sen's name on the plans","hedd","commons","hedd","In the big lettering where mine used to be. Then we'll do the figures for her wages.","The corrected plans bear the apprentice's own name.")]);
  bond("hedd",22,"A Bench with Two Vices","Sen has opened her own shop. She wants your judgment on the footing at Crucible Bowl before she invites Hedd to teach there.",visited("Crucible Bowl"),[
    line("hedd","Two vices, different heights. I assumed the short one was for children. She said it was for people who like to sit down."),
    line("finch","Are you going to take her offer?"),
    line("hedd","She sent me a contract. An old man shouldn't be surprised at the number of good things that can happen once people write them down.")],[
    choice("Sign as witnesses to the first class","hedd","commons","hedd","Witnesses go at the bottom. Sen's name goes at the top.","Finch signs Sen's first school charter."),
    choice("Commission a removable tower key","hedd","relay","hedd","That's a fine first piece for an apprentice. A way of stopping something bigger than yourself.","Sen's first class casts emergency tower keys.")]);

  bond("mina",6,"A Calf out of Tune","A dappled calf ignores every copied bell note. Mina wants help winning two local encounters so the field crew can listen in peace.",local(6,"localWins",2),[
    line("mina","There's nothing wrong with its ears. It's been answering with its feet. One stamp when it's hungry, two when it's worried."),
    line("finch","You've been learning a new language all morning."),
    line("mina","I've been apologizing in it. Those are different things, and I'm slower at the second.")],[
    choice("Learn the calf's two-step answer","mina","wild","mina","Use your heel so the ground rings. There. It looked up at you.","Mina records the calf's own answer."),
    choice("Teach the field crew to watch feet","mina","commons","mina","I'll ask them to sit down first. Tall people forget how little feet look from up there.","The herd crews learn a nonvocal signal.")]);
  bond("mina",12,"Her Father's Last Bar","Mina's father offers her the original written call. Bring the Lullsong license that lets her prove she learned how to stop singing.",licensed("Lullsong"),[
    line("mina","He said the Office paid for my first winter coat. He thought I'd forgive him more easily if I could picture the buttons."),
    line("finch","What did you tell him?"),
    line("mina","That I still have the coat. And that a warm child doesn't make the paper right. He let me take the last bar home.")],[
    choice("Return the tune to the caravan callers","mina","commons","mina","Every caller gets the bit about leaving room for a reply, too.","Caravan callers recover the right to use the family tune."),
    choice("Leave the final bar unwritten","mina","wild","mina","The herd can finish it in whatever feet or voices it has.","The published score leaves a space for a kin's answer.")]);
  bond("mina",23,"The Hoof beside the Signature","Mina wants the listening post at Caribou Watch to hold evidence any keeper will respect. Visit the post with her notebook.",visited("Caribou Watch"),[
    line("mina","There's a clay plate outside the door. The calves walked over it before the adults and the smallest hoof went down deepest."),
    line("finch","What will you call the plate?"),
    line("mina","I thought of calling it a census. But it was made by creatures passing through. It wasn't theirs to finish forever.")],[
    choice("Call it 'People we heard today'","mina","commons","mina","With the date in the top corner. We'll leave room beside it for tomorrow.","Mina opens a living witness register."),
    choice("Leave the plate where the herd walks","mina","wild","mina","It'll wear away. That's a fair price for letting the next herd answer for itself.","The post accepts an ever-changing hoof register.")]);

  bond("edda",7,"A Shutter for Nell","Nell wants to work at the lamp bench but the hot catches cut her fingers. Craft two Fern balms so she and Edda can practice changing a shutter together.",crafted("balm",2,"Fern balms"),[
    line("edda","She put the balm on my hand before she touched her own. I've been hiding that burn for so long I forgot the shape of it."),
    line("finch","Nell has sketched a catch you can open with the heel of your hand."),
    line("edda","It takes one less turn. You spend years teaching a child to hold tools and then she teaches a tool to hold you.")],[
    choice("Stamp Nell's name on the new catch","edda","commons","edda","I've found the little letter punches. She can do the uneven ones herself.","Nell signs her first invention."),
    choice("Make the new catch fit every lamp","edda","relay","edda","An adapter plate. Give me your pencil. I can see it better if I draw it large.","Crews begin fitting Nell's catch to older lamps.")]);
  bond("edda",13,"Every Lamp Has a Shadow","Edda will risk a dark signal test with Nell only if someone can lead the crew out after it. Show her your Glowpath license.",licensed("Glowpath"),[
    line("edda","I shut off four lamps and stayed beside the bench. Nell counted steps all the way around me. I knew where she was the entire time."),
    line("finch","You let her use the key."),
    line("edda","I was scared she'd look back and see how little I can see. She looked back. Then she described the light.")],[
    choice("Let Nell describe tomorrow's test","edda","commons","edda","I'll take the dictation. She can tell me if the letters run uphill.","Mother and daughter write a manual for low-vision keepers."),
    choice("Add a sound to the lamp catch","edda","relay","edda","A clean click under my thumb. Very well. Nobody needs to be outside the work.","The lamp gives its keeper a tactile fault signal.")]);
  bond("edda",24,"An Aurora on the Kitchen Wall","At Halolight Observatory a small lens could show Nell the aurora at home. Bring its measurements back to Edda.",visited("Halolight Observatory"),[
    line("edda","It doesn't make the whole sky. Just a violet thumbprint above the stove. Nell says the real sky is allowed to stay where it belongs."),
    line("finch","What did you do with the towel she used to put over the lamp?"),
    line("edda","I've folded it into a little cushion for the stool. If you come at supper there's room for another chair.")],[
    choice("Bring the field crew to supper","edda","commons","edda","Six more chairs then. The kitchen might have to grow another kitchen.","Edda opens the bench kitchen to the night shift."),
    choice("Share one quiet meal with Nell","edda","wild","edda","No circuit plans on the table. Your notebook can stay in your pocket for an hour.","Finch becomes a welcome guest in Edda's home.")]);

  bond("sol",8,"The Spoon with a Number","Sol asks you to chart Kilnwater Yard to find the old sled tally. The stamped spoon he carries has the same number as a missing entry.",local(8,"surveys",2),[
    line("sol","There she is. Ena. They entered her as 'one small dependent' for the whole winter."),
    line("finch","Want me to take that line out?"),
    line("sol","I want her name to go beside it. The next clerk should have to see what a number looks like once it has a face.")],[
    choice("Leave room for Ena's own account","sol","commons","sol","She'll fill the whole margin. She takes a long time getting to the part about the hammer.","Ena gets space on the old sled roll."),
    choice("Carry the spoon to the station office","sol","relay","sol","It'll look small beside all those brass seals. Maybe a clerk will pick it up and feel the weight.","The stamped spoon becomes part of the official record.")]);
  bond("sol",14,"The Island between Spans","Ena will attempt her first crossing on foot since the winter shelter. Bring a Frostspan license and let her stop after every span.",licensed("Frostspan"),[
    line("sol","She stopped on the first island long enough for the sun to come out. I started counting under my breath and she made me stop."),
    line("finch","Did she finish?"),
    line("sol","She came back to the bank where she started. That was what she had decided to do. I gave her my scarf and we went home.")],[
    choice("Draw her crossing in the family book","sol","commons","sol","An arrow out and an arrow home. I'll draw the sun in the middle.","Ena's own measure of a crossing enters the family record."),
    choice("Let the resting island stay a while","sol","wild","sol","The kin are still lying on it. I'll take their word for when it's time to go.","Sol starts leaving rest space on his winter routes.")]);
  bond("sol",25,"The Last Spoon Comes Home","Walk the line to Icewright Terminal. Sol wants someone who knew him before the journey to be there when he takes the spoon off its string.",visited("Icewright Terminal"),[
    line("sol","I kept thinking that as long as I carried it we were still waiting for the sled to come back. It's been home for years. I hadn't been."),
    line("finch","Where does the spoon go now?"),
    line("sol","Ena made soup. So far she has said absolutely nothing about records, safety margins or the proper resting interval.")],[
    choice("Set three places at Ena's table","sol","commons","sol","She always makes enough for three. I didn't notice that until you came along.","Finch has a standing invitation at Ena's table."),
    choice("Ask Sol to teach a new icewright","sol","relay","sol","After soup. The first lesson is coming home when somebody expects you.","Sol takes an apprentice on the returning route.")]);

  const endings = [
    {
      id:"commons",title:"The Common Bells",label:"Give the towns their own ropes",
      lines:[
        line("finch","The amber signal goes out together. What happens after it belongs to the people standing there. Give every keeper a rope and a way to call the neighbors."),
        line("mara","I'll take the small bell in the west shelter, if they'll have me. They can vote me out after the winter."),
        line("trail","The first storm sends forty different instructions across the valley. Six are wrong. Their neighbors answer before the water rises. Come spring, children know their keeper by name.")
      ]
    },{
      id:"relay",title:"Two Keys in Winter",label:"Require two keepers at each relay",
      lines:[
        line("finch","Keep the long warning circuit. Give its two keys to people who answer to different villages. When they disagree, the bell warns without ordering anyone to move."),
        line("ada","My first form has room for two accounts of the same night. I'll send the carbon copy to the shelter, where it can contradict the original."),
        line("trail","In the first hard freeze, two keepers disagree for nineteen minutes. During that silence the nearest pilot finds a safe ford. The printed report keeps all nineteen minutes.")
      ]
    },{
      id:"wild",title:"A Space for Wingbeats",label:"Let migration interrupt the Crown",
      lines:[
        line("finch","Send the first warning everywhere. Then leave the line open. A turning wing, a stamp on the shelf, a wake running upstream. They all get to interrupt the next instruction."),
        line("mina","I promised a whole valley that listening would do more than calling louder. I'll spend the winter teaching it, one calf and one clerk at a time."),
        line("trail","A year later a calf stamps on both sides of the border without knowing there is a border. Six villages alter their route. Nobody puts a ribbon on the calf, and the spring ledger counts its answer.")
      ],
      needs:s => policyScores(s).wild >= 4 || completedBonds(s,"mina") === 3,
      hint:"Make four choices that give Wilderkin a voice, or finish Mina’s three bond quests."
    },{
      id:"watch",title:"The Traveling Watch",label:"Found a rotating field watch",
      lines:[
        line("finch","No permanent master switch. A crew of pilots, callers, builders and kin will carry the spare key from town to town. Every season somebody new learns to use it."),
        line("mara","Then the first crew will need a cook. I have been getting up before daylight for twenty years. I'll learn the rest."),
        line("trail","Six companions each teach an apprentice, and each apprentice chooses another route. Finch walks the first circuit carrying a blank dispatch. There is room for a hundred hands to mark it.")
      ],
      needs:s => allies.every(id => completedBonds(s,id) === 3),
      hint:"Finish all three personal quests for each of the six traveling companions."
    }
  ];
  register({id:"ending",kind:"ending",chapter:30,region:atlas.routes.at(-1).end,title:"The Unstruck Bell",
    summary:"Return to the last cairn after the Horizon trial and decide who keeps the warning line.",
    character:"finch",lines:[
      line("trail","Thirty crest lamps wake in the frame. Through the floor Finch feels the first drop of the storm before it has fallen at the windows."),
      line("orris","You've brought every answer I asked for. The bearing is loose. We can decide who will be able to stop this machine after we've gone."),
      line("mara","The shoes were red because Ren painted them using leftover signal dye. I should have told somebody that while he was alive. After today I want the bell to belong to more people than my loss."),
      line("finch","The first beat is going out. The second is ours to give away.")
    ],options:endings.map(e => ({id:e.id,label:e.label,policy:null,friend:null,needs:e.needs,
      hint:e.hint,reply:e.lines[0],after:e.lines.slice(1),consequence:e.title}))});

  function records(state) { return state.story?.records || {}; }
  function completed(state,id) { return records(state)[id]?.done === true; }
  function optionsOf(scene) {
    return scene.options.map((c,i)=>({...c,id:c.id || (i===0?"a":"b")}));
  }
  function completedBonds(state,id) {
    return (bondScenes[id] || []).filter(scene => completed(state,scene.id)).length;
  }
  function selected(state,scene) {
    const picked=records(state)[scene.id]?.choice;
    return picked && optionsOf(scene).find(c=>c.id===picked);
  }
  function policyScores(state) {
    const tally={commons:0,relay:0,wild:0};
    for (const scene of all) {
      if (!completed(state,scene.id)) continue;
      const picked=selected(state,scene);
      if (picked?.policy) tally[picked.policy]++;
    }
    return tally;
  }
  function bonds(state) {
    const points=Object.fromEntries(allies.map(id=>[id,0]));
    for (const scene of all) {
      if (!completed(state,scene.id)) continue;
      const picked=selected(state,scene);
      if (Object.hasOwn(points,picked?.friend)) points[picked.friend]++;
      if (scene.kind==="bond") points[scene.character]+=2;
    }
    return allies.map(id=>{
      const arc=bondScenes[id], done=completedBonds(state,id);
      const next=arc.find(d=>!completed(state,d.id));
      const bondLevel=done===3 ? 3 : Math.min(2,Math.floor(points[id]/3));
      return {id,name:cast[id].name,points:points[id],rank:["Fellow traveler","Trusted friend","Close companion","Lifelong ally"][bondLevel],
        completed:done,total:arc.length,next:next?.id || null,nextTitle:next?.title || "",requirement:next ? lockReason(state,next) || next.task.label : ""};
    });
  }
  function preface(state,def) {
    if (!def.echo) return def.lines;
    const old=records(state)[def.echo.id]?.choice;
    const text=old==="a" ? def.echo.a : old==="b" ? def.echo.b : "Finch leaves space in the witness book for an earlier account.";
    return [line("trail",text),...def.lines];
  }
  function branch(picked) { return [picked.reply,...(picked.after || []),line("trail",picked.consequence)]; }

  function restore(saved) {
    const cleaned={records:{}};
    if (!saved?.records || typeof saved.records!=="object") return cleaned;
    for (const def of all) {
      const r=saved.records[def.id];
      if (!r || typeof r !== "object") continue;
      const picked=optionsOf(def).find(c=>c.id===r.choice);
      const opening=def.lines.length+(def.echo ? 1 : 0);
      const length=opening+(picked ? branch(picked).length : 0);
      const cursor=Number.isInteger(r.step) ? r.step : 0;
      const accepted=def.kind==="bond" && r.accepted===true;
      if (def.kind==="bond" && !accepted) continue;
      cleaned.records[def.id]={step:Math.max(0,Math.min(cursor,picked ? length-1 : opening-1)),
        choice:picked?.id || null,accepted,done:Boolean(picked && r.done===true && cursor>=length-1)};
    }
    return cleaned;
  }
  function chapterDone(state,ordinal) { return completed(state,chapterId(ordinal)); }
  function hasLesson(state,ability) { return completed(state,"lesson-"+ability); }
  function ending(state) {
    if (!completed(state,"ending")) return null;
    return selected(state,definitions.ending)?.consequence || null;
  }

  function lockReason(state,def) {
    if (completed(state,def.id)) return "";
    if (def.kind==="ending") {
      if (state.crests.length<30) return "Earn the Horizon Crest after the last Warden trial.";
      const unread=chapters.find(c=>!completed(state,c.id));
      if (unread) return "Read chapter "+unread.chapter+", "+unread.title+".";
    }
    if (state.crests.length<def.chapter-1) return "Earn "+(def.chapter-1)+" Warden crests.";
    if (!state.visited.includes(def.region)) return "Visit "+atlas.regions[def.region].name+".";
    if (def.previous && !completed(state,def.previous)) return "Finish "+definitions[def.previous].title+" first.";
    if (def.kind==="bond" && records(state)[def.id]?.accepted && !def.task.test(state)) return def.task.label+".";
    return "";
  }
  function describe(state,def) {
    const lock=lockReason(state,def);
    const r=records(state)[def.id];
    return {id:def.id,title:def.title,kind:def.kind,region:def.region,chapter:def.chapter,character:def.character,
      summary:def.summary,requirement:lock || (def.kind==="bond" ? def.task.label : ""),
      status:r?.done ? "complete" : lock ? "locked" : r ? "in progress" : "available"};
  }
  function catalog(state) { return all.map(def=>describe(state,def)); }

  function scene(state,id) {
    const def=definitions[id];
    if (!Object.hasOwn(definitions,id)) return null;
    const meta=describe(state,def), r=records(state)[id], picked=selected(state,def);
    const intro=preface(state,def);
    const lines=picked ? [...intro,...branch(picked)] : intro;
    const step=r?.step || 0;
    const lineAt=lines[step] || lines.at(-1);
    const base={...meta,step:step+1,total:picked ? lines.length : intro.length+(def.kind==="ending" ? 4 : 2),
      choices:[],lockedChoices:[],speakerId:lineAt.speakerId,speaker:cast[lineAt.speakerId].name,text:lineAt.text};
    if (meta.status==="locked") return {...base,speakerId:def.character,speaker:cast[def.character].name,text:meta.requirement};
    if (meta.status==="complete") return {...base,text:picked.consequence,speakerId:"trail",speaker:cast.trail.name};
    if (def.kind==="bond" && !r?.accepted) {
      return {...base,step:0,speakerId:def.character,speaker:cast[def.character].name,
        text:def.offer,choices:[{id:"accept",label:"Take the errand"}]};
    }
    if (step===intro.length-1 && !picked) {
      const options=optionsOf(def);
      base.choices=options.filter(c=>!c.needs || c.needs(state)).map(c=>({id:c.id,label:c.label}));
      base.lockedChoices=options.filter(c=>c.needs && !c.needs(state)).map(c=>({label:c.label,requirement:c.hint}));
    }
    return base;
  }

  function advance(state,id,choiceId) {
    const current=scene(state,id);
    const error=message=>({ok:false,kind:"error",message});
    if (!current) return error("No dispatch has that name.");
    if (current.status==="complete") return error("That account is already recorded.");
    if (current.status==="locked") return error(current.requirement);
    if (current.choices.length && !current.choices.some(c=>c.id===choiceId)) return error("Choose an answer before continuing.");
    if (!current.choices.length && choiceId!=null && choiceId!=="") return error("Continue reading this line first.");
    const def=definitions[id];
    const r=state.story.records[id] ||= {step:0,choice:null,accepted:false,done:false};
    if (def.kind==="bond" && !r.accepted) {
      r.accepted=true;
      return {ok:true,kind:"accepted",message:def.task.label+"."};
    }
    if (current.choices.length) r.choice=choiceId;
    if (current.step===current.total) {
      r.done=true;
      return {ok:true,kind:"story-complete",message:def.kind==="ending" ? ending(state) : def.title+" recorded."};
    }
    r.step++;
    return {ok:true,kind:"dialogue",message:scene(state,id).text};
  }

  const letters = {
    nessa:[
      "Lina's little girl borrowed the tide book and wrote her own name in it before counting anyone else. She caught me checking the count and made me add mine. Come for Sunday lunch.",
      "The first stranger to use our spare seat was a fiddler with a very small case. Ulo moved over without asking for a number. I think we're learning."
    ],
    tal:[
      "We flew the plum-tree feather upside down at the family picnic. My sister says there are two ways to hold it and both of them are our mother's fault. I wish you'd heard us laugh.",
      "The square-tailed club had four entries on its first morning. Three of them flew. We gave the fourth a prize for making us look at a tree differently."
    ],
    hedd:[
      "Sen has fourteen students. The youngest insists on a written contract for cleaning the vices. We both signed. My new thumb callus is on the apprentice side of the bench.",
      "Our first six emergency keys failed their tests. Sen mounted them on the wall with our names and the dates. The seventh worked. That's the one we sent to your lodge."
    ],
    mina:[
      "The first date on our hoof register has faded. There's another plate beside it, with three smaller marks that weren't here last winter. A keeper from across the ridge came to listen.",
      "That little hoofprint outside the post is almost gone. Yesterday the same calf came through grown, and put down a new one. Nobody asked for the old one back."
    ],
    edda:[
      "We gave up counting the chairs on supper nights. Nell bolts a new lamp to the shelf each time we run out of light. She files the catches smooth on both sides now.",
      "Your cushion is still beside the stove. Nell can turn the kitchen aurora green by tilting her spoon. Bring the dispatch slip if you like. You don't have to show it to us."
    ],
    sol:[
      "Ena says a person can be late for dinner and still have a place at the table. Three spoons laid out. If the ice goes early this year, bring yourself by boat.",
      "My apprentice can hear the crack in a runner a beat before I do. When supper is ready we leave twice as many tools on the bench as I used to allow."
    ]
  };
  function epilogue(state) {
    const result=[];
    if (!ending(state)) return result;
    for (const id of allies) {
      const last=bondScenes[id].at(-1);
      if (completed(state,last.id)) {
        const index=records(state)[last.id].choice==="a" ? 0 : 1;
        result.push(line(id,letters[id][index]));
      }
    }
    result.push(line("mara",records(state)["chapter-26"].choice==="a"
      ? "I read Ren's letter at the stove on a rainy morning. He had drawn a picture of the red shoes with a pair of ridiculous wings. I put the drawing in the window."
      : "At the first public hearing a girl interrupted my recording to ask Ren's name. We stopped the cylinder and I told her. You could hear the rainfall in the silence after."));
    result.push(line("ada",records(state)["chapter-18"].choice==="a"
      ? "There are twelve names on the cuffs of my yellow gloves. Eight people signed the new register, three declined, and one asked for a week to think. All twelve are in the book."
      : "The shell mould has cracked. Its makers are pressing a second cast into the break. The archives have agreed to keep the joins visible."));
    return result;
  }

  function transcript(state,id) {
    const current=scene(state,id);
    if (!current || current.status==="locked") return [];
    const def=definitions[id], r=records(state)[id];
    if (def.kind==="bond" && !r?.accepted) return [line(def.character,def.offer)].map(l=>({...l,speaker:cast[l.speakerId].name}));
    const intro=preface(state,def), picked=selected(state,def);
    const visible=intro.slice(0,Math.min(intro.length,(r?.step || 0)+1));
    if (picked && r.step>=intro.length) visible.push(line("finch",picked.label),...branch(picked).slice(0,r.step-intro.length+1));
    if (def.kind==="bond") visible.unshift(line(def.character,def.offer));
    if (id==="ending" && current.status==="complete") visible.push(...epilogue(state));
    return visible.map(l=>({...l,speaker:cast[l.speakerId].name}));
  }

  window.WilderStory={title:"The Missing Beat",characters,chapters,restore,catalog,scene,advance,transcript,
    bonds,ending,epilogue,chapterDone,hasLesson};
})();
