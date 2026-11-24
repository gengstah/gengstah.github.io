const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
  const ctx = vm.createContext({window: {}});
  for (const name of ["atlas", "bestiary", "call-habitats", "wild-calls"]) {
    const filename = path.join(__dirname, "../games/wilderkin", name + ".js");
    vm.runInContext(fs.readFileSync(filename, "utf8"), ctx, {filename});
  }
  const dex = ctx.window.WilderKinDex;
  const legacy = ["sprigkit", "cindlet", "dewfin", "mossbell", "coalmoth", "glimmeray"];
  const types = ["Grove", "Ember", "Tide"];
  const species = dex.expand(Object.fromEntries(legacy.map((id, i) =>
    [id, {id, name: id, type: types[i % types.length]}])));
  return {dex, species, habitats: ctx.window.WilderCallHabitats, calls: ctx.window.WilderWildCalls};
}

test("all 26 visible families explain an actual affinity or Beacon Pass on every form", () => {
  const {dex, species, habitats} = load();
  const counts = new Map(), titles = new Set(), affinities = new Set(), signals = new Set();
  for (const kin of Object.values(species)) {
    const shape = dex.shapeOf(kin.id);
    if (!shape) continue;
    const card = habitats.forKin(kin, shape);
    assert.ok(card, kin.id);
    assert.ok(card.scene.startsWith(kin.name + " "));
    assert.ok(card.response.startsWith(kin.name + " "));
    assert.match(card.target, /^the .+/);
    counts.set(shape, (counts.get(shape) || 0) + 1);
    titles.add(card.title);
    if (card.pass) {
      assert.equal(card.pass, "beacon");
      assert.equal(card.affinity, null);
      assert.match(card.answer, /Beacon Pass/);
      signals.add(shape);
    } else {
      assert.equal(card.pass, null);
      assert.ok(Object.hasOwn(dex.types, card.affinity));
      assert.ok(card.answer.includes(card.affinity));
      affinities.add(card.affinity);
    }
  }
  assert.equal(counts.size, 26);
  assert.ok([...counts.values()].every(n => n === 19));
  assert.equal(titles.size, 26);
  assert.deepEqual(affinities, new Set(Object.keys(dex.types)));
  assert.deepEqual(signals, new Set(["glider", "falcon"]));
});

test("public calls cover each recruitable quarry and keep individual opening requests", () => {
  const {dex, species, calls} = load();
  const starters = new Set(["sprigkit", "cindlet", "dewfin"]);
  for (const id of new Set(dex.encounterPools.flat())) {
    if (!starters.has(id)) assert.ok(calls.forKin(id, species[id]), id);
  }
  const gust = calls.forKin("gustlance", species.gustlance);
  assert.equal(gust.affinity, "Ember");
  const crab = calls.forKin("opalclasp", species.opalclasp);
  assert.equal(crab.pass, "beacon");
  assert.equal(calls.forKin("sprigkit", species.sprigkit), null);
});

test("unknown families return null and cards do not share mutable data", () => {
  const {habitats} = load(), kin = {name: "Alder"};
  for (const shape of [undefined, {}, ["mole"], "", "__proto__", "constructor", "wolf"]) {
    assert.equal(habitats.forKin(kin, shape), null);
  }
  assert.equal(habitats.forKin(null, "mole"), null);
  habitats.forKin(kin, "mole").title = "Changed";
  assert.equal(habitats.forKin(kin, "mole").title, "Mud at the back door");
});
