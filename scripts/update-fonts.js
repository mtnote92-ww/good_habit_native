// Regenerates css/fonts.css and css/fonts/*.woff2 from Google Fonts, subsetted to
// only the characters actually used in the app's source files. Run this after
// changing any Japanese/English text in index.html or js/*.js so the bundled
// fonts stay in sync (fonts are self-hosted, not loaded from a CDN, so the app
// has no network dependency at runtime).
//
// Usage: node scripts/update-fonts.js
"use strict";

var fs = require("fs");
var path = require("path");
var https = require("https");

var ROOT = path.join(__dirname, "..");
var TEXT_SOURCES = [
  "index.html",
  "js/icons.js",
  "js/content.js",
  "js/badges.js",
  "js/storage.js",
  "js/logic.js",
  "js/ui.js",
  "js/app.js"
];

var FAMILIES = [
  { name: "Shippori+Mincho", weights: "500;700;800" },
  { name: "Zen+Kaku+Gothic+New", weights: "400;500;700;900" }
];

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var OUT_DIR = path.join(ROOT, "css", "fonts");

function collectChars() {
  var chars = new Set();
  TEXT_SOURCES.forEach(function (f) {
    var text = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (var ch of text) {
      if (ch.codePointAt(0) > 0x2000) chars.add(ch);
    }
  });
  return Array.from(chars).sort().join("");
}

function get(url, headers) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: headers }, function (res) {
      if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode + " for " + url)); return; }
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () { resolve(Buffer.concat(chunks)); });
    }).on("error", reject);
  });
}

function download(url, dest) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode + " for " + url)); return; }
      var file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", function () { file.close(resolve); });
    }).on("error", reject);
  });
}

(async function main() {
  var text = collectChars();
  console.log("Unique non-ASCII characters in use:", text.length);

  var familyParams = FAMILIES.map(function (f) {
    return "family=" + f.name + ":wght@" + f.weights;
  }).join("&");
  var url = "https://fonts.googleapis.com/css2?" + familyParams +
    "&text=" + encodeURIComponent(text) + "&display=swap";

  var cssBuf = await get(url, { "User-Agent": UA });
  var css = cssBuf.toString("utf8");
  var blocks = css.split("@font-face").slice(1);
  if (blocks.length === 0) throw new Error("Google Fonts returned no @font-face blocks");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  var jobs = blocks.map(function (block) {
    var family = /font-family: '([^']+)'/.exec(block)[1];
    var weight = /font-weight: (\d+)/.exec(block)[1];
    var fontUrl = /src: url\(([^)]+)\)/.exec(block)[1];
    var slug = family.toLowerCase().replace(/\s+/g, "-");
    return { family: family, weight: weight, url: fontUrl, filename: slug + "-" + weight + ".woff2" };
  });

  for (var job of jobs) {
    await download(job.url, path.join(OUT_DIR, job.filename));
    console.log("Downloaded", job.filename, "(" + job.family + " " + job.weight + ")");
  }

  var lines = jobs.map(function (job) {
    return [
      "@font-face {",
      "  font-family: '" + job.family + "';",
      "  font-style: normal;",
      "  font-weight: " + job.weight + ";",
      "  font-display: swap;",
      "  src: url('fonts/" + job.filename + "') format('woff2');",
      "}"
    ].join("\n");
  });

  fs.writeFileSync(path.join(ROOT, "css", "fonts.css"), lines.join("\n\n") + "\n", "utf8");
  console.log("Wrote css/fonts.css (" + jobs.length + " @font-face rules)");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
