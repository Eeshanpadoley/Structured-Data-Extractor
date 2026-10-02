const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildPrompt } = require("./promptBuilder");
const { buildResponseSchema } = require("./schema");

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Copy .env.example to .env and add your Google AI Studio key."
      );
    }
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

// Calls Gemini with JSON-mode structured output and returns the parsed
// { fieldName: { value, confidence, reasoning } } object. Throws on
// failure so the caller can decide how to degrade gracefully.
async function runExtraction(rawText) {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const model = getClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(),
      temperature: 0.1, // low temperature: we want calibrated, repeatable judgments, not creative prose
    },
  });

  const prompt = buildPrompt(rawText);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${err.message}`);
  }

  return parsed;
}

module.exports = { runExtraction };
