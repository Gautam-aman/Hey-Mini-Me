// Synthetic companies and prices: fixtures, never live product facts.
export const dataset = [];
for (let variant = 0; variant < 10; variant++)
  for (const category of [
    "price-change",
    "no-baseline",
    "old-error",
    "release-date",
    "recall",
    "missing-history",
  ]) {
    const name = `FixtureCRM${variant}`,
      query =
        category === "recall"
          ? "What did I ask on 3 November?"
          : category === "missing-history"
            ? "Have those five CRM tools changed pricing since Monday?"
            : `On 3 November we discussed ${name}. Has anything changed since then?`;
    const history =
      category === "missing-history"
        ? []
        : [
            {
              id: "u1",
              role: "user",
              content: `Compare ${name} for our ${20 + variant}-person sales team. We require monthly billing in USD in the US.`,
              created_at: "2026-11-03T09:00:00Z",
            },
            {
              id: "a1",
              role: "assistant",
              content:
                category === "old-error"
                  ? `${name} costs $10 per seat monthly.`
                  : `${name} costs $30 per seat monthly.`,
              created_at: "2026-11-03T09:01:00Z",
            },
          ];
    const baseline = ["no-baseline", "missing-history"].includes(category)
      ? []
      : [
          {
            url: `https://fixture.example/${name}/pricing`,
            title: "Stored pricing observation",
            content: `${name} Pro plan: USD 30 per seat per month, US, monthly billing, one seat minimum, unlimited contacts. Observed on November 3.`,
            retrieved_at: "2026-11-03T09:00:00Z",
            published_date: null,
          },
        ];
    const searchResults = [
      {
        url: `https://fixture.example/${name}/pricing`,
        title: "Official fixture pricing",
        content: `${name} Pro plan: USD ${category === "price-change" ? 35 : 30} per seat per month, US, monthly billing, one seat minimum, unlimited contacts. ${category === "price-change" ? "Effective November 6, up from USD 30." : ""}`,
        retrieved_at: "2026-11-10T12:00:00Z",
        published_date: null,
      },
      {
        url: `https://fixture.example/${name}/release`,
        title: "Official fixture release",
        content:
          category === "release-date"
            ? "An article published November 8 describes an integration released October 12. This is not a new release since November 3."
            : "No dated material release evidence is supplied.",
        retrieved_at: "2026-11-10T12:00:00Z",
        published_date: "2026-11-08",
      },
    ];
    dataset.push({
      id: `${category}-${variant}`,
      split: variant < 7 ? "development" : "held-out",
      category,
      query,
      history,
      baseline,
      searchResults,
      expected:
        category === "price-change"
          ? `Recognize a USD 5 monthly increase per seat; team impact ${(20 + variant) * 5}.`
          : category === "old-error"
            ? "Correct the old USD 10 assertion, rather than call it a recent price increase."
            : category === "no-baseline"
              ? "State current price without pretending an old assistant assertion is verified evidence."
              : category === "release-date"
                ? "Do not describe October release as new since November 3."
                : category === "recall"
                  ? `Recover ${name} and ${20 + variant} seats without searching.`
                  : "Ask for the missing shortlist; do not invent five entities.",
    });
  }
