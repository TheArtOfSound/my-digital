# My Digital Threat Model

## 1. Security posture

My Digital is a controlled-use QEV commerce workflow for locked digital goods.

It is designed to improve:

- access control before purchase
- proof of purchase
- license verification
- asset tamper detection
- creator provenance
- buyer-specific unlock tracking
- limited leak traceability where supported

It is not designed to make piracy impossible.

## 2. Assets protected

Primary protected objects:

- uploaded product files before unlock
- locked asset envelopes
- asset manifests
- buyer licenses
- proof receipts
- purchase/license relationships
- creator provenance records

## 3. Main adversaries

### Casual unauthorized user

Someone who obtains a locked asset but has no valid unlock license.

Expected protection:

- cannot unlock the asset without valid credential
- cannot forge successful verification result

### Tamperer

Someone modifies the asset, license, receipt, or metadata.

Expected protection:

- verification should fail or warn clearly
- changed hashes/signatures should be detected

### Fake reseller

Someone reposts a product and claims legitimacy.

Expected protection:

- valid creator-issued receipt/license should be distinguishable from fake claims
- provenance can be checked against original asset ID/hash

### Leaker

A valid buyer unlocks the product and redistributes the decrypted result.

Expected protection:

- My Digital may help identify license source only if buyer-specific fingerprinting exists for that asset type
- My Digital cannot prevent all redistribution after unlock

### Compromised creator or buyer device

A device is infected, logged, or controlled by malware.

Expected protection:

- out of scope for application-level lock workflow
- docs must warn clearly

### Malicious platform operator

Marketplace operator intentionally alters records or issues improper licenses.

Expected protection:

- future signed logs/proofs may reduce this risk
- early MVP should not overclaim against this scenario

## 4. Explicit non-goals

My Digital does not prevent:

- screenshots
- screen recordings
- manual copy/paste after unlock
- re-uploading decrypted files
- malware on buyer or creator devices
- account compromise
- social engineering
- forgotten passphrases or lost credentials
- all forms of copyright infringement
- legal disputes by itself

## 5. Claims allowed

Allowed:

- locked assets reduce unauthorized pre-purchase access
- buyer-specific licenses strengthen purchase proof
- tamper verification detects changed packages
- license receipts can prove marketplace-issued unlock rights
- fingerprinting can support leak investigation when implemented for the asset type

## 6. Claims forbidden

Forbidden:

- piracy-proof
- theft-proof
- unbreakable
- impossible to leak
- impossible to copy
- guaranteed copyright protection
- legal ownership automatically established
- enterprise DRM replacement
- formally audited security unless audit exists

## 7. Verification result requirements

Every verification result must include:

- overall status: pass, fail, warning, unknown
- checks performed
- checks failed
- checks skipped
- assumptions
- artifact IDs involved
- timestamp of verification

A simple boolean is not acceptable for trust UX.

## 8. Demo-mode requirements

If any cryptographic operation is simulated, the UI and docs must say so directly.

Required demo labels:

- `DEMO ONLY`
- `NOT PRODUCTION CRYPTO`
- `FOR LIFECYCLE TESTING`

Demo cryptography must be isolated behind the same adapter shape intended for production QEV integration.

## 9. Production crypto boundary

Production locking should use established primitives and QEV/BRY-NFET-SX envelope semantics from the upstream QEV work.

My Digital must not invent a new cipher.

## 10. Marketplace trust boundary

The marketplace can verify records it controls, but it should distinguish:

- cryptographic verification
- marketplace database verification
- payment processor confirmation
- creator-declared license terms
- external legal ownership claims

These are not the same kind of trust.
