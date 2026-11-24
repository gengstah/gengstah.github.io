// Run with: node --test _tests/wilderkin-activities.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.join(__dirname, "../games/wilderkin/activities.js");
const script = new vm.Script(readFileSync(filename, "utf8"), {filename});

// Give each game the same fresh random stream. Changing a neighboring game's
// setup or moving a test cannot alter this game's cards, clues, or rivals.
function loadGames() {
  let seed = 718;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const context = {window:{}, Math:math, performance:{now:() => 0}};
  script.runInNewContext(context);
  return context.window.WilderActivities.games;
}

// Recorded player moves on the seeded boards. Numbers identify the button on
// the board (zero-based); named actions are the game's own button values.
const playthroughs = {
  "firefly-pairs": "0 4 3 6 1 7 2 5",
  "coal-share": "1 2 2 3",
  "lamplighter": "0 2 5 6 8",
  "mortar": "0 1 3 grind",
  "sluice": "fill1 pour1 empty0 pour1 fill1 pour1",
  "burrow": "down right right down down left left right right up up up right right",
  "loom": "hide 2 1 1 0",
  "ferry": "1 solo 0 1 2 solo 1",
  "wind-cards": "lower higher lower higher",
  "tile-cart": "1 2 5 4 1 0 3 4 7 8",
  "reed-cast": "steady row row row row row reel row row row row row reel",
  "sky-chart": "1 4 5 6 8 11 12 13 check",
  "gem-vault": "0 0 0 try 1 1 1 try 2 1 1 try",
  "glyph-word": "Z E P H Y R",
  "frog-cross": "1 3 4 2 0 1 3 2",
  "vent-survey": "4 1 7 report",
  "stone-scale": "0 1 0 2 0 3 0 4 1 2 1 3 1 4 2 3 2 4 3 4 mode 1 3 4 2 0 submit",
  "kite-run": "hold hold hold left right hold right left",
  "mirror-reef": "1 7 fire",
  "bridge-oath": "3 1 0 2 1 4 3",
  "bell-stack": "0 2 0 1 2 1 0 2 1 0 1 2 0 2"
};

test("every published mini-game has a playthrough", () => {
  const ids = Array.from(loadGames(), game => game.id).sort();
  assert.deepEqual(ids, Object.keys(playthroughs).sort());
});

for (const [id, moves] of Object.entries(playthroughs)) {
  test(id + " can be won using its displayed controls", () => {
    const game = loadGames().find(entry => entry.id === id);
    const round = game.setup();
    for (const [step, move] of moves.split(" ").entries()) {
      const location = id + ", move " + (step + 1) + " (" + move + ")";
      assert.ok(!round.result, location + " requires an active round");
      const buttons = game.view(round).matchAll(/<button\b[^>]*\bdata-play="([^"]+)"[^>]*>/g);
      const button = Array.from(buttons).find(match => match[1] === move);
      assert.ok(button, location + " is missing from the board");
      assert.doesNotMatch(button[0], /\sdisabled\b/, location + " is disabled");
      game.play(round, move);
    }
    assert.equal(round.result, "won", round.notice);
  });
}
