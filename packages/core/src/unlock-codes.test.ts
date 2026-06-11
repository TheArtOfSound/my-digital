import type { LicenseId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { generateRawUnlockCode, issueUnlockCode, redeemUnlockCode, verifyUnlockCode } from "./unlock-codes";

const licenseId = "license_test" as LicenseId;

describe("generateRawUnlockCode", () => {
  it("produces codes in the UNLK-XXXX-XXXX-XXXX-XXXX format without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRawUnlockCode()).toMatch(
        /^UNLK(-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}){4}$/
      );
    }
  });

  it("produces distinct codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRawUnlockCode()));
    expect(codes.size).toBe(100);
  });
});

describe("issueUnlockCode / verifyUnlockCode", () => {
  it("stores only the code hash and verifies the raw code against it", async () => {
    const { unlockCode, rawCode } = await issueUnlockCode({ licenseId });
    expect(JSON.stringify(unlockCode)).not.toContain(rawCode);
    const result = await verifyUnlockCode({ rawCode, unlockCode });
    expect(result.status).toBe("pass");
  });

  it("fails verification for a wrong code", async () => {
    const { unlockCode } = await issueUnlockCode({ licenseId });
    const result = await verifyUnlockCode({
      rawCode: "UNLK-AAAA-BBBB-CCCC-DDDD",
      unlockCode
    });
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain("UNLOCK_CODE_HASH_MISMATCH");
  });

  it("fails verification once redemptions are exhausted", async () => {
    const { unlockCode, rawCode } = await issueUnlockCode({ licenseId, maxRedemptions: 1 });
    const redeemed = redeemUnlockCode(unlockCode, "2026-06-10T12:00:00.000Z");
    expect(redeemed.redemptionCount).toBe(1);
    expect(redeemed.status).toBe("redeemed");
    expect(redeemed.redeemedAt).toBe("2026-06-10T12:00:00.000Z");
    const result = await verifyUnlockCode({ rawCode, unlockCode: redeemed });
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain("UNLOCK_CODE_NOT_ACTIVE");
  });

  it("keeps codes without a redemption limit active after redemption", async () => {
    const { unlockCode, rawCode } = await issueUnlockCode({ licenseId });
    const redeemed = redeemUnlockCode(unlockCode);
    expect(redeemed.status).toBe("active");
    const result = await verifyUnlockCode({ rawCode, unlockCode: redeemed });
    expect(result.status).toBe("pass");
  });
});
