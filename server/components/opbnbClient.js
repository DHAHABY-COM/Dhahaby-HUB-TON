import dotenv from 'dotenv';
import { createHash } from 'crypto';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';

dotenv.config();

const DEFAULT_RPC = 'https://opbnb-testnet-rpc.bnbchain.org';

const registryAbi = [
  'function recordValuation(address user, bytes32 valuationHash, uint256 amountMinor, string currency, uint256 confidenceBps, string reportUri) external returns (uint256)',
  'event ValuationRecorded(uint256 indexed id, address indexed user, bytes32 indexed valuationHash, uint256 amountMinor, uint256 confidenceBps, string currency, string reportUri, uint64 createdAt)'
];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',');

  return `{${body}}`;
}

function computeValuationHash(valuationObject) {
  const canonical = stableStringify(valuationObject);
  return `0x${createHash('sha256').update(canonical).digest('hex')}`;
}

function getContract() {
  const rpcUrl = process.env.OPBNB_RPC_URL || DEFAULT_RPC;
  const privateKey = process.env.OPBNB_PRIVATE_KEY;
  const address = process.env.OPBNB_VALUATION_REGISTRY_ADDRESS;

  if (!privateKey) {
    throw new Error('Missing OPBNB_PRIVATE_KEY');
  }
  if (!address) {
    throw new Error('Missing OPBNB_VALUATION_REGISTRY_ADDRESS');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(address, registryAbi, wallet);

  return { contract, address };
}

export async function recordValuationOnOpBnb({ walletAddress, valuationObject, reportUri = '' }) {
  const { contract, address } = getContract();

  const valuationHash = computeValuationHash(valuationObject);

  const currency = String(valuationObject?.currency || 'USD').toUpperCase();
  const rawValue = Number(valuationObject?.totalValue || 0);
  const amountMinor = Number.isFinite(rawValue) ? BigInt(Math.max(0, Math.round(rawValue * 100))) : 0n;

  const rawConfidence = Number(valuationObject?.classification?.confidence ?? valuationObject?.confidence ?? 0);
  const boundedConfidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;
  const confidenceBps = BigInt(Math.round(boundedConfidence * 10000));

  const tx = await contract.recordValuation(
    walletAddress,
    valuationHash,
    amountMinor,
    currency,
    confidenceBps,
    reportUri
  );

  const receipt = await tx.wait();

  let recordId = null;
  if (receipt?.logs?.length) {
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'ValuationRecorded') {
          recordId = parsed.args?.id?.toString() ?? null;
          break;
        }
      } catch (_err) {
        // ignore non-matching logs
      }
    }
  }

  return {
    txHash: tx.hash,
    recordId,
    contractAddress: address,
    valuationHash,
    amountMinor: amountMinor.toString(),
    currency,
    confidenceBps: confidenceBps.toString(),
    reportUri
  };
}
