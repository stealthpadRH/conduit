# Changelog

All notable changes to Stealthpad Conduit are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the SDK follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- `GET /api/keepers`, `GET /api/stats`, `GET /api/receipts`, `GET /api/rounds/:vault`, `GET /api/proof/:vault/:wallet` with matching client methods.
- StealthFactory address in `constants.ts` on mainnet day.
- Monero route once NEAR Intents lists it.

## [0.1.0] - 2026-09-29

### Added
- `ENDPOINTS.md`: live endpoints (`/api/health`, `/api/board`, `/api/coin/:token`, `/api/claimable`, `/api/leaves/:vault/:round`, `/api/upload`, `/img/:file`), planned and superseded endpoints, error envelope, rate limits.
- `@stealthpad/sdk` 0.1.0:
  - `StealthpadClient` with typed models mirroring the app's data layer; leaf files checked against `x-leaf-hash`.
  - `buildClaimTx` and `buildClaimTxFromItem` encoding `claim(cumulative, proof, to, feeBps)` with viem; `claimSplit` matching the vault's fee rounding.
  - `verifyClaimProof` for sorted-pair Merkle proofs.
  - `requestRouteQuote`, `routeStatus`, `waitForRoute` for NEAR Intents 1Click, called from the caller's own environment.
  - `isZcashTransparent` (base58check) and `isAleoAddress` (bech32m) validators.
- `examples/basic-usage.ts`.
