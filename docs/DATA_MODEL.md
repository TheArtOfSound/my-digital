# My Digital Data Model

## 1. Identifier conventions

All important objects should use stable prefixed IDs.

Suggested prefixes:

- `creator_` creator
- `buyer_` buyer
- `asset_` asset
- `assetver_` asset version
- `locked_` locked asset envelope
- `listing_` marketplace listing
- `purchase_` purchase
- `license_` buyer license
- `unlock_` unlock code
- `receipt_` proof receipt
- `fingerprint_` fingerprint record
- `revocation_` revocation event

## 2. Creator

Represents a seller.

Fields:

- id
- displayName
- handle
- emailHash
- createdAt
- verificationStatus
- publicSigningKey

## 3. Buyer

Represents a purchaser.

Fields:

- id
- emailHash
- displayName optional
- createdAt

## 4. Asset

Represents the creator-owned product concept.

Fields:

- id
- creatorId
- title
- description
- category
- createdAt
- status

## 5. AssetVersion

Represents a specific file/version of an asset.

Fields:

- id
- assetId
- versionLabel
- fileName
- mimeType
- byteSize
- contentHash
- manifestHash
- createdAt
- changelog

## 6. LockedAsset

Represents the QEV-locked asset envelope.

Fields:

- id
- assetVersionId
- envelopeFormat
- envelopeVersion
- lockedPayloadHash
- metadataHash
- qevEngineVersion
- storageUri
- createdAt

## 7. Listing

Represents a sellable marketplace page.

Fields:

- id
- assetId
- activeAssetVersionId
- creatorId
- title
- description
- priceAmount
- priceCurrency
- licenseTemplateId
- status
- createdAt
- updatedAt

## 8. Purchase

Represents a buyer transaction.

Fields:

- id
- listingId
- buyerId
- assetVersionId
- paymentProvider
- paymentProviderReference
- amountPaid
- currency
- status
- createdAt
- paidAt

## 9. License

Represents buyer-specific usage rights and unlock authority.

Fields:

- id
- purchaseId
- buyerId
- assetId
- assetVersionId
- lockedAssetId
- terms
- allowedUses
- expiresAt optional
- unlockLimit optional
- issuer
- issuerSignature
- issuedAt
- revokedAt optional

## 10. UnlockCode

Represents a user-facing unlock credential or code.

Fields:

- id
- licenseId
- codeHash
- createdAt
- redeemedAt optional
- redemptionCount
- maxRedemptions optional
- status

The raw code should not be stored in plaintext in production.

## 11. ProofReceipt

Represents verifiable proof of purchase/license issuance.

Fields:

- id
- purchaseId
- licenseId
- assetId
- assetVersionId
- buyerIdHash
- creatorId
- receiptHash
- issuerSignature
- createdAt
- verificationUrl optional

## 12. VerificationResult

Represents a structured verification response.

Fields:

- id
- status: pass | fail | warning | unknown
- checkedAt
- subjectType
- subjectId
- checksPassed
- checksFailed
- checksSkipped
- warnings
- assumptions
- artifacts

## 13. Fingerprint

Represents buyer-specific tracing metadata.

Fields:

- id
- licenseId
- assetVersionId
- fingerprintType
- fingerprintHash
- embeddingStrategy
- confidenceModel
- createdAt

## 14. Revocation

Represents a license or unlock credential revocation.

Fields:

- id
- targetType
- targetId
- reason
- createdAt
- createdBy
- issuerSignature

## 15. License terms object

License terms must be machine-readable.

Example:

```json
{
  "personalUse": true,
  "commercialUse": false,
  "clientWorkAllowed": false,
  "redistributionAllowed": false,
  "resaleAllowed": false,
  "aiTrainingAllowed": false,
  "attributionRequired": true,
  "seatCount": 1
}
```

## 16. Required relationships

- Creator has many Assets
- Asset has many AssetVersions
- AssetVersion has one or more LockedAssets
- Listing points to one active AssetVersion
- Purchase points to Listing, Buyer, and AssetVersion
- License points to Purchase, Buyer, AssetVersion, and LockedAsset
- UnlockCode points to License
- ProofReceipt points to Purchase and License
- Fingerprint points to License and AssetVersion
- Revocation points to License or UnlockCode
