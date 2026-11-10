import { providers, DEFAULT_MODEL } from "../src/providers.js";
import { research } from "../src/agent.js";
const missing = ["GEMINI_API_KEY", "TAVILY_API_KEY"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error("Missing keys: " + missing.join(", "));
  process.exit(1);
}
const result = await research({
  ...providers(),
  query:
    "What is the current entry-level paid price of Neon Postgres hosting? State billing terms and what remains uncertain.",
  history: [],
  signal: AbortSignal.timeout(90000),
});
console.log(
  JSON.stringify(
    {
      model: process.env.MODEL_ID || DEFAULT_MODEL,
      at: new Date().toISOString(),
      ...result,
    },
    null,
    2,
  ),
);
