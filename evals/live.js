import { providers } from "../src/providers.js";
import { research } from "../src/agent.js";
const missing = ["ANTHROPIC_API_KEY", "TAVILY_API_KEY"].filter(
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
      model: process.env.MODEL_ID || "claude-sonnet-4-6",
      at: new Date().toISOString(),
      ...result,
    },
    null,
    2,
  ),
);
