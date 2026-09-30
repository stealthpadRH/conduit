import type { Address } from "viem";
import { StealthpadInputError } from "./errors.js";
import { destinationError, normalizeDestination, route, USDG_ASSET } from "./routes.js";
import type { RouteId } from "./types.js";

/**
 * NEAR Intents 1Click, called from the caller's own environment. Stealthpad's servers are not
 * involved: they never see or store a payout destination. Docs: docs.near-intents.org
 */
export const ONECLICK_BASE = "https://1click.chaindefuser.com/v0";

export interface RouteQuote {
  depositAddress?: Address;
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  amountInUsd?: string;
  amountOutUsd?: string;
  minAmountOut: string;
  /** Seconds. */
  timeEstimate: number;
  deadline?: string;
}

export type RouteStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export const TERMINAL_STATUSES: readonly RouteStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

export interface QuoteParams {
  route: Exclude<RouteId, "usdg">;
  /** Raw USDG (6 decimals) the vault will send: the claimable amount minus the route fee. */
  usdgUnits: bigint;
  /** Zcash transparent address or Aleo address. Validated (checksum included) before any request. */
  destination: string;
  /** The holder's own Robinhood Chain wallet. An expired, unfilled quote refunds USDG here. */
  refundTo: Address;
  /** true: price only, no deposit address. false: a live quote with a deposit address. */
  dry: boolean;
  /** Minutes until the quote expires. Default 30. */
  deadlineMinutes?: number;
  /** Slippage tolerance in basis points. Default 100. */
  slippageBps?: number;
  fetch?: typeof fetch;
}

/**
 * Requests a route quote for exactly `usdgUnits` of USDG delivered to `destination`.
 * Call it with `dry: true` to show the cost, then `dry: false` for the deposit address to claim to.
 */
export async function requestRouteQuote(p: QuoteParams): Promise<RouteQuote> {
  const info = route(p.route);
  const problem = destinationError(p.route, p.destination);
  if (problem) throw new StealthpadInputError(problem);
  if (p.usdgUnits <= 0n) throw new StealthpadInputError("usdgUnits must be positive");
  if (Number(p.usdgUnits) / 1e6 < info.minUsd) throw new StealthpadInputError(`The ${info.label} route needs at least $${info.minUsd}.`);

  const body = {
    dry: p.dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: p.slippageBps ?? 100,
    originAsset: USDG_ASSET,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: info.asset,
    amount: p.usdgUnits.toString(),
    refundTo: p.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: normalizeDestination(p.route, p.destination),
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + (p.deadlineMinutes ?? 30) * 60_000).toISOString(),
    referral: "stealthpad",
    quoteWaitingTimeMs: 3000,
  };

  const doFetch = p.fetch ?? globalThis.fetch.bind(globalThis);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await doFetch(`${ONECLICK_BASE}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const j = (await res.json().catch(() => ({}))) as { quote?: RouteQuote; message?: string };
    if (!res.ok || !j.quote) throw new Error(j.message || "No route for this amount right now. Try again in a moment.");
    if (!p.dry && !j.quote.depositAddress) throw new Error("The live quote returned no deposit address.");
    return j.quote;
  } finally {
    clearTimeout(timer);
  }
}

/** Settlement status for a deposit address, or null when 1Click does not know it yet. */
export async function routeStatus(depositAddress: string, opts: { fetch?: typeof fetch } = {}): Promise<RouteStatus | null> {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const res = await doFetch(`${ONECLICK_BASE}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("status unavailable");
  return ((await res.json()) as { status: RouteStatus }).status;
}

/** Polls until the route settles (SUCCESS, REFUNDED or FAILED) or `timeoutMs` passes. */
export async function waitForRoute(
  depositAddress: string,
  opts: { intervalMs?: number; timeoutMs?: number; onStatus?: (s: RouteStatus | null) => void; fetch?: typeof fetch } = {},
): Promise<RouteStatus | null> {
  const until = Date.now() + (opts.timeoutMs ?? 20 * 60_000);
  let last: RouteStatus | null = null;
  while (Date.now() < until) {
    last = await routeStatus(depositAddress, { fetch: opts.fetch }).catch(() => last);
    opts.onStatus?.(last);
    if (last && TERMINAL_STATUSES.includes(last)) return last;
    await new Promise((r) => setTimeout(r, opts.intervalMs ?? 5_000));
  }
  return last;
}
