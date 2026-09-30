<div align="center">

# Stealthpad Conduit

**Read API reference and TypeScript SDK for Stealthpad on Robinhood Chain.**

Read the board, fetch claimable balances with Merkle proofs, verify them locally, build the `claim()` transaction, and price Zcash or Aleo payout routes from your own environment.

[![API](https://img.shields.io/badge/read%20API-public%2C%20no%20key-34B27B?style=flat-square)](./ENDPOINTS.md)
[![SDK](https://img.shields.io/badge/sdk-TypeScript-299867?style=flat-square)](./packages/sdk)
[![viem](https://img.shields.io/badge/viem-2.x-77D6A8?style=flat-square)](https://viem.sh)
[![Chain](https://img.shields.io/badge/Robinhood%20Chain-4663-05110F?style=flat-square)](https://stealthpad.online)

</div>

---

## What is in here

| Path | Contents |
|---|---|
| [ENDPOINTS.md](./ENDPOINTS.md) | Every read API endpoint: live today vs planned, parameters, response shapes, error envelope, rate limits |
| [packages/sdk](./packages/sdk) | `@stealthpad/sdk`: typed API client, claim builder, route quotes, address validators |
| [examples/basic-usage.ts](./examples/basic-usage.ts) | Board, claimables, local proof check, USDG claim, dry Zcash quote |

## Authentication

None. The read API is public and read-only: no API key, no cookie, no session. It serves only what the indexer and attester derived from public chain data.

| Endpoint | Limit |
|---|---|
| `GET /api/claimable` | 60 requests per minute per IP |
| `POST /api/upload` | 30 per hour per IP (launch form only) |
| Everything else | No application limit today; poll at most every 15 seconds |

A `429` means wait one full window. Details in [ENDPOINTS.md](./ENDPOINTS.md#rate-limits).

> **Pre-launch.** The app at `app.stealthpad.online` runs against Robinhood Chain mainnet, but the StealthFactory is not deployed yet, so the board is empty until mainnet day.

## Quick start

```bash
git clone https://github.com/stealthpadRH/stealthpad-conduit.git
cd stealthpad-conduit
npm install
npm run typecheck
WALLET=0xYourWallet npm run example
```

### Read the board

```ts
import { StealthpadClient } from "@stealthpad/sdk";

const api = new StealthpadClient(); // https://app.stealthpad.online
const { coins, stats } = await api.board();
console.log(`PAID TO HOLDERS: $${stats?.paidUsdg ?? 0}`);
```

### Claim USDG to the same wallet

```ts
import { buildClaimTxFromItem, robinhoodChain, verifyClaimProof } from "@stealthpad/sdk";

const { items } = await api.claimable(wallet);
const item = items.find((i) => BigInt(i.claimable) > 0n && i.active)!;

// the proof is checked locally against the root before anything is signed
if (!verifyClaimProof(item.active!.root, wallet, item.active!.cumulative, item.active!.proof)) throw new Error("proof mismatch");

const tx = buildClaimTxFromItem(item, wallet, wallet, 0); // USDG: fee 0
await walletClient.sendTransaction({ ...tx, chain: robinhoodChain });
```

### Claim to Zcash

```ts
import { claimSplit, destinationError, requestRouteQuote, buildClaimTxFromItem, tierFor } from "@stealthpad/sdk";

const problem = destinationError("zec", "t1...");        // base58check, checksum included
const { net } = claimSplit(item.claimable, tierFor(weightPct).feeBps);

const dry = await requestRouteQuote({ route: "zec", usdgUnits: net, destination: "t1...", refundTo: wallet, dry: true });
const live = await requestRouteQuote({ route: "zec", usdgUnits: net, destination: "t1...", refundTo: wallet, dry: false });

const tx = buildClaimTxFromItem(item, wallet, live.depositAddress!, tierFor(weightPct).feeBps);
```

The quote request goes from your environment to NEAR Intents 1Click directly. A Stealthpad server never sees the destination. Zcash lands at the transparent address; the holder shields it in the wallet after it arrives. If a quote expires unfilled, NEAR Intents refunds the USDG to `refundTo`.

## SDK surface

| Export | Purpose |
|---|---|
| `StealthpadClient` | `health()`, `board()`, `coin(token)`, `coinIndexed(token)`, `claimable(wallet)`, `leafFile(vault, round)` (checked against `x-leaf-hash`) |
| `buildClaimTx`, `buildClaimTxFromItem` | Encode `claim(cumulative, proof, to, feeBps)`; reject `feeBps > 20`, zero or vault recipient |
| `claimSplit` | `fee = floor(due * feeBps / 10000)`, exactly as the vault computes it |
| `verifyClaimProof`, `claimLeaf` | Sorted-pair Merkle verification of `(holder, cumulative)` leaves |
| `requestRouteQuote`, `routeStatus`, `waitForRoute` | NEAR Intents 1Click quote and settlement status |
| `isZcashTransparent`, `isAleoAddress`, `destinationError` | Checksum validation: base58check for `t1`/`t3`, bech32m for `aleo1` |
| `ROUTES`, `TIERS`, `tierFor`, `VAULT` | Route assets, $STEALTH fee tiers, vault constants |
| `robinhoodChain`, `createRobinhoodClient`, `vaultAbi`, `factoryAbi` | viem chain definition and ABIs for on-chain reads |

## Safety notes for integrators

- Confirm a vault with `StealthFactory.vaultOf(token)` before building a claim. The factory address is published on mainnet day through official channels.
- A claim needs no token approval and no off-chain signature. Anything asking for either is not Stealthpad.
- Never send a route destination to your own backend unless you must. The SDK is written so you do not have to.

## Related

| Repository | Contents |
|---|---|
| [stealthpad-foundry](../stealthpad-foundry) | StealthFactory and StealthVault contracts |
| [stealthpad-warden](../stealthpad-warden) | Indexer, attester, keeper, verifier that feed this API |
| [stealthpad-console](../stealthpad-console) | The app that serves this API |
| [stealthpad-dossier](../stealthpad-dossier) | Thesis, threat model, privacy scope |

---

<div align="center">
<sub>MIT licensed. Stealthpad is experimental software on public blockchains. Payouts depend on trading volume, which can fall to zero. Nothing here is investment, legal or tax advice. Stealthpad is independent and is not affiliated with Robinhood, Pons, NEAR, or the Zcash and Aleo foundations.</sub>
</div>
