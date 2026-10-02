// Single source of truth for the target fields so the prompt, the JSON
// schema handed to the model, and the response-assembly code can never
// drift out of sync with each other.

const CATEGORIES = ["food", "travel", "utilities", "software", "other"];

const FIELD_DEFS = [
  {
    name: "vendor_name",
    type: "string",
    required: true,
    description: "Name of the vendor, merchant, or sender of the message/invoice.",
  },
  {
    name: "amount",
    type: "number",
    required: true,
    description:
      "Total monetary amount as a plain number, with no currency symbol, commas, or units.",
  },
  {
    name: "currency",
    type: "string",
    required: true,
    description:
      "ISO 4217 currency code (e.g. INR, USD). Infer from symbols/context (e.g. '₹' => INR, 'Rs' => INR, '$' => USD) when not spelled out.",
  },
  {
    name: "date",
    type: "string",
    required: true,
    description:
      "Date of the transaction, normalised to YYYY-MM-DD. If only a relative date is given (e.g. 'last tuesday') and no absolute reference date exists in the text, do your best to resolve it only if unambiguous, otherwise return null with low confidence.",
  },
  {
    name: "category",
    type: "string",
    required: true,
    description: `One of: ${CATEGORIES.join(", ")}. Choose 'other' if nothing fits well.`,
    enum: CATEGORIES,
  },
  {
    name: "description",
    type: "string",
    required: false,
    description: "A one-line summary of what the transaction/expense is for.",
  },
  {
    name: "invoice_id",
    type: "string",
    required: false,
    description: "Invoice, reference, or order number if explicitly present in the text.",
  },
];

const REVIEW_THRESHOLD = 0.75;

module.exports = { FIELD_DEFS, CATEGORIES, REVIEW_THRESHOLD };
