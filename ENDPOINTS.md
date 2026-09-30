# Stealthpad Read API Reference

Base URL: `https://app.stealthpad.online`

The read API is public, read-only, and needs no key. It serves what the indexer and attester derived from Robinhood Chain: coins, rounds, leaf files, claimable balances with Merkle proofs, and totals. Every figure it returns can be recomputed from chain data; the vault contracts are the source of truth.

Route quotes are **not** part of this API. A holder's own environment calls NEAR Intents 1Click directly, so a payout destination never reaches a Stealthpad server. See [Route quoting](#route-quoting-outside-this-api).

> **Pre-launch.** The app runs against Robinhood Chain mainnet, but the StealthFactory is not deployed yet. Until it is, board and coin endpoints return empty sets and `POST /api/upload` answers `403`.

---

## Contents

- [Status legend](#status-legend)
- [Conventions](#conventions)
- [Error envelope](#error-envelope)
- [Rate limits](#rate-limits)
- [Live endpoints](#live-endpoints)
  - [GET /api/health](#get-apihealth)
  - [GET /api/board](#get-apiboard)
  - [GET /api/coin/:token](#get-apicointoken)
  - [GET /api/claimable](#get-apiclaimable)
  - [GET /api/leaves/:vault/:round](#get-apileavesvaultround)
  - [POST /api/upload](#post-apiupload)
  - [GET /img/:file](#get-imgfile)
- [Planned endpoints](#planned-endpoints)
- [Route quoting outside this API](#route-quoting-outside-this-api)
- [On-chain reads](#on-chain-reads)

---

## Status legend

| Badge | Meaning |
|---|---|
| **LIVE** | Implemented in the app today and served at the base URL |
| **PLANNED** | In the blueprint; not served yet. Shape may change before release |
| **SUPERSEDED** | In the original blueprint, replaced by a different design |

## Conventions

| Topic | Rule |
|---|---|
| Addresses | `0x` plus 40 hex characters. Case-insensitive on input, returned lowercase |
| USDG amounts | Numbers in whole USDG (6 decimals already applied) unless the field is a raw string |
| Raw integers | Strings of base-10 digits (`"1250000"` is 1.25 USDG). Used for anything a contract call consumes |
| ETH amounts | Numbers in ETH (18 decimals applied) |
| Timestamps | ISO 8601 UTC strings |
| Caching | Dynamic data is `cache-control: no-store`. Leaf files and images are `public, max-age=31536000, immutable` |
| Authentication | None. There are no API keys, cookies or sessions |

## Error envelope

JSON endpoints answer errors with an HTTP status and a single field:

```json
{ "error": "bad wallet" }
```

| Status | When |
|---|---|
| `400` | A path or query parameter failed validation (`bad address`, `bad wallet`) |
| `403` | The action is not open yet (uploads before the factory is live) |
| `404` | The coin, round or file does not exist |
| `413`, `415`, `422` | Upload too large, wrong type, or unreadable image |
| `429` | Rate limit reached (`Too many requests. Wait a minute.`) |
| `503` | The database or RPC is unavailable. `GET /api/board` still returns its full shape with empty values |

`GET /api/leaves/:vault/:round` and `GET /img/:file` serve files, so their errors are plain text (`bad request`, `not found`).

Planned endpoints will use the same `{ "error": string }` envelope.

## Rate limits

| Endpoint | Limit |
|---|---|
| `GET /api/claimable` | 60 requests per minute per IP |
| `POST /api/upload` | 30 uploads per hour per IP |
| All others | No application limit today. Poll no more than once every 15 seconds |

Limits are enforced in memory per server process. They protect the chain RPC behind the API and are not a security boundary. A `429` carries no `Retry-After` header; wait one full window.

---

## Live endpoints

### GET /api/health

**LIVE.** Indexer liveness.

**Response `200`**

```json
{
  "ok": true,
  "cursor": "4512877",
  "heartbeat": "2026-09-29T08:14:03.112Z"
}
```

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | `false` with status `503` when the database cannot be read |
| `cursor` | string or null | Last block the indexer processed |
| `heartbeat` | string or null | Last time the worker reported in |

---

### GET /api/board

**LIVE.** Every coin with its aggregates, pad-wide totals, and the latest rounds. Supersedes the blueprint's `GET /api/coins` and `GET /api/stats`.

**Response `200`**

```json
{
  "coins": [
    {
      "token": "0x...",
      "vault": "0x...",
      "curve": "0x...",
      "launcher": "0x...",
      "taxBps": 300,
      "name": "Example",
      "symbol": "EXMPL",
      "logo": "https://app.stealthpad.online/img/3f1c...e9.webp",
      "description": "",
      "website": "https://example.org",
      "social": "",
      "launchedAt": "2026-09-29T07:00:00.000Z",
      "graduated": false,
      "paidUsdg": 1485.12,
      "claimedUsdg": 920.4,
      "rounds": 14,
      "lastRoundAt": "2026-09-29T08:02:11.000Z",
      "holders": 212,
      "vol24Eth": 18.4,
      "priceEth": 0.0000000061,
      "isStealth": false
    }
  ],
  "stats": {
    "paidUsdg": 1485.12,
    "claimedUsdg": 920.4,
    "rounds": 14,
    "coins": 1,
    "keepers": 3,
    "vol24Eth": 18.4,
    "ethUsd": 2690.5
  },
  "latest": [
    { "vault": "0x...", "roundId": 14, "at": "2026-09-29T08:02:11.000Z", "usdg": 104.2, "symbol": "EXMPL", "token": "0x...", "holders": 187 }
  ]
}
```

`CoinCard`

| Field | Type | Description |
|---|---|---|
| `token`, `vault`, `curve`, `launcher` | address | The coin, its StealthVault, its Pons V2 curve, and the launching wallet |
| `taxBps` | number | Creator tax, one of 100 to 500 |
| `paidUsdg` | number | PAID TO HOLDERS: total USDG assigned to holders across all rounds |
| `claimedUsdg` | number | Total USDG holders have claimed |
| `rounds` | number | Rounds run |
| `holders` | number | Wallets with a positive balance, excluding curve, vault, token, pool manager, hook, zero and burn |
| `vol24Eth` | number | Trading volume over the last 24 hours |
| `priceEth` | number or null | Last trade price in ETH per token |
| `isStealth` | boolean | `true` for the $STEALTH coin |

`stats.paidUsdg` is the pad-wide PAID TO HOLDERS counter. `stats.ethUsd` is read from the same WETH/USDG pool rounds swap on.

**Response `503`**: `{ "coins": [], "stats": null, "latest": [], "error": "board unavailable" }`

---

### GET /api/coin/:token

**LIVE.** One coin with its rounds, chart trades, recent trades, top holders and claim totals. Supersedes the blueprint's `GET /api/coins/:token` and covers most of `GET /api/rounds/:vault`.

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `token` | path | address | Yes | The coin's token address |
| `probe` | query | `1` | No | Returns only `{ "indexed": boolean }`. Use it right after a launch while the indexer catches up |

**Response `200`**

```json
{
  "coin": { "token": "0x...", "vault": "0x...", "symbol": "EXMPL", "taxBps": 300, "paidUsdg": 1485.12, "...": "CoinCard fields" },
  "ethUsd": 2690.5,
  "rounds": [
    {
      "roundId": 14,
      "at": "2026-09-29T08:02:11.000Z",
      "block": "4512790",
      "tx": "0x...",
      "caller": "0x...",
      "ethBudget": 0.0421,
      "usdg": 104.2,
      "tip": 0.001263,
      "toStealth": 0.00105,
      "toTreasury": 0.00105,
      "holdersPaid": 187,
      "root": { "root": "0x...", "status": "pending", "activeAt": "2026-09-29T10:03:40.000Z" }
    }
  ],
  "trades": [ { "t": 1790668800, "price": 0.0000000061, "eth": 0.25, "side": "buy" } ],
  "recent": [ { "tx": "0x...", "side": "buy", "trader": "0x...", "eth": 0.25, "tokens": 40983606.5, "venue": "curve", "at": "2026-09-29T08:01:40.000Z" } ],
  "holders": [ { "holder": "0x...", "tokens": 12500000, "pct": 1.25, "lastShareUsdg": 1.31, "eligible": true, "launcher": false } ],
  "lastSnapshotRound": 13,
  "claims": { "count": 96, "usdg": 920.4 }
}
```

| Field | Description |
|---|---|
| `rounds[]` | Newest first, up to 200. `root.status` is `pending`, `active` or `vetoed`; a vetoed root is shown only when no other root exists for that round |
| `rounds[].holdersPaid` | Holders with a non-zero share, or `null` before the snapshot exists |
| `trades[]` | Up to 5,000 most recent trades, oldest first, for charting |
| `recent[]` | Last 40 trades, newest first |
| `holders[]` | Top 30 by balance. `eligible` is whether the last snapshot's average met the 100,000-token floor |

**Errors**: `400 bad address`, `404 not found`.

---

### GET /api/claimable

**LIVE.** Everything a wallet can claim, with Merkle proofs from the roots the vaults actually hold, the wallet's $STEALTH weight, and its claim history. Supersedes the blueprint's `GET /api/claimable/:wallet` and `GET /api/proof/:vault/:wallet`: proofs are included per vault.

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `wallet` | query | address | Yes | The holder's Robinhood Chain wallet |

**Request**

```bash
curl "https://app.stealthpad.online/api/claimable?wallet=0x1111111111111111111111111111111111111111"
```

**Response `200`**

```json
{
  "items": [
    {
      "token": "0x...",
      "vault": "0x...",
      "symbol": "EXMPL",
      "name": "Example",
      "logo": "https://app.stealthpad.online/img/3f1c...e9.webp",
      "active": {
        "roundId": 12,
        "cumulative": "8420115",
        "proof": ["0x...", "0x..."],
        "root": "0x..."
      },
      "pending": { "roundId": 14, "cumulative": "9750220", "activeAt": "2026-09-29T10:03:40.000Z" },
      "claimed": "5000000",
      "claimable": "3420115"
    }
  ],
  "stealthWeightPct": 0.061,
  "history": [
    { "tx": "0x...", "at": "2026-09-28T19:40:00.000Z", "usdg": 5, "fee": 0.01, "routed": true, "symbol": "EXMPL", "token": "0x..." }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `items[].active` | object or null | The leaf in the vault's active root. Pass `cumulative` and `proof` to `claim()` unchanged |
| `items[].pending` | object or null | A newer root still inside its 2-hour delay, with the time it becomes claimable |
| `items[].claimed` | raw string | `claimed(wallet)` read from the vault at request time |
| `items[].claimable` | raw string | `active.cumulative - claimed`, or `"0"` |
| `stealthWeightPct` | number or null | Time-weighted $STEALTH balance as a percentage of supply from the latest $STEALTH snapshot. Drives the route fee tier. `null` before $STEALTH exists |
| `history[]` | array | Last 50 claims. `routed` is `true` when the claim paid an address other than the holder's wallet. Destinations are not stored |

**Errors**: `400 bad wallet`, `429`, `503 claims unavailable`.

---

### GET /api/leaves/:vault/:round

**LIVE.** The attester's leaf file for one round, byte for byte what its hash commits to. Anyone can rebuild the Merkle tree from it and compare the root with the vault.

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `vault` | path | address | Yes | The StealthVault |
| `round` | path | integer | Yes | Round id, starting at 1 |

**Response headers**

| Header | Value |
|---|---|
| `content-type` | `application/json; charset=utf-8` |
| `x-leaf-hash` | `keccak256` of the UTF-8 bytes of the body |
| `cache-control` | `public, max-age=31536000, immutable` |
| `content-disposition` | `inline; filename="stealthpad-<vault>-round-<round>.json"` |

**Body**

```json
{
  "vault": "0x...",
  "roundId": 14,
  "windowFrom": "4509190",
  "windowTo": "4512790",
  "seed": "0x...",
  "samples": ["4509402", "4509877", "4510233", "4510519", "4510760", "4511004", "4511298", "4511630", "4511902", "4512145", "4512377", "4512651"],
  "eligibilityFloor": "100000000000000000000000",
  "distributable": "104233051",
  "distributed": "104232987",
  "carry": "64",
  "root": "0x...",
  "total": "1485120334",
  "leaves": [
    ["0xholder...", "8420115", "612004", "12500000000000000000000000"]
  ]
}
```

Each leaf is `[holder, cumulative, shareThisRound, averageBalance]`, all integers as strings. `seed` is the hash of the round's block; `samples` are the 12 blocks drawn from `(windowFrom, windowTo]`. The tree is the standard `(address, uint256)` Merkle tree over `[holder, cumulative]`.

**Errors**: `400 bad request`, `404 not found`.

---

### POST /api/upload

**LIVE (write, launch only).** Uploads a coin logo for the launch form. It is the only write endpoint and it touches no chain state.

| Rule | Value |
|---|---|
| Body | `multipart/form-data` with one field `file` |
| Types | `image/png`, `image/jpeg`, `image/webp`, `image/gif` |
| Size | 4 MB maximum |
| Processing | Decoded (40 megapixel ceiling), auto-rotated, cropped to 512 x 512, re-encoded as WebP. Nothing else about the upload is kept |
| Addressing | First 32 hex characters of the SHA-256 of the output |
| Availability | Only once the factory is live; `403` before |

**Response `200`**: `{ "url": "https://app.stealthpad.online/img/<hash>.webp" }`

**Errors**: `400 No image.`, `403`, `413`, `415`, `422`, `429`.

---

### GET /img/:file

**LIVE.** Serves an uploaded logo. `file` must match `^[0-9a-f]{32}\.webp$`. Headers: `content-type: image/webp`, immutable caching, `x-content-type-options: nosniff`.

---

## Planned endpoints

These come from the blueprint. They are not served yet. Today their data is available through the live endpoints noted beside each.

| Method and path | Status | Purpose | Available today through |
|---|---|---|---|
| `GET /api/coins` | SUPERSEDED | Board, filters, totals | `GET /api/board` |
| `GET /api/coins/:token` | SUPERSEDED | Coin, vault, rounds | `GET /api/coin/:token` |
| `GET /api/rounds/:vault` | PLANNED | Paginated rounds with roots, beyond the 200 in the coin view | `GET /api/coin/:token` (`rounds[]`) |
| `GET /api/claimable/:wallet` | SUPERSEDED | Per-coin claimable USDG | `GET /api/claimable?wallet=` |
| `GET /api/proof/:vault/:wallet` | PLANNED | One proof for one vault, for wallets and widgets | `GET /api/claimable?wallet=` (`items[].active.proof`) |
| `GET /api/keepers` | PLANNED | Keeper leaderboard: rounds, tips, coins, first-round badges, streaks | The Keeper page |
| `GET /api/stats` | PLANNED | PAID TO HOLDERS and pad totals, small and cacheable | `GET /api/board` (`stats`) |
| `GET /api/receipts` | PLANNED | Round receipts, newest first | The Receipts page |
| `POST /api/quote` | SUPERSEDED | Route quote for a claim | Holder's environment calls NEAR Intents directly |
| `GET /api/claim-status/:deposit` | SUPERSEDED | Route settlement status | Holder's environment calls NEAR Intents directly |

The two superseded route endpoints will not be built. Proxying them would put every payout destination on a Stealthpad server.

### Planned shape: GET /api/keepers

```json
{
  "keepers": [
    { "caller": "0x...", "rounds": 41, "tipsEth": 0.052, "coins": 9, "firsts": 3, "streak": 5, "lastAt": "2026-09-29T08:02:11.000Z" }
  ]
}
```

### Planned shape: GET /api/proof/:vault/:wallet

```json
{ "vault": "0x...", "holder": "0x...", "roundId": 12, "root": "0x...", "cumulative": "8420115", "proof": ["0x..."], "claimed": "5000000", "claimable": "3420115" }
```

---

## Route quoting outside this API

The TypeScript SDK in this repository calls NEAR Intents 1Click from the caller's own environment.

| Step | Call | Notes |
|---|---|---|
| Quote | `POST https://1click.chaindefuser.com/v0/quote` | `swapType: EXACT_INPUT`, `originAsset` = USDG on Robinhood Chain, `depositType` and `refundType` = `ORIGIN_CHAIN`, `refundTo` = the holder's wallet, `recipientType: DESTINATION_CHAIN`, 30-minute deadline. Request a `dry` quote first to show cost, then a live one for the deposit address |
| Claim | `claim(cumulative, proof, depositAddress, feeBps)` on the vault | Quote the exact net amount the vault will send: `claimable - floor(claimable * feeBps / 10000)` |
| Status | `GET https://1click.chaindefuser.com/v0/status?depositAddress=...` | `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `INCOMPLETE_DEPOSIT`, `PROCESSING`, `SUCCESS`, `REFUNDED`, `FAILED` |

Destination assets:

| Route | Asset id | Decimals | Address format | Minimum |
|---|---|---|---|---|
| USDG | none, claim to own wallet | 6 | holder's `0x` wallet | none |
| Zcash | `nep141:zec.omft.near` | 8 | transparent `t1...` / `t3...`, base58check | $5 |
| USDCx on Aleo | `nep141:aleo-usdcx.omft.near` | 6 | `aleo1...`, bech32m | $5 |
| USAD on Aleo | `nep141:aleo-usad.omft.near` | 6 | `aleo1...`, bech32m | $5 |

Origin asset: `nep141:hood-0x5fc5360d0400a0fd4f2af552add042d716f1d168.omft.near`.

---

## On-chain reads

Everything above can be checked against the contracts directly on Robinhood Chain (chain id 4663).

| Call | Contract | Returns |
|---|---|---|
| `vaultOf(token)` | StealthFactory | The coin's vault, or zero for a coin the factory did not launch |
| `claimed(holder)` | StealthVault | Cumulative USDG already claimed |
| `activeRoot()` / `pendingRoot()` | StealthVault | `(root, total, roundId, activeAt, seed)` |
| `roundReady()` / `nextRoundAt()` / `pendingEth()` | StealthVault | Whether `runRound()` would succeed, when, and with how much |
| `rounds(id)` | StealthVault | `(at, ethBudget, holdersUsdg, cumulativeHolders)` |
| `feeRouteIntact()` / `pendingOverride()` | StealthVault | Whether Pons still pays this vault, and any queued recipient change |

External addresses: Pons V2 LaunchFactory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, USDG `0x5fc5360d0400a0fd4f2af552add042d716f1d168`. The StealthFactory address is published on mainnet day.
