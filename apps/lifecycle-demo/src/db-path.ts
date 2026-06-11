import path from "node:path";
import { fileURLToPath } from "node:url";

/** Demo database location: apps/lifecycle-demo/data/, overridable via MYDIGITAL_DB. */
export function defaultDbPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return process.env.MYDIGITAL_DB ?? path.resolve(here, "..", "data", "my-digital-demo.sqlite");
}
