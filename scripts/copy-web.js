// Capacitor requires webDir to be a real subfolder (not "." or "./"), but this
// project has no build step and keeps its source at the repo root. This script
// mirrors the runtime assets into www/ so Capacitor's `cap sync`/`cap copy` has
// something to consume, without moving the actual source files (which stay at
// the root for the existing GitHub Pages / browser-PWA deployment).
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DEST = path.join(ROOT, "www");

var ENTRIES = ["index.html", "manifest.json", "sw.js", "css", "js", "icons"];

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyEntry(name) {
  var src = path.join(ROOT, name);
  var dest = path.join(DEST, name);
  fs.cpSync(src, dest, { recursive: true });
}

rimraf(DEST);
fs.mkdirSync(DEST, { recursive: true });
ENTRIES.forEach(copyEntry);

console.log("Copied " + ENTRIES.join(", ") + " -> www/");
