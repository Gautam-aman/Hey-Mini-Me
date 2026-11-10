export async function requestJson(url, options, signal, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const response = await fetchImpl(url, { ...options, signal });
    if (response.ok) return response.json();
    if (attempt === 0 && [429, 500, 502, 503, 504].includes(response.status)) {
      await response.body?.cancel();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 250);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      });
      continue;
    }
    throw Error(`Provider request failed (${response.status})`);
  }
}
export const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFINITIONS = {
  gemini: {
    label: "Gemini",
    key: "GEMINI_API_KEY",
    modelKey: "GEMINI_MODEL",
    model: DEFAULT_MODEL,
  },
  anthropic: {
    label: "Anthropic",
    key: "ANTHROPIC_API_KEY",
    modelKey: "ANTHROPIC_MODEL",
    model: "claude-sonnet-4-6",
  },
  openai: {
    label: "OpenAI",
    key: "OPENAI_API_KEY",
    modelKey: "OPENAI_MODEL",
    model: "gpt-4.1-mini",
  },
};
export function providerCatalog(env = process.env) {
  return Object.entries(DEFINITIONS).map(([id, definition]) => ({
    id,
    label: definition.label,
    available: !!env[definition.key]?.trim(),
    model:
      env[definition.modelKey] ||
      (id === "gemini" ? env.MODEL_ID : null) ||
      definition.model,
  }));
}
export function selectProvider(env = process.env, requested = "auto") {
  const preference =
    requested === "auto" ? env.MODEL_PROVIDER || "auto" : requested;
  const catalog = providerCatalog(env);
  const chosen =
    preference === "auto"
      ? catalog.find((item) => item.available)
      : catalog.find((item) => item.id === preference);
  if (!chosen)
    throw Error(
      preference === "auto"
        ? "Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in .env"
        : "Unknown model provider",
    );
  if (!chosen.available)
    throw Error(
      `Set ${DEFINITIONS[chosen.id].key} in .env to use ${chosen.label}`,
    );
  return chosen;
}

export function providers(
  env = process.env,
  fetchImpl = fetch,
  requested = "auto",
) {
  // Resolve lazily so missing-key errors occur when a request is made.
  const remoteModel = async ({ system, messages, signal }) => {
    const chosen = selectProvider(env, requested);
    if (chosen.id === "gemini")
      return geminiModel({ system, messages, signal });
    const anthropic = chosen.id === "anthropic";
    const result = await requestJson(
      anthropic
        ? "https://api.anthropic.com/v1/messages"
        : "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: anthropic
          ? {
              "content-type": "application/json",
              "x-api-key": env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            }
          : {
              "content-type": "application/json",
              authorization: `Bearer ${env.OPENAI_API_KEY}`,
            },
        body: JSON.stringify(
          anthropic
            ? { model: chosen.model, system, max_tokens: 8192, messages }
            : {
                model: chosen.model,
                instructions: system,
                input: messages,
                store: false,
                max_output_tokens: 8192,
                text: { format: { type: "json_object" } },
              },
        ),
      },
      signal,
      fetchImpl,
    );
    if (anthropic) {
      if (result.stop_reason !== "end_turn")
        throw Error(
          `Anthropic did not return a complete answer (${result.stop_reason || "EMPTY_RESPONSE"})`,
        );
      const content = (result.content || []).filter(
        (item) => item.type === "text",
      );
      if (!content.some((item) => item.text?.trim()))
        throw Error("Anthropic returned an empty answer");
      return { content, usage: result.usage };
    }
    if (result.status !== "completed")
      throw Error(
        `OpenAI did not return a complete answer (${result.status || "EMPTY_RESPONSE"})`,
      );
    const parts = (result.output || [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content || []);
    if (parts.some((item) => item.type === "refusal"))
      throw Error("OpenAI declined the request");
    const text = parts
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("");
    if (!text.trim()) throw Error("OpenAI returned an empty answer");
    return {
      content: [{ type: "text", text }],
      usage: {
        input_tokens: result.usage?.input_tokens || 0,
        output_tokens: result.usage?.output_tokens || 0,
      },
    };
  };
  const geminiModel = async ({ system, messages, signal }) => {
    if (!env.GEMINI_API_KEY) throw Error("Set GEMINI_API_KEY in .env");
    const modelId = (env.GEMINI_MODEL || env.MODEL_ID || DEFAULT_MODEL).replace(
      /^models\//,
      "",
    );
    if (!/^[a-zA-Z0-9._-]+$/.test(modelId)) throw Error("Invalid MODEL_ID");
    const result = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        }),
      },
      signal,
      fetchImpl,
    );
    const candidate = result.candidates?.[0];
    if (!candidate || candidate.finishReason !== "STOP") {
      const reason =
        candidate?.finishReason ||
        result.promptFeedback?.blockReason ||
        "EMPTY_RESPONSE";
      throw Error(`Gemini did not return a complete answer (${reason})`);
    }
    const text = (candidate.content?.parts || [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (!text.trim()) throw Error("Gemini returned an empty answer");
    return {
      content: [{ type: "text", text }],
      usage: {
        input_tokens: result.usageMetadata?.promptTokenCount || 0,
        output_tokens:
          (result.usageMetadata?.candidatesTokenCount || 0) +
          (result.usageMetadata?.thoughtsTokenCount || 0),
      },
    };
  };
  return {
    model: remoteModel,
    search: async (query, signal, options = {}) => {
      const result = await requestJson(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.TAVILY_API_KEY}`,
          },
          body: JSON.stringify({
            query,
            max_results: 5,
            include_raw_content: true,
            ...options,
          }),
        },
        AbortSignal.any([
          AbortSignal.timeout(15000),
          ...(signal ? [signal] : []),
        ]),
        fetchImpl,
      );
      return (result.results || [])
        .filter((x) => /^https?:\/\//.test(x.url))
        .map((x) => ({
          title: x.title,
          url: x.url,
          content: (x.raw_content || x.content || "").slice(0, 6000),
          published_date: x.published_date || null,
          retrieved_at: new Date().toISOString(),
        }));
    },
  };
}
