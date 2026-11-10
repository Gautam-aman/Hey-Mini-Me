import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const dir of ["src", "evals", "scripts", "test"])
  for (const file of await readdir(dir))
    if (file.endsWith(".js")) {
      const result = spawnSync(
        process.execPath,
        ["--check", `${dir}/${file}`],
        { stdio: "inherit" },
      );
      if (result.status) process.exit(result.status);
    }
console.log("All JavaScript syntax checks passed. No compilation is required.");
