import { concat, encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

/** The leaf the vault verifies: keccak256(keccak256(abi.encode(holder, cumulative))). */
export function claimLeaf(holder: Address, cumulative: bigint | string): Hex {
  const inner = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holder, BigInt(cumulative)]));
  return keccak256(inner);
}

function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) < BigInt(b) ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

/** Checks a proof locally with sorted-pair hashing, the same rule as the vault's MerkleProof library. */
export function verifyClaimProof(root: Hex, holder: Address, cumulative: bigint | string, proof: readonly Hex[]): boolean {
  let node = claimLeaf(holder, cumulative);
  for (const p of proof) node = hashPair(node, p);
  return node.toLowerCase() === root.toLowerCase();
}
