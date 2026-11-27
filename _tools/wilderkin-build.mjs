// Build the static Pages entry point. The source order also drives the Node integration tests.
import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import {transform} from "esbuild";

const check = process.argv[2] === "--check";
if (process.argv.length !== (check ? 3 : 2)) throw new Error("Use wilderkin-build.mjs [--check]");
const game = new URL("../games/wilderkin/", import.meta.url);
const read = file => readFile(new URL(file, game), "utf8");
const digest = data => createHash("sha256").update(data).digest("hex").slice(0, 10);
async function output(file, body) {
  const current = await read(file).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (current === body) return;
  if (check) throw new Error(file + " is stale. Run node _tools/wilderkin-build.mjs");
  await writeFile(new URL(file, game), body);
}
const files = (await read("_scripts.txt")).trim().split(/\s+/);
if (files.at(-1) !== "game.js" || new Set(files).size !== files.length ||
    !files.every(file => /^[a-z0-9-]+\.js$/.test(file))) {
  throw new Error("Invalid Wilderkin script order");
}
function fingerprint(source, file, hash) {
  const prefix = file + "?v=";
  if (source.split(prefix).length !== 2) throw new Error("Expected one versioned reference to " + file);
  const start = source.indexOf(prefix) + prefix.length;
  const previous = source.slice(start).match(/^[a-f0-9]{10}(?=")/);
  if (!previous) throw new Error("Invalid asset fingerprint for " + file);
  return source.slice(0, start) + hash + source.slice(start + previous[0].length);
}
const relay = await read("realm-relay.mjs");
const transport = fingerprint(await read("realm-transport.js"), "realm-relay.mjs", digest(relay));
await output("realm-transport.js", transport);
const doubles = new Set([
  "twin-battle.js", "twin-match.js", "twin-ring.js", "twinbell.js",
  "switchyard-scout.js", "switchyard-series.js", "switchyard.js", "signal-box.js"
]);
if (![...doubles].every(file => files.includes(file))) throw new Error("Doubles source missing from _scripts.txt");
async function bundle(name, sources) {
  // Each classic script has its own IIFE. Preserve the source order, globals and relative imports.
  const code = await Promise.all(sources.map(read));
  const result = await transform(code.join("\n;\n"), {minify:true, target:"esnext", charset:"utf8"});
  const body = "// Generated from _scripts.txt by _tools/wilderkin-build.mjs.\n" + result.code;
  await output(name, body);
  return digest(body);
}
const coreVersion = await bundle("play.js", files.filter(file => !doubles.has(file)));
const doublesVersion = await bundle("play-doubles.js", files.filter(file => doubles.has(file)));
let html = await read("index.html");
html = fingerprint(html, "play.js", coreVersion);
html = fingerprint(html, "play-doubles.js", doublesVersion);
html = fingerprint(html, "canvas.css", digest(await read("canvas.css")));
await output("index.html", html);
