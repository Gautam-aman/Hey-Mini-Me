import { test } from "node:test";
import assert from "node:assert/strict";
import { research } from "../src/agent.js";
import { mapLimited } from "../src/limits.js";
test("cancelled runs cannot call the model", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    research({
      query: "hello",
      history: [],
      signal: controller.signal,
      model: () => assert.fail("model called"),
      search: () => [],
    }),
  );
});
test("parallel work obeys concurrency limit", async () => {
  let active = 0,
    peak = 0;
  const values = await mapLimited([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(values, [2, 4, 6, 8, 10]);
});
