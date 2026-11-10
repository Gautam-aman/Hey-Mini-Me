import { mkdir, writeFile } from "node:fs/promises";
import { providers, selectProvider } from "../src/providers.js";
import { research } from "../src/agent.js";
import { selectHistory } from "../src/memory.js";
import { selectBaseline } from "../src/evidence.js";
import { challengeCases, fixtureEvidence } from "./challenge-cases.js";
const selected = selectProvider(),
  { model } = providers(),
  results = [];
for (const c of challengeCases
  .filter(
    (c) =>
      !(process.argv[2] || process.env.EVAL_CASE) ||
      c.id === (process.argv[2] || process.env.EVAL_CASE),
  )
  .slice(0, Number(process.env.EVAL_LIMIT || 6))) {
  const evidence = fixtureEvidence(c);
  let searches = 0;
  try {
    const diagnostics = [];
    const result = await research({
      onDiagnostic: (item) => diagnostics.push(item),
      query: c.query,
      history: selectHistory(c.history, c.query, 40, "2026-11-10T12:00:00Z"),
      now: "2026-11-10T12:00:00Z",
      model,
      search: async (query) => {
        searches++;
        const terms = query
          .toLowerCase()
          .split(/\W+/)
          .filter((term) => term.length > 3);
        const score = (source) =>
          terms.filter((term) => source.content.toLowerCase().includes(term))
            .length;
        return [...evidence.current].sort((a, b) => score(b) - score(a));
      },
      loadBaseline: (ids) =>
        selectBaseline(c.history, ids, (id) =>
          id === c.baselineIds.at(-1) ? evidence.baseline : [],
        ),
      signal: AbortSignal.timeout(90000),
    });
    const record = {
      id: c.id,
      diagnostics,
      expected: c.expected,
      text: result.text,
      claims: result.claims,
      unresolved: result.unresolved,
      comparisons: result.comparisons,
      plan: result.plan,
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      modelCalls: result.stages?.length,
      searches,
    };
    results.push(record);
    console.log(JSON.stringify(record));
  } catch (error) {
    const record = { id: c.id, error: error.message };
    results.push(record);
    console.log(JSON.stringify(record));
  }
}
await mkdir("data", { recursive: true });
const path = `data/challenge-${Date.now()}.json`;
await writeFile(
  path,
  JSON.stringify(
    {
      provider: selected.id,
      model: selected.model,
      at: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);
console.log(`Saved ${path}`);
if (results.some((r) => r.error)) process.exitCode = 1;
