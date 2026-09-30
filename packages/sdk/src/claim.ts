import { encodeFunctionData, getAddress, zeroAddress, type Address, type Hex } from "viem";
import { vaultAbi } from "./abi.js";
import { VAULT } from "./constants.js";
import { StealthpadInputError } from "./errors.js";
import type { Claimable } from "./types.js";

export interface ClaimTxParams {
  /** The coin's StealthVault. Confirm it with StealthFactory.vaultOf(token) before signing. */
  vault: Address;
  /** The holder. The vault verifies the leaf for msg.sender, so this must be the signing account. */
  account: Address;
  /** Raw USDG cumulative from the active leaf, unchanged. */
  cumulative: bigint | string;
  proof: readonly Hex[];
  /** The holder's own wallet (USDG route) or the deposit address of the holder's own route quote. */
  to: Address;
  /** Route fee in basis points: 0 for USDG, at most 20 (the vault's MAX_ROUTE_FEE_BPS). */
  feeBps: number;
}

export interface ClaimTx {
  account: Address;
  to: Address;
  data: Hex;
  value: 0n;
}

/**
 * Encodes `claim(cumulative, proof, to, feeBps)` for a StealthVault. The result can be passed to
 * viem's `walletClient.sendTransaction` or to any EIP-1193 wallet. Nothing is signed here.
 */
export function buildClaimTx(p: ClaimTxParams): ClaimTx {
  if (!Number.isInteger(p.feeBps) || p.feeBps < 0 || p.feeBps > VAULT.MAX_ROUTE_FEE_BPS) {
    throw new StealthpadInputError(`feeBps must be an integer from 0 to ${VAULT.MAX_ROUTE_FEE_BPS}`);
  }
  const to = getAddress(p.to);
  const vault = getAddress(p.vault);
  if (to === zeroAddress || to === vault) throw new StealthpadInputError("to cannot be the zero address or the vault");
  const cumulative = BigInt(p.cumulative);
  if (cumulative <= 0n) throw new StealthpadInputError("cumulative must be positive");

  return {
    account: getAddress(p.account),
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "claim", args: [cumulative, [...p.proof], to, p.feeBps] }),
    value: 0n,
  };
}

/** Builds the claim straight from an API `Claimable` item. Throws when nothing is claimable yet. */
export function buildClaimTxFromItem(item: Claimable, account: Address, to: Address, feeBps: number): ClaimTx {
  if (!item.active || BigInt(item.claimable) <= 0n) throw new StealthpadInputError(`Nothing claimable on ${item.symbol} yet.`);
  return buildClaimTx({ vault: item.vault, account, cumulative: item.active.cumulative, proof: item.active.proof, to, feeBps });
}

/**
 * What a claim pays, computed exactly as the vault does: fee = floor(due * feeBps / 10000).
 * Request route quotes for `net`, so the deposit matches the quote to the unit.
 */
export function claimSplit(dueRaw: bigint | string, feeBps: number): { due: bigint; fee: bigint; net: bigint } {
  const due = BigInt(dueRaw);
  const fee = (due * BigInt(feeBps)) / 10_000n;
  return { due, fee, net: due - fee };
}
