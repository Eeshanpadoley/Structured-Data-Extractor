require("dotenv").config();
const express = require("express");
const { extract } = require("./extract");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/extract", async (req, res) => {
  const { text } = req.body || {};

  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Request body must include a non-empty 'text' string." });
  }

  try {
    const result = await extract(text);
    res.json(result);
  } catch (err) {
    // extract() already catches LLM failures internally; this is a final
    // safety net so the endpoint never crashes the process.
    console.error("Unexpected error in /extract:", err);
    res.status(500).json({ error: "Internal extraction error." });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Structured Data Extractor listening on port ${PORT}`);
});
