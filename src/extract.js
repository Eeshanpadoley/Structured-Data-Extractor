const { FIELD_DEFS, REVIEW_THRESHOLD } = require("./fields");
const { clampConfidence, NORMALIZERS } = require("./postProcess");
const { runExtraction } = require("./llmClient");

const LOW_CONFIDENCE_FALLBACK = 0.05;

// Guarantees every field in FIELD_DEFS appears in the final response, even
// if the model omitted one or returned something malformed - the spec
// requires required fields to always be present (null + low confidence)
// rather than crashing or dropping them.
function assembleFields(llmOutput) {
  const fields = {};
  let anyNeedsReview = false;

  for (const def of FIELD_DEFS) {
    const raw = llmOutput && typeof llmOutput === "object" ? llmOutput[def.name] : undefined;

    const normalize = NORMALIZERS[def.name];
    let value = null;
    let confidence = LOW_CONFIDENCE_FALLBACK;

    if (raw && typeof raw === "object") {
      value = normalize(raw.value);
      confidence = clampConfidence(raw.confidence);
      // If normalisation rejected the model's value (e.g. unparseable date),
      // the field is no longer trustworthy even if the model was confident.
      if (value === null && raw.value !== null && raw.value !== undefined) {
        confidence = Math.min(confidence, LOW_CONFIDENCE_FALLBACK);
      }
    }

    const needs_review = confidence < REVIEW_THRESHOLD;
    if (needs_review) anyNeedsReview = true;

    fields[def.name] = { value, confidence, needs_review };
  }

  return { fields, review_required: anyNeedsReview };
}

async function extract(rawText) {
  let llmOutput;
  try {
    llmOutput = await runExtraction(rawText);
  } catch (err) {
    // Degrade gracefully: never 500 on a model hiccup for ambiguous/empty
    // input. Every required field comes back null, low-confidence, flagged.
    const { fields, review_required } = assembleFields(null);
    return {
      review_required,
      fields,
      error: `extraction_failed: ${err.message}`,
    };
  }

  const { fields, review_required } = assembleFields(llmOutput);
  return { review_required, fields };
}

module.exports = { extract };
