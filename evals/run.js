import { scenarios } from "./scenarios.js";
const begin = performance.now();
let passed = 0;
for (const scenario of scenarios) {
  try {
    await scenario.run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${scenario.name}: ${error.message}`);
  }
}
console.log(
  JSON.stringify(
    {
      suite: "offline deterministic architecture checks",
      total: scenarios.length,
      passed,
      failed: scenarios.length - passed,
      elapsedMs: Math.round(performance.now() - begin),
    },
    null,
    2,
  ),
);
if (passed !== scenarios.length) process.exitCode = 1;
