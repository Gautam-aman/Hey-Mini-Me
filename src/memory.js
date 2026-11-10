import { localDate, resolveDates } from "./time.js";
export function selectHistory(
  all,
  query,
  limit = 40,
  now = new Date().toISOString(),
  timezone = "UTC",
) {
  const recentStart = Math.max(0, all.length - Math.floor(limit / 2));
  const chosen = new Set(
    Array.from({ length: all.length - recentStart }, (_, i) => recentStart + i),
  );
  const words = new Set(
    (query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
      (w) =>
        w.length > 3 &&
        ![
          "what",
          "when",
          "that",
          "have",
          "since",
          "about",
          "asked",
          "last",
          "your",
          "this",
          "changed",
          "pricing",
        ].includes(w),
    ),
  );
  const dates = resolveDates(query, now, timezone),
    matches = [];
  for (let i = 0; i < recentStart; i++) {
    let score = 0;
    for (const word of words)
      if (all[i].content.toLowerCase().includes(word)) score++;
    if (dates.includes(localDate(all[i].created_at, timezone))) score += 20;
    if (score) matches.push({ i, score });
  }
  matches.sort((a, b) => b.score - a.score || b.i - a.i);
  for (const { i } of matches) {
    if (chosen.size >= limit) break;
    for (const n of [i, i - 1, i + 1])
      if (n >= 0 && n < recentStart && chosen.size < limit) chosen.add(n);
  }
  return [...chosen].sort((a, b) => a - b).map((i) => all[i]);
}
