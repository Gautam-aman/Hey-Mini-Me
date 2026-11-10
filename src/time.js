const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function localDate(instant, zone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
export function resolveDates(query, now, zone = "UTC") {
  const today = localDate(now, zone),
    base = new Date(today + "T12:00:00Z");
  const explicit = query.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?\b/i,
  );
  if (explicit) {
    let year = Number(explicit[3] || base.getUTCFullYear());
    const month = months.indexOf(explicit[2].toLowerCase());
    let date = new Date(Date.UTC(year, month, Number(explicit[1]), 12));
    if (date.getUTCMonth() !== month) return [];
    if (!explicit[3] && date > base) date.setUTCFullYear(--year);
    return [date.toISOString().slice(0, 10)];
  }
  const day = query.match(
    /\b(last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (day) {
    const target = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(day[2].toLowerCase());
    let back = (base.getUTCDay() - target + 7) % 7;
    if (!back && day[1]) back = 7;
    base.setUTCDate(base.getUTCDate() - back);
    return [base.toISOString().slice(0, 10)];
  }
  if (/\byesterday\b/i.test(query)) base.setUTCDate(base.getUTCDate() - 1);
  else if (!/\btoday\b/i.test(query)) return [];
  return [base.toISOString().slice(0, 10)];
}
