import { selectHistory } from "../src/memory.js";
// Deterministic retrieval ablation, not a model answer benchmark.
const history = Array.from({ length: 150 }, (_, i) => ({
  id: String(i),
  role: i % 2 ? "assistant" : "user",
  content:
    i === 8
      ? "Postgres hosting shortlist: Neon, Supabase, Render."
      : i === 38
        ? "CRM shortlist: Alpha, Beta, Gamma, Delta, Epsilon."
        : "Unrelated discussion " + i,
  created_at: i < 20 ? "2026-11-03T09:00:00Z" : "2026-11-09T09:00:00Z",
}));
const cases = [
  {
    query: "Last Tuesday I asked about Postgres hosting. Any price changes?",
    id: "8",
  },
  { query: "Has the CRM shortlist changed?", id: "38" },
];
const result = {
  kind: "deterministic retrieval ablation",
  cases: cases.length,
  windowOnlyHits: 0,
  retrievalHits: 0,
};
for (const c of cases) {
  if (history.slice(-20).some((m) => m.id === c.id)) result.windowOnlyHits++;
  if (
    selectHistory(history, c.query, 40, "2026-11-10T12:00:00Z").some(
      (m) => m.id === c.id,
    )
  )
    result.retrievalHits++;
}
console.log(JSON.stringify(result, null, 2));
