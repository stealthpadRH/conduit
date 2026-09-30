import { createPublicClient, defineChain, http, type PublicClient } from "viem";
import { CHAIN_ID, DEFAULT_RPC_URL, EXPLORER_URL, MULTICALL3 } from "./constants.js";

/** Robinhood Chain (Arbitrum Orbit L2, ETH gas) as a viem chain. */
export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_RPC_URL] } },
  blockExplorers: { default: { name: "Etherscan", url: EXPLORER_URL } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/** A public client for Robinhood Chain. Pass your own RPC URL for production traffic. */
export function createRobinhoodClient(rpcUrl: string = DEFAULT_RPC_URL): PublicClient {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpcUrl, { timeout: 20_000, retryCount: 2 }),
    batch: { multicall: true },
  }) as PublicClient;
}
