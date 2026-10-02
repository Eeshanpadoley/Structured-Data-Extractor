// Runs all 5 assessment sample inputs against the running /extract endpoint
// and writes the array of responses to results.json, as required by the
// assessment deliverables.
const fs = require("fs");
const path = require("path");
const samples = require("./samples");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const results = [];

  for (const sample of samples) {
    console.log(`Running: ${sample.label}`);
    const res = await fetch(`${BASE_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sample.text }),
    });

    const body = await res.json();
    results.push({
      label: sample.label,
      input: sample.text,
      status: res.status,
      response: body,
    });
  }

  const outPath = path.join(__dirname, "..", "results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} results to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed to run samples:", err);
  process.exit(1);
});
