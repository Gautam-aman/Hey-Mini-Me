const dimensions = [
  "product",
  "plan",
  "currency",
  "region",
  "cadence",
  "seatMinimum",
  "usage",
];
export function comparePrices(before, after, seats = 1) {
  if (!before || !after || !before.source || !after.source)
    return {
      status: "unresolved",
      reason: "Missing baseline or current evidence",
    };
  for (const key of dimensions)
    if (
      before[key] === undefined ||
      after[key] === undefined ||
      before[key] !== after[key]
    )
      return { status: "unresolved", reason: `Incompatible or missing ${key}` };
  if (
    !Number.isFinite(seats) ||
    seats < 1 ||
    !Number.isFinite(before.value) ||
    before.value < 0 ||
    !Number.isFinite(after.value) ||
    after.value < 0
  )
    return { status: "unresolved", reason: "Invalid price" };
  const delta = Math.round((after.value - before.value) * 100) / 100;
  return {
    status: delta === 0 ? "same_at_observations" : "confirmed_change",
    delta,
    teamDelta: Math.round(delta * seats * 100) / 100,
    currency: after.currency,
    cadence: after.cadence,
  };
}
export function validateAnswer(answer, sources, messageIds) {
  if (!answer || typeof answer.text !== "string" || !answer.text.trim())
    throw Error("Answer text is missing");
  if (!Array.isArray(answer.claims) || !Array.isArray(answer.historyReferences))
    throw Error("Answer references are missing");
  const ids = new Set(sources.map((s) => s.id));
  for (const claim of answer.claims) {
    if (
      typeof claim.text !== "string" ||
      !Array.isArray(claim.sourceIds) ||
      !claim.sourceIds.length ||
      claim.sourceIds.some((id) => !ids.has(id))
    )
      throw Error("A factual claim has an invalid source");
  }
  if (answer.historyReferences.some((id) => !messageIds.includes(id)))
    throw Error("Unknown history reference");
  // All links are rendered from source IDs by the client, never model-authored URLs.
  if (/https?:\/\/|\]\(/i.test(answer.text))
    throw Error("Use source IDs instead of raw links");
  return answer;
}
