import type { Address, Hex } from "viem";

/** One coin on the board, with its round, claim, volume and holder aggregates. */
export interface CoinCard {
  token: Address;
  vault: Address;
  curve: Address;
  launcher: Address;
  /** Creator tax in basis points: 100, 200, 300, 400 or 500. Fixed for the life of the coin. */
  taxBps: number;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  website: string;
  social: string;
  launchedAt: string;
  graduated: boolean;
  /** PAID TO HOLDERS: USDG assigned to holders across all rounds. */
  paidUsdg: number;
  claimedUsdg: number;
  rounds: number;
  lastRoundAt: string | null;
  holders: number;
  vol24Eth: number;
  priceEth: number | null;
  isStealth: boolean;
}

export interface BoardStats {
  paidUsdg: number;
  claimedUsdg: number;
  rounds: number;
  coins: number;
  keepers: number;
  vol24Eth: number;
  ethUsd: number;
}

export interface LatestRound {
  vault: Address;
  roundId: number;
  at: string;
  usdg: number;
  symbol: string;
  token: Address;
  holders: number;
}

export interface Board {
  coins: CoinCard[];
  stats: BoardStats | null;
  latest: LatestRound[];
}

export type RootStatus = "pending" | "active" | "vetoed";

export interface RoundRow {
  roundId: number;
  at: string;
  block: string;
  tx: Hex;
  caller: Address;
  ethBudget: number;
  usdg: number;
  tip: number;
  toStealth: number;
  toTreasury: number;
  holdersPaid: number | null;
  root: { root: Hex; status: RootStatus; activeAt: string } | null;
}

export interface TradePoint {
  t: number;
  price: number;
  eth: number;
  side: "buy" | "sell";
}

export interface TradeRow {
  tx: Hex;
  side: "buy" | "sell";
  trader: Address;
  eth: number;
  tokens: number;
  venue: string;
  at: string;
}

export interface HolderRow {
  holder: Address;
  tokens: number;
  pct: number;
  lastShareUsdg: number | null;
  eligible: boolean | null;
  launcher: boolean;
}

export interface CoinDetail {
  coin: CoinCard;
  ethUsd: number;
  rounds: RoundRow[];
  trades: TradePoint[];
  recent: TradeRow[];
  holders: HolderRow[];
  lastSnapshotRound: number | null;
  claims: { count: number; usdg: number };
}

/** A leaf in a vault's active root, ready to pass to `claim()` unchanged. */
export interface ActiveLeaf {
  roundId: number;
  /** Raw USDG (6 decimals) assigned to the holder across all rounds to date. */
  cumulative: string;
  proof: Hex[];
  root: Hex;
}

export interface PendingLeaf {
  roundId: number;
  cumulative: string;
  /** When the root leaves its 2-hour delay and claims may use it. */
  activeAt: string;
}

export interface Claimable {
  token: Address;
  vault: Address;
  symbol: string;
  name: string;
  logo: string;
  active: ActiveLeaf | null;
  pending: PendingLeaf | null;
  /** Raw USDG already claimed, read from the vault at request time. */
  claimed: string;
  /** Raw USDG claimable now: active.cumulative minus claimed. */
  claimable: string;
}

export interface ClaimHistoryRow {
  tx: Hex;
  at: string;
  usdg: number;
  fee: number;
  /** True when the claim paid an address other than the holder's wallet. Destinations are not stored. */
  routed: boolean;
  symbol: string;
  token: Address;
}

export interface ClaimableResponse {
  items: Claimable[];
  /** Time-weighted $STEALTH balance as % of supply, or null before $STEALTH exists. */
  stealthWeightPct: number | null;
  history: ClaimHistoryRow[];
}

/** Leaf as published: [holder, cumulative, shareThisRound, averageBalance], integers as strings. */
export type LeafTuple = [holder: Address, cumulative: string, share: string, averageBalance: string];

export interface LeafFile {
  vault: Address;
  roundId: number;
  windowFrom: string;
  windowTo: string;
  seed: Hex;
  samples: string[];
  eligibilityFloor: string;
  distributable: string;
  distributed: string;
  carry: string;
  root: Hex;
  total: string;
  leaves: LeafTuple[];
}

export interface Health {
  ok: boolean;
  cursor?: string | null;
  heartbeat?: string | null;
}

export type RouteId = "usdg" | "zec" | "usdcx" | "usad";

export interface Tier {
  id: "visitor" | "holder" | "keeper" | "core";
  label: string;
  /** Minimum time-weighted share of $STEALTH supply, in percent. */
  minPct: number;
  /** Route fee applied on Zcash and Aleo claims. */
  feeBps: number;
}
