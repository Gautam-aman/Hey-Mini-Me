// Distinct multi-turn scenarios with frozen source observations; synthetic prices.
const turn = (id, role, content, at = "2026-11-03T09:00:00Z") => ({
  id,
  role,
  content,
  created_at: at,
});
const clutter = Array.from({ length: 70 }, (_, i) =>
  turn(
    `noise${i}`,
    i % 2 ? "assistant" : "user",
    "Unrelated discussion about lunch and travel.",
    "2026-11-09T18:00:00Z",
  ),
);
export const challengeCases = [
  {
    id: "five-crm",
    query:
      "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
    history: [
      turn(
        "u1",
        "user",
        "Shortlist AlphaCRM, BetaCRM, GammaCRM, DeltaCRM and EpsilonCRM for 20 salespeople. Monthly USD billing, US.",
        "2026-11-09T09:00:00Z",
      ),
      turn(
        "a1",
        "assistant",
        "The five shortlisted tools are AlphaCRM, BetaCRM, GammaCRM, DeltaCRM and EpsilonCRM.",
        "2026-11-09T09:01:00Z",
      ),
      ...clutter,
    ],
    baselineIds: ["u1", "a1"],
    entities: ["AlphaCRM", "BetaCRM", "GammaCRM", "DeltaCRM", "EpsilonCRM"],
    expected:
      "Recover all five original tools and 20 seats. AlphaCRM rose from USD 30 to 35 monthly per seat: +USD 100 for the team. BetaCRM shipped the required SSO integration after Monday. Do not call the old GammaCRM announcement a new release.",
  },
  {
    id: "november-revalidate",
    query:
      "What did I ask you on 3 November? Is your answer still correct today?",
    history: [
      turn(
        "u2",
        "user",
        "Does AtlasDB include daily backups in its basic plan?",
      ),
      turn(
        "a2",
        "assistant",
        "Yes, daily backups are included in AtlasDB Basic.",
      ),
      ...clutter,
    ],
    baselineIds: ["u2", "a2"],
    entities: ["AtlasDB"],
    expected:
      "Recall the daily-backup question. Correct the earlier answer: the original dated terms and current terms both say backups require Pro. This was an error, not a recent change.",
  },
  {
    id: "postgres-pricing",
    query:
      "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
    history: [
      turn(
        "u3",
        "user",
        "Compare hosting Postgres on NorthDB and SouthDB. USD monthly billing in US; 1 CU and 10 GB storage.",
      ),
      turn(
        "a3",
        "assistant",
        "NorthDB compute USD 0.10 per CU-hour; SouthDB compute USD 0.12 per CU-hour.",
      ),
      ...clutter,
    ],
    baselineIds: ["u3", "a3"],
    entities: ["NorthDB", "SouthDB"],
    expected:
      "Recover both providers and workload. NorthDB rose from USD 0.10 to 0.11 per CU-hour. Do not multiply compute rates by seats. SouthDB remains unresolved because no current official price is available.",
  },
  {
    id: "same-day-correction",
    query: "Has our final CRM shortlist changed pricing?",
    history: [
      turn("u4", "user", "Consider AlphaCRM and BetaCRM."),
      turn("a4", "assistant", "AlphaCRM and BetaCRM are candidates."),
      turn(
        "u5",
        "user",
        "Correction: drop AlphaCRM. Final shortlist: DeltaCRM and EpsilonCRM.",
      ),
      turn("a5", "assistant", "Final shortlist: DeltaCRM and EpsilonCRM."),
      ...clutter,
    ],
    baselineIds: ["u5", "a5"],
    entities: ["DeltaCRM", "EpsilonCRM"],
    expected:
      "Use the corrected final shortlist; do not reintroduce AlphaCRM or BetaCRM. Distinguish no announcement from proof of no changes.",
  },
  {
    id: "no-history",
    query: "Have those five changed since Monday?",
    history: [],
    baselineIds: [],
    entities: [],
    expected:
      "Ask which five, without inventing a shortlist or running speculative searches.",
  },
  {
    id: "billing-mismatch",
    query: "Did the AlphaCRM price drop since our discussion?",
    history: [
      turn("u6", "user", "AlphaCRM monthly billing for 20 seats in US, USD."),
      turn("a6", "assistant", "USD 30 per seat per month, monthly billing."),
    ],
    baselineIds: ["u6", "a6"],
    entities: ["AlphaCRM"],
    expected:
      "Do not call USD 25 a price drop: the new advertised rate requires annual billing, while the old rate was monthly billing.",
  },
];
export function fixtureEvidence(c) {
  const texts = {
    "five-crm": [
      "AlphaCRM Pro USD 30 per seat per month, monthly billing, US, minimum 1 seat on November 9.",
      "BetaCRM release log through November 9: no SSO integration.",
    ],
    "november-revalidate": [
      "AtlasDB terms dated November 1: Basic does not include daily backups. Daily backups require Pro.",
    ],
    "postgres-pricing": [
      "NorthDB compute USD 0.10 per CU-hour, US, monthly billing, on November 3.",
      "SouthDB compute USD 0.12 per CU-hour, US, monthly billing, on November 3.",
    ],
    "same-day-correction": [
      "DeltaCRM and EpsilonCRM Pro both USD 30 per seat per month, monthly US billing.",
    ],
    "billing-mismatch": [
      "AlphaCRM Pro USD 30 per seat per month, monthly US billing, minimum 1 seat.",
    ],
  };
  const current = {
    "five-crm": [
      "AlphaCRM Pro USD 35 per seat per month effective November 10, monthly US billing, minimum 1 seat. Previously USD 30.",
      "BetaCRM released SSO November 10.",
      "GammaCRM article published November 10 describes a release shipped October 12.",
      "DeltaCRM and EpsilonCRM current Pro prices are USD 30 per seat monthly, US, minimum 1 seat.",
    ],
    "november-revalidate": [
      "AtlasDB current terms: Basic does not include daily backups. Pro includes daily backups.",
    ],
    "postgres-pricing": [
      "NorthDB compute is USD 0.11 per CU-hour effective November 10, US monthly billing. SouthDB current pricing could not be retrieved.",
    ],
    "same-day-correction": [
      "DeltaCRM current price USD 30; EpsilonCRM pricing unavailable. No change announcements found.",
    ],
    "billing-mismatch": [
      "AlphaCRM advertises USD 25 per seat per month equivalent, billed annually, US, minimum 1 seat.",
    ],
  };
  const make = (content, i, old) => ({
    url: `https://fixture.example/${c.id}/${old ? "old" : "now"}/${i}`,
    title: "Synthetic official fixture",
    content,
    retrieved_at: old
      ? c.history.find((m) => m.id === c.baselineIds.at(-1))?.created_at ||
        "2026-11-03T09:00:00Z"
      : "2026-11-10T12:00:00Z",
  });
  return {
    baseline: (texts[c.id] || []).map((x, i) => make(x, i, true)),
    current: (current[c.id] || []).map((x, i) => make(x, i, false)),
  };
}
