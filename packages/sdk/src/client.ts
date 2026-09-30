import { keccak256, stringToBytes, type Address } from "viem";
import { DEFAULT_API_URL } from "./constants.js";
import { StealthpadApiError, StealthpadInputError } from "./errors.js";
import type { Board, ClaimableResponse, CoinDetail, Health, LeafFile } from "./types.js";

export interface ClientOptions {
  /** Defaults to https://app.stealthpad.online */
  baseUrl?: string;
  /** Custom fetch (tests, edge runtimes). Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. Default 20 000. */
  timeoutMs?: number;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function assertAddress(value: string, what: string): asserts value is Address {
  if (!ADDRESS.test(value)) throw new StealthpadInputError(`${what} must be 0x followed by 40 hex characters`);
}

/**
 * Client for the public, read-only Stealthpad API. No key, no session.
 * Every figure it returns can be checked against the vault contracts on Robinhood Chain.
 */
export class StealthpadClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions = {}) {
    this.base = (opts.baseUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    this.doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  private async request(path: string): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const res = await this.doFetch(`${this.base}${path}`, { headers: { accept: "application/json" }, signal: ac.signal });
      if (!res.ok) {
        const body = (await res.clone().json().catch(() => null)) as { error?: string } | null;
        const text = body?.error ?? (await res.text().catch(() => "")) ?? "";
        throw new StealthpadApiError(res.status, path, text || `HTTP ${res.status}`);
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  private async json<T>(path: string): Promise<T> {
    return (await (await this.request(path)).json()) as T;
  }

  /** Indexer liveness: last processed block and heartbeat. */
  health(): Promise<Health> {
    return this.json<Health>("/api/health");
  }

  /** Every coin with aggregates, pad-wide totals (PAID TO HOLDERS) and the latest rounds. */
  board(): Promise<Board> {
    return this.json<Board>("/api/board");
  }

  /** One coin: rounds with roots, trades, top holders, claim totals. */
  coin(token: string): Promise<CoinDetail> {
    assertAddress(token, "token");
    return this.json<CoinDetail>(`/api/coin/${token}`);
  }

  /** Whether the indexer has seen a just-launched coin yet. */
  async coinIndexed(token: string): Promise<boolean> {
    assertAddress(token, "token");
    return (await this.json<{ indexed: boolean }>(`/api/coin/${token}?probe=1`)).indexed;
  }

  /** Everything a wallet can claim, with Merkle proofs, its $STEALTH weight and its claim history. */
  claimable(wallet: string): Promise<ClaimableResponse> {
    assertAddress(wallet, "wallet");
    return this.json<ClaimableResponse>(`/api/claimable?wallet=${wallet}`);
  }

  /**
   * The attester's leaf file for one round. The body is checked against the `x-leaf-hash`
   * header (keccak256 of the UTF-8 bytes) before it is parsed.
   */
  async leafFile(vault: string, roundId: number): Promise<{ file: LeafFile; leafHash: `0x${string}`; raw: string }> {
    assertAddress(vault, "vault");
    if (!Number.isInteger(roundId) || roundId < 1) throw new StealthpadInputError("roundId must be a positive integer");
    const res = await this.request(`/api/leaves/${vault}/${roundId}`);
    const raw = await res.text();
    const leafHash = keccak256(stringToBytes(raw));
    const header = res.headers.get("x-leaf-hash");
    if (header && header.toLowerCase() !== leafHash) {
      throw new StealthpadApiError(502, `/api/leaves/${vault}/${roundId}`, "leaf file does not match its published hash");
    }
    return { file: JSON.parse(raw) as LeafFile, leafHash, raw };
  }
}
