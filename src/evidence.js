// Keep relevant passages and their neighbours, rather than a page's navigation header.
export function excerpt(content, query, budget = 4000) {
  const clean = String(content || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= budget) return clean;
  const terms = [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
        (w) => w.length > 3,
      ),
    ),
  ];
  // Overlapping windows preserve qualifiers and tables around matching values.
  const windows = [];
  for (let start = 0; start < Math.min(clean.length, 150000); start += 650) {
    const text = clean.slice(start, start + 1000),
      lower = text.toLowerCase();
    const score =
      terms.reduce((n, t) => n + (lower.includes(t) ? 2 : 0), 0) +
      (/[$€£]\s*\d|\bUSD\s*\d|\b\d[\d.]*\s*(?:per|\/)/i.test(text) ? 4 : 0);
    windows.push({ start, end: start + text.length, score });
  }
  windows.sort((a, b) => b.score - a.score || a.start - b.start);
  const chosen = [];
  let size = 0;
  for (const window of windows) {
    if (size + window.end - window.start > budget - 100) continue;
    if (chosen.some((w) => window.start < w.end && window.end > w.start))
      continue;
    chosen.push(window);
    size += window.end - window.start;
  }
  return chosen
    .sort((a, b) => a.start - b.start)
    .map((w) => clean.slice(w.start, w.end))
    .join("\n[… excerpt gap …]\n")
    .slice(0, budget);
}
export function selectBaseline(history, ids, observations) {
  const selected = new Set(ids),
    answerIds = new Set();
  for (let i = 0; i < history.length; i++)
    if (selected.has(history[i].id)) {
      if (history[i].role === "assistant") answerIds.add(history[i].id);
      else
        for (
          let j = i + 1;
          j < history.length && history[j].role !== "user";
          j++
        )
          if (history[j].role === "assistant") answerIds.add(history[j].id);
    }
  const seen = new Set(),
    result = [];
  for (const id of answerIds)
    for (const source of observations(id)) {
      const key = JSON.stringify([
        source.url,
        source.retrieved_at,
        source.hash || source.content,
      ]);
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          ...source,
          originMessageId: source.originMessageId || id,
        });
      }
    }
  return result;
}
