import type { VerificationCheck, VerificationResult, VerificationStatus } from "@my-digital/types";

export interface CreateVerificationResultInput {
  subjectType: string;
  subjectId: string;
  status: VerificationStatus;
  checksPassed?: VerificationCheck[];
  checksFailed?: VerificationCheck[];
  checksSkipped?: VerificationCheck[];
  warnings?: VerificationCheck[];
  assumptions?: string[];
  artifacts?: string[];
}

export function createVerificationResult(input: CreateVerificationResultInput): VerificationResult {
  return {
    id: `verify_${crypto.randomUUID()}`,
    checkedAt: new Date().toISOString(),
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    status: input.status,
    checksPassed: input.checksPassed ?? [],
    checksFailed: input.checksFailed ?? [],
    checksSkipped: input.checksSkipped ?? [],
    warnings: input.warnings ?? [],
    assumptions: input.assumptions ?? [],
    artifacts: input.artifacts ?? []
  };
}

export function inferVerificationStatus(input: {
  failedCount: number;
  warningCount: number;
  unknownCount?: number;
}): VerificationStatus {
  if (input.failedCount > 0) return "fail";
  if ((input.unknownCount ?? 0) > 0) return "unknown";
  if (input.warningCount > 0) return "warning";
  return "pass";
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortForStableJson(nested)])
    );
  }
  return value;
}
