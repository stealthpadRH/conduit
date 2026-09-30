import { parseAbi } from "viem";

/** The StealthVault surface a client needs: claims, rounds and read-only views. */
export const vaultAbi = parseAbi([
  "function claim(uint256 cumulative, bytes32[] proof, address to, uint16 feeBps) returns (uint256 paid)",
  "function claimed(address holder) view returns (uint256 cumulative)",
  "function runRound() returns (uint64 roundId)",
  "function roundReady() view returns (bool)",
  "function nextRoundAt() view returns (uint256)",
  "function pendingEth() view returns (uint256 total)",
  "function roundCount() view returns (uint256)",
  "function rounds(uint256 roundId) view returns ((uint64 at, uint128 ethBudget, uint128 holdersUsdg, uint256 cumulativeHolders))",
  "function activeRoot() view returns ((bytes32 root, uint256 total, uint64 roundId, uint64 activeAt, bytes32 seed))",
  "function pendingRoot() view returns ((bytes32 root, uint256 total, uint64 roundId, uint64 activeAt, bytes32 seed))",
  "function unclaimed() view returns (uint256)",
  "function token() view returns (address)",
  "function taxBps() view returns (uint16)",
  "function feeRouteIntact() view returns (bool)",
  "function pendingOverride() view returns (address newRecipient, uint256 effectiveAt, uint256 expiresAt)",
  "event Claimed(address indexed holder, address indexed to, uint256 amount, uint256 fee, uint64 rootRound)",
  "event RoundRun(uint64 indexed roundId, address indexed caller, uint256 ethBudget, uint256 usdgToHolders, uint256 tip, uint256 toStealth, uint256 toTreasury)",
  "event RootPosted(uint64 indexed roundId, bytes32 root, uint256 total, bytes32 seed, uint64 activeAt)",
  "error BadProof()",
  "error BadRecipient()",
  "error FeeTooHigh()",
  "error NothingToClaim()",
  "error CoolingDown(uint256 availableAt)",
  "error BelowMinimum(uint256 budget)",
  "error SwapOutTooLow(uint256 out, uint256 minOut)",
]);

/** The StealthFactory views used to confirm that a coin is genuine. */
export const factoryAbi = parseAbi([
  "function vaultOf(address token) view returns (address vault)",
  "function isVault(address vault) view returns (bool)",
  "function attester() view returns (address)",
  "function guardian() view returns (address)",
  "function launchesOpen() view returns (bool)",
]);
