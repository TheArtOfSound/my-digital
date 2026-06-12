import { describe, expect, it } from "vitest";
import { formatPrice, shortHash, shortId } from "./format";

describe("formatPrice", () => {
  it("formats cents as currency", () => {
    expect(formatPrice(1900, "USD")).toContain("19");
  });

  it("falls back gracefully for unknown currency codes", () => {
    expect(formatPrice(500, "NOT_A_CODE")).toContain("5.00");
  });
});

describe("short helpers", () => {
  it("truncates long ids and hashes with an ellipsis", () => {
    expect(shortId("license_0123456789abcdef0123456789abcdef")).toMatch(/…$/);
    expect(shortHash("ab".repeat(32))).toMatch(/…$/);
  });

  it("leaves short values untouched", () => {
    expect(shortId("license_x")).toBe("license_x");
    expect(shortHash("abcd")).toBe("abcd");
  });
});
