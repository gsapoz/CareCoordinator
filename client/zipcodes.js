const zipcodes = require("zipcodes");

// example: node ziphelper.js 98103 98107
const [zipA, zipB] = process.argv.slice(2);
if (!zipA || !zipB) {
  console.log(-1);
  process.exit(0);
}

const dist = zipcodes.distance(zipA, zipB);
// zipcodes.distance returns null if invalid 
console.log(typeof dist === "number" ? dist : -1);