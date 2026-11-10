import { test } from "node:test";
import assert from "node:assert/strict";
import { research } from "../src/agent.js";
function response(object) {
  return { content: [{ type: "text", text: JSON.stringify(object) }] };
}
test("verification rejection yields an honest fallback after repair fails", async () => {
  let count = 0;
  const result = await research({
    query: "What changed?",
    history: [],
    search: async () => [],
    model: async () => {
      count++;
      if (count === 1)
        return response({
          intent: "revalidate",
          baselineMessageIds: [],
          entities: [],
          queries: [],
          clarification: null,
        });
      if (count === 3 || count === 5)
        return response({ supported: false, issues: ["Unsupported"] });
      return response({
        text: "Unproven answer",
        claims: [],
        historyReferences: [],
        comparisons: [],
        followups: [],
      });
    },
  });
  assert.match(result.text, /could not verify/);
  assert.equal(count, 5);
});
test("duplicate searches share one upstream request", async () => {
  let models = 0,
    searches = 0;
  await research({
    query: "price",
    history: [],
    search: async () => {
      searches++;
      return [];
    },
    model: async () =>
      response(
        ++models === 1
          ? {
              intent: "research",
              baselineMessageIds: [],
              entities: ["A"],
              queries: [{ query: "A pricing" }, { query: "A pricing" }],
              clarification: null,
            }
          : models === 2
            ? {
                text: "Unknown",
                claims: [],
                historyReferences: [],
                comparisons: [],
                followups: [],
              }
            : { supported: true },
      ),
  });
  assert.equal(searches, 1);
});
test("missing-history clarification searches nothing", async () => {
  const result = await research({
    query: "Those five?",
    history: [],
    model: async () =>
      response({
        intent: "recall",
        baselineMessageIds: [],
        entities: [],
        queries: [],
        clarification: "Which shortlist?",
      }),
    search: () => assert.fail("must not search"),
  });
  assert.equal(result.text, "Which shortlist?");
});
