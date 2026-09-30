import type { Address } from "viem";
import type { Tier } from "./types.js";

/** Robinhood Chain mainnet. */
export const CHAIN_ID = 4663;
export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = "https://robin.etherscan.io";
export const DEFAULT_API_URL = "https://app.stealthpad.online";

/** External contracts on Robinhood Chain. The StealthFactory address is published on mainnet day. */
export const PONS_V2_LAUNCH_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address;
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

/** StealthVault constants, mirrored for display and pre-flight checks. The contract is the source of truth. */
export const VAULT = {
  HOLDERS_BPS: 9200,
  CALLER_BPS: 300,
  STEALTH_BPS: 250,
  TREASURY_BPS: 250,
  MIN_ROUND_WEI: 20_000_000_000_000_000n, // 0.02 ETH
  COOLDOWN_S: 3600,
  ROOT_DELAY_S: 7200,
  MAX_ROUTE_FEE_BPS: 20,
  IMPACT_CAP_BPS: 100,
  SLIPPAGE_BPS: 150,
} as const;

export const ATTESTER_DELAY_S = 2 * 24 * 3600;
export const SUPPLY = 1_000_000_000;
/** Average balance a holder needs across the 12 sampled blocks to share in a round. */
export const ELIGIBILITY_FLOOR_TOKENS = 100_000;
export const SNAPSHOT_SAMPLES = 12;
export const USDG_DECIMALS = 6;

/** $STEALTH route fee tiers, measured on the same time-weighted snapshot as rounds. */
export const TIERS: readonly Tier[] = [
  { id: "visitor", label: "Visitor", minPct: 0, feeBps: 20 },
  { id: "holder", label: "Holder", minPct: 0.05, feeBps: 10 },
  { id: "keeper", label: "Keeper-plus", minPct: 0.2, feeBps: 0 },
  { id: "core", label: "Core", minPct: 1, feeBps: 0 },
] as const;

/** The tier for a $STEALTH weight (percent of supply). `null` weight is treated as zero. */
export function tierFor(weightPct: number | null): Tier {
  const w = weightPct ?? 0;
  return [...TIERS].reverse().find((t) => w >= t.minPct) ?? TIERS[0];
}
