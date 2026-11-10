import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePrices } from "../src/compare.js";
import { excerpt, selectBaseline } from "../src/evidence.js";
import { research } from "../src/agent.js";
const price = {
  product: "CRM",
  plan: "Pro",
  currency: "USD",
  region: "US",
  cadence: "monthly",
  seatMinimum: 1,
  usage: "per-seat",
  value: 30,
  source: "H1",
};
for (const key of [
  "product",
  "plan",
  "currency",
  "region",
  "cadence",
  "seatMinimum",
  "usage",
])
  for (const value of [null, "", "unknown"])
    test(`unknown ${key} ${JSON.stringify(value)} cannot confirm a price change`, () => {
      assert.equal(
        comparePrices(
          { ...price, [key]: value },
          { ...price, [key]: value, value: 35, source: "S1" },
          20,
        ).status,
        "unresolved",
      );
    });
test("seat minimum changes team cost and infrastructure prices are not multiplied by headcount", () => {
  assert.equal(
    comparePrices(
      { ...price, seatMinimum: 25 },
      { ...price, seatMinimum: 25, value: 35 },
      20,
    ).teamDelta,
    125,
  );
  assert.equal(
    comparePrices(
      { ...price, usage: "per CU-hour" },
      { ...price, usage: "per CU-hour", value: 35 },
      20,
    ).teamDelta,
    null,
  );
});
test("pricing beyond long navigation is retained with billing qualifiers", () => {
  const raw =
    "[Home](https://example.com) ![nav](https://example.com/image.png)\n".repeat(
      250,
    ) +
    "\n## Launch plan\n$35 per seat per month. USD, US, billed annually. Minimum 5 seats. Taxes excluded.\n" +
    "Unrelated footer content. ".repeat(300);
  const result = excerpt(raw, "Launch plan pricing", 2000);
  assert.match(result, /\$35/);
  assert.match(result, /billed annually/);
  assert.match(result, /Minimum 5 seats/);
  assert.ok(result.length <= 2000);
  assert.ok(!result.includes("image.png"));
});
test("baseline uses selected old exchange despite many more recent sources", () => {
  const history = [
    { id: "u0", role: "user" },
    { id: "a0", role: "assistant" },
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `recent${i}`,
      role: i % 2 ? "assistant" : "user",
    })),
  ];
  const sources = (id) =>
    Array.from({ length: id === "a0" ? 5 : 20 }, (_, i) => ({
      url: `https://example.com/${id}/${i}`,
      content: `${id} price ${i}`,
      retrieved_at: "2026-11-03",
    }));
  const selected = selectBaseline(history, ["u0"], sources);
  assert.equal(selected.length, 5);
  assert.ok(selected.every((s) => s.originMessageId === "a0"));
  assert.deepEqual(selectBaseline(history, ["unknown"], sources), []);
});
test("ordinary chat returns in one model call without web search", async () => {
  let calls = 0;
  const result = await research({
    query: "Hello",
    history: [],
    model: async () => {
      calls++;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              intent: "conversation",
              entities: [],
              baselineMessageIds: [],
              queries: [],
              clarification: null,
              directAnswer: {
                text: "Hello! How can I help?",
                claims: [],
                historyReferences: [],
              },
            }),
          },
        ],
      };
    },
    search: () => assert.fail("no search"),
  });
  assert.equal(calls, 1);
  assert.match(result.text, /Hello/);
});

test("baseline loader runs after the model resolves the original messages", async () => {
  let calls = 0;
  const loaded = [];
  await research({
    query: "What changed?",
    history: [
      {
        id: "old",
        role: "assistant",
        content: "Original shortlist",
        created_at: "2026-11-03",
      },
    ],
    loadBaseline: (ids) => {
      loaded.push(ids);
      return [{ url: "https://example.com/old", content: "old price" }];
    },
    model: async ({ messages }) => {
      const payload = JSON.parse(messages[0].content);
      calls++;
      if (calls === 2) {
        assert.equal(payload.sources[0].historical, true);
        assert.match(payload.sources[0].content, /old price/);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              calls === 1
                ? {
                    intent: "revalidate",
                    baselineMessageIds: ["old"],
                    entities: [],
                    queries: [],
                    clarification: null,
                  }
                : calls === 2
                  ? {
                      text: "Insufficient current evidence.",
                      claims: [],
                      historyReferences: ["old"],
                      comparisons: [],
                      followups: [],
                    }
                  : { supported: true },
            ),
          },
        ],
      };
    },
    search: async () => [],
  });
  assert.deepEqual(loaded, [["old"]]);
});

test("invalid citations are repaired once before an answer is released", async () => {
  let n = 0;
  const result = await research({
    query: "Check price",
    history: [],
    search: async () => [
      { url: "https://example.com", content: "USD 30 per seat" },
    ],
    model: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            ++n === 1
              ? {
                  intent: "research",
                  baselineMessageIds: [],
                  entities: ["CRM"],
                  queries: [{ query: "CRM price" }],
                  clarification: null,
                }
              : n === 2
                ? {
                    text: "USD 30",
                    claims: [{ text: "USD 30", sourceIds: ["made-up"] }],
                    historyReferences: [],
                    comparisons: [],
                  }
                : n === 3
                  ? {
                      text: "USD 30",
                      claims: [{ text: "USD 30", sourceIds: ["S1"] }],
                      historyReferences: [],
                      comparisons: [],
                    }
                  : { supported: true },
          ),
        },
      ],
    }),
  });
  assert.equal(result.claims[0].sourceIds[0], "S1");
  assert.equal(n, 4);
});
