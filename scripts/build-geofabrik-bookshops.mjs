import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {buildExtractDataset} from "./geofabrik-bookshops-core.mjs";

const TARGETS = {
  scotland: {
    output: "data/scotland-bookshops.json",
    source: "https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf",
    minimumCount: 100
  },
  uk: {
    output: "data/uk-bookshops.json",
    source: "https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf",
    minimumCount: 250
  }
};

async function readFeatures(filename) {
  const features = [];
  let lineNumber = 0;
  const input = readline.createInterface({
    input: fs.createReadStream(filename, {encoding:"utf8"}),
    crlfDelay: Infinity
  });
  for await (let line of input) {
    lineNumber += 1;
    line = line.replace(/^\u001e/, "").trim();
    if (!line) continue;
    let feature;
    try {
      feature = JSON.parse(line);
    } catch (error) {
      throw new Error("Invalid GeoJSONSeq at line " + lineNumber +
        ": " + error.message);
    }
    if (feature?.type !== "Feature") {
      throw new Error("Unexpected GeoJSONSeq record at line " + lineNumber);
    }
    features.push(feature);
  }
  if (!features.length) throw new Error("Extract contains zero GeoJSON features.");
  return features;
}

async function main() {
  const mode = process.argv[2];
  const sourceFile = process.argv[3];
  if (!Object.hasOwn(TARGETS, mode) || !sourceFile) {
    throw new Error("Usage: node scripts/build-geofabrik-bookshops.mjs scotland|uk path.geojsonseq");
  }
  const options = TARGETS[mode];
  const previous = JSON.parse(await fsp.readFile(options.output, "utf8"));
  const features = await readFeatures(sourceFile);
  const output = buildExtractDataset({
    features, previous, mode, sourceUrl: options.source,
    minimumCount: options.minimumCount
  });
  const tempFile = options.output + ".tmp";
  await fsp.mkdir(path.dirname(options.output), {recursive:true});
  try {
    await fsp.writeFile(tempFile, JSON.stringify(output, null, 2) + "\n", "utf8");
    await fsp.rename(tempFile, options.output);
  } finally {
    await fsp.rm(tempFile, {force:true});
  }
  console.log("Built " + output.count + " bookshops from " +
    output.parsedFeatures + " GeoJSON features in " + mode +
    ". No candidate listing was published without validation.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
