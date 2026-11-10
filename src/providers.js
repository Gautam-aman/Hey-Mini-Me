export async function requestJson(url, options, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const response = await fetch(url, { ...options, signal });
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
export function providers(env = process.env) {
  return {
    model: async ({ system, messages, tools = [], signal }) =>
      requestJson(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: env.MODEL_ID || "claude-sonnet-4-6",
            max_tokens: 4096,
            system,
            messages,
            ...(tools.length ? { tools } : {}),
          }),
        },
        signal,
      ),
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
