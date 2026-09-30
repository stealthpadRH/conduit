import { sha256 } from "viem";
import type { RouteId } from "./types.js";

/** USDG on Robinhood Chain, as NEAR Intents 1Click names it. Every route starts here. */
export const USDG_ASSET = "nep141:hood-0x5fc5360d0400a0fd4f2af552add042d716f1d168.omft.near";

export interface RouteInfo {
  id: RouteId;
  label: string;
  /** 1Click destination asset id, or null for USDG (claimed straight to the holder's wallet). */
  asset: string | null;
  decimals: number;
  lands: string;
  /** Minimum claim in USD equivalent. */
  minUsd: number;
}

/** Payout routes. Asset ids checked against 1Click GET /v0/tokens on 2026-09-28. Monero joins when listed. */
export const ROUTES: readonly RouteInfo[] = [
  { id: "usdg", label: "USDG", asset: null, decimals: 6, lands: "the same wallet on Robinhood Chain", minUsd: 0 },
  { id: "zec", label: "Zcash", asset: "nep141:zec.omft.near", decimals: 8, lands: "a Zcash transparent address; the holder shields it after it lands", minUsd: 5 },
  { id: "usdcx", label: "USDCx on Aleo", asset: "nep141:aleo-usdcx.omft.near", decimals: 6, lands: "an Aleo address", minUsd: 5 },
  { id: "usad", label: "USAD on Aleo", asset: "nep141:aleo-usad.omft.near", decimals: 6, lands: "an Aleo address", minUsd: 5 },
] as const;

export function route(id: RouteId): RouteInfo {
  const r = ROUTES.find((x) => x.id === id);
  if (!r) throw new Error(`unknown route ${id}`);
  return r;
}

/** What the landing looks like on the destination chain, said plainly before anyone signs. */
export const PRIVACY_NOTE: Record<RouteId, string> = {
  usdg: "USDG lands in the wallet that claims. Everything about it is public on Robinhood Chain.",
  zec: "Zcash lands at a transparent address, visible on the Zcash chain. Shield it in your wallet; from then on its moves are private.",
  usdcx: "Arrives as USDCx on Aleo. Move it with a private transfer from your Aleo wallet to make it private.",
  usad: "Arrives as USAD on Aleo. Move it with a private transfer from your Aleo wallet to make it private.",
};

// ── address checks: shape and checksum, so a typo is caught before any quote or signature ──

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}

/**
 * Zcash transparent address: base58check, 26 bytes, version 0x1CB8 (t1, key hash) or
 * 0x1CBD (t3, script hash), last 4 bytes = first 4 bytes of double SHA-256.
 */
export function isZcashTransparent(address: string): boolean {
  const b = base58Decode(address.trim());
  if (!b || b.length !== 26 || b[0] !== 0x1c || (b[1] !== 0xb8 && b[1] !== 0xbd)) return false;
  const sum = sha256(sha256(b.slice(0, 22), "bytes"), "bytes");
  return sum[0] === b[22] && sum[1] === b[23] && sum[2] === b[24] && sum[3] === b[25];
}

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32M_CONST = 0x2bc830a3;

/** Aleo address: bech32m with human-readable part "aleo", 63 characters, single case. */
export function isAleoAddress(address: string): boolean {
  const raw = address.trim();
  const a = raw.toLowerCase();
  if (raw !== a && raw !== raw.toUpperCase()) return false;
  if (a.length !== 63 || !a.startsWith("aleo1")) return false;
  const data = [...a.slice(5)].map((c) => BECH32.indexOf(c));
  if (data.some((d) => d < 0)) return false;
  const hrp = "aleo";
  const values = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31), ...data];
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) ^ v) >>> 0;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk = (chk ^ GEN[i]) >>> 0;
  }
  return chk === BECH32M_CONST;
}

/** A human-readable problem with a destination address, or null when it is valid for the route. */
export function destinationError(routeId: RouteId, address: string): string | null {
  const a = address.trim();
  if (routeId === "usdg") return null;
  if (!a) return "Enter the address the payout should land at.";
  if (routeId === "zec") {
    if (/^(u1|zs1|zc)/.test(a)) return "The route cannot deliver to shielded or unified addresses yet. Use the wallet's transparent address (t1...), then shield it when it lands.";
    if (!/^t[13]/.test(a) || a.length !== 35) return "Not a Zcash transparent address. It starts with t1 and is 35 characters long.";
    return isZcashTransparent(a) ? null : "That address fails its checksum. Copy it again from the wallet.";
  }
  if (!a.toLowerCase().startsWith("aleo1") || a.length !== 63) return "Not an Aleo address. It starts with aleo1 and is 63 characters long.";
  return isAleoAddress(a) ? null : "That address fails its checksum. Copy it again from the wallet.";
}

/** The recipient string 1Click expects: Zcash as typed, Aleo lowercased. */
export function normalizeDestination(routeId: RouteId, address: string): string {
  const a = address.trim();
  return routeId === "zec" ? a : a.toLowerCase();
}
