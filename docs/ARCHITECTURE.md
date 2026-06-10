# My Digital Architecture

## 1. System purpose

My Digital is a QEV commerce extension. Its architecture is centered on a locked-asset lifecycle rather than a generic ecommerce catalog.

```text
CREATE -> LOCK -> LIST -> BUY -> LICENSE -> UNLOCK -> VERIFY -> TRACE
```

## 2. High-level components

### Web app

User-facing interface for creators and buyers.

Responsibilities:

- landing page
- creator upload/listing flow
- buyer purchase/unlock flow
- license verification
- receipt display/export
- creator dashboard

### Core package

Domain logic independent of framework.

Responsibilities:

- type definitions
- asset manifest generation
- license policy evaluation
- verification result construction
- receipt generation
- lifecycle orchestration

### QEV lock package

Cryptographic and envelope boundary.

Responsibilities:

- lock asset bytes
- unlock asset bytes
- generate envelope metadata
- verify envelope metadata
- bind license to asset
- expose deterministic verification checks

The first implementation may include a clearly labeled demo adapter, but production crypto must be isolated behind the same interface.

### Types package

Shared TypeScript types and branded identifiers used by all app/packages.

### Persistence layer

Stores marketplace state.

Initial local/dev entities:

- creators
- buyers
- assets
- asset versions
- locked assets
- listings
- purchases
- licenses
- proof receipts
- revocations
- fingerprints

### Payment adapter

Abstracts purchase confirmation.

Initial implementation:

- mocked checkout
- simulated payment confirmation

Future implementation:

- Stripe checkout
- webhook-confirmed purchase event
- license issuance after payment confirmation

## 3. Data flow

### Creator asset creation

1. Creator uploads file.
2. System hashes bytes.
3. System creates asset manifest.
4. QEV lock package encrypts/locks asset.
5. System stores locked asset reference and manifest.
6. Creator publishes listing.

### Purchase/license issuance

1. Buyer starts checkout.
2. Payment adapter confirms paid event.
3. System creates purchase record.
4. System issues buyer-specific license.
5. License binds buyer, asset, asset version, purchase, usage policy, and issuer signature.
6. Buyer receives unlock code or license file.

### Unlock

1. Buyer provides locked asset and unlock credential.
2. System verifies license signature.
3. System verifies license matches asset and version.
4. System verifies payment/purchase state.
5. System unwraps or authorizes asset unlock.
6. Buyer receives decrypted product.

### Verify

1. User provides asset/package/license/receipt.
2. System checks hashes, IDs, signatures, policy, and revocation state.
3. System returns structured verification result.
4. Result must state both passed checks and unchecked assumptions.

### Trace

1. Creator provides leaked artifact or suspected copy.
2. System checks embedded manifest/fingerprint where supported.
3. System reports likely license/source only if evidence exists.
4. System must not overclaim forensic certainty.

## 4. Package layout

```text
apps/
  web/
    src/
      app-or-routes/
      components/
      features/
      lib/
packages/
  core/
    src/
      lifecycle/
      receipts/
      verification/
  qev-lock/
    src/
      adapters/
      demo/
      production-boundary/
  types/
    src/
      ids.ts
      domain.ts
      policies.ts
      verification.ts
docs/
```

## 5. Integration with existing QEV work

Existing QEV repositories may be used as references for:

- envelope format
- lock/unlock semantics
- metadata binding
- verification language
- threat model phrasing
- browser/local-first limitations

However, My Digital must not blindly copy code without checking:

- license compatibility
- package boundaries
- browser/runtime assumptions
- test coverage
- security claims

My Digital should define its own stable commerce interfaces and connect QEV implementation behind those interfaces.

## 6. Key interfaces

### Lock adapter

```ts
interface LockAdapter {
  lock(input: LockInput): Promise<LockedAssetEnvelope>;
  unlock(input: UnlockInput): Promise<UnlockResult>;
  verify(input: VerifyEnvelopeInput): Promise<VerificationResult>;
}
```

### Payment adapter

```ts
interface PaymentAdapter {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentConfirmation>;
}
```

### License issuer

```ts
interface LicenseIssuer {
  issue(input: IssueLicenseInput): Promise<License>;
  verify(input: VerifyLicenseInput): Promise<VerificationResult>;
}
```

## 7. Security boundary

The marketplace can manage listings, purchases, and license state.

The QEV lock package owns cryptographic operations.

The web app must never pretend a simulated adapter is production security.

## 8. First useful milestone

The first real milestone is a local demo where:

1. asset bytes are hashed
2. a locked asset envelope is produced
3. a listing is created
4. a purchase is simulated
5. a buyer-specific license is issued
6. license verification succeeds
7. unlock returns the original payload
8. tampered asset/license verification fails
9. proof receipt is generated
10. tests pass
