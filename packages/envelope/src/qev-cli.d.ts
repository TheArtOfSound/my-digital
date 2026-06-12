declare module "@bryan237l/qev-cli" {
  export function encryptVaultV2(opts: {
    plaintext: string;
    password: string;
    mode: "self" | "share";
    opslimit?: number;
    memlimit?: number;
    createdAt?: string;
  }): Promise<unknown>;
  export function decryptVaultV2(opts: { vault: unknown; password: string }): Promise<string>;
  export function validateVaultSchemaV2(vault: unknown): void;
  export function ready(): Promise<unknown>;
  export const SCHEMA_V2: string;
}
