import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";
import { scenarios } from "../evals/scenarios.js";
for (const scenario of scenarios) test(scenario.name, scenario.run);
test("durable evidence, full-text retrieval, conversation isolation and deletion", () => {
  const store = new Store(":memory:");
  try {
    const a = store.create(),
      b = store.create();
    const id = store.add(a, "assistant", "Postgres shortlist", {}, [
      {
        id: "S1",
        url: "https://example.com",
        content: "price",
        retrieved_at: "2026-11-10",
      },
    ]);
    assert.equal(store.messages(b).length, 0);
    assert.deepEqual(store.search(a, "Postgres"), [id]);
    assert.deepEqual(store.search(b, "Postgres"), []);
    assert.equal(store.evidence(id).length, 1);
    store.delete(a);
    assert.equal(store.evidence(id).length, 0);
    assert.equal(store.search(a, "Postgres").length, 0);
    assert.equal(store.exists(b), true);
  } finally {
    store.close();
  }
});
