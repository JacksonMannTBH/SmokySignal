import { rmSync } from "node:fs";

for (const path of [".next", "tsconfig.tsbuildinfo"]) {
  rmSync(path, { recursive: true, force: true });
}
