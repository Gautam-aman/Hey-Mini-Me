import { test } from "node:test";
import assert from "node:assert/strict";
import { providers, DEFAULT_MODEL } from "../src/providers.js";
const complete = {
  candidates: [
    {
      finishReason: "STOP",
      content: {
        parts: [
          { text: "private thought", thought: true },
          { text: '{"supported":true}' },
        ],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 3,
  },
};
test("Gemini request uses header auth, JSON mode, system context, and normalized usage", async () => {
  const controller = new AbortController();
  const { model } = providers(
    { GEMINI_API_KEY: "test-not-a-real-key" },
    async (url, options) => {
      assert.equal(
        url,
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`,
      );
      assert.equal(options.headers["x-goog-api-key"], "test-not-a-real-key");
      assert.ok(!url.includes("test-not-a-real-key"));
      assert.equal(options.signal, controller.signal);
      const body = JSON.parse(options.body);
      assert.deepEqual(body.systemInstruction, { parts: [{ text: "system" }] });
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.deepEqual(body.contents, [
        { role: "user", parts: [{ text: "question" }] },
        { role: "model", parts: [{ text: "answer" }] },
      ]);
      assert.ok(!("tools" in body));
      return Response.json(complete);
    },
  );
  const result = await model({
    system: "system",
    messages: [
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
    ],
    signal: controller.signal,
  });
  assert.deepEqual(result.content, [
    { type: "text", text: '{"supported":true}' },
  ]);
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 8 });
});
test("Gemini accepts an explicit model override", async () => {
  const { model } = providers(
    { GEMINI_API_KEY: "test", MODEL_ID: "models/custom-model" },
    async (url) => {
      assert.ok(url.includes("/custom-model:generateContent"));
      return Response.json(complete);
    },
  );
  await model({ system: "s", messages: [] });
});
for (const [name, response] of [
  ["blocked", { promptFeedback: { blockReason: "SAFETY" } }],
  [
    "truncated",
    {
      candidates: [
        { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } },
      ],
    },
  ],
  ["empty", { candidates: [{ finishReason: "STOP", content: { parts: [] } }] }],
])
  test(`Gemini rejects ${name} output`, async () => {
    const { model } = providers({ GEMINI_API_KEY: "test" }, async () =>
      Response.json(response),
    );
    await assert.rejects(model({ system: "s", messages: [] }));
  });
test("Gemini fails clearly with no key and makes no request", async () => {
  const { model } = providers({}, () => assert.fail("must not fetch"));
  await assert.rejects(model({ system: "s", messages: [] }), /GEMINI_API_KEY/);
});
test("Gemini retry shares the cancellation signal", async () => {
  let calls = 0;
  const controller = new AbortController();
  const { model } = providers(
    { GEMINI_API_KEY: "test" },
    async (_url, options) => {
      assert.equal(options.signal, controller.signal);
      return ++calls === 1
        ? new Response("", { status: 503 })
        : Response.json(complete);
    },
  );
  await model({ system: "s", messages: [], signal: controller.signal });
  assert.equal(calls, 2);
});
