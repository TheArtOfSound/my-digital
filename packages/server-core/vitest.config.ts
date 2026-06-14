import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The account tests run real Argon2id password hashing (deliberately strong:
    // m=12 MiB, t=3). Several hashes per test can exceed vitest's 5s default
    // under parallel CI load, so give them generous headroom.
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
