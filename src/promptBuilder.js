const { FIELD_DEFS } = require("./fields");

// Builds the prompt sent to the LLM. The core design problem this solves:
// LLMs asked to "rate your confidence" tend to anchor on one number and
// repeat it for every field (e.g. everything comes back 0.9). To get
// genuine, decorrelated per-field scores we:
//   1. Give the model an explicit, numeric calibration rubric tied to
//      *evidence in the text* rather than a vague feeling.
//   2. Force a short "reasoning" phrase per field BEFORE the confidence
//      number (via the response schema's field order), so the model has
//      to look for evidence for that specific field instead of reusing
//      one judgment for the whole document.
//   3. Explicitly tell it that most documents should produce a MIX of
//      high and low scores, and that guessing must not be rewarded with
//      high confidence.
function buildPrompt(rawText) {
  const fieldList = FIELD_DEFS.map(
    (f) =>
      `- ${f.name} (${f.type}${f.required ? ", required" : ", optional"}): ${f.description}`
  ).join("\n");

  return `You are a structured-data extraction engine for an expense/invoice processing system. You read one piece of raw, unstructured text (an email, receipt, chat message, or scanned document) and extract a fixed set of fields.

FIELDS TO EXTRACT:
${fieldList}

CONFIDENCE CALIBRATION RULES (apply independently to EACH field):
- 0.90 - 1.00: The value is stated explicitly and unambiguously in the text, verbatim or near-verbatim.
- 0.75 - 0.89: The value is clearly present but required light interpretation or normalisation (e.g. converting "12 March 2024" to "2024-03-12", or inferring currency "USD" from a "$" symbol).
- 0.40 - 0.74: The value is not stated directly and had to be inferred from indirect, partial, or ambiguous context (e.g. a relative date like "last tuesday" with no anchor date, or a category guessed from vague wording).
- 0.00 - 0.39: The field is not present in the text at all, or your answer is essentially a guess with no real textual support. In this case the "value" should usually be null.

HARD RULES:
- Judge each field's confidence independently using ONLY the evidence for that specific field. Do not copy one overall impression across all fields - a document can easily have one field at 0.95 and another at 0.15.
- Do not inflate confidence to "be helpful". A missing or unsupported field MUST get a low confidence score (below 0.4) and, almost always, a null value. Guessing a plausible-sounding value does not earn a high score.
- For "amount": return a plain number only, no currency symbols, no commas, no words.
- For "currency": return a 3-letter ISO 4217 code. Infer it from symbols or context (₹/Rs/INR => "INR", $ => "USD" unless another country is implied, etc.) but lower confidence if you had to infer rather than read it directly.
- For "date": return strict YYYY-MM-DD format, or null if it cannot be determined. Only resolve relative dates ("last tuesday", "next week") if the text gives you an unambiguous anchor; otherwise return null with low confidence rather than inventing a date.
- For "category": choose exactly one of the allowed values. If nothing fits clearly, use "other" with a correspondingly moderate-to-low confidence.
- For every REQUIRED field (vendor_name, amount, currency, date, category) you MUST still return an entry even when you cannot find a value - set "value" to null and give a low confidence. Never omit a required field.
- "reasoning" must be a short phrase (under 15 words) citing the specific evidence (or lack of it) for that field - e.g. "explicit amount with currency symbol in text" or "no date mentioned anywhere".
- Base the extraction ONLY on the text given below. Do not use outside knowledge about any named entity beyond resolving obvious things like currency symbols.

TEXT TO EXTRACT FROM:
"""
${rawText}
"""

Return your answer strictly as JSON matching the required schema - one object per field, each with value, confidence, and reasoning.`;
}

module.exports = { buildPrompt };
