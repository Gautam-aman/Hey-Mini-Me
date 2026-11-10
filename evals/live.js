import { providers, selectProvider } from "../src/providers.js";
import { research } from "../src/agent.js";
let selected;
try {
  selected = selectProvider();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (!process.env.TAVILY_API_KEY) {
  console.error("Set TAVILY_API_KEY in .env");
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
      provider: selected.id,
      model: selected.model,
      at: new Date().toISOString(),
      ...result,
    },
    null,
    2,
  ),
);
