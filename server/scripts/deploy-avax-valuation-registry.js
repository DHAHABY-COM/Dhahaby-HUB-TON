import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import solc from 'solc';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';

dotenv.config();

const RPC_URL = process.env.AVAX_CCHAIN_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const PRIVATE_KEY = process.env.AVAX_PRIVATE_KEY;
const OWNER_ADDRESS = process.env.AVAX_VALUATION_OWNER;

if (!PRIVATE_KEY) {
  throw new Error('Missing AVAX_PRIVATE_KEY in .env');
}

const contractPath = path.resolve('contracts/ValuationRegistry.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'ValuationRegistry.sol': { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  const fatal = output.errors.filter((e) => e.severity === 'error');
  output.errors.forEach((e) => {
    console.log(`${e.severity.toUpperCase()}: ${e.formattedMessage}`);
  });
  if (fatal.length) {
    throw new Error('Solidity compilation failed');
  }
}

const compiled = output.contracts['ValuationRegistry.sol']['ValuationRegistry'];
const abi = compiled.abi;
const bytecode = compiled.evm.bytecode.object;

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

const owner = OWNER_ADDRESS || wallet.address;
const factory = new ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy(owner);

console.log('Deploying transaction hash:', contract.deploymentTransaction().hash);
await contract.waitForDeployment();

const address = await contract.getAddress();
const network = await provider.getNetwork();
console.log('ValuationRegistry deployed at:', address);
console.log('Owner:', owner);
console.log('Chain ID:', Number(network.chainId));

const artifactPath = path.resolve('build/ValuationRegistry.avax.json');
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(
  artifactPath,
  JSON.stringify({
    network: 'avax-c-chain',
    chainId: Number(network.chainId),
    address,
    abi
  }, null, 2)
);

console.log('Saved artifact:', artifactPath);
console.log(`Set AVAX_VALUATION_REGISTRY_ADDRESS=${address}`);
