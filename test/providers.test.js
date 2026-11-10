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

test("provider discovery exposes availability but never API keys", async () => {
  const { providerCatalog, selectProvider } =
    await import("../src/providers.js");
  const env = {
    GEMINI_API_KEY: "gemini-secret",
    ANTHROPIC_API_KEY: "anthropic-secret",
    OPENAI_API_KEY: "openai-secret",
  };
  assert.equal(selectProvider(env).id, "gemini");
  assert.equal(selectProvider({ OPENAI_API_KEY: "test" }).id, "openai");
  assert.equal(
    selectProvider({ ...env, MODEL_PROVIDER: "anthropic" }).id,
    "anthropic",
  );
  assert.equal(selectProvider(env, "openai").id, "openai");
  const catalog = providerCatalog(env);
  assert.ok(catalog.every((item) => item.available));
  assert.ok(!JSON.stringify(catalog).includes("secret"));
  assert.throws(() => selectProvider(env, "other"), /Unknown/);
  assert.throws(
    () => selectProvider({ GEMINI_API_KEY: "test" }, "openai"),
    /OPENAI_API_KEY/,
  );
});
test("Anthropic maps system prompt, credentials, model and usage", async () => {
  const { model } = providers(
    {
      ANTHROPIC_API_KEY: "test",
      ANTHROPIC_MODEL: "claude-custom",
      MODEL_ID: "gemini-only",
    },
    async (url, options) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      assert.equal(options.headers["x-api-key"], "test");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "claude-custom");
      assert.equal(body.system, "Return JSON");
      return Response.json({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "{}" }],
        usage: { input_tokens: 7, output_tokens: 3 },
      });
    },
  );
  assert.deepEqual(
    (await model({ system: "Return JSON", messages: [] })).usage,
    { input_tokens: 7, output_tokens: 3 },
  );
});
test("OpenAI uses Responses JSON mode without storing response state", async () => {
  const { model } = providers(
    { OPENAI_API_KEY: "test", OPENAI_MODEL: "gpt-custom" },
    async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.authorization, "Bearer test");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "gpt-custom");
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, "json_object");
      assert.equal(body.instructions, "Return JSON");
      assert.ok(!("tools" in body));
      return Response.json({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: "{}" }] },
        ],
        usage: { input_tokens: 5, output_tokens: 2 },
      });
    },
  );
  const result = await model({
    system: "Return JSON",
    messages: [{ role: "user", content: "question" }],
  });
  assert.equal(result.content[0].text, "{}");
  assert.equal(result.usage.input_tokens, 5);
});
for (const [provider, response] of [
  ["anthropic", { stop_reason: "max_tokens" }],
  ["openai", { status: "incomplete" }],
  [
    "openai",
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "declined" }],
        },
      ],
    },
  ],
])
  test(`${provider} rejects incomplete or refused answers`, async () => {
    const { model } = providers(
      {
        [provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"]:
          "test",
      },
      async () => Response.json(response),
    );
    await assert.rejects(model({ system: "JSON", messages: [] }));
  });
