/**
 * Stealthpad SDK, end to end:
 *   1. read the board and PAID TO HOLDERS
 *   2. list what a wallet can claim and check each proof locally
 *   3. build a USDG claim transaction
 *   4. price a Zcash route from this machine (dry quote, nothing is signed)
 *
 * Run: WALLET=0xYourWallet npm run example
 * Optional: ZEC_ADDRESS=t1... to price the Zcash route.
 */
import type { Address } from "viem";
import {
  StealthpadClient,
  buildClaimTxFromItem,
  claimSplit,
  destinationError,
  requestRouteQuote,
  tierFor,
  verifyClaimProof,
} from "@stealthpad/sdk";

const wallet = (process.env.WALLET ?? "") as Address;
const zecAddress = process.env.ZEC_ADDRESS ?? "";

const api = new StealthpadClient();

// 1. The board. Before the factory is deployed this is an empty list.
const board = await api.board();
console.log(`coins on the board: ${board.coins.length}`);
console.log(`PAID TO HOLDERS: $${(board.stats?.paidUsdg ?? 0).toFixed(2)}`);
for (const c of board.coins.slice(0, 5)) {
  console.log(`  $${c.symbol.padEnd(8)} tax ${c.taxBps / 100}%  paid $${c.paidUsdg.toFixed(2)}  rounds ${c.rounds}`);
}

if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
  console.log("set WALLET=0x... to see claimable balances");
  process.exit(0);
}

// 2. Claimable balances with proofs, verified locally against the root the API reports.
const { items, stealthWeightPct } = await api.claimable(wallet);
const tier = tierFor(stealthWeightPct);
console.log(`$STEALTH tier: ${tier.label} (route fee ${(tier.feeBps / 100).toFixed(2)}%)`);

for (const item of items) {
  const due = BigInt(item.claimable);
  const proofOk = item.active ? verifyClaimProof(item.active.root, wallet, item.active.cumulative, item.active.proof) : false;
  console.log(`  $${item.symbol}: claimable ${Number(due) / 1e6} USDG, proof ${proofOk ? "valid" : "n/a"}` +
    (item.pending ? `, next root claimable at ${item.pending.activeAt}` : ""));

  if (due === 0n || !proofOk) continue;

  // 3. USDG to the same wallet: fee 0, no route, no minimum.
  const tx = buildClaimTxFromItem(item, wallet, wallet, 0);
  console.log(`  claim tx to ${tx.to}, ${tx.data.length / 2 - 1} bytes of calldata`);

  // Send it with any viem wallet client on Robinhood Chain, for example in a browser:
  //   const wc = createWalletClient({ chain: robinhoodChain, transport: custom(window.ethereum) });
  //   await wc.sendTransaction({ ...tx, chain: robinhoodChain });

  // 4. Or price the Zcash route. The quote goes from here to NEAR Intents, never through Stealthpad.
  if (zecAddress) {
    const problem = destinationError("zec", zecAddress);
    if (problem) {
      console.log(`  ${problem}`);
      continue;
    }
    const { net, fee } = claimSplit(due, tier.feeBps);
    try {
      const q = await requestRouteQuote({ route: "zec", usdgUnits: net, destination: zecAddress, refundTo: wallet, dry: true });
      console.log(`  Zcash route: ${q.amountInFormatted} USDG -> ${q.amountOutFormatted} ZEC in about ${q.timeEstimate}s (route fee ${Number(fee) / 1e6} USDG)`);
      console.log("  ZEC lands at the transparent address; shield it in the wallet once it arrives.");
    } catch (e) {
      console.log(`  no Zcash quote: ${(e as Error).message}`);
    }
  }
}
