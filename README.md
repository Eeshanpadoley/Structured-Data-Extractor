# Structured Data Extractor

A single-endpoint backend that takes raw, unstructured text (a vendor email, a
scanned receipt, a Slack message) and returns structured, database-ready
fields, each with a calibrated per-field confidence score and a
`needs_review` flag, using an LLM.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your API key**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `GEMINI_API_KEY` to a key from
   [Google AI Studio](https://aistudio.google.com/apikey).

3. **Run the server**
   ```bash
   npm start
   ```
   The server listens on `http://localhost:3000` (configurable via `PORT`).

4. **Call the endpoint**
   ```bash
   curl -X POST http://localhost:3000/extract \
     -H "Content-Type: application/json" \
     -d '{"text": "Paid Rs 1,250 to AWS India Pvt Ltd on 12 March 2024. Invoice #INV-2024-0312."}'
   ```

5. **Run the 5 sample inputs and regenerate `results.json`**
   (server must already be running in another terminal)
   ```bash
   npm run test:samples
   ```
   This posts all 5 sample inputs from `test/samples.js` to the running
   server and writes the array of responses to `results.json`.

## LLM and model choice

**Provider: Google Gemini.** **Model: `gemini-3.5-flash-lite`.**

The assessment suggested `gemini-2.5-flash-lite`. When exercised against a
freshly created Google AI Studio key, that model returned `404 Not Found`:
*"This model ... is no longer available to new users."* Querying
`GET /v1beta/models` against the same key confirmed the current generation
of the same tier is `gemini-3.5-flash-lite` (Google's own error message
pointed at this replacement), so that's what the client is configured to use
via `GEMINI_MODEL` in `.env`. It keeps the same rationale the brief intended:
a small, fast, cheap flash-lite model is plenty for short-text field
extraction, where the bottleneck is prompt/schema design, not raw model
capability. The model name is a single environment variable
(`src/llmClient.js`), so swapping to `gemini-2.5-flash-lite`,
`gemini-flash-lite-latest`, or a different tier entirely is a one-line config
change, not a code change.

## Architecture

```
src/
  fields.js        # single source of truth: the 7 target fields + review threshold
  promptBuilder.js  # builds the extraction prompt (calibration rubric + hard rules)
  schema.js         # builds the Gemini structured-output (JSON mode) schema
  llmClient.js      # calls Gemini with the prompt + schema, parses JSON
  postProcess.js    # deterministic normalisation (date/amount/currency formats)
  extract.js        # orchestrates: LLM call -> normalise -> apply review threshold
  server.js         # Express app, POST /extract
test/
  samples.js         # the 5 assessment sample inputs
  run-samples.js      # posts all 5 to a running server, writes results.json
```

## How the prompt elicits genuine per-field confidence

The main failure mode when you ask an LLM for "a confidence score" is that it
anchors on one overall impression of the document and repeats a similar
number (often a suspiciously round 0.9) for every field, regardless of
whether that specific field was actually stated in the text. Three things in
this implementation specifically target that:

1. **A structured-output schema that forces one object per field**
   (`src/schema.js`, via Gemini's `responseSchema` / JSON mode). The model
   cannot return a single top-level score — the schema requires
   `{ value, confidence, reasoning }` for each of the 7 fields individually,
   so there is no "whole response" field to lazily fill in.

2. **A `reasoning` field evaluated before `confidence`, per field.** Each
   field's schema entry also asks for a short phrase citing the textual
   evidence (e.g. *"explicit amount with currency symbol in text"* or *"no
   date mentioned anywhere"*). Forcing the model to articulate *why* for one
   specific field, immediately before scoring that field, makes it actually
   look at that field's evidence instead of reusing a document-level
   judgment. (`reasoning` is used purely to steer the model's generation
   order; it's stripped out before the response is returned, so the public
   API shape matches the spec exactly.)

3. **An explicit, numeric calibration rubric in the prompt**
   (`src/promptBuilder.js`), instead of a vague "rate your confidence
   0-1": values stated verbatim score 0.90-1.00, values requiring light
   normalisation score 0.75-0.89, values inferred from indirect context
   score 0.40-0.74, and anything not actually present in the text — even a
   plausible-sounding guess — must score below 0.40 with `value: null`. The
   prompt also explicitly tells the model that confidence must *not* be
   inflated "to be helpful," and that a realistic document usually produces
   a mix of high and low scores across its fields, not a uniform one.

The 0.75 `needs_review` threshold itself is **not** left to the model — it's
applied deterministically in `src/extract.js` against the confidence the
model returned, so the threshold logic can't drift or be reasoned about
inconsistently by the LLM across requests.

## Review flag logic

- Any field with `confidence < 0.75` is marked `needs_review: true`.
- The top-level `review_required` is `true` if any field (required or
  optional) is flagged.
- Required fields (`vendor_name`, `amount`, `currency`, `date`, `category`)
  always appear in the response, even when the model found nothing — in
  that case `value` is `null` and `confidence` defaults low enough to be
  flagged, satisfying "required fields must always appear, even if null."

## Failure handling

- If the LLM call throws (bad key, network error, malformed JSON back from
  the model), `extract()` catches it and still returns a valid `200` body
  with every required field `null`/low-confidence/flagged, plus an `error`
  field describing what went wrong — it never 500s or crashes the process
  on a model hiccup.
- Input with no transaction data (sample 5) is handled by the LLM itself
  returning low confidence / null for every field, which the review logic
  then correctly flags — no special-casing of "empty" input in code (per
  the "do not hardcode extraction logic" constraint).
- Post-processing (`postProcess.js`) only *reformats* values the model
  already extracted (date formats, stripping currency symbols from
  amounts, uppercasing currency codes) — it never invents or looks up
  values, which the assessment explicitly permits.

## results.json

`results.json` contains the array of all 5 sample-input responses, generated
by running `npm run test:samples` against a live server backed by
`gemini-3.5-flash-lite`. Each entry includes the sample label, the input
text, the HTTP status, and the full response body.
