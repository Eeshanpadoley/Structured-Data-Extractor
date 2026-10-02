const { SchemaType } = require("@google/generative-ai");
const { FIELD_DEFS } = require("./fields");

// Builds the Gemini structured-output schema (JSON-mode) so the model is
// *constrained* to emit { value, confidence } for every field, rather than
// us hoping a prose instruction is followed.
function buildResponseSchema() {
  const properties = {};

  for (const field of FIELD_DEFS) {
    const valueSchema =
      field.type === "number"
        ? { type: SchemaType.NUMBER, nullable: true }
        : { type: SchemaType.STRING, nullable: true, ...(field.enum ? { enum: field.enum } : {}) };

    properties[field.name] = {
      type: SchemaType.OBJECT,
      properties: {
        value: valueSchema,
        confidence: {
          type: SchemaType.NUMBER,
          description: "0.0-1.0 calibrated confidence for THIS field only.",
        },
        reasoning: {
          type: SchemaType.STRING,
          description: "One short phrase: what evidence in the text (or absence of it) justifies the confidence.",
        },
      },
      required: ["value", "confidence", "reasoning"],
    };
  }

  return {
    type: SchemaType.OBJECT,
    properties,
    required: FIELD_DEFS.map((f) => f.name),
  };
}

module.exports = { buildResponseSchema };
